import { beforeEach, describe, expect, it } from "vitest";
import { CONSENT_KEY, consentGiven, readConsent, writeConsent } from "./consent";

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

describe("cookie consent", () => {
  it("is unanswered at first", () => {
    expect(readConsent()).toBeNull();
    expect(consentGiven()).toBe(false);
  });

  it("keeps the answer and when it was given", () => {
    expect(writeConsent("accepted")).toBe(true);
    expect(readConsent()).toBe("accepted");
    expect(consentGiven()).toBe(true);
    expect(JSON.parse(store.get(CONSENT_KEY) ?? "{}")).toMatchObject({ choice: "accepted", at: expect.any(String) });
  });

  it("treats a decline as an answer that allows nothing optional", () => {
    writeConsent("declined");
    expect(readConsent()).toBe("declined");
    expect(consentGiven()).toBe(false);
  });

  it("reads anything unexpected as unanswered", () => {
    store.set(CONSENT_KEY, "yes");
    expect(readConsent()).toBeNull();
    store.set(CONSENT_KEY, JSON.stringify({ choice: "maybe" }));
    expect(readConsent()).toBeNull();
  });

  it("survives blocked storage", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    expect(readConsent()).toBeNull();
    expect(writeConsent("accepted")).toBe(false);
  });
});
