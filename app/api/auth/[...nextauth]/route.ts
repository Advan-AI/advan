import { handlers } from "@/auth"

/**
 * NextAuth v5 route handler — mounts GET + POST on /api/auth/*
 */
export const { GET, POST } = handlers
