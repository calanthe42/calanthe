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
 * WHICH ENVIRONMENT'S KEYS THESE ARE.
 *
 * Production and Preview point at the SAME Upstash database, and every key
 * was written as `rl:<bucket>:<identifier>`. So a preview deployment shared
 * production's rate-limit buckets: a burst of testing on a preview could
 * lock a real customer out of signing in, and — once A5 lands — a replayed
 * webhook id from preview would mark a production event already handled.
 * Rate limits and idempotency are exactly the state that must never be
 * shared between a place where people spend money and a place where we
 * experiment.
 *
 * `VERCEL_ENV` is production | preview | development on Vercel, and absent
 * locally, which is its own namespace. It is read directly rather than
 * through lib/env because it is Vercel's own variable, not part of our
 * schema, and it must never be a reason the app refuses to boot.
 */
export const KEY_ENV = process.env.VERCEL_ENV ?? "local";

/** Namespace for every key this app writes to Redis. */
export const keyPrefix = (name: string) => `${KEY_ENV}:${name}`;

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
      prefix: keyPrefix(`rl:${name}`),
    });
    limiters.set(key, limiter);
  }
  return limiter;
}
