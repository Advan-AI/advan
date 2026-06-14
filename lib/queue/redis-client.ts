import { Redis } from "@upstash/redis"

/**
 * Upstash Redis client — REST-based, Vercel Edge compatible.
 * Used by BullMQ queue infrastructure and rate limiting (Phase 6).
 *
 * Configure via: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 */
export const redis = Redis.fromEnv()
