import { beforeEach, describe, expect, it } from "vitest";
import { isTypingInto, readWelcomeSeen, WELCOME_SEEN_KEY, welcomeAmount, welcomeMayOpen } from "./welcome-offer";

const store = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};

beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, "localStorage", { value: memoryStorage, configurable: true });
});

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

describe("readWelcomeSeen", () => {
  it("sees what another tab wrote after this page loaded", () => {
    expect(readWelcomeSeen()).toBeNull();
    /* Tab A answers the invitation while tab B is still waiting to show it. */
    store.set(WELCOME_SEEN_KEY, "registered");
    expect(readWelcomeSeen()).toBe("registered");
    expect(welcomeMayOpen("/shop", readWelcomeSeen())).toBe(false);
  });

  it("keeps the invitation shut when storage cannot be read", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    expect(readWelcomeSeen()).not.toBeNull();
    expect(welcomeMayOpen("/shop", readWelcomeSeen())).toBe(false);
  });
});

describe("isTypingInto", () => {
  it("waits while she is typing into a field", () => {
    expect(isTypingInto({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTypingInto({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTypingInto({ tagName: "INPUT", type: "email" })).toBe(true);
    expect(isTypingInto({ tagName: "INPUT", type: "number" })).toBe(true);
    expect(isTypingInto({ tagName: "INPUT" })).toBe(true);
    expect(isTypingInto({ tagName: "SELECT" })).toBe(true);
    expect(isTypingInto({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("does not wait on a control that is only pressed", () => {
    expect(isTypingInto(null)).toBe(false);
    expect(isTypingInto({ tagName: "BODY" })).toBe(false);
    expect(isTypingInto({ tagName: "BUTTON", type: "submit" })).toBe(false);
    expect(isTypingInto({ tagName: "A" })).toBe(false);
    expect(isTypingInto({ tagName: "INPUT", type: "radio" })).toBe(false);
    expect(isTypingInto({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isTypingInto({ tagName: "DIV", isContentEditable: false })).toBe(false);
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
