/**
 * Client-safe message from a tRPC / mutation error.
 * Never surface SQL, stacks, or serialized Zod dumps in the UI.
 */
export function getSafeClientErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object") return fallback

  const message =
    "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message.trim()
      : ""

  if (!message) return fallback

  if (
    /Failed query|select\s+|insert\s+into|update\s+|delete\s+from|ECONNREFUSED|relation .* does not exist|syntax error at/i.test(
      message
    )
  ) {
    return fallback
  }

  if (message.startsWith("[") || message.startsWith("{")) {
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
        if (messages.length > 0) return messages.join(" ")
      }
    } catch {
      return fallback
    }
    return fallback
  }

  return message
}
