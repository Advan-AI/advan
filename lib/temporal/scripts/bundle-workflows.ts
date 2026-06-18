/**
 * Pre-builds workflow code for production workers.
 * Run: npm run temporal:bundle
 */
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { bundleWorkflowCode } from "@temporalio/worker"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main(): Promise<void> {
  const workflowsPath = path.join(__dirname, "../workflows/workflows-entry.ts")
  const outDir = path.join(__dirname, "../dist")
  const outFile = path.join(outDir, "workflow-bundle.js")

  await fs.mkdir(outDir, { recursive: true })

  const { code } = await bundleWorkflowCode({ workflowsPath })
  await fs.writeFile(outFile, code, "utf8")

  // eslint-disable-next-line no-console
  console.log(`[temporal:bundle] Wrote workflow bundle to ${outFile}`)
}

void main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error("[temporal:bundle] Failed:", err)
  process.exit(1)
})
