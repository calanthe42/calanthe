import { describe, expect, it } from "vitest";
import { MIN_CHARGE_FILS } from "@/lib/money";
import {
  PAY_LINK_TTL_DAYS,
  QUOTE_MIN_FILS,
  hashPayToken,
  isPayTokenShape,
  isUnpaidQuote,
  newPayTokenSalt,
  payLinkExpiry,
  payLinkOrigin,
  payRequestState,
  payToken,
  payUrl,
} from "./pay-link";

const SECRET = "s".repeat(40);

describe("the pay token", () => {
  it("is deterministic for the same secret and salt, so a resend rebuilds the same link", () => {
    expect(payToken(SECRET, "salt-a")).toBe(payToken(SECRET, "salt-a"));
  });

  it("is 43 URL-safe characters", () => {
    const token = payToken(SECRET, newPayTokenSalt());
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isPayTokenShape(token)).toBe(true);
  });

  it("changes when the salt or the secret changes", () => {
    expect(payToken(SECRET, "salt-a")).not.toBe(payToken(SECRET, "salt-b"));
    expect(payToken(SECRET, "salt-a")).not.toBe(payToken("t".repeat(40), "salt-a"));
  });

  it("uses a salt of 32 random bytes, different every time", () => {
    const a = newPayTokenSalt();
    const b = newPayTokenSalt();
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
    expect(a).not.toBe(b);
  });

  it("is stored only as a hash, which is not the token", () => {
    const token = payToken(SECRET, "salt-a");
    const hash = hashPayToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    expect(hash).not.toContain(token);
  });

  it("refuses anything that is not token-shaped before a query is made", () => {
    const token = payToken(SECRET, "salt-a");
    expect(isPayTokenShape(token.slice(0, 42))).toBe(false);
    expect(isPayTokenShape(`${token}x`)).toBe(false);
    expect(isPayTokenShape(`${token.slice(0, 42)}+`)).toBe(false);
    expect(isPayTokenShape(`${token.slice(0, 42)}/`)).toBe(false);
    expect(isPayTokenShape("")).toBe(false);
    expect(isPayTokenShape(undefined)).toBe(false);
    expect(isPayTokenShape(12345)).toBe(false);
  });
});

describe("link expiry", () => {
  it("is exactly seven days", () => {
    const now = new Date("2026-10-04T10:00:00.000Z");
    expect(PAY_LINK_TTL_DAYS).toBe(7);
    expect(payLinkExpiry(now).toISOString()).toBe("2026-10-11T10:00:00.000Z");
  });
});

describe("payRequestState", () => {
  const now = new Date("2026-10-04T10:00:00.000Z");
  const future = "2026-10-05T10:00:00.000Z";
  const past = "2026-10-03T10:00:00.000Z";

  it("is awaiting while unpaid, live and unexpired", () => {
    expect(payRequestState({ paymentStatus: "PENDING", fulfilmentStatus: "NEW", payLinkExpiresAt: future }, now)).toBe(
      "awaiting",
    );
  });

  it("puts paid above cancelled, and cancelled above expired", () => {
    expect(
      payRequestState({ paymentStatus: "PAID", fulfilmentStatus: "CANCELLED", payLinkExpiresAt: past }, now),
    ).toBe("paid");
    expect(
      payRequestState({ paymentStatus: "PENDING", fulfilmentStatus: "CANCELLED", payLinkExpiresAt: past }, now),
    ).toBe("cancelled");
    expect(
      payRequestState({ paymentStatus: "PENDING", fulfilmentStatus: "CANCELLED", payLinkExpiresAt: future }, now),
    ).toBe("cancelled");
  });

  it("counts a refunded order as paid: the money did arrive", () => {
    for (const paymentStatus of ["REFUNDED", "PARTIALLY_REFUNDED"]) {
      expect(payRequestState({ paymentStatus, fulfilmentStatus: "CONFIRMED", payLinkExpiresAt: past }, now)).toBe(
        "paid",
      );
    }
  });

  it("treats a missing expiry, or one equal to now, as expired", () => {
    expect(payRequestState({ paymentStatus: "PENDING", fulfilmentStatus: "NEW" }, now)).toBe("expired");
    expect(payRequestState({ paymentStatus: "PENDING", fulfilmentStatus: "NEW", payLinkExpiresAt: null }, now)).toBe(
      "expired",
    );
    expect(
      payRequestState({ paymentStatus: "PENDING", fulfilmentStatus: "NEW", payLinkExpiresAt: now.toISOString() }, now),
    ).toBe("expired");
    expect(
      payRequestState({ paymentStatus: "PENDING", fulfilmentStatus: "NEW", payLinkExpiresAt: "not a date" }, now),
    ).toBe("expired");
  });
});

describe("the unpaid-quote rule", () => {
  it("is true only for a payment request nobody has paid", () => {
    expect(isUnpaidQuote({ source: "admin-quote", paymentStatus: "PENDING" })).toBe(true);
    expect(isUnpaidQuote({ source: "admin-quote", paymentStatus: "FAILED" })).toBe(true);
    expect(isUnpaidQuote({ source: "admin-quote", paymentStatus: "PAID" })).toBe(false);
    expect(isUnpaidQuote({ source: "admin-quote", paymentStatus: "REFUNDED" })).toBe(false);
    expect(isUnpaidQuote({ source: "web-checkout-card", paymentStatus: "PENDING" })).toBe(false);
    expect(isUnpaidQuote({ paymentStatus: "PENDING" })).toBe(false);
  });
});

describe("the minimum charge", () => {
  it("is defined once: the quote minimum IS the shared constant, AED 2", () => {
    expect(QUOTE_MIN_FILS).toBe(MIN_CHARGE_FILS);
    expect(MIN_CHARGE_FILS).toBe(200);
  });
});

describe("the link itself", () => {
  it("carries the token and the language, and nothing else", () => {
    expect(payUrl("https://www.calanthe.ae", "TOKEN", "ar")).toBe("https://www.calanthe.ae/pay/TOKEN?lang=ar");
    expect(payUrl("https://www.calanthe.ae/", "TOKEN", "en")).toBe("https://www.calanthe.ae/pay/TOKEN?lang=en");
  });

  it("points a preview deployment at itself, and everything else at the site", () => {
    const site = "https://www.calanthe.ae";
    expect(payLinkOrigin(site)).toBe(site);
    expect(payLinkOrigin(site, { env: "production", branchUrl: "x.vercel.app" })).toBe(site);
    expect(payLinkOrigin(site, { env: "preview", branchUrl: "calanthe-git-x.vercel.app" })).toBe(
      "https://calanthe-git-x.vercel.app",
    );
    expect(payLinkOrigin(site, { env: "preview" })).toBe(site);
  });
});
