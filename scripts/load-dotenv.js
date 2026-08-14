/**
 * Load `.env` into process.env without overriding values already set
 * (Cloud Run / compose / `docker run -e` win). Used by Docker build + prod-runner.
 */
const fs = require("fs")
const path = require("path")

function applyEnvFile(file) {
  if (!fs.existsSync(file)) return false
  const text = fs.readFileSync(file, "utf8")
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const cleaned = line.replace(/^export\s+/, "")
    const eq = cleaned.indexOf("=")
    if (eq <= 0) continue
    const key = cleaned.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = cleaned.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value
    }
  }
  return true
}

function loadDotenv() {
  const roots = [path.resolve(__dirname, ".."), process.cwd(), "/app", "/home/user"]
  let loaded = false
  for (const root of roots) {
    loaded = applyEnvFile(path.join(root, ".env")) || loaded
  }
  return loaded
}

loadDotenv()

const args = process.argv.slice(2)
if (args.length > 0) {
  const { spawn } = require("child_process")
  const child = spawn(args[0], args.slice(1), {
    stdio: "inherit",
    env: process.env,
  })
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    process.exit(code ?? 1)
  })
}

module.exports = { applyEnvFile, loadDotenv }
