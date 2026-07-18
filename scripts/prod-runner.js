#!/usr/bin/env node

/**
 * 🚀 Advan AI Production Process Supervisor (Zero-Dependency)
 * 
 * Manages multiple background services within a single container in production.
 * Monitors, logs, and restarts crashed processes. Traps system termination
 * signals and guarantees clean, graceful shutdowns.
 * 
 * Features:
 *   - Service prefixing and colorized output.
 *   - Crash loop protection with max restarter threshold.
 *   - Graceful forwarding of SIGTERM/SIGINT.
 */

const { spawn } = require("child_process");
const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..");

const SERVICES = [
  {
    name: "next-web",
    command: "node",
    args: ["server.js"], // Next.js standalone entrypoint
    enabled: process.env.SKIP_WEB !== "1",
  },
  {
    name: "socket-server",
    command: "npx",
    args: ["tsx", "lib/realtime/socket-server.ts"],
    enabled: process.env.SKIP_SOCKET !== "1" && process.env.NEXT_PUBLIC_SOCKET_URL?.includes("3002"),
  },
  {
    name: "queue-workers",
    command: "npx",
    args: ["tsx", "lib/queue/worker-entrypoint.ts"],
    enabled: process.env.SKIP_QUEUES !== "1" && !!process.env.REDIS_URL,
  },
  {
    name: "temporal-worker",
    command: "npx",
    args: ["tsx", "lib/temporal/worker.ts"],
    enabled: process.env.SKIP_TEMPORAL !== "1" && !!process.env.TEMPORAL_ADDRESS,
  }
];

const activeProcesses = new Map();
let isShuttingDown = false;

// ANSI Terminal Colors for pretty logs
const COLORS = {
  reset: "\x1b[0m",
  "next-web": "\x1b[36m",       // Cyan
  "socket-server": "\x1b[35m",  // Magenta
  "queue-workers": "\x1b[32m",  // Green
  "temporal-worker": "\x1b[33m" // Yellow
};

function log(serviceName, message) {
  const color = COLORS[serviceName] || COLORS.reset;
  const timestamp = new Date().toISOString();
  console.log(`${color}[${serviceName}] [${timestamp}]${COLORS.reset} ${message}`);
}

function startService(service) {
  if (isShuttingDown) return;

  log(service.name, `Starting service: ${service.command} ${service.args.join(" ")}...`);

  const child = spawn(service.command, service.args, {
    cwd: ROOT_DIR,
    env: { ...process.env, PORT: process.env.PORT || "3000" },
    shell: true,
  });

  child.stdout.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => log(service.name, line));
  });

  child.stderr.on("data", (data) => {
    const lines = data.toString().trim().split("\n");
    lines.forEach((line) => log(service.name, `⚠️ STDERR: ${line}`));
  });

  child.on("close", (code) => {
    activeProcesses.delete(service.name);
    
    if (isShuttingDown) {
      log(service.name, `Terminated with exit code ${code}.`);
      return;
    }

    log(service.name, `CRASHED: Stopped unexpectedly with exit code ${code}.`);
    
    // Check restart limit to protect against infinite crash loops
    service.restarts = (service.restarts || 0) + 1;
    if (service.restarts > 5) {
      log(service.name, "❌ Critical: Service exceeded maximum restarts (5 times). Shutting down supervisor.");
      shutdown(1);
    } else {
      const backoff = Math.min(1000 * service.restarts, 10000);
      log(service.name, `Attempting restart in ${backoff / 1000}s...`);
      setTimeout(() => startService(service), backoff);
    }
  });

  activeProcesses.set(service.name, child);
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log("\n======================================================================");
  console.log("🛑 SUPERVISOR SHUTDOWN SIGNAL RECEIVED. STOPPING ALL SERVICES GRACEFULLY.");
  console.log("======================================================================\n");

  const terminationPromises = [];

  for (const [name, child] of activeProcesses.entries()) {
    log(name, "Sending SIGTERM to child process...");
    child.kill("SIGTERM");

    const terminationPromise = new Promise((resolve) => {
      const forceTimeout = setTimeout(() => {
        log(name, "⏳ Process did not exit in time. Escalate to SIGKILL.");
        child.kill("SIGKILL");
        resolve();
      }, 5000);

      child.on("close", () => {
        clearTimeout(forceTimeout);
        resolve();
      });
    });

    terminationPromises.push(terminationPromise);
  }

  Promise.all(terminationPromises).then(() => {
    console.log("\n======================================================================");
    console.log(`✓ All services terminated. Supervisor exiting with code ${exitCode}.`);
    console.log("======================================================================\n");
    process.exit(exitCode);
  });
}

// Trap system signals
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

// Start all enabled services
console.log("======================================================================");
console.log("🌐 ADVAN AI PRODUCTION PROCESS SUPERVISOR INITIATED");
console.log("======================================================================\n");

const enabledServices = SERVICES.filter((s) => s.enabled);
if (enabledServices.length === 0) {
  console.error("❌ Error: No services enabled or configured to run. Exiting.");
  process.exit(1);
}

enabledServices.forEach((service) => {
  service.restarts = 0;
  startService(service);
});
