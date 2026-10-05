import { CONTACT } from "@/lib/data";

/**
 * Who the invoice is from.
 *
 * Not secrets, and not yet editable: there is no Settings screen, so these
 * are constants until one exists. Every value the owner has not supplied is
 * `null`, and a null is OMITTED from the invoice — a placeholder such as
 * "TRN: to be confirmed" must never reach a customer.
 *
 * VAT IS OFF. The owner's decision: the business is not charging VAT, so the
 * rate is 0, the document is titled "Invoice" and no VAT line or TRN is
 * printed. The structure is all here for the day that changes: set
 * `vatRegistered` to true, `vatRateBps` to 500 and supply `trn` and
 * `legalName` (business.test.ts refuses a build that turns VAT on without
 * them). Prices are then treated as VAT-INCLUSIVE — the order total never
 * changes, the invoice only says how much of it is tax — and orders already
 * paid keep the rate that was snapshotted onto them at payment.
 */
export type BusinessDetails = {
  tradingName: string;
  legalName: { en: string; ar: string } | null;
  addressLines: { en: readonly string[]; ar: readonly string[] } | null;
  city: { en: string; ar: string };
  country: { en: string; ar: string };
  tradeLicence: string | null;
  /** Tax registration number, 15 digits. */
  trn: string | null;
  vatRegistered: boolean;
  /** Basis points: 500 = 5%. Ignored unless `vatRegistered`. */
  vatRateBps: number;
  email: string;
  phone: string;
};

export const BUSINESS: BusinessDetails = {
  tradingName: "Calanthe",
  legalName: null /* OWNER TO PROVIDE */,
  addressLines: null /* OWNER TO PROVIDE */,
  city: { en: "Abu Dhabi", ar: "أبوظبي" },
  country: { en: "United Arab Emirates", ar: "الإمارات العربية المتحدة" },
  tradeLicence: null /* OWNER TO PROVIDE */,
  trn: null /* OWNER TO PROVIDE, 15 digits */,
  vatRegistered: false,
  vatRateBps: 0,
  email: CONTACT.email,
  phone: CONTACT.whatsapp,
};

/** The rate to snapshot onto an order at the moment it is paid. */
export function currentVatRateBps(business: BusinessDetails = BUSINESS): number {
  return business.vatRegistered ? business.vatRateBps : 0;
}
