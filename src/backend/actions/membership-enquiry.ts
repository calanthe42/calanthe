"use server";

import { getPayload } from "payload";
import config from "@payload-config";
import { LIMITS, guardByAddress } from "@backend/security/throttle";

/**
 * Membership interest, recorded in the system rather than thrown at WhatsApp.
 *
 * WHAT THIS REPLACES. "Begin Signature" used to open WhatsApp with one line of
 * text: "Hello Calanthe, I'd like to begin the Signature membership." The
 * delivery day the visitor had just chosen on the page was discarded, and so
 * was everything else. Nothing was recorded anywhere, so the atelier could not
 * count membership interest, see which plan people wanted, or follow up on the
 * ones that went cold — for the one product on the site built on recurring
 * revenue.
 *
 * WHAT IT DOES NOT DO. It does not start a membership, take a payment, or
 * create a Membership record. It writes an ENQUIRY whose membership status is
 * the schema's only allowed value, "interest". Activating a membership needs a
 * Membership record and a payment, and neither happens here — the collection
 * says so in its own description, and this function honours it.
 *
 * WHY overrideAccess IS USED. `enquiries.create` is staff-only by design: an
 * openly writable enquiries table is an open funnel into the business. A
 * visitor has no permissions, so the write cannot run as them. This is the
 * same documented, greppable exception that guest checkout uses, and it is
 * safe for the same reason — nothing the visitor sends carries authority.
 * Every field is validated here, the type is pinned to MEMBERSHIP, and the
 * status fields are set by this function rather than accepted from the caller.
 */

export type MembershipEnquiryRequest = {
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  /** The tier card the visitor pressed — recorded in the subject line. */
  planName: string;
  frequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  deliveryPreference: "home" | "office" | "gift";
  /** The day already chosen on the page. Previously discarded. */
  deliveryDay?: string;
  preferredStartDate?: string;
  deliveryLocation?: string;
  notes?: string;
};

export type MembershipEnquiryResult =
  | { ok: true; reference: string }
  | { ok: false; code: string; message: string };

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const FREQUENCIES = ["WEEKLY", "FORTNIGHTLY", "MONTHLY"] as const;
const PREFERENCES = ["home", "office", "gift"] as const;

function fail(code: string, message: string): MembershipEnquiryResult {
  return { ok: false, code, message };
}

/** Trim, collapse whitespace, and cap at the column's length. */
function clean(value: string | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export async function submitMembershipEnquiry(
  request: MembershipEnquiryRequest,
): Promise<MembershipEnquiryResult> {
  /* One bucket for every lead form. These write to the enquiry list the
     owner works through by hand, so spam here does not degrade a service —
     it wastes a florist's morning. */
  const wait = await guardByAddress(LIMITS.enquiry);
  if (wait) return fail("throttled", `That is a lot of enquiries at once. ${wait}`);

  const contactName = clean(request.contactName, 140);
  const contactEmail = clean(request.contactEmail, 200).toLowerCase();
  const contactPhone = clean(request.contactPhone, 40);
  const planName = clean(request.planName, 60);

  if (contactName.length < 2) {
    return fail("name", "Please tell us your name.");
  }
  if (!EMAIL.test(contactEmail)) {
    return fail("email", "Please check your email address.");
  }
  if (!E164.test(contactPhone)) {
    return fail("phone", "Please include your phone number with its country code, like +9715…");
  }
  if (!FREQUENCIES.includes(request.frequency)) {
    return fail("frequency", "Please choose how often the flowers should arrive.");
  }
  if (!PREFERENCES.includes(request.deliveryPreference)) {
    return fail("deliveryPreference", "Please choose where the flowers should go.");
  }

  /* A date the visitor picked is only useful if it is a real one, and never
     in the past — a start date behind today is a typo, not a request. */
  let preferredStartDate: string | undefined;
  if (request.preferredStartDate) {
    const parsed = new Date(request.preferredStartDate);
    if (Number.isNaN(parsed.getTime())) {
      return fail("startDate", "Please check the start date.");
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (parsed < today) {
      return fail("startDate", "Please choose a start date from today onward.");
    }
    preferredStartDate = parsed.toISOString();
  }

  const deliveryDay = clean(request.deliveryDay, 20);
  const deliveryLocation = clean(request.deliveryLocation, 240);

  /* The day and the drop-off point have no columns of their own on the
     membership group, so they are written into the notes the florist reads —
     losing them again would defeat the point of the form. */
  const notes = [
    deliveryDay ? `Preferred delivery day: ${deliveryDay}` : "",
    deliveryLocation ? `Delivery to: ${deliveryLocation}` : "",
    clean(request.notes, 1500),
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);

  try {
    const payload = await getPayload({ config });

    const created = await payload.create({
      collection: "enquiries",
      overrideAccess: true,
      data: {
        /* Pinned here, never taken from the caller. `source` records how it
           reached the atelier, which is the point of this change: these used
           to arrive as WhatsApp messages and now arrive from the site. */
        type: "MEMBERSHIP",
        status: "NEW",
        priority: "NORMAL",
        source: "WEBSITE",
        contactName,
        contactEmail,
        contactPhone,
        subject: planName
          ? `Membership interest — ${planName}`
          : "Membership interest",
        /* Spread rather than `message: notes || undefined`: Payload's
           generated types reject an explicitly-undefined property, which is
           why every optional field in checkout.ts is written this way too. */
        ...(notes ? { message: notes } : {}),
        membership: {
          /* The schema allows exactly one value. Interest, never active. */
          status: "interest",
          frequency: request.frequency,
          deliveryPreference: request.deliveryPreference,
          ...(preferredStartDate ? { preferredStartDate } : {}),
          ...(notes ? { notes } : {}),
        },
      },
    });

    /* `assignEnquiryNumber` fills this in a beforeChange hook. */
    const reference = String(
      (created as { enquiryNumber?: string }).enquiryNumber ?? created.id,
    );
    return { ok: true, reference };
  } catch (error) {
    /* The visitor is told something neutral; the detail goes to the server
       log. A failed enquiry must never look like a successful one. */
    console.error("membership enquiry failed", error);
    return fail(
      "unknown",
      "We could not record that just now. Please try again, or message us on WhatsApp.",
    );
  }
}
