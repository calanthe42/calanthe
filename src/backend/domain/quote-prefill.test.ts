import { describe, expect, it } from "vitest";
import {
  filsToAedInput,
  parseQuoteForm,
  quotePrefill,
  type PreviousQuote,
  type QuoteEnquiry,
} from "./quote";

const CTX = { todayDubai: "2026-10-04" };

const ENQUIRY: QuoteEnquiry = {
  id: 45,
  enquiryNumber: "CAL-E-000045",
  type: "BUILD_YOUR_OWN",
  status: "NEW",
  contactName: "Layla Haddad",
  contactEmail: "layla@example.com",
  contactPhone: "+971 50 123 4567",
  locale: "ar",
  message: "Indicative total: AED 650\nRecipient: Noor\nRecipient phone: +971 55 555 0000",
  buildYourOwn: {
    indicativeTotalFils: 65050,
    budgetFils: 75000,
    deliveryDate: "2026-10-10T08:00:00.000Z",
    deliveryLocation: " Al Reem Island, Tower 3 ",
    cardMessage: "With love",
  },
};

describe("filsToAedInput", () => {
  it("writes whole dirhams without decimals and fractions with two", () => {
    expect(filsToAedInput(65000)).toBe("650");
    expect(filsToAedInput(65050)).toBe("650.50");
    expect(filsToAedInput(65005)).toBe("650.05");
  });

  it("is empty when there is nothing to suggest", () => {
    expect(filsToAedInput(null)).toBe("");
    expect(filsToAedInput(0)).toBe("");
    expect(filsToAedInput(-5)).toBe("");
  });
});

describe("quotePrefill — from the enquiry", () => {
  const prefill = quotePrefill(ENQUIRY, null, CTX);

  it("suggests the indicative total as the amount, in the form a florist types", () => {
    expect(prefill.amountAed).toBe("650.50");
    expect(prefill.indicativeFils).toBe(65050);
  });

  it("takes the email, a phone with its spaces removed, and the enquiry's language", () => {
    expect(prefill.customerEmail).toBe("layla@example.com");
    expect(prefill.customerPhone).toBe("+971501234567");
    expect(prefill.locale).toBe("ar");
  });

  it("names the arrangement in the customer's language", () => {
    expect(prefill.description).toBe("تنسيق خاص");
    expect(quotePrefill({ ...ENQUIRY, locale: null }, null, CTX).description).toBe("Bespoke arrangement");
    expect(quotePrefill({ ...ENQUIRY, type: "EVENT", locale: "en" }, null, CTX).description).toBe("Event flowers");
  });

  it("takes the delivery day as a UAE calendar day, and the address trimmed", () => {
    expect(prefill.deliveryDate).toBe("2026-10-10");
    expect(prefill.deliveryAddress).toBe("Al Reem Island, Tower 3");
    /* 21:30 UTC is already the next day in the UAE. */
    const late = quotePrefill(
      { ...ENQUIRY, buildYourOwn: { deliveryDate: "2026-10-10T21:30:00.000Z" } },
      null,
      CTX,
    );
    expect(late.deliveryDate).toBe("2026-10-11");
  });

  it("never prefills a time window: the enquiry form does not ask for one", () => {
    expect(prefill.deliveryTimeSlot).toBe("");
  });

  it("leaves a delivery day that has passed EMPTY rather than suggesting it", () => {
    const past = quotePrefill(
      { ...ENQUIRY, buildYourOwn: { deliveryDate: "2026-10-01T08:00:00.000Z" } },
      null,
      CTX,
    );
    expect(past.deliveryDate).toBe("");
  });

  it("reads the gift details the enquiry form wrote into the message", () => {
    expect(prefill.recipientName).toBe("Noor");
    expect(prefill.recipientPhone).toBe("+971555550000");
    expect(prefill.cardMessage).toBe("With love");
  });

  it("falls back to an event's date and venue for an event enquiry", () => {
    const event = quotePrefill(
      {
        ...ENQUIRY,
        type: "EVENT",
        buildYourOwn: null,
        message: "",
        relatedEvent: { quoteAmountFils: 500000, eventDate: "2026-11-20T08:00:00.000Z", eventLocation: "Emirates Palace" },
      },
      null,
      CTX,
    );
    expect(event.amountAed).toBe("5000");
    expect(event.deliveryDate).toBe("2026-11-20");
    expect(event.deliveryAddress).toBe("Emirates Palace");
  });

  it("is blank, not broken, for an enquiry that says almost nothing", () => {
    const bare = quotePrefill(
      { id: 1, type: "CUSTOM_REQUEST", contactName: "A", contactEmail: "a@b.co" },
      null,
      CTX,
    );
    expect(bare.amountAed).toBe("");
    expect(bare.indicativeFils).toBeNull();
    expect(bare.customerPhone).toBe("");
    expect(bare.deliveryDate).toBe("");
    expect(bare.locale).toBe("en");
  });
});

describe("quotePrefill — confirming again after a cancelled request", () => {
  const previous: PreviousQuote = {
    totalFils: 70000,
    description: "Peony cloud",
    deliveryDate: "2026-10-12T08:00:00.000Z",
    deliveryTimeSlot: "13:00 – 17:00",
    deliveryAddress: "Saadiyat, Villa 9",
    customerEmail: "corrected@example.com",
    customerPhone: "+971501234567",
    recipientName: null,
    recipientPhone: null,
    cardMessage: null,
    customerNote: "Peonies are in.",
    locale: "en",
  };
  const prefill = quotePrefill(ENQUIRY, previous, CTX);

  it("starts from what was sent last time, not from the enquiry", () => {
    expect(prefill.amountAed).toBe("700");
    expect(prefill.description).toBe("Peony cloud");
    expect(prefill.customerEmail).toBe("corrected@example.com");
    expect(prefill.deliveryDate).toBe("2026-10-12");
    expect(prefill.deliveryTimeSlot).toBe("13:00 – 17:00");
    expect(prefill.customerNote).toBe("Peonies are in.");
    expect(prefill.locale).toBe("en");
    expect(prefill.recipientName).toBe("");
  });

  it("still shows what the customer was first quoted, for the hint", () => {
    expect(prefill.indicativeFils).toBe(65050);
  });
});

describe("the prefill and the parser agree", () => {
  it("a prefilled form, with a window chosen, is accepted by parseQuoteForm unchanged", () => {
    const prefill = quotePrefill(ENQUIRY, null, CTX);
    const values: Record<string, string> = { ...prefill, deliveryTimeSlot: "10:00 – 13:00" } as never;
    const form = { get: (name: string) => values[name] ?? null };
    const parsed = parseQuoteForm(form as never, { todayDubai: CTX.todayDubai, slots: ["10:00 – 13:00"] });
    expect(parsed.amountFils).toBe(65050);
    expect(parsed.customerEmail).toBe("layla@example.com");
    expect(parsed.customerPhone).toBe("+971501234567");
    expect(parsed.recipientPhone).toBe("+971555550000");
    expect(parsed.locale).toBe("ar");
  });
});
