import { describe, it, expect, vi, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"

// ── Mocks (factories must be pure — no external variable references) ──────────

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock("@/lib/billing/subscription-service", () => ({
  assertSeatLimit: vi.fn(),
}))

vi.mock("bcryptjs", () => ({
  hash: vi.fn(),
}))

// ── Imports (resolved after mocks are registered) ─────────────────────────────

import { teamRouter } from "./team"
import { db } from "@/lib/db"
import { assertSeatLimit } from "@/lib/billing/subscription-service"
import { hash } from "bcryptjs"

// ── UUID fixtures (Zod requires valid UUIDs for userId inputs) ────────────────

const ADMIN_ID  = "00000000-0000-0000-0000-000000000001"
const MEMBER_ID = "00000000-0000-0000-0000-000000000002"
const OTHER_ID  = "00000000-0000-0000-0000-000000000003"
const ORG_ID    = "00000000-0000-0000-0000-000000000010"

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCaller(orgId = ORG_ID, userId = ADMIN_ID) {
  return teamRouter.createCaller({ user: { id: userId, orgId, role: "admin" } })
}

const VALID_INPUT = {
  name: "New Member",
  email: "newmember@example.com",
  role: "member" as const,
  password: "password123",
}

const NEW_USER_ROW = {
  id: MEMBER_ID,
  email: "newmember@example.com",
  name: "New Member",
  role: "member",
}

function mockInsert(row: object) {
  vi.mocked(db.insert).mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([row]),
    }),
  } as any)
}

function mockDelete() {
  vi.mocked(db.delete).mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  } as any)
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(assertSeatLimit).mockResolvedValue(undefined)
  vi.mocked(hash).mockResolvedValue("hashed_password" as any)
  vi.mocked(db.query.users.findMany).mockResolvedValue([])
  vi.mocked(db.query.users.findFirst).mockResolvedValue(null as any)
  mockInsert(NEW_USER_ROW)
  mockDelete()
})

// ─────────────────────────────────────────────────────────────────────────────

describe("team.addMember", () => {
  it("inserts a new user when a seat is available and the email is unique", async () => {
    const caller = makeCaller()
    const result = await caller.addMember(VALID_INPUT)

    expect(assertSeatLimit).toHaveBeenCalledOnce()
    expect(assertSeatLimit).toHaveBeenCalledWith(ORG_ID)
    expect(db.insert).toHaveBeenCalledOnce()
    expect(result.email).toBe("newmember@example.com")
  })

  it("throws FORBIDDEN with the upgrade message when the seat limit is reached", async () => {
    vi.mocked(assertSeatLimit).mockRejectedValue(
      new Error("Seat limit reached (2 seats). Please upgrade your plan to add more seats.")
    )

    const caller = makeCaller()
    const err = await caller.addMember(VALID_INPUT).catch((e) => e)

    expect(err).toBeInstanceOf(TRPCError)
    expect(err.code).toBe("FORBIDDEN")
    expect(err.message).toContain("Seat limit reached (2 seats)")
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("throws CONFLICT when the email already exists, regardless of seat availability", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue({ id: MEMBER_ID } as any)

    const caller = makeCaller()
    const err = await caller.addMember(VALID_INPUT).catch((e) => e)

    expect(err).toBeInstanceOf(TRPCError)
    expect(err.code).toBe("CONFLICT")
    expect(db.insert).not.toHaveBeenCalled()
  })

  it("normalises email to lowercase before the duplicate check and insert", async () => {
    const caller = makeCaller()
    await caller.addMember({ ...VALID_INPUT, email: "NewMember@EXAMPLE.COM" })

    const valuesMock = vi.mocked(db.insert).mock.results[0].value.values
    expect(valuesMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: "newmember@example.com" })
    )
  })
})

describe("team.removeMember", () => {
  it("throws BAD_REQUEST when an admin tries to remove themselves", async () => {
    // caller's own userId === input userId → self-removal guard fires
    const caller = makeCaller(ORG_ID, ADMIN_ID)
    const err = await caller.removeMember({ userId: ADMIN_ID }).catch((e) => e)

    expect(err).toBeInstanceOf(TRPCError)
    expect(err.code).toBe("BAD_REQUEST")
  })

  it("throws NOT_FOUND when the target user belongs to a different org", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: OTHER_ID,
      orgId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    } as any)

    const caller = makeCaller(ORG_ID, ADMIN_ID)
    const err = await caller.removeMember({ userId: OTHER_ID }).catch((e) => e)

    expect(err).toBeInstanceOf(TRPCError)
    expect(err.code).toBe("NOT_FOUND")
  })
})
