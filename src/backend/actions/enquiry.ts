"use server";

import { getPayload, type RequiredDataFromCollectionSlug } from "payload";
import config from "@payload-config";

/**
 * The atelier's two remaining lead flows, recorded instead of discarded.
 *
 * WHAT THIS REPLACES. Build Your Own asked eight questions — occasion,
 * budget, colours, vase, card message, notes — and then did this:
 *
 *     window.open(whatsappHref, "_blank");
 *
 * The brief was serialised into a WhatsApp URL and nothing was kept. If the
 * customer never pressed send, or the tab was blocked, or they changed their
 * mind at the last second, the atelier never knew the enquiry existed. The
 * Events page was worse: two buttons straight to WhatsApp, no form at all.
 *
 * Both now write a real Enquiry. WhatsApp stays as a second route for people
 * who would rather talk, but it is no longer the only one.
 *
 * WHY overrideAccess. `enquiries.create` is staff-only by design — an openly
 * writable enquiries table is an open funnel into the business. A visitor has
 * no permissions, so the write cannot run as them. This is the same
 * documented server-side exception guest checkout uses, and it is safe for
 * the same reason: nothing the visitor sends carries authority. Every field
 * is validated here and `type`, `status`, `priority` and `source` are set by
 * this function, never accepted from the caller.
 */

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type EnquiryResult =
  | { ok: true; reference: string }
  | { ok: false; code: string; message: string };

function fail(code: string, message: string): EnquiryResult {
  return { ok: false, code, message };
}

/** Trim, collapse whitespace, cap at the column's length. */
function clean(value: string | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

type Contact = { name: string; email: string; phone: string };

function checkContact(c: Contact): EnquiryResult | null {
  if (clean(c.name, 140).length < 2) return fail("name", "Please tell us your name.");
  if (!EMAIL.test(clean(c.email, 200))) {
    return fail("email", "Please check your email address.");
  }
  if (!E164.test(clean(c.phone, 40))) {
    return fail(
      "phone",
      "Please include your phone number with its country code, like +9715…",
    );
  }
  return null;
}

async function create(
  data: RequiredDataFromCollectionSlug<"enquiries">,
): Promise<EnquiryResult> {
  try {
    const payload = await getPayload({ config });
    const doc = await payload.create({
      collection: "enquiries",
      overrideAccess: true,
      data,
    });
    /* `assignEnquiryNumber` fills this in a beforeChange hook. */
    const reference = String(
      (doc as { enquiryNumber?: string }).enquiryNumber ?? doc.id,
    );
    return { ok: true, reference };
  } catch (error) {
    /* Neutral for the visitor, detailed for the log. A failed enquiry must
       never be shown as a successful one. */
    console.error("enquiry failed", error);
    return fail(
      "unknown",
      "We could not record that just now. Please try again, or message us on WhatsApp.",
    );
  }
}

/* ------------------------------------------------------------------ */
/* Build Your Own                                                      */
/* ------------------------------------------------------------------ */

export type BespokeEnquiryRequest = Contact & {
  occasion: string;
  budgetAed: number;
  colours: readonly string[];
  floristChoosesColours: boolean;
  vase: boolean | null;
  cardMessage: string;
  leaveCardBlank: boolean;
  notes: string;
  totalAed: number;
};

export async function submitBespokeEnquiry(
  request: BespokeEnquiryRequest,
): Promise<EnquiryResult> {
  const invalid = checkContact(request);
  if (invalid) return invalid;

  if (!request.occasion) return fail("occasion", "Please choose the occasion.");
  if (!Number.isFinite(request.budgetAed) || request.budgetAed <= 0) {
    return fail("budget", "Please choose a budget.");
  }

  const colours = request.floristChoosesColours
    ? "Florist's choice"
    : request.colours.join(", ");

  /* The schema's buildYourOwn group has no column for the vase, the card or
     the running total, so they are written into the message the florist
     actually reads. Losing them would defeat the point of recording this. */
  const message = [
    `Occasion: ${request.occasion}`,
    `Budget: AED ${request.budgetAed}`,
    colours ? `Colours: ${colours}` : "",
    request.vase === null ? "" : `Vase: ${request.vase ? "yes" : "no"}`,
    request.leaveCardBlank
      ? "Card: leave blank"
      : request.cardMessage
        ? `Card: ${request.cardMessage}`
        : "",
    request.totalAed ? `Indicative total: AED ${request.totalAed}` : "",
    clean(request.notes, 1200) ? `Notes: ${clean(request.notes, 1200)}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);

  return create({
    type: "BUILD_YOUR_OWN",
    status: "NEW",
    priority: "NORMAL",
    source: "WEBSITE",
    contactName: clean(request.name, 140),
    contactEmail: clean(request.email, 200).toLowerCase(),
    contactPhone: clean(request.phone, 40),
    subject: `Build your own — ${request.occasion}`,
    message,
    buildYourOwn: {
      budgetFils: Math.round(request.budgetAed * 100),
      ...(request.cardMessage && !request.leaveCardBlank
        ? { cardMessage: clean(request.cardMessage, 300) }
        : {}),
      ...(clean(request.notes, 2000)
        ? { specialInstructions: clean(request.notes, 2000) }
        : {}),
    },
  });
}

/* ------------------------------------------------------------------ */
/* Events                                                             */
/* ------------------------------------------------------------------ */

export type EventEnquiryRequest = Contact & {
  company?: string;
  eventType: string;
  eventDate?: string;
  guests?: string;
  venue?: string;
  notes?: string;
};

export async function submitEventEnquiry(
  request: EventEnquiryRequest,
): Promise<EnquiryResult> {
  const invalid = checkContact(request);
  if (invalid) return invalid;

  if (!clean(request.eventType, 80)) {
    return fail("eventType", "Please tell us what kind of occasion it is.");
  }

  let when: string | undefined;
  if (request.eventDate) {
    const parsed = new Date(request.eventDate);
    if (Number.isNaN(parsed.getTime())) {
      return fail("eventDate", "Please check the date.");
    }
    when = parsed.toISOString();
  }

  const message = [
    `Occasion: ${clean(request.eventType, 80)}`,
    request.guests ? `Guests: ${clean(request.guests, 40)}` : "",
    request.venue ? `Venue: ${clean(request.venue, 240)}` : "",
    clean(request.notes, 2000) ? `Notes: ${clean(request.notes, 2000)}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 8000);

  return create({
    type: "EVENT",
    status: "NEW",
    /* An event is a large, dated commitment — it should not sit in the queue
       behind a single bouquet enquiry. */
    priority: "HIGH",
    source: "WEBSITE",
    contactName: clean(request.name, 140),
    contactEmail: clean(request.email, 200).toLowerCase(),
    contactPhone: clean(request.phone, 40),
    ...(clean(request.company ?? "", 140)
      ? { company: clean(request.company, 140) }
      : {}),
    subject: `Event — ${clean(request.eventType, 80)}`,
    /* Enquiries has no event detail group — an EVENT enquiry links to an
       `events` record, which is a staff-created object holding the venue,
       guest count and services. Creating one from a public form would let
       anyone write into the operations calendar, so the details stay in the
       message until a florist has qualified the enquiry. */
    message: when
      ? `Date: ${new Date(when).toISOString().slice(0, 10)}
${message}`
      : message,
  });
}
