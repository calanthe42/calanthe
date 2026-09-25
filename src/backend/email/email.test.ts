import { describe, expect, it } from "vitest";
import { bareAddress, decideRecipient, parseAllowlist } from "./allowlist";
import { buildOrderEmails, describeOptions } from "./order-emails";
import { floristJobSheet, formatMoney, orderConfirmation, ownerNewOrder, passwordReset, verifyAddress } from "./templates";
import type { OrderEmailInput } from "./order-emails";

const ORDER: OrderEmailInput = {
  orderId: 1,
  orderNumber: "CAL-000001",
  customerName: "Layla",
  customerEmail: "layla@example.com",
  customerPhone: "+971500000000",
  deliveryAddress: "Villa 12, Al Barsha 2",
  deliveryEmirate: "Dubai",
  deliveryDate: "Friday, 26 September",
  deliveryTimeSlot: "13:00 – 17:00",
  recipientName: "Noor",
  recipientPhone: "+971511111111",
  cardMessage: "For everything. — L",
  lines: [{ productName: "Amber Hour", quantity: 1, options: "Large, with a vase" }],
  subtotalFils: 65000,
  deliveryFeeFils: 2500,
  totalFils: 67500,
};

/**
 * What a READER would see. Markup is stripped first, because an inline style
 * such as `line-height:1.25` is not a price — a test that counts it as one
 * fails for the wrong reason, as this one did on its first run.
 */
function visibleText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");
}

/** Every way a price could reach a reader, so a leak cannot hide. */
function mentionsMoney(html: string): boolean {
  const text = visibleText(html).replace(/CAL-\d+/g, "");
  return (
    /AED/i.test(text) ||
    /\b650\b|\b675\b|\b25\b/.test(text) ||
    /65000|67500|2500/.test(text)
  );
}

describe("the gifting rule", () => {
  it("keeps every price out of the florist's job sheet", () => {
    const sheet = floristJobSheet({
      orderNumber: ORDER.orderNumber,
      customerName: ORDER.customerName,
      recipientName: ORDER.recipientName,
      deliveryDate: ORDER.deliveryDate,
      deliveryTimeSlot: ORDER.deliveryTimeSlot,
      deliveryEmirate: ORDER.deliveryEmirate,
      deliveryAddress: ORDER.deliveryAddress,
      cardMessage: ORDER.cardMessage,
      recipientPhone: ORDER.recipientPhone,
      lines: ORDER.lines,
      audience: "florist",
    });
    expect(mentionsMoney(sheet.html)).toBe(false);
    expect(mentionsMoney(sheet.text)).toBe(false);
    expect(mentionsMoney(sheet.subject)).toBe(false);
  });

  it("still gives the florist everything needed to compose the order", () => {
    const sheet = buildOrderEmails(ORDER, { florist: "florist@example.com" }).find(
      (r) => r.type === "florist-job-sheet",
    )!;
    for (const needed of ["Amber Hour", "Al Barsha", "Noor", "For everything"]) {
      expect(sheet.rendered.html).toContain(needed);
    }
  });

  it("lets the customer and the owner see the money", () => {
    const emails = buildOrderEmails(ORDER, { owner: "owner@example.com" });
    const customer = emails.find((e) => e.type === "order-confirmation")!;
    const owner = emails.find((e) => e.type === "owner-new-order")!;
    expect(customer.rendered.html).toContain("AED 675");
    expect(owner.rendered.html).toContain("AED 675");
  });

  it("never sends internal mail when no internal address is configured", () => {
    const emails = buildOrderEmails(ORDER, {});
    expect(emails.map((e) => e.type)).toEqual(["order-confirmation"]);
  });

  it("addresses each email to the right person", () => {
    const emails = buildOrderEmails(ORDER, { owner: "owner@x.com", florist: "florist@x.com" });
    expect(emails.find((e) => e.type === "order-confirmation")!.to).toBe(ORDER.customerEmail);
    expect(emails.find((e) => e.type === "owner-new-order")!.to).toBe("owner@x.com");
    expect(emails.find((e) => e.type === "florist-job-sheet")!.to).toBe("florist@x.com");
  });
});

describe("every email has a plain-text part", () => {
  it.each(
    buildOrderEmails(ORDER, { owner: "o@x.com", florist: "f@x.com" }).map(
      (e) => [e.type, e] as const,
    ),
  )("%s", (_type, email) => {
    expect(email.rendered.text.trim().length).toBeGreaterThan(20);
    expect(email.rendered.text).not.toContain("<");
    expect(email.rendered.subject.trim().length).toBeGreaterThan(3);
  });

  it("covers the auth emails too", () => {
    for (const e of [
      verifyAddress({ name: "Layla", url: "https://calanthe.ae/v?token=abc" }),
      passwordReset({ name: "Layla", url: "https://calanthe.ae/r?token=abc" }),
    ]) {
      expect(e.text).toContain("https://calanthe.ae");
      expect(e.text).not.toContain("<");
      expect(e.html).toContain("https://calanthe.ae");
    }
  });
});

describe("money formatting", () => {
  it("renders fils as whole dirhams", () => {
    expect(formatMoney(65000)).toBe("AED 650");
    expect(formatMoney(0)).toBe("AED 0");
  });

  it("keeps the fils when they are not round", () => {
    expect(formatMoney(65050)).toBe("AED 650.50");
  });

  it("never shows a raw fils integer to a reader", () => {
    expect(formatMoney(67500)).not.toContain("67500");
  });
});

describe("the non-production allowlist", () => {
  it("lets production email anyone", () => {
    expect(
      decideRecipient("stranger@example.com", { vercelEnv: "production", allowlist: undefined })
        .allowed,
    ).toBe(true);
  });

  it("blocks everything outside production when the list is empty", () => {
    const d = decideRecipient("stranger@example.com", { vercelEnv: "preview", allowlist: "" });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain("EMAIL_ALLOWLIST");
  });

  it("allows a listed address on preview and blocks an unlisted one", () => {
    const list = "owner@gmail.com, tester@gmail.com";
    expect(decideRecipient("owner@gmail.com", { vercelEnv: "preview", allowlist: list }).allowed).toBe(true);
    expect(decideRecipient("OWNER@GMAIL.COM", { vercelEnv: "preview", allowlist: list }).allowed).toBe(true);
    expect(decideRecipient("customer@example.com", { vercelEnv: "preview", allowlist: list }).allowed).toBe(false);
  });

  it("allows a whole domain when one is listed", () => {
    expect(decideRecipient("anyone@calanthe.ae", { vercelEnv: "preview", allowlist: "@calanthe.ae" }).allowed).toBe(true);
    expect(decideRecipient("anyone@elsewhere.com", { vercelEnv: "preview", allowlist: "@calanthe.ae" }).allowed).toBe(false);
  });

  it("reads the address out of a display name", () => {
    expect(bareAddress("Calanthe <orders@calanthe.ae>")).toBe("orders@calanthe.ae");
    expect(bareAddress("  Plain@Example.com ")).toBe("plain@example.com");
  });

  it("parses a list written any reasonable way", () => {
    expect(parseAllowlist("a@x.com, b@x.com;c@x.com  d@x.com")).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
    ]);
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("not-an-address")).toEqual([]);
  });

  it("treats a local machine as non-production", () => {
    expect(decideRecipient("a@b.com", { vercelEnv: undefined, allowlist: "" }).allowed).toBe(false);
  });
});

describe("option descriptions", () => {
  it("joins the words a reader understands", () => {
    expect(describeOptions([{ value: "Large" }, { value: "With a vase" }])).toBe("Large, With a vase");
  });
  it("is absent rather than empty", () => {
    expect(describeOptions([])).toBeUndefined();
    expect(describeOptions(null)).toBeUndefined();
    expect(describeOptions([{ value: "" }])).toBeUndefined();
  });
});

describe("escaping", () => {
  it("does not let a card message inject markup", () => {
    const sheet = floristJobSheet({
      orderNumber: "CAL-1",
      customerName: "A",
      deliveryDate: "d",
      deliveryTimeSlot: "t",
      deliveryEmirate: "Dubai",
      deliveryAddress: "addr",
      cardMessage: '<script>alert("x")</script>',
      lines: [{ productName: "X", quantity: 1 }],
      audience: "florist",
    });
    expect(sheet.html).not.toContain("<script>");
    expect(sheet.html).toContain("&lt;script&gt;");
  });

  it("escapes a product name too", () => {
    const e = orderConfirmation({
      orderNumber: "CAL-1",
      customerName: "A & B",
      deliveryDate: "d",
      deliveryTimeSlot: "t",
      deliveryEmirate: "Dubai",
      deliveryAddress: "addr",
      lines: [{ productName: "Roses & Peonies", quantity: 1 }],
      audience: "customer",
      customerEmail: "a@b.com",
      customerPhone: "+9715",
      subtotal: { fils: 100, currency: "AED" },
      deliveryFee: { fils: 0, currency: "AED" },
      total: { fils: 100, currency: "AED" },
    });
    expect(e.html).toContain("Roses &amp; Peonies");
  });
});

describe("owner email", () => {
  it("carries the customer's contact details, which the florist sheet does not", () => {
    const owner = ownerNewOrder({
      ...ORDER,
      audience: "owner",
      subtotal: { fils: ORDER.subtotalFils, currency: "AED" },
      deliveryFee: { fils: ORDER.deliveryFeeFils, currency: "AED" },
      total: { fils: ORDER.totalFils, currency: "AED" },
      lines: ORDER.lines,
    });
    expect(owner.html).toContain("layla@example.com");
    const sheet = buildOrderEmails(ORDER, { florist: "f@x.com" }).find(
      (r) => r.type === "florist-job-sheet",
    )!;
    expect(sheet.rendered.html).not.toContain("layla@example.com");
  });
});
