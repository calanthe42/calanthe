import { describe, expect, it } from "vitest";
import { FormInputError } from "@backend/domain/form-error";
import { validateBespokeLines, validateOrderTotals } from "@backend/payload/hooks/orderIntegrity";
import {
  isQuotableEnquiry,
  parseBespokeMessage,
  parseQuoteForm,
  quoteCustomerId,
  quoteOrderData,
  suggestedQuoteFils,
  type QuoteEnquiry,
} from "./quote";

const ENQUIRY: QuoteEnquiry = {
  id: 45,
  enquiryNumber: "CAL-E-000045",
  type: "BUILD_YOUR_OWN",
  status: "NEW",
  contactName: "Layla Ahmed",
  contactEmail: "layla@example.com",
  contactPhone: "+971501234567",
};

const SLOTS = ["10:00 – 13:00", "13:00 – 17:00", "17:00 – 21:00"] as const;
const CTX = { todayDubai: "2026-10-04", slots: SLOTS };

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    amountAed: "650",
    description: "",
    deliveryDate: "2026-10-10",
    deliveryTimeSlot: "13:00 – 17:00",
    deliveryAddress: "Villa 4, Al Reem Island",
    customerEmail: "layla@example.com",
    customerPhone: "+971501234567",
    locale: "en",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/** The code a refused form carries — what the admin translates. */
function refusal(overrides: Record<string, string>): string | undefined {
  try {
    parseQuoteForm(form(overrides), CTX);
  } catch (error) {
    if (error instanceof FormInputError) return error.code;
    throw error;
  }
  return "accepted";
}

describe("suggestedQuoteFils", () => {
  it("prefers the recorded indicative total", () => {
    expect(
      suggestedQuoteFils({
        ...ENQUIRY,
        message: "Indicative total: AED 900",
        buildYourOwn: { indicativeTotalFils: 65000, budgetFils: 50000 },
      }),
    ).toBe(65000);
  });

  it("falls back to the total written into the message", () => {
    expect(suggestedQuoteFils({ ...ENQUIRY, message: "Budget: AED 500\nIndicative total: AED 650" })).toBe(65000);
    expect(suggestedQuoteFils({ ...ENQUIRY, message: "Indicative total: AED 650.50\nNotes: x" })).toBe(65050);
  });

  it("then to a budget, then to an event's quote, then to nothing", () => {
    expect(suggestedQuoteFils({ ...ENQUIRY, buildYourOwn: { budgetFils: 50000 } })).toBe(50000);
    expect(suggestedQuoteFils({ ...ENQUIRY, customRequest: { budgetFils: 30000 } })).toBe(30000);
    expect(suggestedQuoteFils({ ...ENQUIRY, relatedEvent: { quoteAmountFils: 900000 } })).toBe(900000);
    expect(suggestedQuoteFils({ ...ENQUIRY, relatedEvent: 7 })).toBeNull();
    expect(suggestedQuoteFils(ENQUIRY)).toBeNull();
  });
});

describe("parseBespokeMessage", () => {
  it("reads the recipient's name and phone", () => {
    expect(
      parseBespokeMessage("Budget: AED 500\nFor: a gift\nRecipient: Noor Saleh\nRecipient phone: +971511111111"),
    ).toEqual({ recipientName: "Noor Saleh", recipientPhone: "+971511111111" });
  });

  it("is empty when the flowers are for the sender", () => {
    expect(parseBespokeMessage("Budget: AED 500\nFor: themselves")).toEqual({});
    expect(parseBespokeMessage(null)).toEqual({});
  });
});

describe("which enquiries can be sent a payment request", () => {
  it("allows the three bespoke kinds and refuses spam and the rest", () => {
    for (const type of ["BUILD_YOUR_OWN", "EVENT", "CUSTOM_REQUEST"]) {
      expect(isQuotableEnquiry({ type, status: "NEW" })).toBe(true);
      expect(isQuotableEnquiry({ type, status: "SPAM" })).toBe(false);
    }
    expect(isQuotableEnquiry({ type: "MEMBERSHIP", status: "NEW" })).toBe(false);
    expect(isQuotableEnquiry({ type: "CONTACT", status: "NEW" })).toBe(false);
  });
});

describe("parseQuoteForm — the amount", () => {
  it("turns dirhams into fils, exactly", () => {
    expect(parseQuoteForm(form({ amountAed: "650" }), CTX).amountFils).toBe(65000);
    expect(parseQuoteForm(form({ amountAed: "650.5" }), CTX).amountFils).toBe(65050);
    expect(parseQuoteForm(form({ amountAed: "1,250" }), CTX).amountFils).toBe(125000);
    expect(parseQuoteForm(form({ amountAed: "2" }), CTX).amountFils).toBe(200);
  });

  it("refuses an empty amount", () => {
    expect(refusal({ amountAed: "" })).toBe("amountRequired");
  });

  it("refuses anything below the minimum charge of AED 2", () => {
    expect(refusal({ amountAed: "0.29" })).toBe("amountTooLow");
    expect(refusal({ amountAed: "1.99" })).toBe("amountTooLow");
    expect(refusal({ amountAed: "0" })).toBe("amountTooLow");
  });

  it("refuses a decimal comma rather than reading 12,50 as 1,250", () => {
    expect(refusal({ amountAed: "12,50" })).toBe("amountFormat");
    expect(refusal({ amountAed: "650,5" })).toBe("amountFormat");
  });

  it("refuses words, negatives and three decimals", () => {
    expect(refusal({ amountAed: "abc" })).toBe("amountFormat");
    expect(refusal({ amountAed: "-650" })).toBe("amountFormat");
    expect(refusal({ amountAed: "650.555" })).toBe("amountFormat");
  });

  it("refuses an absurdly high amount", () => {
    expect(refusal({ amountAed: "1000001" })).toBe("amountTooHigh");
  });

  it("never reads a fils field smuggled into the form", () => {
    const smuggled = form({ amountAed: "650" });
    smuggled.set("amountFils", "1");
    smuggled.set("totalFils", "1");
    expect(parseQuoteForm(smuggled, CTX).amountFils).toBe(65000);
  });
});

describe("parseQuoteForm — everything else", () => {
  it("stores the delivery day as noon in the UAE", () => {
    expect(parseQuoteForm(form(), CTX).deliveryDate).toBe("2026-10-10T08:00:00.000Z");
  });

  it("accepts today and refuses yesterday", () => {
    expect(refusal({ deliveryDate: "2026-10-04" })).toBe("accepted");
    expect(refusal({ deliveryDate: "2026-10-03" })).toBe("deliveryDatePast");
  });

  it("refuses a missing or impossible date", () => {
    expect(refusal({ deliveryDate: "" })).toBe("deliveryDateRequired");
    expect(refusal({ deliveryDate: "10/10/2026" })).toBe("deliveryDateRequired");
    expect(refusal({ deliveryDate: "2026-02-31" })).toBe("deliveryDateRequired");
  });

  it("refuses a time window that is not one the shop offers", () => {
    expect(refusal({ deliveryTimeSlot: "03:00 – 04:00" })).toBe("slotRequired");
    expect(refusal({ deliveryTimeSlot: "" })).toBe("slotRequired");
  });

  it("requires an address", () => {
    expect(refusal({ deliveryAddress: "" })).toBe("addressRequired");
  });

  it("requires phones in international format", () => {
    expect(refusal({ customerPhone: "0501234567" })).toBe("phoneFormat");
    expect(refusal({ customerPhone: "" })).toBe("phoneFormat");
    expect(refusal({ recipientPhone: "0501234567" })).toBe("phoneFormat");
    expect(parseQuoteForm(form({ customerPhone: "+971 50 123 4567" }), CTX).customerPhone).toBe("+971501234567");
  });

  it("takes the email from the form — corrected at confirmation — and validates it", () => {
    expect(parseQuoteForm(form({ customerEmail: " Layla.Fixed@Example.com " }), CTX).customerEmail).toBe(
      "layla.fixed@example.com",
    );
    expect(refusal({ customerEmail: "layla@" })).toBe("emailFormat");
    expect(refusal({ customerEmail: "" })).toBe("emailFormat");
  });

  it("refuses a note over 600 characters, a card over 300, a description over 140", () => {
    expect(refusal({ customerNote: "x".repeat(601) })).toBe("tooLong");
    expect(refusal({ customerNote: "x".repeat(600) })).toBe("accepted");
    expect(refusal({ cardMessage: "x".repeat(301) })).toBe("tooLong");
    expect(refusal({ description: "x".repeat(141) })).toBe("tooLong");
  });

  it("names the line by the email language when the florist leaves it empty", () => {
    expect(parseQuoteForm(form({ locale: "en" }), CTX).description).toBe("Bespoke arrangement");
    expect(parseQuoteForm(form({ locale: "ar" }), CTX).description).toBe("تنسيق خاص");
    expect(parseQuoteForm(form({ locale: "fr" }), CTX).locale).toBe("en");
  });

  it("keeps a description on one line, so it cannot break an email subject", () => {
    expect(parseQuoteForm(form({ description: "Peony\r\nBcc: x@y.z" }), CTX).description).toBe("Peony Bcc: x@y.z");
  });
});

describe("quoteOrderData", () => {
  const parsed = parseQuoteForm(form({ recipientName: "Noor", customerNote: "Peonies are in." }), CTX);
  const extra = { salt: "salt", tokenHash: "hash", expiresAt: new Date("2026-10-11T10:00:00.000Z") };

  it("builds one bespoke line whose price is every total", () => {
    const data = quoteOrderData(ENQUIRY, parsed, extra);
    expect(data.items).toHaveLength(1);
    const [line] = data.items;
    expect(line).not.toHaveProperty("product");
    expect(line?.productSlug).toBe("bespoke-arrangement");
    expect(line?.quantity).toBe(1);
    expect(line?.unitPriceFils).toBe(65000);
    expect(line?.lineTotalFils).toBe(65000);
    expect(data.subtotalFils).toBe(65000);
    expect(data.totalFils).toBe(65000);
    expect(data.deliveryFeeFils).toBe(0);
    expect(data.discountFils).toBe(0);
    expect(data.paymentStatus).toBe("PENDING");
    expect(data.fulfilmentStatus).toBe("NEW");
    expect(data.source).toBe("admin-quote");
    expect(data.enquiry).toBe(45);
    expect(data.deliveryEmirate).toBe("abu-dhabi");
    expect(data.payLinkExpiresAt).toBe("2026-10-11T10:00:00.000Z");
  });

  it("is a guest order unless the enquiry was made while signed in", () => {
    const guest = quoteOrderData(ENQUIRY, parsed, extra);
    expect(guest.customerType).toBe("guest");
    expect(guest).not.toHaveProperty("customer");

    const registered = quoteOrderData(ENQUIRY, parsed, { ...extra, customerId: 9 });
    expect(registered.customerType).toBe("registered");
    expect(registered.customer).toBe(9);
  });

  it("links an account only from the enquiry's own customer, never by matching an email", () => {
    expect(quoteCustomerId(ENQUIRY)).toBeUndefined();
    expect(quoteCustomerId({ ...ENQUIRY, customer: 9 })).toBe(9);
    expect(quoteCustomerId({ ...ENQUIRY, customer: { id: 9 } })).toBe(9);
  });

  it("writes the address the florist confirmed, not the one on the enquiry", () => {
    const corrected = parseQuoteForm(form({ customerEmail: "right@example.com" }), CTX);
    expect(quoteOrderData(ENQUIRY, corrected, extra).customerEmail).toBe("right@example.com");
  });

  it("passes the order collection's own integrity hooks unchanged", () => {
    const data = quoteOrderData(ENQUIRY, parsed, extra);
    expect(() => validateOrderTotals({ data, operation: "create" } as never)).not.toThrow();
    expect(() => validateBespokeLines({ data, operation: "create" } as never)).not.toThrow();
  });
});
