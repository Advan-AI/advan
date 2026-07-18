import { startBillingWorker } from "./workers/billing-worker"
import { startTriageWorker } from "./workers/copilot-triage-worker"
import { startEmbeddingWorker } from "./workers/embedding-worker"
import { startNotificationWorker } from "./workers/notification-worker"

/**
 * Unified Queue Worker Entrypoint.
 * Starts all BullMQ workers (billing, triage, embedding, notification) in a single Node process.
 * This is the recommended entrypoint for production/containerized environments (like Cloud Run or VM containers)
 * to consolidate system memory and CPU footprints.
 * 
 * Run: npx tsx lib/queue/worker-entrypoint.ts
 */
async function main() {
  console.log("======================================================================")
  console.log("🚀 STARTING ALL ADVAN AI QUEUE WORKERS (BULLMQ)...")
  console.log("======================================================================")

  try {
    const billingWorker = startBillingWorker()
    console.log("✓ Billing Worker initialized successfully.")

    const triageWorker = startTriageWorker()
    console.log("✓ Triage Worker initialized successfully.")

    const embeddingWorker = startEmbeddingWorker()
    console.log("✓ Embedding Worker initialized successfully.")

    const notificationWorker = startNotificationWorker()
    console.log("✓ Notification Worker initialized successfully.")

    console.log("======================================================================")
    console.log("🎉 ALL WORKERS ARE RUNNING AND POLLING FOR JOBS.")
    console.log("======================================================================")

    // Keep the process alive and handle graceful shutdown
    const handleShutdown = async () => {
      console.log("\n🛑 Gracefully shutting down queue workers...")
      
      await Promise.all([
        billingWorker.close(),
        triageWorker.close(),
        embeddingWorker.close(),
        notificationWorker.close()
      ])

      console.log("✓ All queue workers shut down successfully. Exiting.")
      process.exit(0)
    }

    process.on("SIGTERM", handleShutdown)
    process.on("SIGINT", handleShutdown)

  } catch (err: any) {
    console.error("❌ Failed to start queue workers:", err.message)
    process.exit(1)
  }
}

main()
