import type { InvoiceView } from "@backend/domain/invoice";
import type { Dictionary, Locale } from "@/lib/i18n/dictionary";
import { formatDate } from "@/lib/i18n/date";
import { formatFils } from "@/lib/money";

/**
 * The invoice, on the page.
 *
 * Rendered from the SAME InvoiceView as the invoice in the thank-you email
 * (backend/domain/invoice.ts), so the two cannot disagree about what was sold
 * or what it cost. Whatever the owner has not supplied — legal name, address,
 * licence, TRN — is simply absent: a placeholder never reaches a customer.
 *
 * `data-print-sheet` is what "Print or save as PDF" prints: globals.css hides
 * everything else on the page, so the paper is the invoice alone.
 *
 * Amounts read left to right in both languages ("AED 650"), as everywhere on
 * the site.
 */
function Money({ fils }: { fils: number }) {
  return <span dir="ltr">{formatFils(fils)}</span>;
}

const LABEL = "font-brand text-xs font-medium uppercase tracking-brand text-ink-muted";

export function PayInvoice({
  invoice,
  locale,
  t,
}: {
  invoice: InvoiceView;
  locale: Locale;
  t: Dictionary;
}) {
  const i = t.pay.invoice;
  const { seller } = invoice;
  const sellerLines = [
    seller.legalName?.[locale],
    ...(seller.addressLines?.[locale] ?? []),
    `${seller.city[locale]}, ${seller.country[locale]}`,
    seller.tradeLicence,
    seller.trn ? i.trn.replace("{trn}", seller.trn) : undefined,
  ].filter((line): line is string => Boolean(line));

  return (
    <section
      data-print-sheet
      aria-labelledby="invoice-title"
      className="rounded-sm border border-hairline bg-cream/70 p-6 text-start text-olive sm:p-8"
    >
      <h2 id="invoice-title" className="font-display text-3xl font-light">
        {invoice.vat ? i.taxTitle : i.title}
      </h2>

      <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className={LABEL}>{i.number}</dt>
          <dd dir="ltr" className="mt-1 text-base rtl:text-end">
            {invoice.number}
          </dd>
        </div>
        <div>
          <dt className={LABEL}>{i.date}</dt>
          <dd className="mt-1 text-base">{formatDate(locale, invoice.issuedAt)}</dd>
        </div>
        <div>
          <dt className={LABEL}>{i.order}</dt>
          <dd dir="ltr" className="mt-1 text-base rtl:text-end">
            {invoice.orderNumber}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className={LABEL}>{i.billedTo}</dt>
          <dd className="mt-1 text-base">
            <span className="block break-words">{invoice.billTo.name}</span>
            <span dir="ltr" className="block break-all text-ink-muted rtl:text-end">
              {invoice.billTo.email}
            </span>
          </dd>
        </div>
      </dl>

      {/* Three columns fit a 390px screen: the description wraps, the other
          two are as narrow as their content. */}
      <table className="mt-8 w-full border-collapse text-base">
        <thead>
          <tr className="border-y border-hairline">
            <th scope="col" className={`${LABEL} py-3 text-start`}>
              {i.description}
            </th>
            <th scope="col" className={`${LABEL} w-14 px-2 py-3 text-center`}>
              {i.qty}
            </th>
            <th scope="col" className={`${LABEL} py-3 text-end`}>
              {i.amount}
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line, index) => (
            <tr key={index} className="border-b border-hairline align-top">
              <td className="break-words py-3 pe-2">
                {line.description}
                {line.detail ? (
                  <span className="block text-sm text-ink-muted">{line.detail}</span>
                ) : null}
              </td>
              <td className="px-2 py-3 text-center">{line.quantity}</td>
              <td className="whitespace-nowrap py-3 text-end">
                <Money fils={line.totalFils} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-4 flex flex-col gap-2 text-base">
        <div className="flex justify-between gap-4 text-ink-muted">
          <dt>{i.subtotal}</dt>
          <dd>
            <Money fils={invoice.subtotalFils} />
          </dd>
        </div>
        <div className="flex justify-between gap-4 text-ink-muted">
          <dt>{t.pay.deliveryCharge}</dt>
          <dd>
            {invoice.deliveryFeeFils > 0 ? (
              <Money fils={invoice.deliveryFeeFils} />
            ) : (
              t.checkout.complimentary
            )}
          </dd>
        </div>
        {invoice.discount ? (
          <div className="flex justify-between gap-4 text-ink-muted">
            <dt>
              {i.discount}
              {invoice.discount.code ? (
                <>
                  {" "}
                  <span dir="ltr">({invoice.discount.code})</span>
                </>
              ) : null}
            </dt>
            <dd dir="ltr">−{formatFils(invoice.discount.fils)}</dd>
          </div>
        ) : null}
        {invoice.vat ? (
          <div className="flex justify-between gap-4 text-ink-muted">
            <dt>{i.vatIncluded.replace("{rate}", String(invoice.vat.rateBps / 100))}</dt>
            <dd>
              <Money fils={invoice.vat.includedFils} />
            </dd>
          </div>
        ) : null}
        <div className="mt-2 flex items-baseline justify-between gap-4 border-t border-hairline pt-4">
          <dt className="font-brand text-xs font-medium uppercase tracking-brand">{i.total}</dt>
          <dd className="font-display text-2xl">
            <Money fils={invoice.totalFils} />
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-base text-ink-muted">
        {i.paidByCard.replace("{date}", formatDate(locale, invoice.paidAt))}
      </p>

      <div className="mt-8 border-t border-hairline pt-6">
        <p className={LABEL}>{i.from}</p>
        <p className="mt-2 text-base">{seller.tradingName}</p>
        {sellerLines.map((line) => (
          <p key={line} className="text-base text-ink-muted">
            {line}
          </p>
        ))}
        <p className="text-base text-ink-muted">
          <span dir="ltr">{seller.email}</span>
          {" · "}
          <span dir="ltr">{seller.phone}</span>
        </p>
      </div>
    </section>
  );
}
