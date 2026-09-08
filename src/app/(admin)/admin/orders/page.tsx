import Link from "next/link";
import { formatFils } from "@/lib/money";
import { EmptyState, PageHeader, StatusBadge, Table, Td } from "@admin/components/ui";
import { getAdminOrders } from "@backend/data/admin-metrics";

/**
 * Orders, newest first.
 *
 * Two status columns, never merged: where the money is and where the flowers
 * are are different questions with different owners. Payment is set by the
 * provider's webhook alone; fulfilment is the only one staff can move.
 */

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage() {
  const orders = await getAdminOrders();

  return (
    <>
      <PageHeader
        title="Orders"
        breadcrumb={[{ label: "Orders" }]}
        description={orders.length > 0 ? `${orders.length} order${orders.length === 1 ? "" : "s"}` : undefined}
      />

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          message="Your first order will appear here. Nothing is missing — the shop simply has not taken one yet."
        />
      ) : (
        <Table head={["Order", "Customer", "Items", "Total", "Payment", "Status", "Delivery", "Placed"]}>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-hairline/50 last:border-0">
              <Td className="font-medium">
                {order.orderNumber ? (
                  <Link href={`/admin/orders/${order.orderNumber}`} className="hover:underline">
                    {order.orderNumber}
                  </Link>
                ) : (
                  "—"
                )}
              </Td>
              <Td>
                {order.customerName}
                <span className="block text-xs text-sage">
                  {order.customerType === "guest" ? "Guest" : "Registered"}
                </span>
              </Td>
              <Td className="tabular-nums text-sage">{(order.items ?? []).length}</Td>
              <Td className="whitespace-nowrap tabular-nums">{formatFils(Number(order.totalFils))}</Td>
              <Td><StatusBadge value={order.paymentStatus} kind="payment" /></Td>
              <Td><StatusBadge value={order.fulfilmentStatus} /></Td>
              <Td className="whitespace-nowrap text-sage">
                {new Date(order.deliveryDate).toLocaleDateString("en-AE", { day: "numeric", month: "short" })}
              </Td>
              <Td className="whitespace-nowrap text-sage">
                {new Date(order.createdAt).toLocaleDateString("en-AE", { day: "numeric", month: "short" })}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
