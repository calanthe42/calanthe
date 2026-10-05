import type { InvoiceSheetView } from "@backend/domain/invoice";
import type { Dictionary, Locale } from "@/lib/i18n/dictionary";
import { formatDate } from "@/lib/i18n/date";
import { formatFils } from "@/lib/money";

/**
 * The invoice — a sheet of the atelier's own paper.
 *
 * ONE document for every sale and every place it is seen: the customer's pay
 * page, the shareable invoice page and the PDF (which is this page, printed;
 * the rules are in app/(frontend)/invoice.css). Warm Cream paper with the
 * client's orchid print tone on tone, the stacked logo as a letterhead, and
 * Burnt Orange twice only — the status mark and the rule above the total.
 *
 * Rendered from an InvoiceSheetView (backend/domain/invoice.ts), which is
 * built from the order's own snapshot and refuses to exist if the figures do
 * not add up. So nothing is calculated here: this file only lays out numbers
 * that were already checked.
 *
 * BEFORE PAYMENT the same sheet is the bill: it carries the order number,
 * says "Unpaid" and shows the amount due. The invoice NUMBER appears once it
 * is paid — that is what keeps the series without gaps.
 *
 * Whatever the owner has not supplied — legal name, address, licence, TRN —
 * is simply absent: a placeholder never reaches a customer.
 *
 * Amounts, numbers and addresses read left to right in both languages.
 */
function Money({ fils }: { fils: number }) {
  return <span className="inv-ltr">{formatFils(fils)}</span>;
}

const PAID_BY = {
  card: "paidByCard",
  cash: "paidByCash",
  "bank-transfer": "paidByBankTransfer",
  "card-machine": "paidByCardMachine",
} as const;

export function InvoiceSheet({
  sheet,
  locale,
  t,
}: {
  sheet: InvoiceSheetView;
  locale: Locale;
  t: Dictionary;
}) {
  const i = t.pay.invoice;
  const { seller } = sheet;
  const sellerLines = [
    seller.legalName?.[locale],
    ...(seller.addressLines?.[locale] ?? []),
    `${seller.city[locale]}, ${seller.country[locale]}`,
    seller.tradeLicence ? i.licence.replace("{number}", seller.tradeLicence) : undefined,
    seller.trn ? i.trn.replace("{trn}", seller.trn) : undefined,
  ].filter((line): line is string => Boolean(line));

  const statusWord = sheet.status === "paid" ? i.paid : sheet.status === "void" ? i.void : i.unpaid;
  const closing =
    sheet.status === "paid" && sheet.paidAt
      ? i[PAID_BY[sheet.paymentMethod]].replace("{date}", formatDate(locale, sheet.paidAt))
      : sheet.status === "void"
        ? i.voidLine
        : i.unpaidLine;

  return (
    <article
      className="inv"
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-status={sheet.status}
      data-fit={sheet.fit ? "true" : "false"}
      aria-labelledby="invoice-title"
    >
      <header className="inv-head">
        {/* A plain image, not the header's SVG symbol: the sheet must print
            the same when the site header is not on the page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="inv-logo"
          src="/brand/stacked-deep-olive.png"
          width={1081}
          height={719}
          alt="Calanthe"
        />
      </header>

      <div className="inv-top">
        <div>
          <h2 id="invoice-title" className="inv-title">
            {sheet.vat ? i.taxTitle : i.title}
          </h2>
          <p className="inv-label">{i.billedTo}</p>
          <p className="inv-name">{sheet.billTo.name}</p>
          {sheet.billTo.email ? (
            <p className="inv-contact">
              <span className="inv-ltr">{sheet.billTo.email}</span>
            </p>
          ) : null}
          {sheet.billTo.phone ? (
            <p className="inv-contact">
              <span className="inv-ltr">{sheet.billTo.phone}</span>
            </p>
          ) : null}
        </div>
        <dl className="inv-meta">
          {sheet.number ? (
            <div>
              <dt className="inv-label">{i.number}</dt>
              <dd className="inv-ltr">{sheet.number}</dd>
            </div>
          ) : null}
          <div>
            <dt className="inv-label">{i.date}</dt>
            <dd>{formatDate(locale, sheet.issuedAt)}</dd>
          </div>
          <div>
            <dt className="inv-label">{i.order}</dt>
            <dd className="inv-ltr">{sheet.orderNumber}</dd>
          </div>
          <div>
            <dt className="inv-label">{i.status}</dt>
            <dd>
              <span className="inv-mark" data-status={sheet.status}>
                {statusWord}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <table className="inv-lines">
        <thead>
          <tr>
            <th scope="col" className="inv-label">
              {i.description}
            </th>
            <th scope="col" className="inv-label inv-qty">
              {i.qty}
            </th>
            <th scope="col" className="inv-label inv-unit">
              {i.unit}
            </th>
            <th scope="col" className="inv-label inv-amount">
              {i.amount}
            </th>
          </tr>
        </thead>
        <tbody>
          {sheet.lines.map((line, index) => (
            <tr key={index}>
              <td className="inv-desc">
                {line.description}
                {line.detail ? <span className="inv-detail">{line.detail}</span> : null}
              </td>
              <td className="inv-qty">{line.quantity}</td>
              <td className="inv-unit">
                {line.wasUnitFils ? (
                  <span className="inv-was">
                    <Money fils={line.wasUnitFils} />
                  </span>
                ) : null}
                <Money fils={line.unitFils} />
              </td>
              <td className="inv-amount">
                <Money fils={line.totalFils} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-sum">
        <dl className="inv-totals">
          <div>
            <dt>{i.subtotal}</dt>
            <dd>
              <Money fils={sheet.subtotalFils} />
            </dd>
          </div>
          {sheet.discount ? (
            <div>
              <dt>
                {i.discount}
                {sheet.discount.code ? (
                  <>
                    {" "}
                    <span className="inv-ltr">({sheet.discount.code})</span>
                  </>
                ) : null}
              </dt>
              <dd>
                <span className="inv-ltr">−{formatFils(sheet.discount.fils)}</span>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>{t.pay.deliveryCharge}</dt>
            <dd>{sheet.deliveryFeeFils > 0 ? <Money fils={sheet.deliveryFeeFils} /> : t.checkout.complimentary}</dd>
          </div>
          {sheet.vat ? (
            <div>
              <dt>{i.vatIncluded.replace("{rate}", String(sheet.vat.rateBps / 100))}</dt>
              <dd>
                <Money fils={sheet.vat.includedFils} />
              </dd>
            </div>
          ) : null}
          <div className="inv-total">
            <dt className="inv-label">{sheet.status === "unpaid" ? i.amountDue : i.total}</dt>
            <dd>
              <Money fils={sheet.totalFils} />
            </dd>
          </div>
        </dl>
        <p className="inv-paid">{closing}</p>
      </div>

      <footer className="inv-foot">
        <p className="inv-thanks">{i.thanks}</p>
        <div className="inv-from">
          <p className="inv-label" lang="en">
            {seller.tradingName}
          </p>
          {sellerLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <p>
            <span className="inv-ltr">{seller.email}</span>
            {"  |  "}
            <span className="inv-ltr">{seller.phone}</span>
          </p>
        </div>
      </footer>
    </article>
  );
}
