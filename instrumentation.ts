/**
 * Next.js instrumentation hook.
 *
 * This file is auto-loaded by Next.js 15+ at server startup when placed in
 * the project root. OpenTelemetry runs only when NODE_ENV=production; LangSmith
 * still activates whenever LANGSMITH_API_KEY is set (any environment).
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV === "production") {
      const { initTracing } = await import("./lib/observability/tracing")
      initTracing()
    }

    // LangSmith tracing for LangGraph workflows
    if (process.env.LANGSMITH_API_KEY) {
      const langsmithProject = process.env.LANGSMITH_PROJECT?.trim()
      if (!langsmithProject) {
        throw new Error("Missing LANGSMITH_PROJECT while LANGSMITH_API_KEY is set")
      }
      process.env.LANGCHAIN_TRACING_V2 = "true"
      process.env.LANGCHAIN_PROJECT = langsmithProject
      console.log("[LangSmith] Tracing enabled for project:", process.env.LANGCHAIN_PROJECT)
    }
  }
}
