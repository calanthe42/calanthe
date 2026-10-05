import "server-only";

import { headers as nextHeaders } from "next/headers";
import { evaluate } from "@backend/domain/sliding-window";
import { rateLimit } from "@/lib/redis";

/**
 * How often one caller may do one thing.
 *
 * WHAT THIS PROTECTS. Payload already locks an individual account after five
 * failed passwords, which stops someone guessing ONE person's password. It
 * does nothing about the other three shapes of abuse, all of which this file
 * covers:
 *
 *   · credential stuffing — one password tried against ten thousand
 *     addresses, where no single account ever reaches five failures;
 *   · account-creation and enquiry spam, which fills the owner's inbox and
 *     the database with rubbish and costs money in email;
 *   · address enumeration through the "forgot password" and "resend
 *     verification" endpoints, which answer identically for known and
 *     unknown addresses — the only remaining signal being how many times a
 *     stranger may ask.
 *
 * WHY IT DOES NOT FAIL CLOSED. Upstash is optional in this deployment
 * (lib/env.ts warns rather than refusing to boot) and the live site runs
 * without it today. A limiter that denies when its store is missing would
 * therefore not "fail safe" — it would take sign-in, checkout and every
 * enquiry form offline the moment a credential expired or Upstash had an
 * incident, which is a self-inflicted outage on the whole business.
 *
 * So the store degrades instead of the service: Upstash when it is
 * configured (shared across every serverless instance, the real defence),
 * and an in-process window when it is not. The in-process one is weaker —
 * each instance counts only what it saw — but it is strictly better than no
 * limit, and it can never refuse a legitimate customer because infrastructure
 * is absent. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to get
 * the strong version; nothing else changes.
 *
 * A REFUSAL IS NEVER SILENT. Every caller returns the same shaped failure it
 * returns for any other rejected input, with a sentence saying how long to
 * wait. A form that simply stops working teaches people to press harder.
 */

export type Bucket = {
  /** Namespace; keeps one caller's login count separate from their checkout count. */
  readonly name: string;
  readonly limit: number;
  readonly windowSeconds: number;
};

const minutes = (n: number) => n * 60;
const hours = (n: number) => n * 3600;

/**
 * Every limit in one table, so the whole policy can be read at once.
 *
 * The numbers are set against real human use, not against what feels strict:
 * a person who mistypes their password four times is ordinary, a person who
 * submits six enquiries in an hour is not. Where a limit is applied twice —
 * once per address and once per network — the per-address one is tighter,
 * because a shared office NAT is one network and many honest people.
 */
export const LIMITS = {
  /** Sign-in, per network. Payload's own five-strike lock covers per-account. */
  adminLogin: { name: "admin-login", limit: 10, windowSeconds: minutes(10) },
  customerLogin: { name: "customer-login", limit: 10, windowSeconds: minutes(10) },
  /** And per address, so stuffing cannot spread the cost across many accounts. */
  loginIdentity: { name: "login-identity", limit: 6, windowSeconds: minutes(10) },

  register: { name: "register", limit: 5, windowSeconds: hours(1) },
  passwordResetIp: { name: "password-reset-ip", limit: 6, windowSeconds: hours(1) },
  passwordResetEmail: { name: "password-reset-email", limit: 3, windowSeconds: hours(1) },
  verifyResend: { name: "verify-resend", limit: 3, windowSeconds: hours(1) },

  /** A real customer places one order; nobody places ten in an hour by hand. */
  checkout: { name: "checkout", limit: 8, windowSeconds: hours(1) },
  enquiry: { name: "enquiry", limit: 6, windowSeconds: hours(1) },

  /* Payment links. Viewing is generous — the page polls while a payment is
     being confirmed, and a family shares one address. Starting a payment is
     not: each attempt talks to Stripe. Both are per network address; the
     token itself is 256 bits and cannot be guessed at any rate. */
  payView: { name: "pay-view", limit: 60, windowSeconds: minutes(10) },
  payStart: { name: "pay-start", limit: 10, windowSeconds: minutes(10) },
  /** Per ORDER, not per florist: nobody needs the same email six times an hour. */
  payResend: { name: "pay-resend", limit: 5, windowSeconds: hours(1) },

  /* Discount codes. This counts WRONG codes only (see `peek` below): a
     basket holding a good code re-quotes itself on every quantity change,
     and charging each of those to the bucket would lock an honest customer
     out of the discount she was shown. Twelve wrong guesses in ten minutes
     from one network is a script, not a typo. */
  discountCode: { name: "discount-code", limit: 12, windowSeconds: minutes(10) },
} as const satisfies Record<string, Bucket>;

export type Throttled = {
  allowed: boolean;
  retryAfterSeconds: number;
  /** True while the weaker in-process store is in use — surfaced for logging. */
  degraded: boolean;
};

/* ------------------------------------------------------------------ */
/* In-process fallback                                                 */
/* ------------------------------------------------------------------ */

/**
 * Bounded on purpose. An unbounded Map keyed by caller IP is a memory leak
 * with a remote trigger: anyone can mint new keys faster than they expire.
 * At the cap the coldest half is dropped, which loses some counts under a
 * flood — acceptable, because the flood is exactly when Upstash should be
 * configured, and losing counts is better than losing the process.
 */
const MAX_KEYS = 20_000;
const memory = new Map<string, number[]>();

function memoryThrottle(key: string, bucket: Bucket, now: number): Throttled {
  const decision = evaluate(
    memory.get(key) ?? [],
    now,
    bucket.limit,
    bucket.windowSeconds * 1000,
  );

  if (decision.kept.length === 0) memory.delete(key);
  else {
    /* Re-inserting moves the key to the end of the Map's insertion order,
       which is what makes the eviction below least-recently-used. */
    memory.delete(key);
    memory.set(key, decision.kept);
  }

  if (memory.size > MAX_KEYS) {
    const drop = Math.ceil(memory.size / 2);
    let i = 0;
    for (const k of memory.keys()) {
      if (i >= drop) break;
      memory.delete(k);
      i += 1;
    }
  }

  return {
    allowed: decision.allowed,
    retryAfterSeconds: Math.ceil(decision.retryAfterMs / 1000),
    degraded: true,
  };
}

/** Test seam: the in-process window is module state and outlives a test file. */
export function resetThrottleMemory(): void {
  memory.clear();
}

/* ------------------------------------------------------------------ */
/* The check                                                           */
/* ------------------------------------------------------------------ */

/**
 * Counts one attempt against `bucket` for `identifier`.
 *
 * `identifier` is whatever the limit is about — a network address, an email
 * address, a user id. It is namespaced by the bucket, so the same address
 * counted for sign-in and for checkout never shares a tally.
 */
export async function throttle(bucket: Bucket, identifier: string): Promise<Throttled> {
  const key = identifier.trim().toLowerCase() || "unknown";

  const limiter = rateLimit(
    bucket.name,
    bucket.limit,
    `${bucket.windowSeconds} s` as `${number} s`,
  );

  if (!limiter) return memoryThrottle(`${bucket.name}:${key}`, bucket, Date.now());

  try {
    const result = await limiter.limit(key);
    return {
      allowed: result.success,
      retryAfterSeconds: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
      degraded: false,
    };
  } catch (error) {
    /* Upstash is reachable in principle but not right now. Counting in
       process is the closest thing to the intended behaviour; refusing
       everyone would turn their outage into ours. */
    console.error(
      `[throttle] ${bucket.name} store unavailable, counting in process`,
      error,
    );
    return memoryThrottle(`${bucket.name}:${key}`, bucket, Date.now());
  }
}

/**
 * Is this caller over the limit — WITHOUT counting this call as an attempt.
 *
 * `throttle` counts every call, which is right when the call itself is the
 * thing being limited (a sign-in, an order). It is wrong for a limit on
 * FAILURES: the caller is asked "may I try?" first (`peek`), and charged
 * (`throttle`) only once the attempt has turned out to be a wrong one. A
 * successful attempt costs nothing, however often it is repeated.
 */
export async function peek(bucket: Bucket, identifier: string): Promise<Throttled> {
  const key = identifier.trim().toLowerCase() || "unknown";

  const fromMemory = (): Throttled => {
    const now = Date.now();
    const windowMs = bucket.windowSeconds * 1000;
    const live = (memory.get(`${bucket.name}:${key}`) ?? []).filter((at) => at > now - windowMs);
    if (live.length < bucket.limit) return { allowed: true, retryAfterSeconds: 0, degraded: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((Math.min(...live) + windowMs - now) / 1000)),
      degraded: true,
    };
  };

  const limiter = rateLimit(
    bucket.name,
    bucket.limit,
    `${bucket.windowSeconds} s` as `${number} s`,
  );
  if (!limiter) return fromMemory();

  try {
    const state = await limiter.getRemaining(key);
    return {
      allowed: state.remaining > 0,
      retryAfterSeconds:
        state.remaining > 0 ? 0 : Math.max(1, Math.ceil((state.reset - Date.now()) / 1000)),
      degraded: false,
    };
  } catch (error) {
    console.error(`[throttle] ${bucket.name} store unavailable, reading in process`, error);
    return fromMemory();
  }
}

/* ------------------------------------------------------------------ */
/* Who is asking                                                       */
/* ------------------------------------------------------------------ */

/**
 * The caller's network address.
 *
 * `x-forwarded-for` is only trustworthy behind a proxy that sets it, which
 * on Vercel it is — the platform overwrites the header at the edge, so a
 * client cannot forge the first entry. The FIRST entry is the client; later
 * ones are proxies, and reading the last would key every caller to the same
 * edge node and rate-limit the entire site as one person.
 *
 * "unknown" is a real key, not a bypass: callers with no resolvable address
 * share one bucket rather than escaping the limit.
 */
export async function clientAddress(): Promise<string> {
  const headers = await nextHeaders();

  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;

  return headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * The common case in one line: limit this bucket by the caller's network.
 *
 * Returns null when the attempt is allowed, or the sentence to show when it
 * is not — so a caller reads `const wait = await guardByAddress(...); if
 * (wait) return fail(...)`, with no chance of checking the limit and then
 * forgetting to act on it.
 */
export async function guardByAddress(bucket: Bucket): Promise<string | null> {
  const result = await throttle(bucket, await clientAddress());
  return result.allowed ? null : waitMessage(result.retryAfterSeconds);
}

/**
 * The same guard, as a quantity rather than an English sentence, for the
 * storefront — which has to say it in the visitor's language.
 */
export async function hintByAddress(bucket: Bucket): Promise<WaitHint | null> {
  const result = await throttle(bucket, await clientAddress());
  return result.allowed ? null : waitHint(result.retryAfterSeconds);
}

/**
 * How long to wait, as a quantity rather than a sentence.
 *
 * The sentence used to be built here, in English, and handed straight to a
 * customer — so an Arabic visitor who was rate-limited was told to wait in a
 * language the rest of her page was not in. The wording now belongs to
 * whichever dictionary is in use; this decides only the number and the unit.
 *
 * Rounding up to the next minute is deliberately generous: telling someone
 * to wait slightly longer than necessary is harmless, telling them to come
 * back too early means being refused twice.
 */
export type WaitHint = { unit: "moment" } | { unit: "minutes" | "hours"; count: number };

export function waitHint(retryAfterSeconds: number): WaitHint {
  if (retryAfterSeconds <= 60) return { unit: "moment" };
  const mins = Math.ceil(retryAfterSeconds / 60);
  if (mins < 60) return { unit: "minutes", count: mins };
  return { unit: "hours", count: Math.ceil(mins / 60) };
}

/**
 * The English sentence, for callers that have no dictionary of their own.
 * The admin has its own translator, so this is the storefront's fallback and
 * the wording used in logs.
 */
export function waitMessage(retryAfterSeconds: number): string {
  const hint = waitHint(retryAfterSeconds);
  if (hint.unit === "moment") return "Please wait a moment and try again.";
  const plural = hint.count === 1 ? "" : "s";
  return hint.unit === "minutes"
    ? `Please try again in ${hint.count} minute${plural}.`
    : `Please try again in about ${hint.count} hour${plural}.`;
}
