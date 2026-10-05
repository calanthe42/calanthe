import type { Metadata } from "next";
import { InvoiceSheet } from "@/components/commerce/InvoiceSheet";
import { PayPrintButton } from "@/components/commerce/PayPageBits";
import { buttonClasses } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { loadInvoiceByKey } from "@backend/data/invoices";
import { LIMITS, clientAddress, throttle, waitHint } from "@backend/security/throttle";
import { CONTACT } from "@/lib/data";
import { dictionaryFor } from "@/lib/i18n/dictionary";
import { getDictionary } from "@/lib/i18n/server";
import { withWait } from "@/lib/i18n/wait";

/**
 * A paid invoice, on the atelier's paper, at an address that cannot be
 * guessed: `/invoice/<number>/<key>`.
 *
 * This is what "View / PDF" opens in the admin and what the shop sends a
 * customer who asks for their invoice. "Download PDF" is the browser's own
 * print-to-PDF; the print rules in app/(frontend)/invoice.css put the sheet
 * on A4 and nothing else.
 *
 * The sheet is written in the language of the ORDER (or `?lang=`), whatever
 * language the visitor's site happens to be in: an invoice is a document, and
 * a document does not change language with the reader's cookie.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDictionary();
  return {
    title: t.pay.invoice.title,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

const H1 = "font-display text-4xl font-light leading-tight text-olive lg:text-5xl";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ number: string; key: string }>;
  searchParams: Promise<{ lang?: string | string[] }>;
}) {
  const [{ number, key }, query, { locale, t }] = await Promise.all([params, searchParams, getDictionary()]);

  const views = await throttle(LIMITS.payView, await clientAddress());
  const invoice = views.allowed ? await loadInvoiceByKey(decodeURIComponent(number), key) : null;

  if (!invoice) {
    return (
      <main className="mx-auto max-w-xl gutter section-pad">
        <div className="flex min-h-[55svh] flex-col items-center justify-center gap-6 text-center">
          <Monogram className="w-14 text-ink-muted" />
          <h1 className={`max-w-lg ${H1}`}>{views.allowed ? t.pay.invoice.missingTitle : t.pay.busyTitle}</h1>
          <p className="max-w-md text-base leading-relaxed text-ink-muted">
            {views.allowed
              ? t.pay.invoice.missingBody
              : withWait(locale, t, t.server.pay.rateLimited, waitHint(views.retryAfterSeconds))}
          </p>
          <a
            href={CONTACT.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses("secondary", "whitespace-nowrap")}
          >
            {t.pay.whatsapp}
          </a>
        </div>
      </main>
    );
  }

  const sheetLocale = query.lang === "ar" || query.lang === "en" ? query.lang : invoice.locale;
  const sheetCopy = dictionaryFor(sheetLocale);

  return (
    <main className="mx-auto max-w-4xl gutter section-pad">
      <h1 className="sr-only">
        {sheetCopy.pay.invoice.title} {invoice.sheet.number}
      </h1>
      <div className="mx-auto mb-6 flex max-w-[210mm] justify-end print:hidden">
        <PayPrintButton label={sheetCopy.pay.invoice.download} />
      </div>
      <InvoiceSheet sheet={invoice.sheet} locale={sheetLocale} t={sheetCopy} />
    </main>
  );
}
