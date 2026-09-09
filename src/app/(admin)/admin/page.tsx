import Link from "next/link";
import { formatFils } from "@/lib/money";
import { cn } from "@/lib/cn";
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
import { BarChart, Comparison, StatusDistribution } from "@admin/components/Charts";
import { getDashboardMetrics } from "@backend/data/admin-metrics";
import { getDashboardData, parsePeriod } from "@backend/data/dashboard";
import { getAdminSession, displayName } from "@backend/data/admin-session";

/**
 * What needs doing today, and how the shop is trading.
 *
 * Every figure is read from real orders. Where the business has no data yet,
 * the panel says so plainly rather than showing a plausible-looking number —
 * a dashboard the owner cannot trust is worse than none, because she would
 * act on it.
 */

export const metadata = { title: "Dashboard" };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const PERIODS = [7, 30, 90] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period = parsePeriod(rawPeriod);

  const [session, metrics, data] = await Promise.all([
    getAdminSession(),
    getDashboardMetrics(),
    getDashboardData(period),
  ]);

  const firstName = session ? displayName(session.user).split(" ")[0] : "there";

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}.`}
        description="Everything the atelier has on today, in one place."
      />

      {/* Period filter */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="font-brand text-[10px] uppercase tracking-brand text-sage">
          Showing
        </span>
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/admin?period=${p}`}
            aria-current={p === period ? "page" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-md px-3 text-sm transition-colors",
              p === period
                ? "bg-olive text-cream"
                : "border border-hairline bg-white text-olive hover:bg-admin-sunken",
            )}
          >
            {p} days
          </Link>
        ))}
      </div>

      <section aria-label="Overview" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={`Orders · ${period}d`}
          value={String(data.ordersInPeriod)}
          hint={
            metrics.ordersTotal === 0
              ? "Your first order will appear here."
              : `${metrics.ordersTotal} all time`
          }
        />
        <Card>
          <p className="font-brand text-[10px] uppercase tracking-brand text-sage">
            Revenue · {period}d
          </p>
          <p className="mt-2 font-display text-3xl font-light tabular-nums text-olive">
            {formatFils(data.revenueInPeriodFils)}
          </p>
          <Comparison
            currentFils={data.revenueInPeriodFils}
            previousFils={data.previousRevenueFils}
            days={period}
          />
        </Card>
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

      <section aria-label="Trading" className="mt-6 grid gap-4 lg:grid-cols-2">
        <BarChart points={data.series} metric="revenue" title={`Revenue · last ${period} days`} />
        <BarChart points={data.series} metric="orders" title={`Orders · last ${period} days`} />
      </section>

      {data.needsAttention.length > 0 ? (
        <section aria-label="Needs attention" className="mt-6">
          <div className="rounded-md border border-burgundy/30 bg-burgundy/5 p-5">
            <h2 className="font-display text-xl font-light text-burgundy">Needs attention</h2>
            <p className="mt-1 text-sm text-burgundy/80">
              {data.needsAttention.length} order
              {data.needsAttention.length === 1 ? " is" : "s are"} past their delivery date and
              still open.
            </p>
            <ul className="mt-3 space-y-1.5">
              {data.needsAttention.slice(0, 5).map((order) => (
                <li key={order.id} className="text-sm">
                  <Link
                    href={`/admin/orders/${order.orderNumber}`}
                    className="font-medium text-burgundy underline underline-offset-4"
                  >
                    {order.orderNumber}
                  </Link>{" "}
                  <span className="text-burgundy/80">
                    — {order.customerName}, due{" "}
                    {new Date(order.deliveryDate).toLocaleDateString("en-AE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section aria-label="Today" className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-xl font-light text-olive">Today&rsquo;s deliveries</h2>
          {data.todaysDeliveries.length === 0 ? (
            <EmptyState
              title="Nothing out today"
              message="Orders due for delivery today will be listed here with their time slot."
            />
          ) : (
            <Table head={["Order", "Recipient", "Where", "Slot", "Status"]}>
              {data.todaysDeliveries.map((order) => (
                <tr key={order.id} className="border-b border-hairline/50 last:border-0">
                  <Td className="font-medium">
                    <Link href={`/admin/orders/${order.orderNumber}`} className="hover:underline">
                      {order.orderNumber}
                    </Link>
                  </Td>
                  <Td>{order.recipientName || order.customerName}</Td>
                  <Td className="capitalize text-sage">
                    {order.deliveryEmirate.replace(/-/g, " ")}
                  </Td>
                  <Td className="whitespace-nowrap text-sage">{order.deliveryTimeSlot}</Td>
                  <Td>
                    <StatusBadge value={order.fulfilmentStatus} />
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <StatusDistribution counts={data.statusCounts} total={data.statusTotal} />
      </section>

      <section aria-label="Recent orders" className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-light text-olive">Recent orders</h2>
          {data.recent.length > 0 ? <ActionLink href="/admin/orders">View all</ActionLink> : null}
        </div>

        {data.recent.length === 0 ? (
          <EmptyState
            title="No orders yet"
            message="Your first order will appear here the moment someone checks out."
          />
        ) : (
          <Table head={["Order", "Customer", "Total", "Payment", "Status", "Placed"]}>
            {data.recent.map((order) => (
              <tr key={order.id} className="border-b border-hairline/50 last:border-0">
                <Td className="font-medium">
                  <Link href={`/admin/orders/${order.orderNumber}`} className="hover:underline">
                    {order.orderNumber}
                  </Link>
                </Td>
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
              <ActionLink href="/admin/products/new" variant="primary">
                Add product
              </ActionLink>
              <ActionLink href="/admin/orders">View orders</ActionLink>
              <ActionLink href="/admin/occasions/new">Add occasion</ActionLink>
              <ActionLink href="/admin/media">Upload photos</ActionLink>
              <ActionLink href="/admin/enquiries">View enquiries</ActionLink>
            </div>
          </Card>
        </section>

        <section aria-label="Best sellers">
          <h2 className="mb-3 font-display text-xl font-light text-olive">Best sellers</h2>
          {data.bestSellers.length === 0 ? (
            <EmptyState
              title={
                metrics.productsAvailable === 0
                  ? "Nothing is on sale yet"
                  : "No sales in this period"
              }
              message={
                metrics.productsAvailable === 0
                  ? metrics.productsTotal > 0
                    ? `All ${metrics.productsTotal} products are hidden because none has a photograph yet. Add photos, then mark them available.`
                    : "Add your first product and it will appear here."
                  : "Once paid orders arrive, your best-selling arrangements will be ranked here."
              }
              action={<ActionLink href="/admin/products">Review products</ActionLink>}
            />
          ) : (
            <Table head={["Arrangement", "Units", "Revenue"]}>
              {data.bestSellers.map((row) => (
                <tr key={row.name} className="border-b border-hairline/50 last:border-0">
                  <Td>{row.name}</Td>
                  <Td className="tabular-nums">{row.units}</Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {formatFils(row.revenueFils)}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </section>
      </div>
    </>
  );
}
