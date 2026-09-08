import { formatFils } from "@/lib/money";
import {
  ActionLink,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  StatusBadge,
  Table,
  Td,
} from "@admin/components/ui";
import { getDashboardMetrics, getRecentOrders } from "@backend/data/admin-metrics";
import { getAdminSession, displayName } from "@backend/data/admin-session";

/**
 * The dashboard answers one question: what needs doing today?
 *
 * Every figure is read from the database. Where the business has no data yet,
 * the card shows a real zero with a line explaining what will fill it — never
 * an invented number. A dashboard the owner cannot trust is worse than no
 * dashboard, because she would act on it.
 */

export const metadata = { title: "Dashboard" };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const [session, metrics, recentOrders] = await Promise.all([
    getAdminSession(),
    getDashboardMetrics(),
    getRecentOrders(6),
  ]);

  const firstName = session ? displayName(session.user).split(" ")[0] : "there";

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}.`}
        description="Everything the atelier has on today, in one place."
      />

      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Orders today"
          value={String(metrics.ordersToday)}
          hint={
            metrics.ordersTotal === 0
              ? "Your first order will appear here."
              : `${metrics.ordersTotal} in total`
          }
        />
        <StatCard
          label="Revenue"
          value={formatFils(metrics.revenueFils)}
          hint={metrics.revenueFils === 0 ? "Counted from paid orders only." : "Paid orders only"}
        />
        <StatCard
          label="Customers"
          value={String(metrics.customersTotal)}
          hint={
            metrics.customersTotal === 0
              ? "Guests can buy without an account."
              : "Registered accounts"
          }
        />
        <StatCard
          label="Enquiries waiting"
          value={String(metrics.enquiriesPending)}
          hint={metrics.enquiriesPending === 0 ? "Nothing needs a reply." : "Needs a reply"}
        />
      </section>

      <section aria-label="Recent orders" className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-light text-olive">Recent orders</h2>
          {recentOrders.length > 0 ? (
            <ActionLink href="/admin/orders">View all</ActionLink>
          ) : null}
        </div>

        {recentOrders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            message="Your first order will appear here the moment someone checks out."
          />
        ) : (
          <Table head={["Order", "Customer", "Total", "Payment", "Status", "Placed"]}>
            {recentOrders.map((order) => (
              <tr key={order.id} className="border-b border-hairline/50 last:border-0">
                <Td className="font-medium">{order.orderNumber ?? "—"}</Td>
                <Td>{order.customerName}</Td>
                <Td className="tabular-nums">{formatFils(Number(order.totalFils))}</Td>
                <Td>
                  <StatusBadge value={order.paymentStatus} kind="payment" />
                </Td>
                <Td>
                  <StatusBadge value={order.fulfilmentStatus} />
                </Td>
                <Td className="whitespace-nowrap text-sage">
                  {new Date(order.createdAt).toLocaleDateString("en-AE", {
                    day: "numeric",
                    month: "short",
                  })}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section aria-label="Quick actions">
          <h2 className="mb-3 font-display text-xl font-light text-olive">Quick actions</h2>
          <Card>
            <div className="flex flex-wrap gap-2">
              <ActionLink href="/cms/collections/products/create" variant="primary">
                Add product
              </ActionLink>
              <ActionLink href="/admin/orders">View orders</ActionLink>
              <ActionLink href="/cms/collections/occasions/create">Add occasion</ActionLink>
              <ActionLink href="/admin/enquiries">View enquiries</ActionLink>
            </div>
          </Card>
        </section>

        <section aria-label="Catalogue health">
          <h2 className="mb-3 font-display text-xl font-light text-olive">Best sellers</h2>
          {metrics.productsAvailable === 0 ? (
            <EmptyState
              title="Nothing is on sale yet"
              message={
                metrics.productsTotal > 0
                  ? `All ${metrics.productsTotal} products are hidden because none has a photograph yet. Add photos, then mark them available.`
                  : "Add your first product and it will appear here."
              }
              action={<ActionLink href="/admin/products">Review products</ActionLink>}
            />
          ) : (
            <EmptyState
              title="No sales data yet"
              message="Once orders start arriving, your best-selling arrangements will be ranked here."
            />
          )}
        </section>
      </div>
    </>
  );
}
