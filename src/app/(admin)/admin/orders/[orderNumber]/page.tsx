import { notFound } from "next/navigation";
import { formatFils } from "@/lib/money";
import { Card, PageHeader, StatusBadge, Table, Td } from "@admin/components/ui";
import { getAdminOrderByNumber } from "@backend/data/admin-metrics";

/**
 * One order, read from its immutable snapshot.
 *
 * Everything shown is the copy taken at checkout, never the current product
 * record — that is the point of the snapshot. Amounts are read-only for every
 * role including the owner, so this screen deliberately offers no way to edit
 * them; docs/ADMIN.md §3 is explicit that no button marks an order paid.
 */

export const metadata = { title: "Order" };

export default async function AdminOrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await getAdminOrderByNumber(decodeURIComponent(orderNumber));
  if (!order) notFound();

  const items = order.items ?? [];
  const isGift = Boolean(order.recipientName || order.cardMessage);

  return (
    <>
      <PageHeader
        title={order.orderNumber ?? "Order"}
        breadcrumb={[
          { label: "Orders", href: "/admin/orders" },
          { label: order.orderNumber ?? "Order" },
        ]}
        description={`Placed ${new Date(order.createdAt).toLocaleString("en-AE", {
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        })}`}
        action={
          <div className="flex gap-2">
            <StatusBadge value={order.paymentStatus} kind="payment" />
            <StatusBadge value={order.fulfilmentStatus} />
          </div>
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
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-xl font-light text-olive">Items</h2>
          <Table head={["Item", "Qty", "Unit", "Line total"]}>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-hairline/50 last:border-0">
                <Td>
                  {item.productName}
                  {(item.selectedOptions ?? []).length > 0 ? (
                    <span className="block text-xs text-sage">
                      {(item.selectedOptions ?? [])
                        .map((o) => `${o.label}: ${o.value}`)
                        .join(" · ")}
                    </span>
                  ) : null}
                </Td>
                <Td className="tabular-nums">{item.quantity}</Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {formatFils(Number(item.unitPriceFils))}
                </Td>
                <Td className="whitespace-nowrap tabular-nums">
                  {formatFils(Number(item.lineTotalFils))}
                </Td>
              </tr>
            ))}
          </Table>

          <Card className="mt-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-sage">Subtotal</dt>
                <dd className="tabular-nums">{formatFils(Number(order.subtotalFils))}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sage">Delivery</dt>
                <dd className="tabular-nums">{formatFils(Number(order.deliveryFeeFils))}</dd>
              </div>
              {Number(order.discountFils) > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-sage">
                    Discount{order.couponCode ? ` (${order.couponCode})` : ""}
                  </dt>
                  <dd className="tabular-nums">−{formatFils(Number(order.discountFils))}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-hairline/70 pt-2 text-base font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatFils(Number(order.totalFils))}</dd>
              </div>
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-display text-xl font-light text-olive">Customer</h2>
            <Card>
              <p className="font-medium">{order.customerName}</p>
              <p className="mt-1 text-sm text-sage">{order.customerEmail}</p>
              <p className="text-sm text-sage">{order.customerPhone}</p>
              <p className="mt-2 text-xs text-sage">
                {order.customerType === "guest" ? "Guest checkout" : "Registered account"}
              </p>
            </Card>
          </div>

          <div>
            <h2 className="mb-3 font-display text-xl font-light text-olive">Delivery</h2>
            <Card>
              {order.recipientName ? (
                <p className="font-medium">
                  {order.recipientName}
                  {order.recipientPhone ? (
                    <span className="block text-sm font-normal text-sage">
                      {order.recipientPhone}
                    </span>
                  ) : null}
                </p>
              ) : null}
              <p className="mt-1 whitespace-pre-line text-sm text-olive">
                {order.deliveryAddress}
              </p>
              <p className="mt-2 text-sm text-sage">
                {new Date(order.deliveryDate).toLocaleDateString("en-AE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
                {" · "}
                {order.deliveryTimeSlot}
              </p>
              {order.deliveryNotes ? (
                <p className="mt-2 text-xs leading-relaxed text-sage">{order.deliveryNotes}</p>
              ) : null}
            </Card>
          </div>

          {order.cardMessage ? (
            <div>
              <h2 className="mb-3 font-display text-xl font-light text-olive">Card message</h2>
              <Card>
                <p className="whitespace-pre-line font-display text-lg font-light text-olive">
                  “{order.cardMessage}”
                </p>
              </Card>
            </div>
          ) : null}
        </div>
      </div>

      <p className="mt-8 max-w-2xl text-xs leading-relaxed text-sage">
        Amounts and customer details are the permanent record taken at checkout and cannot be
        edited by anyone. Payment status is set by the payment provider only.
      </p>
    </>
  );
}
