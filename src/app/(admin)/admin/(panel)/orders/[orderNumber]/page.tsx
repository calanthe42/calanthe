import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderOps } from "@admin/components/OrderOps";
import { QuotePayment } from "@admin/components/QuotePayment";
import { getAdminI18n } from "@admin/i18n/server";
import { quoteCardData } from "@admin/lib/quote-card";
import { orderSourceKey, toneFor } from "@admin/lib/status";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { Card, CardHeader } from "@admin/ui/Card";
import { DescriptionList } from "@admin/ui/Content";
import { Icon } from "@admin/ui/icons";
import { PageHeader } from "@admin/ui/PageHeader";
import { Notice } from "@admin/ui/States";
import { getAdminOrderByNumber, getTeamOptions } from "@backend/data/admin-metrics";
import { getAdminSession } from "@backend/data/admin-session";
import { getQuoteForOrder } from "@backend/data/quote";
import { saleSavingsOfItems } from "@backend/domain/checkout-order";

/**
 * One order, read from its immutable snapshot.
 *
 * Everything shown is the copy taken at checkout, never the current product
 * record — that is the point of the snapshot. Amounts are read-only for every
 * role including the owner, so this screen deliberately offers no way to edit
 * them; docs/ADMIN.md §3 is explicit that no button marks an order paid.
 *
 * A PAYMENT REQUEST (an order a florist confirmed from an enquiry) that has
 * not been paid says so at the very top, with the only things that can be
 * done about it: resend the link, copy it, cancel. It cannot be prepared —
 * OrderOps is told the same — and the notice sits above the columns so it is
 * the first thing on a phone.
 *
 * DISCOUNTS ARE READ FROM THE ORDER, NOT FROM THE DISCOUNT. A line sold on
 * offer keeps its regular price and the sale's label beside what was paid;
 * a code is the "Discount (CODE)" row. All of it is the order's own snapshot,
 * so it reads the same after the owner edits or ends the discount — and a
 * florist, who cannot open Discounts, can still answer "did my code work?".
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("orders.title") };
}

export default async function AdminOrderPage({ params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const [i18n, order, session] = await Promise.all([
    getAdminI18n(),
    getAdminOrderByNumber(decodeURIComponent(orderNumber)),
    getAdminSession(),
  ]);
  if (!order) notFound();

  const { t, label, money, date, locale } = i18n;
  const isOwner = Boolean(session?.isAdmin);
  const isQuote = orderSourceKey(order.source) === "quote";
  const [staff, quote] = await Promise.all([
    getTeamOptions(),
    isQuote ? getQuoteForOrder(order.id) : Promise.resolve(null),
  ]);
  /* Unpaid and not cancelled: waiting on the customer, or the link ran out. */
  const unpaidQuote = quote && (quote.state === "awaiting" || quote.state === "expired") ? quote : null;
  const enquiryId = typeof order.enquiry === "object" && order.enquiry ? order.enquiry.id : order.enquiry;

  const items = order.items ?? [];
  const isGift = Boolean(order.recipientName || order.cardMessage);
  const isCashOnDelivery = orderSourceKey(order.source) === "cod";
  const customerId = typeof order.customer === "object" && order.customer ? order.customer.id : order.customer;
  const deliveryFee = Number(order.deliveryFeeFils);
  const discount = Number(order.discountFils ?? 0);
  /* What sale prices took off — already inside the line prices and subtotal. */
  const saleSavings = saleSavingsOfItems(items);
  const number = order.orderNumber ?? "";

  return (
    <>
      <PageHeader
        title={t("orders.detail.title", { number })}
        breadcrumbs={[
          { label: t("nav.sections.sales") },
          { label: t("orders.title"), href: "/admin/orders" },
          { label: number },
        ]}
        description={t("orders.detail.placed", {
          date: date(order.createdAt, "datetime"),
          source: label("source", orderSourceKey(order.source)),
        })}
        badge={
          <>
            {unpaidQuote ? (
              <Badge tone={toneFor("payRequest", unpaidQuote.state)}>{label("payRequest", unpaidQuote.state)}</Badge>
            ) : (
              <Badge tone={toneFor("payment", order.paymentStatus)}>{label("payment", order.paymentStatus)}</Badge>
            )}
            <Badge tone={toneFor("fulfilment", order.fulfilmentStatus)} dot>
              {label("fulfilment", order.fulfilmentStatus)}
            </Badge>
          </>
        }
      />

      {unpaidQuote ? (
        <Notice tone={unpaidQuote.state === "expired" ? "warning" : "info"}>
          <p className="font-medium text-ink">
            {unpaidQuote.state === "expired"
              ? t("orders.detail.expiredQuote")
              : unpaidQuote.lastEmail
                ? t("orders.detail.awaitingQuote", { date: date(unpaidQuote.lastEmail.createdAt, "datetime") })
                : t("orders.detail.awaitingQuoteNoEmail")}
          </p>
          {unpaidQuote.lastEmail && unpaidQuote.lastEmail.status !== "sent" ? (
            <p className="mt-1 text-ink-2">
              {t("enquiries.quote.emailNotSent", { status: label("emailStatus", unpaidQuote.lastEmail.status) })}
            </p>
          ) : null}
          <div className="mt-3">
            <QuotePayment variant="notice" quote={quoteCardData(unpaidQuote)} form={null} />
          </div>
          {typeof enquiryId === "number" ? (
            <Link
              href={`/admin/enquiries/${enquiryId}`}
              className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              {t("orders.detail.openEnquiry")}
              <Icon name="chevronRight" className="h-4 w-4" />
            </Link>
          ) : null}
        </Notice>
      ) : null}

      {isGift ? (
        <Notice tone="warning">
          <p className="font-medium">{t("orders.detail.gift")}</p>
          <p className="mt-0.5 text-ink-2">{t("orders.detail.giftBody")}</p>
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card padded={false}>
            <div className="px-4 pt-3 sm:px-5">
              <CardHeader title={t("orders.detail.items")} />
            </div>
            <ul aria-label={t("orders.detail.itemsLabel")} className="divide-y divide-line border-t border-line">
              {items.map((item, index) => {
                const productId = typeof item.product === "object" && item.product ? item.product.id : item.product;
                const options = (item.selectedOptions ?? []).map((o) => `${o.label}: ${o.value}`).join(" · ");
                /* Sold on offer: the regular unit price, kept on the line. */
                const wasUnit = Number(item.compareAtUnitPriceFils ?? 0);
                const onOffer = wasUnit > Number(item.unitPriceFils);
                const saleLabel = (locale === "ar" ? item.saleLabelAr : item.saleLabelEn) || item.saleLabelEn || item.saleLabelAr;
                return (
                  <li key={item.id ?? index} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{item.productName}</p>
                      {options ? <p className="mt-0.5 text-xs text-ink-3">{options}</p> : null}
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3 tabular">
                        <span>
                          {item.quantity} × {money(Number(item.unitPriceFils))}
                        </span>
                        {onOffer ? (
                          <>
                            <span className="sr-only">{t("orders.detail.was", { price: money(wasUnit) })}</span>
                            <s aria-hidden>{money(wasUnit)}</s>
                            {saleLabel ? <Badge>{saleLabel}</Badge> : null}
                          </>
                        ) : null}
                      </p>
                    </div>
                    <p className="font-medium text-ink tabular">{money(Number(item.lineTotalFils))}</p>
                    {typeof productId === "number" && isOwner ? (
                      <ButtonLink
                        href={`/admin/products/${productId}/edit`}
                        size="sm"
                        variant="ghost"
                        icon="flower"
                        aria-label={t("orders.detail.openProduct", { name: item.productName })}
                      >
                        {t("orders.detail.product")}
                      </ButtonLink>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <dl className="space-y-2 border-t border-line px-4 py-4 text-sm sm:px-5">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">{t("orders.detail.subtotal")}</dt>
                <dd className="tabular">{money(Number(order.subtotalFils))}</dd>
              </div>
              {saleSavings > 0 ? (
                /* Muted, and not part of the sum: the lines above are
                   already the sale prices. It is here so the total can be
                   explained on the phone without opening Discounts. */
                <div className="flex justify-between gap-4 text-ink-3">
                  <dt>{t("orders.detail.saleSavings")}</dt>
                  <dd className="tabular">{money(saleSavings)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">{t("orders.detail.deliveryFee")}</dt>
                <dd className="tabular">{deliveryFee > 0 ? money(deliveryFee) : t("orders.detail.free")}</dd>
              </div>
              {discount > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-3">
                    {order.couponCode ? t("orders.detail.discountWithCode", { code: order.couponCode }) : t("orders.detail.discount")}
                  </dt>
                  <dd className="tabular">−{money(discount)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-semibold">
                <dt>{t("orders.detail.total")}</dt>
                <dd className="tabular">{money(Number(order.totalFils))}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title={t("orders.detail.payment")} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={toneFor("payment", order.paymentStatus)}>{label("payment", order.paymentStatus)}</Badge>
              <span className="text-sm text-ink-2">{label("source", orderSourceKey(order.source))}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              {isCashOnDelivery && order.paymentStatus === "PENDING"
                ? t("orders.detail.codPending")
                : unpaidQuote
                  ? t("orders.detail.quoteNote")
                  : t("orders.detail.providerNote")}
            </p>
            {order.invoiceNumber && order.paidAt ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
                <span>
                  {t("orders.detail.invoiceLine", {
                    number: order.invoiceNumber,
                    date: date(order.paidAt, "datetime"),
                  })}
                </span>
                {quote?.state === "paid" && quote.payUrl ? (
                  <a
                    href={quote.payUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="-my-3 inline-flex items-center gap-1 py-3 font-medium underline underline-offset-4"
                  >
                    {t("enquiries.quote.viewInvoice")}
                    <Icon name="external" className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </p>
            ) : null}
            {!unpaidQuote && typeof enquiryId === "number" ? (
              <Link
                href={`/admin/enquiries/${enquiryId}`}
                className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                {t("orders.detail.openEnquiry")}
                <Icon name="chevronRight" className="h-4 w-4" />
              </Link>
            ) : null}
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-ink-3">
              <Icon name="info" className="mt-px h-3.5 w-3.5" />
              {t("orders.detail.noManualPayment")}
            </p>
          </Card>

          <OrderOps
            orderId={order.id}
            fulfilmentStatus={order.fulfilmentStatus}
            internalNotes={order.internalNotes ?? undefined}
            assignedStaffId={
              typeof order.assignedStaff === "object" && order.assignedStaff
                ? order.assignedStaff.id
                : (order.assignedStaff ?? undefined)
            }
            staff={staff}
            awaitingPayment={Boolean(unpaidQuote)}
          />
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title={t("orders.detail.customer")} />
            <p className="mt-1 font-medium text-ink">{order.customerName}</p>
            <p className="mt-1.5 flex min-w-0 items-center gap-2 text-sm">
              <Icon name="mail" className="h-4 w-4 text-ink-3" />
              <a href={`mailto:${order.customerEmail}`} className="truncate text-ink-2 underline-offset-4 hover:text-ink hover:underline" dir="ltr">
                {order.customerEmail}
              </a>
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <Icon name="phone" className="h-4 w-4 text-ink-3" />
              <a href={`tel:${order.customerPhone}`} className="text-ink-2 underline-offset-4 hover:text-ink hover:underline" dir="ltr">
                {order.customerPhone}
              </a>
            </p>
            <p className="mt-3 text-xs text-ink-3">
              {order.customerType === "guest" ? t("orders.detail.guestCheckout") : t("orders.detail.customerAccount")}
            </p>
            {isOwner && typeof customerId === "number" ? (
              <Link href={`/admin/customers/${customerId}`} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink underline-offset-4 hover:underline">
                {t("orders.detail.openCustomer")}
                <Icon name="chevronRight" className="h-4 w-4" />
              </Link>
            ) : null}
          </Card>

          <Card>
            <CardHeader title={t("orders.detail.delivery")} />
            <div className="mt-3">
              <DescriptionList
                columns={1}
                emptyLabel={t("common.nothingProvided")}
                rows={[
                  [t("orders.detail.recipient"), order.recipientName],
                  [t("orders.detail.recipientPhone"), order.recipientPhone ? <span dir="ltr">{order.recipientPhone}</span> : null],
                  [t("orders.detail.address"), order.deliveryAddress],
                  [t("orders.detail.emirate"), label("emirate", order.deliveryEmirate)],
                  [t("orders.detail.date"), date(order.deliveryDate, "weekday")],
                  [t("orders.detail.timeSlot"), <span key="slot" dir="ltr">{order.deliveryTimeSlot}</span>],
                  [t("orders.detail.notes"), order.deliveryNotes],
                  [t("orders.detail.customerNote"), order.customerNote],
                ]}
              />
            </div>
          </Card>

          {order.cardMessage ? (
            <Card>
              <CardHeader title={t("orders.detail.cardMessage")} />
              <p className="mt-2 whitespace-pre-line font-display text-lg font-light leading-relaxed text-ink">“{order.cardMessage}”</p>
            </Card>
          ) : null}
        </div>
      </div>

      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-ink-3">{t("orders.detail.record")}</p>
    </>
  );
}
