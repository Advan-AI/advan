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

if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = "redis://127.0.0.1:6379";
}

const SERVICES = [
  {
    name: "redis-server",
    command: "redis-server",
    args: ["--port", "6379", "--bind", "127.0.0.1", "--protected-mode", "no", "--save", "", "--appendonly", "no"],
    enabled: process.env.SKIP_REDIS_SERVER !== "1",
    critical: false,
  },
  {
    name: "next-web",
    command: "node",
    args: ["server.js"], // Next.js standalone entrypoint
    enabled: process.env.SKIP_WEB !== "1",
    critical: true,
  },
  {
    name: "socket-server",
    command: "npx",
    args: ["tsx", "lib/realtime/socket-server.ts"],
    enabled: process.env.SKIP_SOCKET !== "1",
    critical: false,
  },
  {
    name: "queue-workers",
    command: "npx",
    args: ["tsx", "lib/queue/worker-entrypoint.ts"],
    enabled: process.env.SKIP_QUEUES !== "1",
    critical: false,
  },
  {
    name: "temporal-worker",
    command: "npx",
    args: ["tsx", "lib/temporal/worker.ts"],
    enabled: process.env.SKIP_TEMPORAL !== "1" && !!process.env.TEMPORAL_ADDRESS,
    critical: false,
  }
];

const activeProcesses = new Map();
let isShuttingDown = false;

// ANSI Terminal Colors for pretty logs
const COLORS = {
  reset: "\x1b[0m",
  "redis-server": "\x1b[31m",   // Red
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

  const internalPort = service.name === "next-web" ? "3001" : (process.env.PORT || "3000");

  const child = spawn(service.command, service.args, {
    cwd: ROOT_DIR,
    env: { ...process.env, PORT: internalPort },
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
      if (service.critical) {
        log(service.name, "❌ Critical: Service exceeded maximum restarts (5 times). Shutting down supervisor.");
        shutdown(1);
      } else {
        log(service.name, "⚠️ Warning: Non-critical service exceeded maximum restarts (5 times). Suspending auto-restarts for this service, but keeping supervisor active.");
      }
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

// ── Unified Routing Proxy ───────────────────────────────────────────────────
// Google Cloud Run only exposes a single public port. This zero-dependency
// reverse proxy receives all traffic on the main container port and routes it:
//   - Paths starting with "/socket.io/" -> Standalone Socket.IO (Port 3002)
//   - All other paths                    -> Standalone Next.js (Port 3001)
if (process.env.SKIP_WEB !== "1") {
  const http = require("http");
  const net = require("net");

  const PUBLIC_PORT = parseInt(process.env.PORT || "3000", 10);
  const NEXT_PORT = 3001;
  const SOCKET_PORT = 3002;

  const server = http.createServer((req, res) => {
    const isSocket = req.url.startsWith("/socket.io/");
    const targetPort = isSocket ? SOCKET_PORT : NEXT_PORT;

    const connector = http.request({
      hostname: "127.0.0.1",
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    }, (targetRes) => {
      res.writeHead(targetRes.statusCode, targetRes.headers);
      targetRes.pipe(res);
    });

    req.pipe(connector);

    connector.on("error", (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end(`Proxy Error: Connection refused to internal port ${targetPort}`);
      }
    });
  });

  server.on("upgrade", (req, socket, head) => {
    const isSocket = req.url.startsWith("/socket.io/");
    const targetPort = isSocket ? SOCKET_PORT : NEXT_PORT;

    const targetSocket = net.connect(targetPort, "127.0.0.1", () => {
      targetSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
      for (const [key, value] of Object.entries(req.headers)) {
        targetSocket.write(`${key}: ${value}\r\n`);
      }
      targetSocket.write("\r\n");
      targetSocket.write(head);
      socket.pipe(targetSocket).pipe(socket);
    });

    targetSocket.on("error", (err) => {
      socket.destroy();
    });
  });

  server.listen(PUBLIC_PORT, "0.0.0.0", () => {
    console.log(`[Supervisor Proxy] Exposing unified routing on public port ${PUBLIC_PORT} -> Next.js (${NEXT_PORT}) & Socket.IO (${SOCKET_PORT})`);
  });
}

