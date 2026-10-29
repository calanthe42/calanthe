import { describe, expect, it } from "vitest";
import { welcomeAmount, welcomeMayOpen } from "./welcome-offer";

describe("welcomeMayOpen", () => {
  it("opens once, on a browsing page", () => {
    expect(welcomeMayOpen("/", null)).toBe(true);
    expect(welcomeMayOpen("/shop", null)).toBe(true);
    expect(welcomeMayOpen("/product/quiet-devotion", null)).toBe(true);
  });

  it("never opens again in a browser that has seen it", () => {
    expect(welcomeMayOpen("/", "dismissed")).toBe(false);
    expect(welcomeMayOpen("/", "shown")).toBe(false);
  });

  it("never interrupts paying, the basket or the account", () => {
    for (const path of ["/checkout", "/pay/abc", "/cart", "/account", "/account/register", "/login", "/invoice/CAL-1"]) {
      expect(welcomeMayOpen(path, null)).toBe(false);
    }
  });

  it("matches whole path segments, not prefixes of words", () => {
    expect(welcomeMayOpen("/paysage", null)).toBe(true);
    expect(welcomeMayOpen("/accounting-flowers", null)).toBe(true);
  });
});

describe("welcomeAmount", () => {
  it("is a percentage when the gift is one", () => {
    expect(welcomeAmount({ percentOff: 10, amountOffFils: null })).toBe("10%");
  });

  it("is an amount in AED when the gift is fixed", () => {
    expect(welcomeAmount({ percentOff: null, amountOffFils: 5000 })).toContain("50");
  });
});
