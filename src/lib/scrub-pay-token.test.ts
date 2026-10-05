import { describe, expect, it } from "vitest";
import { scrubPayPath, scrubPayTokens } from "./scrub-pay-token";

const TOKEN = "Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6"; // 43 chars, token-shaped

describe("scrubPayPath", () => {
  it("replaces the token in a payment-link address", () => {
    expect(scrubPayPath(`https://www.calanthe.ae/pay/${TOKEN}?lang=ar`)).toBe(
      "https://www.calanthe.ae/pay/[token]?lang=ar",
    );
  });

  it("keeps Stripe's return parameters out of it, but not the path", () => {
    expect(scrubPayPath(`/pay/${TOKEN}?payment_intent=pi_123`)).toBe("/pay/[token]?payment_intent=pi_123");
  });

  it("leaves every other address alone", () => {
    for (const path of ["/checkout", "/product/peony-cloud", "/pay", "/pay/", "/payments/help"]) {
      expect(scrubPayPath(path)).toBe(path);
    }
  });

  it("replaces every occurrence in one string", () => {
    expect(scrubPayPath(`from /pay/${TOKEN} to /pay/${TOKEN}`)).toBe("from /pay/[token] to /pay/[token]");
  });
});

describe("scrubPayTokens", () => {
  it("scrubs the request URL, the transaction name and breadcrumbs of an event", () => {
    const event = {
      transaction: `GET /pay/${TOKEN}`,
      request: { url: `https://www.calanthe.ae/pay/${TOKEN}`, headers: { Referer: `https://x/pay/${TOKEN}` } },
      breadcrumbs: [{ category: "navigation", data: { from: "/", to: `/pay/${TOKEN}` } }],
      exception: { values: [{ value: `fetch failed for /pay/${TOKEN}` }] },
      level: "error",
    };
    const scrubbed = scrubPayTokens(event);
    expect(JSON.stringify(scrubbed)).not.toContain(TOKEN);
    expect(scrubbed.transaction).toBe("GET /pay/[token]");
    expect(scrubbed.request.url).toBe("https://www.calanthe.ae/pay/[token]");
    expect(scrubbed.breadcrumbs[0]?.data.to).toBe("/pay/[token]");
    expect(scrubbed.level).toBe("error");
  });

  it("passes through what is not an object or a string", () => {
    expect(scrubPayTokens(null)).toBeNull();
    expect(scrubPayTokens(42)).toBe(42);
    expect(scrubPayTokens(undefined)).toBeUndefined();
  });

  it("does not follow a structure for ever", () => {
    type Node = { next?: Node; url: string };
    const loop: Node = { url: `/pay/${TOKEN}` };
    loop.next = loop;
    expect(() => scrubPayTokens(loop)).not.toThrow();
    expect(loop.url).toBe("/pay/[token]");
  });
});
