import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PayInvoice } from "@/components/commerce/PayInvoice";
import { PayLocaleAdopter, PayPrintButton } from "@/components/commerce/PayPageBits";
import { PayConfirming, PayRequestForm } from "@/components/commerce/PayRequestForm";
import { Reveal } from "@/components/motion/Reveal";
import { buttonClasses } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Monogram } from "@/components/ui/Monogram";
import { isPayIntentSettling, loadPayRequest } from "@backend/data/pay";
import { cardPaymentsConfigured, getStripe } from "@backend/payments/stripe";
import { LIMITS, clientAddress, throttle, waitHint } from "@backend/security/throttle";
import { CONTACT } from "@/lib/data";
import { formatDate, formatDeliveryDate } from "@/lib/i18n/date";
import { LOCALE_COOKIE, getDictionary } from "@/lib/i18n/server";
import { withWait } from "@/lib/i18n/wait";
import { formatFils } from "@/lib/money";

/**
 * The payment link — /pay/[token].
 *
 * A florist confirmed a bespoke arrangement and the customer was emailed this
 * address. The token in it is the whole of the visitor's authority: 256 bits,
 * good for paying this one order or reading its invoice, and nothing else.
 *
 * OPENING THE PAGE CHANGES NOTHING. Mail scanners and link previews fetch
 * every link in an email before its reader does, so a GET here creates no
 * PaymentIntent and writes no row. The intent is made when somebody presses
 * pay (backend/actions/pay.ts), and only Stripe's signed webhook marks the
 * order paid.
 *
 * THE TOKEN STAYS OUT OF OTHER PEOPLE'S LOGS. `referrer: no-referrer` keeps
 * the address out of the Referer header sent to Stripe and the font host; the
 * page is noindex and /pay/ is disallowed in robots.ts.
 *
 * ONE ANSWER FOR EVERY BAD LINK. Malformed, unknown, another environment's or
 * not a payment request at all: the same "we could not find this link", with
 * a 200 and no detail, so there is nothing to probe.
 *
 * Never cached: what this page says depends on the second it is asked.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    title: t.meta.pay,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

const MAIN = "mx-auto max-w-xl gutter section-pad";
const H1 = "font-display text-4xl font-light leading-tight text-olive lg:text-5xl";

/** A link that cannot be paid: what happened, what to do, and how to reach us. */
function Message({
  title,
  body,
  whatsapp,
}: {
  title: string;
  body: string;
  whatsapp?: string;
}) {
  return (
    <main className={MAIN}>
      <div className="flex min-h-[55svh] flex-col items-center justify-center gap-6 text-center">
        <Monogram className="w-14 text-ink-muted" />
        {/* The LCP on these states: rendered on the server, never faded in. */}
        <h1 className={`max-w-lg ${H1}`}>{title}</h1>
        <p className="max-w-md text-base leading-relaxed text-ink-muted">{body}</p>
        {whatsapp ? (
          <a
            href={CONTACT.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses("secondary", "whitespace-nowrap")}
          >
            {whatsapp}
          </a>
        ) : null}
      </div>
    </main>
  );
}

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string | string[]; payment_intent?: string | string[] }>;
}) {
  const [{ token }, query, { locale, t }, jar] = await Promise.all([
    params,
    searchParams,
    getDictionary(),
    cookies(),
  ]);

  /* The language the florist wrote in, for a visitor who has not chosen one. */
  const lang = query.lang === "ar" || query.lang === "en" ? query.lang : null;
  const adopt = lang && lang !== locale && !jar.has(LOCALE_COOKIE) ? lang : null;
  const adopter = adopt ? <PayLocaleAdopter locale={adopt} /> : null;

  /* Counted before the database is asked anything. A visible "please wait"
     in the visitor's language — never a blank page. */
  const views = await throttle(LIMITS.payView, await clientAddress());
  if (!views.allowed) {
    return (
      <>
        {adopter}
        <Message
          title={t.pay.busyTitle}
          body={withWait(locale, t, t.server.pay.rateLimited, waitHint(views.retryAfterSeconds))}
        />
      </>
    );
  }

  const request = await loadPayRequest(token);

  if (request.state === "invalid") {
    return (
      <>
        {adopter}
        <Message title={t.pay.invalidTitle} body={t.pay.invalidBody} whatsapp={t.pay.whatsapp} />
      </>
    );
  }

  const { view, invoice } = request;
  const amountText = formatFils(view.totalFils);

  if (request.state === "paid") {
    return (
      <main className={MAIN}>
        {adopter}
        <div className="print:hidden">
          <Eyebrow>{t.pay.reference.replace("{number}", view.orderNumber)}</Eyebrow>
          <h1 className={`mt-3 ${H1}`}>{t.pay.paidTitle}</h1>
          <p className="mt-5 text-base leading-relaxed text-ink-muted">{t.pay.paidBody}</p>
        </div>
        {invoice ? (
          <>
            <div className="mt-10 print:mt-0">
              <PayInvoice invoice={invoice} locale={locale} t={t} />
            </div>
            <div className="mt-6 print:hidden">
              <PayPrintButton label={t.pay.invoice.print} />
            </div>
          </>
        ) : (
          /* Paid, and the invoice number is a moment behind it. */
          <p className="mt-6 text-base leading-relaxed text-ink-muted">{t.pay.confirmingBody}</p>
        )}
      </main>
    );
  }

  /*
   * Back from Stripe (3-D Secure, a wallet that left the page) with
   * `?payment_intent=`. If that is THIS order's intent and the customer has
   * finished paying, the page waits for the webhook rather than offering the
   * form again. Read-only. Checked for an expired link too: a tab left open
   * can still complete a payment after the link ran out, and that customer
   * must see "confirming", not "expired".
   */
  const returned = typeof query.payment_intent === "string" ? query.payment_intent : null;
  if (returned && (await isPayIntentSettling(token, returned))) {
    return (
      <main className={MAIN}>
        {adopter}
        <PayConfirming token={token} />
      </main>
    );
  }

  if (request.state === "expired") {
    return (
      <>
        {adopter}
        <Message title={t.pay.expiredTitle} body={t.pay.expiredBody} whatsapp={t.pay.whatsapp} />
      </>
    );
  }
  if (request.state === "cancelled") {
    return (
      <>
        {adopter}
        <Message title={t.pay.cancelledTitle} body={t.pay.cancelledBody} whatsapp={t.pay.whatsapp} />
      </>
    );
  }

  /* Card payments are not set up on this deployment: say so, and how to reach us. */
  if (!getStripe() || !cardPaymentsConfigured()) {
    return (
      <>
        {adopter}
        <Message
          title={t.pay.title}
          body={t.server.checkout.paymentUnavailable}
          whatsapp={t.pay.whatsapp}
        />
      </>
    );
  }

  const rowLabel = "font-brand text-xs font-medium uppercase tracking-brand text-ink-muted";

  return (
    <main className={MAIN}>
      {adopter}
      <PayRequestForm
        token={token}
        totalFils={view.totalFils}
        amountText={amountText}
        validUntil={
          view.payLinkExpiresAt
            ? t.pay.validUntil.replace("{date}", formatDate(locale, view.payLinkExpiresAt))
            : null
        }
      >
        <Eyebrow>{t.pay.eyebrow}</Eyebrow>
        {/* The LCP: on the server, in the first byte, never animated in. */}
        <h1 className={`mt-3 ${H1}`}>{t.pay.title}</h1>
        <p className="mt-5 text-base leading-relaxed text-ink-muted">{t.pay.intro}</p>

        <Reveal className="mt-8">
          <section
            aria-label={t.pay.eyebrow}
            className="rounded-sm border border-hairline bg-cream p-6 text-olive"
          >
            <p className="text-sm text-ink-muted">
              {t.pay.reference.replace("{number}", view.orderNumber)}
            </p>
            <dl className="mt-4 flex flex-col gap-4">
              <div>
                <dt className={rowLabel}>{t.pay.arrangement}</dt>
                <dd className="mt-1 break-words font-display text-2xl font-light leading-snug">
                  {view.description || t.pay.bespokeDefault}
                </dd>
              </div>
              <div>
                <dt className={rowLabel}>{t.pay.delivery}</dt>
                <dd className="mt-1 text-base">
                  {formatDeliveryDate(locale, view.deliveryDate)}
                  {" · "}
                  {/* A time range reads 10:00 – 13:00 in either language. */}
                  <span dir="ltr">{view.deliveryTimeSlot}</span>
                </dd>
              </div>
              <div>
                <dt className={rowLabel}>{t.pay.deliverTo}</dt>
                <dd className="mt-1 whitespace-pre-line break-words text-base">{view.deliveryAddress}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className={rowLabel}>{t.pay.deliveryCharge}</dt>
                <dd className="text-base">{t.checkout.complimentary}</dd>
              </div>
            </dl>

            {view.customerNote ? (
              <div className="mt-5 border-s border-sage ps-4">
                <p className={rowLabel}>{t.pay.noteTitle}</p>
                <p className="mt-1 whitespace-pre-line break-words text-base leading-relaxed">
                  {view.customerNote}
                </p>
              </div>
            ) : null}

            <div className="mt-6 flex items-baseline justify-between gap-4 border-t border-hairline pt-5">
              <p className="font-brand text-xs font-medium uppercase tracking-brand">{t.pay.total}</p>
              <p dir="ltr" className="font-display text-3xl">
                {amountText}
              </p>
            </div>
          </section>
        </Reveal>
      </PayRequestForm>
    </main>
  );
}
