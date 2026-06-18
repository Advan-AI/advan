import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      orgId: string
      role: "admin" | "member" | "viewer"
    }
  }

  interface User {
    orgId: string
    role: "admin" | "member" | "viewer"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    orgId: string
    role: "admin" | "member" | "viewer"
  }
}
