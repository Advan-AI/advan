import { describe, it, expect, vi, beforeEach } from "vitest"
import { TRPCError } from "@trpc/server"

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      organizations: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(),
  },
}))

vi.mock("bcryptjs", () => {
  return {
    hash: vi.fn().mockResolvedValue("new_hashed_password"),
    compare: vi.fn().mockResolvedValue(true),
  }
})

// ── Imports ──────────────────────────────────────────────────────────────────
import { userRouter } from "./user"
import { db } from "@/lib/db"
import { compare, hash } from "bcryptjs"

const USER_ID = "00000000-0000-0000-0000-000000000001"
const ORG_ID = "00000000-0000-0000-0000-000000000010"

function makeCaller(role = "admin") {
  return userRouter.createCaller({ user: { id: USER_ID, orgId: ORG_ID, role } })
}

const mockUpdateChain = () => {
  const setMock = vi.fn().mockReturnThis()
  const whereMock = vi.fn().mockResolvedValue({ success: true })
  return {
    set: setMock,
    where: whereMock,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.query.users.findFirst).mockResolvedValue({
    id: USER_ID,
    orgId: ORG_ID,
    email: "user@example.com",
    name: "John Doe",
    passwordHash: "current_hashed_password",
    chatAvailable: true,
  } as any)

  vi.mocked(db.query.organizations.findFirst).mockResolvedValue({
    id: ORG_ID,
    name: "Acme Corp",
    slug: "acme",
  } as any)

  vi.mocked(db.update).mockReturnValue(mockUpdateChain() as any)
  vi.mocked(compare).mockResolvedValue(true as never)
})

describe("userRouter.getProfile", () => {
  it("returns user details", async () => {
    const caller = makeCaller()
    const profile = await caller.getProfile()
    expect(profile.name).toBe("John Doe")
    expect(profile.email).toBe("user@example.com")
  })

  it("throws NOT_FOUND if user is missing", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(null as any)
    const caller = makeCaller()
    await expect(caller.getProfile()).rejects.toThrow(TRPCError)
  })
})

describe("userRouter.updateProfile", () => {
  it("updates user details successfully", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue(null as any) // No duplicate email found
    const caller = makeCaller()
    const updateSpy = vi.mocked(db.update)

    const result = await caller.updateProfile({
      name: "John Updated",
      email: "john_updated@example.com",
      chatAvailable: false,
    })

    expect(result.success).toBe(true)
    expect(updateSpy).toHaveBeenCalledOnce()
  })

  it("throws CONFLICT if email is already taken by another user", async () => {
    vi.mocked(db.query.users.findFirst).mockResolvedValue({
      id: "another-user-uuid",
      email: "taken@example.com",
    } as any)

    const caller = makeCaller()
    await expect(
      caller.updateProfile({
        name: "John",
        email: "taken@example.com",
      })
    ).rejects.toThrow("A user with this email address already exists")
  })
})

describe("userRouter.changePassword", () => {
  it("securely changes password if current matches", async () => {
    const caller = makeCaller()
    const updateSpy = vi.mocked(db.update)

    const result = await caller.changePassword({
      currentPassword: "correct_password",
      newPassword: "mynewsecurepassword",
    })

    expect(result.success).toBe(true)
    expect(compare).toHaveBeenCalledWith("correct_password", "current_hashed_password")
    expect(hash).toHaveBeenCalledWith("mynewsecurepassword", 12)
    expect(updateSpy).toHaveBeenCalledOnce()
  })

  it("throws BAD_REQUEST if current password does not match", async () => {
    vi.mocked(compare).mockResolvedValue(false as never)
    const caller = makeCaller()

    await expect(
      caller.changePassword({
        currentPassword: "wrong_password",
        newPassword: "mynewsecurepassword",
      })
    ).rejects.toThrow("Incorrect current password")
  })
})

describe("userRouter.getOrgSettings", () => {
  it("returns organization settings", async () => {
    const caller = makeCaller()
    const org = await caller.getOrgSettings()
    expect(org.name).toBe("Acme Corp")
    expect(org.slug).toBe("acme")
  })
})

describe("userRouter.updateOrgSettings", () => {
  it("updates organization setting if administrator", async () => {
    vi.mocked(db.query.organizations.findFirst).mockResolvedValue(null as any) // No slug conflict
    const caller = makeCaller("admin")
    const updateSpy = vi.mocked(db.update)

    const result = await caller.updateOrgSettings({
      name: "New Acme Name",
      slug: "new-acme",
    })

    expect(result.success).toBe(true)
    expect(updateSpy).toHaveBeenCalledOnce()
  })

  it("throws FORBIDDEN if role is not admin", async () => {
    const caller = makeCaller("member")
    await expect(
      caller.updateOrgSettings({
        name: "New Acme Name",
        slug: "new-acme",
      })
    ).rejects.toThrow("Only organization administrators can modify settings")
  })
})
