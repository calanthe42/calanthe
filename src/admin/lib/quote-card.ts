import "server-only";
import type { QuoteCardData, QuoteFormSetup } from "@admin/components/QuotePayment";
import type { QuoteSummary } from "@backend/data/quote";
import { dubaiDateInputValue } from "@backend/domain/dates";
import { isQuotableEnquiry, quotePrefill, type QuoteEnquiry } from "@backend/domain/quote";
import { PAY_LINK_TTL_DAYS } from "@backend/payments/pay-link";
import { timeSlots } from "@/lib/data";
import { dictionaryFor } from "@/lib/i18n/dictionary";

/**
 * What the Payment card is given — plain data, built on the server.
 *
 * The card is a Client Component, so everything it receives is serialised
 * into the page. That is why this is an allow-list assembled field by field
 * from the summary, and why the summary itself (backend/data/quote.ts) never
 * carries the salt or the hash.
 */

/**
 * "Send on WhatsApp": a wa.me link to the customer's own number, carrying one
 * sentence and the pay link. The sentence is in the CUSTOMER's language (the
 * one the email went out in), from the storefront dictionary — it is read by
 * them, not by the florist.
 */
function whatsappHref(quote: QuoteSummary): string | null {
  const digits = quote.customerPhone.replace(/\D/g, "");
  if (!quote.payUrl || digits.length < 8) return null;
  const text = dictionaryFor(quote.locale).pay.whatsappMessage.replace("{url}", quote.payUrl);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function quoteCardData(quote: QuoteSummary): QuoteCardData {
  return {
    orderId: quote.orderId,
    orderNumber: quote.orderNumber,
    state: quote.state,
    totalFils: quote.totalFils,
    customerEmail: quote.customerEmail,
    createdAt: quote.createdAt,
    payLinkExpiresAt: quote.payLinkExpiresAt,
    paidAt: quote.paidAt,
    invoiceNumber: quote.invoiceNumber,
    payUrl: quote.payUrl,
    whatsappHref: whatsappHref(quote),
    lastEmail: quote.lastEmail,
    sendCount: quote.sendCount,
  };
}

/**
 * The confirm form's starting values, or null when this enquiry cannot be
 * sent a payment request (a membership or contact enquiry, or one marked
 * spam). A cancelled request prefills "confirm again".
 */
export function quoteFormSetup(
  enquiry: QuoteEnquiry,
  quote: QuoteSummary | null,
  now: Date = new Date(),
): QuoteFormSetup | null {
  if (!isQuotableEnquiry(enquiry)) return null;
  const todayDubai = dubaiDateInputValue(now.toISOString());
  return {
    enquiryId: enquiry.id,
    customerName: enquiry.contactName,
    prefill: quotePrefill(enquiry, quote && quote.state === "cancelled" ? quote : null, { todayDubai }),
    slots: timeSlots,
    todayDubai,
    ttlDays: PAY_LINK_TTL_DAYS,
  };
}
