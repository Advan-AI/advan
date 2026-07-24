import type { TRPCError } from "@trpc/server"
import { ZodError } from "zod"

const SAFE_INTERNAL_MESSAGE = "Something went wrong. Please try again."

const LEAKY_ERROR_PATTERN =
  /Failed query|select\s+|insert\s+into|update\s+|delete\s+from|ECONNREFUSED|password authentication|relation .* does not exist|syntax error at|drizzle|postgres|stack trace|at\s+\S+\s+\(/i

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

  if (isInternal || LEAKY_ERROR_PATTERN.test(message)) {
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

export { SAFE_INTERNAL_MESSAGE }
