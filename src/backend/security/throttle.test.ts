import { beforeEach, describe, expect, it, vi } from "vitest";

/* throttle.ts is server-only and reads request headers; a unit test has
   neither. With no Upstash credentials it counts in process, which is the
   path exercised here. */
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/redis", () => ({ rateLimit: () => null }));

import { LIMITS, peek, resetThrottleMemory, throttle } from "./throttle";

describe("payment-link limits", () => {
  beforeEach(() => resetThrottleMemory());

  it("exist, with the numbers the policy states", () => {
    expect(LIMITS.payView).toEqual({ name: "pay-view", limit: 60, windowSeconds: 600 });
    expect(LIMITS.payStart).toEqual({ name: "pay-start", limit: 10, windowSeconds: 600 });
    expect(LIMITS.payResend).toEqual({ name: "pay-resend", limit: 5, windowSeconds: 3600 });
  });

  it("refuses a caller who is over the pay-start limit, and says how long to wait", async () => {
    for (let i = 0; i < LIMITS.payStart.limit; i += 1) {
      expect((await throttle(LIMITS.payStart, "203.0.113.7")).allowed).toBe(true);
    }
    const refused = await throttle(LIMITS.payStart, "203.0.113.7");
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each caller, and each bucket, separately", async () => {
    for (let i = 0; i < LIMITS.payStart.limit; i += 1) await throttle(LIMITS.payStart, "203.0.113.7");
    expect((await throttle(LIMITS.payStart, "203.0.113.7")).allowed).toBe(false);
    expect((await throttle(LIMITS.payStart, "203.0.113.8")).allowed).toBe(true);
    expect((await throttle(LIMITS.payView, "203.0.113.7")).allowed).toBe(true);
  });

  it("limits resends per order, not per florist", async () => {
    for (let i = 0; i < LIMITS.payResend.limit; i += 1) {
      expect((await throttle(LIMITS.payResend, "order-12")).allowed).toBe(true);
    }
    expect((await throttle(LIMITS.payResend, "order-12")).allowed).toBe(false);
    expect((await throttle(LIMITS.payResend, "order-13")).allowed).toBe(true);
  });
});

describe("discount-code limit — wrong guesses only", () => {
  beforeEach(() => resetThrottleMemory());

  it("exists, with the numbers the policy states", () => {
    expect(LIMITS.discountCode).toEqual({ name: "discount-code", limit: 12, windowSeconds: 600 });
  });

  it("asking whether a caller may try costs nothing, however often it is asked", async () => {
    /* This is the honest basket: a good code re-quoted on every change. */
    for (let i = 0; i < 200; i += 1) {
      expect((await peek(LIMITS.discountCode, "203.0.113.7")).allowed).toBe(true);
    }
    /* …and the whole allowance is still there afterwards. */
    for (let i = 0; i < LIMITS.discountCode.limit; i += 1) {
      expect((await throttle(LIMITS.discountCode, "203.0.113.7")).allowed).toBe(true);
    }
  });

  it("refuses once the wrong guesses are spent, and says how long to wait", async () => {
    for (let i = 0; i < LIMITS.discountCode.limit; i += 1) {
      expect((await peek(LIMITS.discountCode, "203.0.113.7")).allowed).toBe(true);
      await throttle(LIMITS.discountCode, "203.0.113.7");
    }
    const refused = await peek(LIMITS.discountCode, "203.0.113.7");
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
    expect(refused.retryAfterSeconds).toBeLessThanOrEqual(LIMITS.discountCode.windowSeconds);
    /* Another network is untouched. */
    expect((await peek(LIMITS.discountCode, "203.0.113.8")).allowed).toBe(true);
  });
});
