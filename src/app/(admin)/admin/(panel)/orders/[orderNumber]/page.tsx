import Link from "next/link";
import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { OrderOps } from "@admin/components/OrderOps";
import { formatFils } from "@/lib/money";
import {
  Card,
  DataList,
  DataRow,
  DetailList,
  PageHeader,
  RowAction,
  StatusBadge,
  emirateLabel,
  orderSourceLabel,
  uaeDate,
} from "@admin/components/ui";
import { getAdminOrderByNumber } from "@backend/data/admin-metrics";
import { getAdminSession } from "@backend/data/admin-session";

/**
 * One order, read from its immutable snapshot.
 *
 * Everything shown is the copy taken at checkout, never the current product
 * record — that is the point of the snapshot. Amounts are read-only for every
 * role including the owner, so this screen deliberately offers no way to edit
 * them; docs/ADMIN.md §3 is explicit that no button marks an order paid.
 */

export const metadata = { title: "Order" };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-display text-xl font-light text-olive">{children}</h2>;
}

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const [order, session] = await Promise.all([
    getAdminOrderByNumber(decodeURIComponent(orderNumber)),
    getAdminSession(),
  ]);
  if (!order) notFound();

  const isOwner = Boolean(session?.isAdmin);

  /* Internal users who can own an order. Read as the caller, so a staff
     member sees only what the permission model allows. */
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const team = await payload
    .find({
      collection: "users",
      where: { role: { in: ["admin", "staff"] } },
      limit: 50,
      depth: 0,
      user,
      overrideAccess: false,
    })
    .catch(() => ({ docs: [] as { id: number; name?: string | null; email: string }[] }));

  const staffOptions = team.docs.map((m) => ({ label: m.name || m.email, value: String(m.id) }));

  const items = order.items ?? [];
  const isGift = Boolean(order.recipientName || order.cardMessage);
  const isCashOnDelivery = /cod/i.test(order.source ?? "");
  const customerId =
    typeof order.customer === "object" && order.customer ? order.customer.id : order.customer;
  const deliveryFee = Number(order.deliveryFeeFils);

  return (
    <>
      <PageHeader
        title={`Order ${order.orderNumber ?? ""}`.trim()}
        breadcrumb={[
          { label: "Orders", href: "/admin/orders" },
          { label: order.orderNumber ?? "Order" },
        ]}
        description={`Placed ${uaeDate(order.createdAt, "datetime")} · ${orderSourceLabel(order.source)}`}
        action={
          <>
            <StatusBadge value={order.paymentStatus} kind="payment" />
            <StatusBadge value={order.fulfilmentStatus} />
          </>
        }
      />

      {isGift ? (
        <div className="mb-6 rounded-md border border-burgundy/25 bg-burgundy/5 px-4 py-3">
          <p className="text-sm font-medium text-burgundy">This is a gift</p>
          <p className="mt-0.5 text-xs leading-relaxed text-burgundy/80">
            The recipient must not see a price. Do not include a receipt in the delivery.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section>
            <SectionTitle>Items</SectionTitle>
            <DataList label="Items in this order">
              {items.map((item, i) => {
                const productId =
                  typeof item.product === "object" && item.product ? item.product.id : item.product;
                const options = (item.selectedOptions ?? []).map((o) => `${o.label}: ${o.value}`).join(" · ");
                return (
                  <DataRow
                    key={item.id ?? i}
                    title={item.productName}
                    subtitle={options || undefined}
                    meta={
                      <>
                        <span className="tabular-nums">
                          {item.quantity} × {formatFils(Number(item.unitPriceFils))}
                        </span>
                        <span className="font-medium tabular-nums text-olive">
                          {formatFils(Number(item.lineTotalFils))}
                        </span>
                      </>
                    }
                    actions={
                      typeof productId === "number" && isOwner ? (
                        <RowAction href={`/admin/products/${productId}/edit`} label={`Open product ${item.productName}`}>
                          Product
                        </RowAction>
                      ) : undefined
                    }
                  />
                );
              })}
            </DataList>

            <Card className="mt-4">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-sage">Subtotal</dt>
                  <dd className="tabular-nums">{formatFils(Number(order.subtotalFils))}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-sage">Delivery fee</dt>
                  <dd className="tabular-nums">{deliveryFee > 0 ? formatFils(deliveryFee) : "Free"}</dd>
                </div>
                {Number(order.discountFils) > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-sage">Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
                    <dd className="tabular-nums">−{formatFils(Number(order.discountFils))}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-hairline/70 pt-2 text-base font-medium">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatFils(Number(order.totalFils))}</dd>
                </div>
              </dl>
            </Card>
          </section>

          <section>
            <SectionTitle>Payment</SectionTitle>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={order.paymentStatus} kind="payment" />
                <span className="text-sm text-olive">{orderSourceLabel(order.source)}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-sage">
                {isCashOnDelivery && order.paymentStatus === "PENDING"
                  ? "Cash on delivery: collect payment when the flowers are handed over. Cash payments are not recorded in the system yet, so this order keeps showing “Awaiting payment”."
                  : "Payment status is updated automatically by the payment provider."}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-sage">
                Nobody can change a payment status by hand — not staff, and not the owner.
              </p>
            </Card>
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section>
            <SectionTitle>Customer</SectionTitle>
            <Card>
              <p className="font-medium text-olive">{order.customerName}</p>
              <p className="mt-1 break-all text-sm">
                <a href={`mailto:${order.customerEmail}`} className="text-sage underline-offset-4 hover:text-olive hover:underline">
                  {order.customerEmail}
                </a>
              </p>
              <p className="text-sm">
                <a href={`tel:${order.customerPhone}`} className="text-sage underline-offset-4 hover:text-olive hover:underline">
                  {order.customerPhone}
                </a>
              </p>
              <p className="mt-2 text-xs text-sage">
                {order.customerType === "guest" ? "Guest checkout" : "Customer account"}
              </p>
              {isOwner && typeof customerId === "number" ? (
                <Link
                  href={`/admin/customers/${customerId}`}
                  className="mt-3 inline-flex min-h-11 items-center text-sm text-olive underline underline-offset-4"
                >
                  Open customer profile
                </Link>
              ) : null}
            </Card>
          </section>

          <section>
            <SectionTitle>Delivery</SectionTitle>
            <Card>
              <DetailList
                rows={[
                  ["Recipient", order.recipientName],
                  ["Recipient phone", order.recipientPhone],
                  ["Address", order.deliveryAddress],
                  ["Emirate", emirateLabel(order.deliveryEmirate)],
                  ["Date", uaeDate(order.deliveryDate, "weekday")],
                  ["Time slot", order.deliveryTimeSlot],
                  ["Delivery notes", order.deliveryNotes],
                ]}
              />
            </Card>
          </section>

          {order.cardMessage ? (
            <section>
              <SectionTitle>Card message</SectionTitle>
              <Card>
                <p className="whitespace-pre-line font-display text-lg font-light text-olive">
                  “{order.cardMessage}”
                </p>
              </Card>
            </section>
          ) : null}
        </div>
      </div>

      <div className="mt-10">
        <OrderOps
          orderId={order.id}
          fulfilmentStatus={order.fulfilmentStatus}
          internalNotes={order.internalNotes ?? undefined}
          assignedStaffId={
            typeof order.assignedStaff === "object" && order.assignedStaff
              ? order.assignedStaff.id
              : (order.assignedStaff ?? undefined)
          }
          staff={staffOptions}
        />
      </div>

      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-sage">
        Amounts and customer details are the permanent record taken at checkout and cannot be
        edited by anyone. Payment status is set by the payment provider only.
      </p>
    </>
  );
}
