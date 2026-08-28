import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Upstash Redis — rate limiting, OTP storage and webhook idempotency
 * keys. In development without credentials the client is null and
 * callers MUST fail closed (see requireRateLimit below); production
 * boot fails outright without credentials (lib/env.ts).
 */
export const redis: Redis | null =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const limiters = new Map<string, Ratelimit>();

/**
 * Sliding-window limiter factory, e.g. rateLimit("otp-send", 3, "1 h").
 * Returns null when Redis is unconfigured (dev only) — callers decide,
 * and anything security-sensitive must treat null as "deny" in
 * production paths.
 */
export function rateLimit(
  name: string,
  limit: number,
  window: `${number} ${"s" | "m" | "h" | "d"}`,
): Ratelimit | null {
  if (!redis) return null;
  const key = `${name}:${limit}:${window}`;
  let limiter = limiters.get(key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `rl:${name}`,
    });
    limiters.set(key, limiter);
  }
  return limiter;
}
