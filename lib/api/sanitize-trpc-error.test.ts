import { describe, expect, it } from "vitest"
import { TRPCError } from "@trpc/server"
import { ZodError, z } from "zod"
import {
  SAFE_INTERNAL_MESSAGE,
  sanitizeTrpcErrorShape,
  type TrpcErrorShape,
} from "./sanitize-trpc-error"
import { getSafeClientErrorMessage } from "./safe-client-error"

function baseShape(message: string, code = "INTERNAL_SERVER_ERROR"): TrpcErrorShape {
  return {
    message,
    code: code === "INTERNAL_SERVER_ERROR" ? -32603 : -32600,
    data: {
      code,
      httpStatus: code === "INTERNAL_SERVER_ERROR" ? 500 : 400,
      path: "auth.signup",
      stack: "Error: secret\n    at Object.handler (/app/lib/db.ts:10:5)",
    },
  }
}

describe("sanitizeTrpcErrorShape", () => {
  it("replaces internal errors with a safe message and strips stack", () => {
    const error = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: 'Failed query: select "id" from "organizations" where "slug" = $1',
      cause: new Error("connection refused"),
    })

    const result = sanitizeTrpcErrorShape(baseShape(error.message), error)

    expect(result.message).toBe(SAFE_INTERNAL_MESSAGE)
    expect(result.data.stack).toBeUndefined()
    expect(JSON.stringify(result)).not.toMatch(/organizations|Failed query|stack/i)
  })

  it("humanizes Zod validation errors instead of dumping issue JSON", () => {
    let zodError: ZodError
    try {
      z.object({ adminName: z.string().min(2, "Name must be at least 2 characters.") }).parse({
        adminName: "A",
      })
      throw new Error("expected zod parse to fail")
    } catch (err) {
      zodError = err as ZodError
    }

    const error = new TRPCError({
      code: "BAD_REQUEST",
      message: JSON.stringify(zodError!.issues),
      cause: zodError!,
    })

    const result = sanitizeTrpcErrorShape(
      baseShape(error.message, "BAD_REQUEST"),
      error
    )

    expect(result.message).toBe("Name must be at least 2 characters.")
    expect(result.data.zodError).toEqual(zodError!.flatten())
    expect(result.message).not.toContain("too_small")
    expect(result.data.stack).toBeUndefined()
  })

  it("preserves intentional client-safe TRPCError messages", () => {
    const error = new TRPCError({
      code: "CONFLICT",
      message: "A user with this email address is already registered.",
    })

    const result = sanitizeTrpcErrorShape(
      baseShape(error.message, "CONFLICT"),
      error
    )

    expect(result.message).toBe("A user with this email address is already registered.")
  })

  it("masks leaky messages even when code is not INTERNAL", () => {
    const error = new TRPCError({
      code: "BAD_REQUEST",
      message: 'Failed query: select "id" from "users"',
    })

    const result = sanitizeTrpcErrorShape(baseShape(error.message, "BAD_REQUEST"), error)
    expect(result.message).toBe(SAFE_INTERNAL_MESSAGE)
  })
})

describe("getSafeClientErrorMessage", () => {
  it("hides SQL and serialized Zod dumps", () => {
    expect(
      getSafeClientErrorMessage(
        { message: 'Failed query: select "id" from "organizations"' },
        "Signup failed."
      )
    ).toBe("Signup failed.")

    expect(
      getSafeClientErrorMessage(
        {
          message: JSON.stringify([
            {
              code: "too_small",
              message: "Name must be at least 2 characters.",
              path: ["adminName"],
            },
          ]),
        },
        "Signup failed."
      )
    ).toBe("Name must be at least 2 characters.")
  })
})
