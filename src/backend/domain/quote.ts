import { FormInputError } from "@backend/domain/form-error";
import {
  parseAedToFils,
  readText,
  within,
  type FormReader,
} from "@backend/domain/product-form";
import { BESPOKE_SLUG, QUOTE_MIN_FILS, QUOTE_SOURCE } from "@backend/payments/pay-link";

/**
 * Turning a confirmed enquiry into an order somebody can pay for.
 *
 * PURE — no Payload, no request, no clock (today is passed in) — so every
 * money rule is unit-tested and the server action is left doing only what
 * needs a server.
 *
 * THE AMOUNT. A florist types dirhams into "Final amount". This is the one
 * place it becomes integer fils; it is parsed, bounded and then frozen on the
 * order by `immutableAfterCreate`. Nothing a customer's browser sends is ever
 * read as an amount.
 */

export const QUOTABLE_ENQUIRY_TYPES = ["BUILD_YOUR_OWN", "EVENT", "CUSTOM_REQUEST"] as const;

export type QuoteLocale = "en" | "ar";

/** What the line is called when the florist leaves the field empty. */
export const BESPOKE_DEFAULT_DESCRIPTION: Record<QuoteLocale, string> = {
  en: "Bespoke arrangement",
  ar: "تنسيق خاص",
};

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
/* The UAE has no daylight saving; +04:00 is correct all year. Noon, so the
   stored instant is the same calendar day in every timezone that reads it. */
const UAE_NOON = "T12:00:00+04:00";

type Relation = number | { id: number } | null | undefined;

const relationId = (value: Relation): number | undefined =>
  typeof value === "number" ? value : value && typeof value === "object" ? value.id : undefined;

export type QuoteEnquiry = {
  id: number;
  enquiryNumber?: string | null;
  type?: string | null;
  status?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  message?: string | null;
  locale?: QuoteLocale | null;
  customer?: Relation;
  assignedStaff?: Relation;
  buildYourOwn?: {
    indicativeTotalFils?: number | null;
    budgetFils?: number | null;
    deliveryDate?: string | null;
    deliveryLocation?: string | null;
    cardMessage?: string | null;
  } | null;
  customRequest?: { budgetFils?: number | null } | null;
  relatedEvent?: number | { quoteAmountFils?: number | null } | null;
};

/** Can this enquiry be sent a payment request at all? */
export function isQuotableEnquiry(enquiry: { type?: string | null; status?: string | null }): boolean {
  return (
    (QUOTABLE_ENQUIRY_TYPES as readonly string[]).includes(enquiry.type ?? "") &&
    enquiry.status !== "SPAM"
  );
}

const positive = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;

/**
 * What to prefill "Final amount" with — a suggestion, never a charge.
 *
 * The indicative total the form showed the customer is the best guess; older
 * enquiries carry it only inside the free-text message. A budget is a ceiling
 * rather than a price, so it comes after both.
 */
export function suggestedQuoteFils(enquiry: QuoteEnquiry): number | null {
  const indicative = positive(enquiry.buildYourOwn?.indicativeTotalFils);
  if (indicative) return indicative;

  const match = /Indicative total: AED (\d+(?:\.\d{1,2})?)/.exec(enquiry.message ?? "");
  if (match?.[1]) {
    const fils = Math.round(Number(match[1]) * 100);
    if (Number.isSafeInteger(fils) && fils > 0) return fils;
  }

  const event = typeof enquiry.relatedEvent === "object" ? enquiry.relatedEvent : null;
  return (
    positive(enquiry.buildYourOwn?.budgetFils) ??
    positive(enquiry.customRequest?.budgetFils) ??
    positive(event?.quoteAmountFils) ??
    null
  );
}

/**
 * The recipient lines backend/actions/enquiry.ts writes into the message.
 * "Recipient:" must not match "Recipient phone:", hence the anchors.
 */
export function parseBespokeMessage(message: string | null | undefined): {
  recipientName?: string;
  recipientPhone?: string;
} {
  const text = message ?? "";
  const name = /^Recipient: (.+)$/m.exec(text)?.[1]?.trim();
  const phone = /^Recipient phone: (.+)$/m.exec(text)?.[1]?.trim();
  return {
    ...(name ? { recipientName: name } : {}),
    ...(phone ? { recipientPhone: phone } : {}),
  };
}

export type ParsedQuote = {
  description: string;
  amountFils: number;
  /** ISO instant: noon in the UAE on the chosen day. */
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryAddress: string;
  /** Where the payment email, Stripe's receipt and the invoice go. */
  customerEmail: string;
  customerPhone: string;
  recipientName?: string;
  recipientPhone?: string;
  cardMessage?: string;
  customerNote?: string;
  locale: QuoteLocale;
};

/** One line: no newline can reach an email subject or a table cell. */
const oneLine = (value: string): string => value.replace(/\s+/g, " ").trim();

/**
 * Reads the "Send payment request" form.
 *
 * Field names: amountAed, description, deliveryDate (YYYY-MM-DD),
 * deliveryTimeSlot, deliveryAddress, customerEmail, customerPhone,
 * recipientName, recipientPhone, cardMessage, customerNote, locale.
 *
 * `customerEmail` is read from the form, not from the enquiry: an enquiry's
 * contact details are frozen, so this is the one moment a typo in the
 * address can be put right before money is asked for at it.
 */
export function parseQuoteForm(
  form: FormReader,
  ctx: { todayDubai: string; slots: readonly string[] },
): ParsedQuote {
  const locale: QuoteLocale = readText(form.get("locale")) === "ar" ? "ar" : "en";

  const rawAmount = readText(form.get("amountAed"));
  /* The shared parser reads a comma as a thousands separator, so "12,50" —
     twelve and a half, typed the European way — would become AED 1,250. On a
     price list that is a typo someone sees; here it is an amount a customer
     is asked to pay. A comma is accepted only where a thousands separator
     can be. */
  if (rawAmount.includes(",") && !/^(aed)?\s*\d{1,3}(,\d{3})+(\.\d{1,2})?$/i.test(rawAmount)) {
    throw new FormInputError(
      "Final amount: enter an amount in dirhams, like 480 or 480.50.",
      "amountFormat",
      { label: "Final amount" },
    );
  }
  const amountFils = parseAedToFils(rawAmount, "Final amount");
  if (amountFils === null) {
    throw new FormInputError("Enter the final amount in dirhams.", "amountRequired");
  }
  if (amountFils < QUOTE_MIN_FILS) {
    throw new FormInputError("The amount must be at least AED 2.", "amountTooLow");
  }

  const description =
    within(oneLine(readText(form.get("description"))), 140, "The description") ||
    BESPOKE_DEFAULT_DESCRIPTION[locale];

  const customerEmail = readText(form.get("customerEmail")).toLowerCase();
  if (customerEmail.length > 200 || !EMAIL.test(customerEmail)) {
    throw new FormInputError("Enter the customer's email address.", "emailFormat");
  }

  const day = readText(form.get("deliveryDate"));
  if (!day) throw new FormInputError("Choose the delivery date.", "deliveryDateRequired");
  const at = DAY.test(day) ? new Date(`${day}${UAE_NOON}`) : new Date(Number.NaN);
  /* 2026-02-31 parses to March in some engines; refuse anything that does
     not come back out as the day that went in. */
  if (Number.isNaN(at.getTime()) || new Date(at.getTime() + 4 * 3_600_000).toISOString().slice(0, 10) !== day) {
    throw new FormInputError("Choose the delivery date.", "deliveryDateRequired");
  }
  if (day < ctx.todayDubai) {
    throw new FormInputError("The delivery date is in the past.", "deliveryDatePast");
  }

  const deliveryTimeSlot = readText(form.get("deliveryTimeSlot"));
  if (!ctx.slots.includes(deliveryTimeSlot)) {
    throw new FormInputError("Choose a time window.", "slotRequired");
  }

  const deliveryAddress = within(readText(form.get("deliveryAddress")), 600, "The delivery address");
  if (!deliveryAddress) throw new FormInputError("Enter the delivery address.", "addressRequired");

  const phoneError = () =>
    new FormInputError("Enter the phone in international format, e.g. +971501234567.", "phoneFormat");

  const customerPhone = readText(form.get("customerPhone")).replace(/[\s-]/g, "");
  if (!E164.test(customerPhone)) throw phoneError();

  const recipientPhone = readText(form.get("recipientPhone")).replace(/[\s-]/g, "");
  if (recipientPhone && !E164.test(recipientPhone)) throw phoneError();

  const recipientName = within(oneLine(readText(form.get("recipientName"))), 140, "The recipient name");
  const cardMessage = within(readText(form.get("cardMessage")), 300, "The card message");
  const customerNote = within(readText(form.get("customerNote")), 600, "The note to the customer");

  return {
    description,
    amountFils,
    deliveryDate: at.toISOString(),
    deliveryTimeSlot,
    deliveryAddress,
    customerEmail,
    customerPhone,
    ...(recipientName ? { recipientName } : {}),
    ...(recipientPhone ? { recipientPhone } : {}),
    ...(cardMessage ? { cardMessage } : {}),
    ...(customerNote ? { customerNote } : {}),
    locale,
  };
}

export type QuoteOrderData = ReturnType<typeof quoteOrderData>;

/**
 * The exact `orders.create` payload for a payment request — built here so
 * the totals are assembled in one tested place.
 *
 * One line, one unit, no product; unit = line = subtotal = total = the
 * amount; no delivery fee and no discount. That is precisely the shape
 * validateBespokeLines demands, and validateOrderTotals passes it unchanged.
 *
 * `customerId` links the order to an account ONLY when the enquiry itself
 * was made while signed in. Matching a free-typed email to an account would
 * put one person's address and phone into another person's order history the
 * first time somebody mistyped — or lied.
 */
export function quoteOrderData(
  enquiry: QuoteEnquiry,
  parsed: ParsedQuote,
  extra: { customerId?: number; salt: string; tokenHash: string; expiresAt: Date },
) {
  const assignedStaff = relationId(enquiry.assignedStaff);
  return {
    enquiry: enquiry.id,
    locale: parsed.locale,
    source: QUOTE_SOURCE,

    customerType: extra.customerId ? ("registered" as const) : ("guest" as const),
    ...(extra.customerId ? { customer: extra.customerId } : {}),
    customerName: oneLine(enquiry.contactName).slice(0, 140),
    customerEmail: parsed.customerEmail,
    customerPhone: parsed.customerPhone,

    deliveryAddress: parsed.deliveryAddress,
    /* The only zone the atelier delivers to. */
    deliveryEmirate: "abu-dhabi" as const,
    deliveryDate: parsed.deliveryDate,
    deliveryTimeSlot: parsed.deliveryTimeSlot,
    ...(parsed.customerNote ? { customerNote: parsed.customerNote } : {}),

    ...(parsed.recipientName ? { recipientName: parsed.recipientName } : {}),
    ...(parsed.recipientPhone ? { recipientPhone: parsed.recipientPhone } : {}),
    ...(parsed.cardMessage ? { cardMessage: parsed.cardMessage } : {}),

    items: [
      {
        productName: parsed.description,
        productSlug: BESPOKE_SLUG,
        quantity: 1,
        unitPriceFils: parsed.amountFils,
        lineTotalFils: parsed.amountFils,
        selectedOptions: [],
      },
    ],

    subtotalFils: parsed.amountFils,
    deliveryFeeFils: 0,
    discountFils: 0,
    totalFils: parsed.amountFils,
    currency: "AED" as const,

    /* Not paid until Stripe's signed webhook says so. */
    paymentStatus: "PENDING" as const,
    fulfilmentStatus: "NEW" as const,
    ...(assignedStaff ? { assignedStaff } : {}),

    payTokenSalt: extra.salt,
    payTokenHash: extra.tokenHash,
    payLinkExpiresAt: extra.expiresAt.toISOString(),
  };
}

/** The account to link, by the rule above. */
export function quoteCustomerId(enquiry: QuoteEnquiry): number | undefined {
  return relationId(enquiry.customer);
}

/* ------------------------------------------------------------------ */
/* Prefilling the "confirm & request payment" form                     */
/* ------------------------------------------------------------------ */

/** What an EVENT enquiry is quoted as when the florist types nothing. */
export const EVENT_DEFAULT_DESCRIPTION: Record<QuoteLocale, string> = {
  en: "Event flowers",
  ar: "زهور المناسبة",
};

/** Fils as a florist would type them: "650", or "650.50" — never "650.5". */
export function filsToAedInput(fils: number | null | undefined): string {
  const value = positive(fils);
  if (!value) return "";
  return value % 100 === 0 ? String(value / 100) : (value / 100).toFixed(2);
}

/** Everything the form opens with. All of it is editable; none of it is trusted. */
export type QuotePrefill = {
  amountAed: string;
  /** The total the enquiry form showed the customer, for the hint. */
  indicativeFils: number | null;
  description: string;
  /** YYYY-MM-DD, or "" when unknown or already past. */
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryAddress: string;
  customerEmail: string;
  customerPhone: string;
  recipientName: string;
  recipientPhone: string;
  cardMessage: string;
  customerNote: string;
  locale: QuoteLocale;
};

/** A cancelled request's details, when the florist is confirming again. */
export type PreviousQuote = {
  totalFils: number;
  description: string;
  deliveryDate: string;
  deliveryTimeSlot: string;
  deliveryAddress: string;
  customerEmail: string;
  customerPhone: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  cardMessage?: string | null;
  customerNote?: string | null;
  locale: QuoteLocale;
};

type PrefillEnquiry = Omit<QuoteEnquiry, "relatedEvent"> & {
  relatedEvent?:
    | number
    | { quoteAmountFils?: number | null; eventDate?: string | null; eventLocation?: string | null }
    | null;
};

/** The UAE calendar day of an instant; "" when it cannot be read. */
function uaeDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return new Date(at.getTime() + 4 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * What the dialog opens with.
 *
 * A cancelled request wins over the enquiry — "confirm again" is nearly
 * always the same arrangement with one thing corrected. A delivery day that
 * has already passed is left EMPTY rather than prefilled: the server would
 * refuse it, and a date nobody chose is worse than a date nobody filled in.
 */
export function quotePrefill(
  enquiry: PrefillEnquiry,
  previous: PreviousQuote | null,
  ctx: { todayDubai: string },
): QuotePrefill {
  const future = (day: string): string => (day && day >= ctx.todayDubai ? day : "");
  const indicative = suggestedQuoteFils(enquiry as QuoteEnquiry);

  if (previous) {
    return {
      amountAed: filsToAedInput(previous.totalFils),
      indicativeFils: indicative,
      description: previous.description,
      deliveryDate: future(uaeDay(previous.deliveryDate)),
      deliveryTimeSlot: previous.deliveryTimeSlot,
      deliveryAddress: previous.deliveryAddress,
      customerEmail: previous.customerEmail,
      customerPhone: previous.customerPhone,
      recipientName: previous.recipientName ?? "",
      recipientPhone: previous.recipientPhone ?? "",
      cardMessage: previous.cardMessage ?? "",
      customerNote: previous.customerNote ?? "",
      locale: previous.locale,
    };
  }

  const locale: QuoteLocale = enquiry.locale === "ar" ? "ar" : "en";
  const event = typeof enquiry.relatedEvent === "object" ? enquiry.relatedEvent : null;
  const recipient = parseBespokeMessage(enquiry.message);
  return {
    amountAed: filsToAedInput(indicative),
    indicativeFils: indicative,
    description:
      enquiry.type === "EVENT" ? EVENT_DEFAULT_DESCRIPTION[locale] : BESPOKE_DEFAULT_DESCRIPTION[locale],
    deliveryDate: future(uaeDay(enquiry.buildYourOwn?.deliveryDate ?? event?.eventDate)),
    deliveryTimeSlot: "",
    deliveryAddress: (enquiry.buildYourOwn?.deliveryLocation ?? event?.eventLocation ?? "").trim(),
    customerEmail: enquiry.contactEmail,
    customerPhone: (enquiry.contactPhone ?? "").replace(/[\s-]/g, ""),
    recipientName: recipient.recipientName ?? "",
    recipientPhone: (recipient.recipientPhone ?? "").replace(/[\s-]/g, ""),
    cardMessage: enquiry.buildYourOwn?.cardMessage ?? "",
    customerNote: "",
    locale,
  };
}
