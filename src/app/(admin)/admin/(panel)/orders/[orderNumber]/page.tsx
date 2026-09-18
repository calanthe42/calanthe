import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderOps } from "@admin/components/OrderOps";
import { getAdminI18n } from "@admin/i18n/server";
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

/**
 * One order, read from its immutable snapshot.
 *
 * Everything shown is the copy taken at checkout, never the current product
 * record — that is the point of the snapshot. Amounts are read-only for every
 * role including the owner, so this screen deliberately offers no way to edit
 * them; docs/ADMIN.md §3 is explicit that no button marks an order paid.
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

  const { t, label, money, date } = i18n;
  const isOwner = Boolean(session?.isAdmin);
  const staff = await getTeamOptions();

  const items = order.items ?? [];
  const isGift = Boolean(order.recipientName || order.cardMessage);
  const isCashOnDelivery = orderSourceKey(order.source) === "cod";
  const customerId = typeof order.customer === "object" && order.customer ? order.customer.id : order.customer;
  const deliveryFee = Number(order.deliveryFeeFils);
  const discount = Number(order.discountFils ?? 0);
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
            <Badge tone={toneFor("payment", order.paymentStatus)}>{label("payment", order.paymentStatus)}</Badge>
            <Badge tone={toneFor("fulfilment", order.fulfilmentStatus)} dot>
              {label("fulfilment", order.fulfilmentStatus)}
            </Badge>
          </>
        }
      />

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
                return (
                  <li key={item.id ?? index} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{item.productName}</p>
                      {options ? <p className="mt-0.5 text-xs text-ink-3">{options}</p> : null}
                      <p className="mt-0.5 text-xs text-ink-3 tabular">
                        {item.quantity} × {money(Number(item.unitPriceFils))}
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
              {isCashOnDelivery && order.paymentStatus === "PENDING" ? t("orders.detail.codPending") : t("orders.detail.providerNote")}
            </p>
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
