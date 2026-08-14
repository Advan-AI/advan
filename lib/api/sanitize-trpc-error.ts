import type { TRPCError } from "@trpc/server"
import { ZodError } from "zod"

const SAFE_INTERNAL_MESSAGE = "Something went wrong. Please try again."
const DB_UNAVAILABLE_MESSAGE =
  "Database temporarily unavailable. Check your network connection and try again."

const LEAKY_ERROR_PATTERN =
  /Failed query|params:\s|column "|on conflict|select\s+|insert\s+into|update\s+|delete\s+from|ECONNREFUSED|password authentication|relation .* does not exist|syntax error at|drizzle|postgres|stack trace|at\s+\S+\s+\(/i

const DB_CONNECTIVITY_PATTERN =
  /EAI_AGAIN|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|CONNECT_TIMEOUT|getaddrinfo|Connection terminated|connection.*timed out|sorry, too many clients|Could not connect|fetch failed/i

export type TrpcErrorShape = {
  message: string
  code: number
  data: {
    code: string
    httpStatus: number
    path?: string
    stack?: string
    [key: string]: unknown
  }
}

/**
 * Strip SQL, stack traces, and raw Zod JSON from client-facing tRPC errors.
 * Full details must stay in server logs only (see route onError).
 */
export function sanitizeTrpcErrorShape(shape: TrpcErrorShape, error: TRPCError) {
  const zodError = error.cause instanceof ZodError ? error.cause : null
  const isInternal = error.code === "INTERNAL_SERVER_ERROR"

  let message = shape.message

  if (isDbConnectivityFailure(error)) {
    message = DB_UNAVAILABLE_MESSAGE
  } else if (isInternal || LEAKY_ERROR_PATTERN.test(message)) {
    message = SAFE_INTERNAL_MESSAGE
  } else if (zodError) {
    const messages = zodError.issues.map((issue) => issue.message).filter(Boolean)
    message = messages.length > 0 ? messages.join(" ") : "Invalid input."
  } else if (looksLikeSerializedZodIssues(message)) {
    message = humanizeSerializedZodMessage(message) ?? "Invalid input."
  }

  const { stack: _stack, ...dataWithoutStack } = shape.data

  return {
    ...shape,
    message,
    data: {
      ...dataWithoutStack,
      stack: undefined,
      zodError: zodError ? zodError.flatten() : null,
    },
  }
}

/** Walk drizzle / node error causes for DNS and connection failures. */
export function isDbConnectivityFailure(error: { message?: string; cause?: unknown }): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 5 && current; depth++) {
    if (typeof current !== "object" || current === null) break
    const record = current as { message?: unknown; code?: unknown; cause?: unknown }
    const blob = `${String(record.message ?? "")} ${String(record.code ?? "")}`
    if (DB_CONNECTIVITY_PATTERN.test(blob)) return true
    current = record.cause
  }
  return false
}

function looksLikeSerializedZodIssues(message: string): boolean {
  const trimmed = message.trim()
  return trimmed.startsWith("[") || trimmed.startsWith("{")
}

function humanizeSerializedZodMessage(message: string): string | null {
  try {
    const parsed = JSON.parse(message) as unknown
    if (Array.isArray(parsed)) {
      const messages = parsed
        .map((issue) =>
          issue && typeof issue === "object" && "message" in issue
            ? String((issue as { message: unknown }).message)
            : null
        )
        .filter((m): m is string => Boolean(m))
      return messages.length > 0 ? messages.join(" ") : null
    }
  } catch {
    // Not JSON — treat as unsafe opaque input.
  }
  return null
}

export { SAFE_INTERNAL_MESSAGE, DB_UNAVAILABLE_MESSAGE, LEAKY_ERROR_PATTERN }

/** REST / demo APIs: never return SQL, params, or stacks to the browser. */
export function toPublicApiError(err: unknown, fallback = SAFE_INTERNAL_MESSAGE): string {
  if (isDbConnectivityFailure(err instanceof Error ? err : { message: String(err ?? "") })) {
    return DB_UNAVAILABLE_MESSAGE
  }
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : ""
  if (!raw || LEAKY_ERROR_PATTERN.test(raw) || raw.length > 180) return fallback
  return raw
}
