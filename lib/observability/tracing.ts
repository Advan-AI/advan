import { NodeSDK } from "@opentelemetry/sdk-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node"

/**
 * OpenTelemetry SDK setup for Advan AI.
 *
 * Traces are exported to an OTLP-compatible collector (Grafana Cloud, Honeycomb,
 * or any OTEL endpoint) via OTEL_EXPORTER_OTLP_ENDPOINT + OTEL_EXPORTER_OTLP_HEADERS.
 *
 * Called from instrumentation.ts only when NODE_ENV=production.
 */
export function initTracing() {
  if (process.env.NODE_ENV !== "production") {
    return
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (!endpoint) {
    console.warn("[OTel] OTEL_EXPORTER_OTLP_ENDPOINT not set — tracing disabled")
    return
  }

  const headers: Record<string, string> = {}
  const rawHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS
  if (rawHeaders) {
    for (const pair of rawHeaders.split(",")) {
      const [k, v] = pair.split("=")
      if (k && v) headers[k.trim()] = v.trim()
    }
  }

  const exporter = new OTLPTraceExporter({ url: endpoint, headers })

  const serviceName = process.env.OTEL_SERVICE_NAME?.trim()
  if (!serviceName) {
    throw new Error("Missing OTEL_SERVICE_NAME in production tracing configuration")
  }

  process.env.OTEL_SERVICE_NAME = serviceName

  const sdk = new NodeSDK({
    spanProcessor: new SimpleSpanProcessor(exporter),
  })

  sdk.start()
  console.log("[OTel] Tracing initialised →", endpoint)

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    try {
      await sdk.shutdown()
    } catch (err) {
      console.error("[OTel] Shutdown error:", err)
    }
  })
}

/**
 * Tracer factory — use this in server code to create spans.
 *
 * Usage:
 *   const tracer = getTracer("orchestration")
 *   tracer.startActiveSpan("workflow.run", (span) => {
 *     span.setAttribute("orgId", orgId)
 *     // ... work ...
 *     span.end()
 *   })
 */
export function getTracer(name: string) {
  const { trace } = require("@opentelemetry/api")
  return trace.getTracer(name)
}
