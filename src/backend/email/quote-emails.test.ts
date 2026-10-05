import { describe, expect, it } from "vitest";
import { BUSINESS, type BusinessDetails } from "@/lib/business";
import { buildInvoice } from "@backend/domain/invoice";
import {
  COPY,
  buildPaymentRequestEmail,
  buildQuotePaidEmails,
  invoiceHtml,
  quoteFactsFromOrder,
  type QuoteOrderFacts,
} from "./quote-emails";

/**
 * The payment-request emails, in both languages.
 *
 * Kept beside the builders rather than appended to email.test.ts: that file
 * is about the gifting rule and the allowlist, and this one would have
 * doubled it.
 */

const ORDER: QuoteOrderFacts = {
  orderId: 12,
  orderNumber: "CAL-000123",
  customerName: "Layla Ahmed",
  customerEmail: "layla@example.com",
  customerPhone: "+971501234567",
  description: "Bespoke arrangement",
  deliveryDate: "2026-10-10T08:00:00.000Z",
  deliveryTimeSlot: "13:00 – 17:00",
  deliveryAddress: "Villa 4, Al Reem Island",
  customerNote: "Peonies are in this week.",
  totalFils: 65000,
};

const PAY_URL = "https://www.calanthe.ae/pay/abcDEF123_-abcDEF123_-abcDEF123_-abcDEF1234?lang=en";
const EXPIRES = new Date("2026-10-11T10:00:00.000Z");

const INVOICE = buildInvoice(
  {
    invoiceNumber: "CAL-INV-2026-00001",
    paidAt: "2026-10-04T10:00:00.000Z",
    orderNumber: ORDER.orderNumber,
    customerName: ORDER.customerName,
    customerEmail: ORDER.customerEmail,
    items: [{ productName: ORDER.description, quantity: 1, unitPriceFils: 65000, lineTotalFils: 65000 }],
    subtotalFils: 65000,
    deliveryFeeFils: 0,
    discountFils: 0,
    totalFils: 65000,
  },
  BUSINESS,
);

const VAT_BUSINESS: BusinessDetails = {
  ...BUSINESS,
  legalName: { en: "Calanthe Flowers LLC", ar: "كالانثي للزهور ذ.م.م" },
  trn: "100123456700003",
  vatRegistered: true,
  vatRateBps: 500,
};

const TAX_INVOICE = buildInvoice(
  {
    invoiceNumber: "CAL-INV-2026-00002",
    paidAt: "2026-10-04T10:00:00.000Z",
    orderNumber: ORDER.orderNumber,
    customerName: ORDER.customerName,
    customerEmail: ORDER.customerEmail,
    items: [{ productName: ORDER.description, quantity: 1, unitPriceFils: 65000, lineTotalFils: 65000 }],
    subtotalFils: 65000,
    totalFils: 65000,
    vatRateBps: 500,
    vatIncludedFils: 3095,
  },
  VAT_BUSINESS,
);

/** Every leaf key of a copy tree, as dotted paths. */
function keys(tree: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [`${prefix}${key}`] : keys(value as Record<string, unknown>, `${prefix}${key}.`),
  );
}

describe("the copy", () => {
  it("has exactly the same keys in English and Arabic", () => {
    expect(keys(COPY.ar).sort()).toEqual(keys(COPY.en).sort());
  });

  it("keeps every placeholder in the Arabic", () => {
    const tokens = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const en = COPY.en as unknown as Record<string, Record<string, string>>;
    const ar = COPY.ar as unknown as Record<string, Record<string, string>>;
    for (const path of keys(COPY.en)) {
      const [group, key] = path.split(".");
      if (!key) {
        expect(tokens(String((COPY.ar as Record<string, unknown>)[path])), path).toEqual(
          tokens(String((COPY.en as Record<string, unknown>)[path])),
        );
        continue;
      }
      expect(tokens(ar[group!]![key]!), path).toEqual(tokens(en[group!]![key]!));
    }
  });

  it("addresses everyone in the plural, and never calls flowers «طازج»", () => {
    const arabic = JSON.stringify(COPY.ar);
    expect(COPY.ar.request.payNow.startsWith("ادفعوا")).toBe(true);
    expect(arabic).toContain("تواصلوا");
    expect(arabic).not.toContain("طازج");
    /* The singular feminine imperative is the mistake this guards against. */
    expect(arabic).not.toMatch(/ادفعي|تواصلي|انسخي/);
  });

  it("makes no delivery-speed promise in either language", () => {
    const all = JSON.stringify(COPY);
    expect(all).not.toMatch(/same[- ]day/i);
    expect(all).not.toContain("اليوم نفسه");
    expect(all).not.toContain("نفس اليوم");
  });
});

describe("payment-request", () => {
  const english = buildPaymentRequestEmail({ order: ORDER, payUrl: PAY_URL, expiresAt: EXPIRES, locale: "en" });
  const arabic = buildPaymentRequestEmail({ order: ORDER, payUrl: PAY_URL, expiresAt: EXPIRES, locale: "ar" });

  it("goes to the payer, typed and linked to the order", () => {
    expect(english.to).toBe("layla@example.com");
    expect(english.type).toBe("payment-request");
    expect(english.orderId).toBe(12);
    expect(english.orderNumber).toBe("CAL-000123");
  });

  it.each([
    ["en", english],
    ["ar", arabic],
  ] as const)("%s: carries the amount, the link, the reference and the expiry", (_locale, email) => {
    expect(email.rendered.subject).toContain("AED 650");
    for (const part of [email.rendered.html, email.rendered.text]) {
      expect(part).toContain("AED 650");
      expect(part).toContain("CAL-000123");
      expect(part).toContain("2026");
    }
    expect(email.rendered.html).toContain(PAY_URL.replace(/&/g, "&amp;"));
    expect(email.rendered.text).toContain(PAY_URL);
    /* The URL is on a line of its own in the text part. */
    expect(email.rendered.text.split("\n")).toContain(PAY_URL);
    expect(email.rendered.text).not.toContain("<");
  });

  it("says the words: English", () => {
    expect(english.rendered.subject).toBe("Your arrangement is confirmed — AED 650 to pay");
    expect(english.rendered.html).toContain("Pay now — AED 650");
    expect(english.rendered.html).toContain("11 October 2026");
    expect(english.rendered.html).toContain("Peonies are in this week.");
    expect(english.rendered.html).toContain('lang="en"');
  });

  it("says the words: Arabic, right-to-left, plural", () => {
    expect(arabic.rendered.subject).toBe("تم تأكيد تنسيقكم — المبلغ المطلوب AED 650");
    expect(arabic.rendered.html).toContain('lang="ar"');
    expect(arabic.rendered.html).toContain('dir="rtl"');
    expect(arabic.rendered.html).toContain("ادفعوا الآن — AED 650");
    /* The amount stays left-to-right inside Arabic text. */
    expect(arabic.rendered.html).toContain('<span dir="ltr">AED 650</span>');
    expect(arabic.rendered.html).toContain("كالانثي");
  });

  it("never promises a delivery speed, and never says «طازج»", () => {
    for (const email of [english, arabic]) {
      for (const part of [email.rendered.subject, email.rendered.html, email.rendered.text]) {
        expect(part).not.toMatch(/same[- ]day/i);
        expect(part).not.toContain("طازج");
      }
    }
  });

  it("marks a resend as a reminder", () => {
    const again = buildPaymentRequestEmail({
      order: ORDER,
      payUrl: PAY_URL,
      expiresAt: EXPIRES,
      locale: "en",
      reminder: true,
    });
    expect(again.rendered.subject).toBe("Reminder: Your arrangement is confirmed — AED 650 to pay");
  });

  it("prints fils properly: AED 650.50, never AED 650.5", () => {
    const email = buildPaymentRequestEmail({
      order: { ...ORDER, totalFils: 65050 },
      payUrl: PAY_URL,
      expiresAt: EXPIRES,
      locale: "en",
    });
    expect(email.rendered.subject).toContain("AED 650.50");
    expect(email.rendered.html).not.toMatch(/AED 650\.5(?!0)/);
  });

  it("escapes everything a person typed, and keeps a newline out of the subject", () => {
    const hostile = buildPaymentRequestEmail({
      order: {
        ...ORDER,
        customerName: 'Layla <script>alert("x")</script>\r\nBcc: someone@evil.test',
        description: "<img src=x onerror=alert(1)>",
        deliveryAddress: "Villa <b>4</b>",
        customerNote: "</div><script>steal()</script>",
      },
      payUrl: PAY_URL,
      expiresAt: EXPIRES,
      locale: "en",
    });
    expect(hostile.rendered.html).not.toContain("<script>");
    expect(hostile.rendered.html).not.toContain("<img src=x");
    expect(hostile.rendered.html).not.toContain("<b>4</b>");
    expect(hostile.rendered.html).toContain("&lt;script&gt;");
    expect(hostile.rendered.subject).not.toMatch(/[\r\n]/);
  });
});

describe("payment-received, owner notice and job sheet", () => {
  const build = (locale: "en" | "ar", invoice = INVOICE, order = ORDER) =>
    buildQuotePaidEmails(
      { order, invoice, payUrl: PAY_URL, enquiryNumber: "CAL-E-000045", locale },
      { owner: "owner@example.com", florist: "florist@example.com" },
    );

  it("sends the customer, the owner and the florist one each", () => {
    const emails = build("en");
    expect(emails.map((e) => [e.type, e.to])).toEqual([
      ["payment-received", "layla@example.com"],
      ["owner-quote-paid", "owner@example.com"],
      ["florist-job-sheet", "florist@example.com"],
    ]);
  });

  it("sends only the customer's when no internal address is configured", () => {
    const emails = buildQuotePaidEmails({ order: ORDER, invoice: INVOICE, payUrl: PAY_URL, locale: "en" }, {});
    expect(emails.map((e) => e.type)).toEqual(["payment-received"]);
  });

  it("gives the customer the invoice: number, total and how it was paid", () => {
    const customer = build("en")[0]!;
    expect(customer.rendered.subject).toBe("Thank you — your invoice CAL-INV-2026-00001");
    for (const part of [customer.rendered.html, customer.rendered.text]) {
      expect(part).toContain("CAL-INV-2026-00001");
      expect(part).toContain("AED 650");
      expect(part).toContain("Paid by card on 4 October 2026");
      expect(part).toContain("Calanthe");
      expect(part).toContain("Abu Dhabi, United Arab Emirates");
    }
    expect(customer.rendered.html).toContain(">Invoice<");
    expect(customer.rendered.html).not.toContain("Tax invoice");
  });

  it("shows no VAT line and no TRN while VAT is off", () => {
    const customer = build("en")[0]!;
    for (const part of [customer.rendered.html, customer.rendered.text]) {
      expect(part).not.toMatch(/VAT/);
      expect(part).not.toMatch(/TRN/);
      expect(part).not.toMatch(/null|undefined|TO PROVIDE/);
    }
  });

  it("shows the VAT line, the TRN and the title of a tax invoice once VAT is on", () => {
    const customer = build("en", TAX_INVOICE)[0]!;
    for (const part of [customer.rendered.html, customer.rendered.text]) {
      expect(part).toContain("Tax invoice");
      expect(part).toContain("Includes VAT (5%)");
      expect(part).toContain("AED 30.95");
      expect(part).toContain("TRN 100123456700003");
      expect(part).toContain("Calanthe Flowers LLC");
    }
  });

  it("writes the Arabic invoice right-to-left with Arabic labels", () => {
    const customer = build("ar", TAX_INVOICE)[0]!;
    expect(customer.rendered.subject).toBe("شكرًا لكم — فاتورتكم CAL-INV-2026-00002");
    expect(customer.rendered.html).toContain('dir="rtl"');
    expect(customer.rendered.html).toContain("فاتورة ضريبية");
    expect(customer.rendered.html).toContain("يشمل ضريبة القيمة المضافة (5%)");
    expect(customer.rendered.html).toContain("مدفوعة بالبطاقة بتاريخ");
    expect(customer.rendered.html).toContain("أبوظبي");
    expect(customer.rendered.html).not.toContain("طازج");
  });

  it("prints a discount row for a discounted order", () => {
    const html = invoiceHtml(
      { ...INVOICE, subtotalFils: 72000, discountFils: 7000, discount: { code: "EID10", fils: 7000 } },
      "en",
    );
    expect(html).toContain("Discount (EID10)");
    expect(html).toContain("AED 70");
  });

  it("gives the owner the money and the customer's details", () => {
    const owner = build("en")[1]!;
    expect(owner.rendered.subject).toBe("Paid: CAL-000123 — AED 650 (bespoke, CAL-E-000045)");
    expect(owner.rendered.html).toContain("layla@example.com");
    expect(owner.rendered.html).toContain("+971501234567");
    expect(owner.rendered.html).toContain("Invoice CAL-INV-2026-00001");
    expect(owner.rendered.html).not.toMatch(/cancelled before the payment/);
  });

  it("warns the owner first when the request had been cancelled", () => {
    const owner = build("en", INVOICE, { ...ORDER, cancelled: true })[1]!;
    expect(owner.rendered.text.split("\n")[0]).toMatch(/cancelled before the payment arrived/);
    expect(owner.rendered.text).toMatch(/do not reinstate/);
  });

  it("keeps every price out of the florist's job sheet", () => {
    const sheet = build("en")[2]!;
    for (const part of [sheet.rendered.subject, sheet.rendered.html, sheet.rendered.text]) {
      const visible = part.replace(/<[^>]+>/g, " ").replace(/CAL-\d+/g, "");
      expect(visible).not.toMatch(/AED/i);
      expect(visible).not.toMatch(/\b650\b|65000/);
    }
    expect(sheet.rendered.html).toContain("Bespoke arrangement");
    expect(sheet.rendered.html).not.toContain("layla@example.com");
  });

  it("escapes a hostile name in every one of them", () => {
    const emails = build("en", INVOICE, { ...ORDER, customerName: "<script>x</script>\nLayla" });
    for (const email of emails) {
      expect(email.rendered.html).not.toContain("<script>");
      expect(email.rendered.subject).not.toMatch(/[\r\n]/);
    }
  });
});

describe("quoteFactsFromOrder", () => {
  it("reads the description from the order's own line, and notices a cancelled request", () => {
    const facts = quoteFactsFromOrder({
      id: 12,
      orderNumber: "CAL-000123",
      customerName: "Layla",
      customerEmail: "layla@example.com",
      customerPhone: "+971501234567",
      deliveryDate: "2026-10-10T08:00:00.000Z",
      deliveryTimeSlot: "13:00 – 17:00",
      deliveryAddress: "Villa 4",
      totalFils: 65000,
      fulfilmentStatus: "CANCELLED",
      items: [{ productName: "Peony cloud" }],
    });
    expect(facts.description).toBe("Peony cloud");
    expect(facts.cancelled).toBe(true);
    expect(facts).not.toHaveProperty("customerNote");
  });
});
