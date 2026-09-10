import Link from "next/link";
import { formatFils } from "@/lib/money";
import { cn } from "@/lib/cn";
import {
  ActionLink,
  Card,
  DataList,
  DataRow,
  EmptyState,
  PageHeader,
  Pill,
  RowAction,
  StatCard,
  StatusBadge,
  emirateLabel,
  humanStatus,
  uaeDate,
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

/* The owner is in Dubai; the server is not. */
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Dubai",
    }).format(new Date()),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const PERIODS = [7, 30, 90] as const;
const OPEN_ENQUIRY = new Set(["NEW", "IN_REVIEW", "WAITING_FOR_CUSTOMER"]);

function SectionHeading({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-2">
      <h2 className="font-display text-xl font-light text-olive">{title}</h2>
      {href ? (
        <Link href={href} className="inline-flex min-h-11 items-center text-sm text-sage underline underline-offset-4 hover:text-olive">
          {linkLabel ?? "View all"}
        </Link>
      ) : null}
    </div>
  );
}

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

  const isOwner = Boolean(session?.isAdmin);
  const firstName = session ? displayName(session.user).split(" ")[0] : "there";

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}.`}
        description="How the shop is doing, and what needs you today."
      />

      <section aria-label="Quick actions" className="mb-6 flex flex-wrap gap-2">
        {isOwner ? (
          <>
            <ActionLink href="/admin/products/new" variant="primary">
              + Add product
            </ActionLink>
            <ActionLink href="/admin/occasions/new">+ Add occasion</ActionLink>
          </>
        ) : null}
        <ActionLink href="/admin/orders">View orders</ActionLink>
        <ActionLink href="/admin/enquiries">View enquiries</ActionLink>
        <ActionLink href="/admin/media">Upload photos</ActionLink>
      </section>

      <div role="group" aria-label="Time period" className="mb-5 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs text-sage">Showing the last</span>
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/admin?period=${p}`}
            aria-current={p === period ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-md px-4 text-sm transition-colors",
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
        <Card>
          <p className="font-brand text-[10px] uppercase tracking-brand text-sage">
            Revenue · {period} days
          </p>
          <p className="mt-2 font-display text-3xl font-light tabular-nums lining-nums text-olive">
            {formatFils(data.revenueInPeriodFils)}
          </p>
          <Comparison
            currentFils={data.revenueInPeriodFils}
            previousFils={data.previousRevenueFils}
            days={period}
          />
          <p className="mt-2 text-xs leading-relaxed text-sage">
            Paid orders only.
            {data.awaitingPaymentFils > 0
              ? ` A further ${formatFils(data.awaitingPaymentFils)} is in orders still awaiting payment, including cash on delivery.`
              : ""}
          </p>
        </Card>
        <StatCard
          label={`Orders · ${period} days`}
          value={String(data.ordersInPeriod)}
          href="/admin/orders"
          hint={
            metrics.ordersTotal === 0
              ? "No orders yet — the first appears here the moment someone checks out."
              : `${metrics.ordersTotal} all time`
          }
        />
        <StatCard
          label="Customers"
          value={isOwner ? String(metrics.customersTotal) : "—"}
          href={isOwner ? "/admin/customers" : undefined}
          hint={
            !isOwner
              ? "Customer details are visible to the owner."
              : metrics.customersTotal === 0
                ? "No accounts yet. Guests can buy without one."
                : "Registered accounts"
          }
        />
        <StatCard
          label="Enquiries waiting"
          value={String(metrics.enquiriesPending)}
          href="/admin/enquiries"
          hint={
            metrics.enquiriesPending === 0
              ? "Nothing is waiting for a reply."
              : "New, in review, or waiting on the customer"
          }
        />
      </section>

      <section aria-label="Trading" className="mt-6 grid gap-4 lg:grid-cols-2">
        <BarChart points={data.series} metric="revenue" title={`Revenue · last ${period} days`} />
        <BarChart points={data.series} metric="orders" title={`Orders · last ${period} days`} />
      </section>
      {data.ordersInPeriod === 0 ? (
        <p className="mt-2 text-xs leading-relaxed text-sage">
          The charts are flat because no orders were placed in this period. That is a true zero,
          not missing data.
        </p>
      ) : null}

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <SectionHeading title="Today’s deliveries" href={data.todaysDeliveries.length ? "/admin/orders" : undefined} />
          {data.todaysDeliveries.length === 0 ? (
            <EmptyState
              title="Nothing out today"
              message="Orders due for delivery today will be listed here with their time slot."
            />
          ) : (
            <DataList label="Today’s deliveries">
              {data.todaysDeliveries.map((order) => (
                <DataRow
                  key={order.id}
                  title={
                    <Link href={`/admin/orders/${order.orderNumber}`} className="hover:underline">
                      {order.orderNumber}
                    </Link>
                  }
                  subtitle={`${order.recipientName || order.customerName} · ${emirateLabel(order.deliveryEmirate)}`}
                  meta={
                    <>
                      <span>{order.deliveryTimeSlot}</span>
                      <StatusBadge value={order.fulfilmentStatus} />
                    </>
                  }
                  actions={
                    <RowAction href={`/admin/orders/${order.orderNumber}`} label={`Open order ${order.orderNumber}`}>
                      Open
                    </RowAction>
                  }
                />
              ))}
            </DataList>
          )}
        </div>

        <div className="min-w-0">
          <SectionHeading title="Overdue orders" />
          {data.needsAttention.length === 0 ? (
            <EmptyState
              title="Nothing overdue"
              message="An order still open after its delivery date would be flagged here."
            />
          ) : (
            <>
              <p className="mb-3 text-sm text-burgundy">
                {data.needsAttention.length} order{data.needsAttention.length === 1 ? " is" : "s are"} past
                the delivery date and still open.
              </p>
              <DataList label="Overdue orders">
                {data.needsAttention.slice(0, 6).map((order) => (
                  <DataRow
                    key={order.id}
                    title={
                      <Link href={`/admin/orders/${order.orderNumber}`} className="hover:underline">
                        {order.orderNumber}
                      </Link>
                    }
                    subtitle={order.customerName}
                    meta={
                      <>
                        <Pill tone="halt">Due {uaeDate(order.deliveryDate, "weekday")}</Pill>
                        <StatusBadge value={order.fulfilmentStatus} />
                      </>
                    }
                    actions={
                      <RowAction href={`/admin/orders/${order.orderNumber}`} variant="primary" label={`Open order ${order.orderNumber}`}>
                        Open
                      </RowAction>
                    }
                  />
                ))}
              </DataList>
            </>
          )}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <StatusDistribution counts={data.statusCounts} total={data.statusTotal} />
        </div>

        <div className="min-w-0">
          <SectionHeading title="Best sellers" />
          {data.bestSellers.length === 0 ? (
            <EmptyState
              title={metrics.productsAvailable === 0 ? "Nothing is on sale yet" : "No sales in this period"}
              message={
                metrics.productsAvailable === 0
                  ? metrics.productsTotal > 0
                    ? `All ${metrics.productsTotal} products are hidden because none has a photo yet. Add photos, then make them available.`
                    : "Add your first product and it will appear here."
                  : "Once paid orders arrive, your best-selling arrangements will be ranked here."
              }
              action={<ActionLink href="/admin/products">Review products</ActionLink>}
            />
          ) : (
            <DataList label="Best sellers">
              {data.bestSellers.map((row, i) => (
                <DataRow
                  key={row.name}
                  leading={<span className="w-5 text-sm tabular-nums text-sage">{i + 1}</span>}
                  title={row.name}
                  meta={
                    <>
                      <span className="tabular-nums">{row.units} sold</span>
                      <span className="tabular-nums text-olive">{formatFils(row.revenueFils)}</span>
                    </>
                  }
                />
              ))}
            </DataList>
          )}
        </div>
      </section>

      <section className="mt-10 grid gap-6 xl:grid-cols-2">
        <div className="min-w-0">
          <SectionHeading title="Recent orders" href={data.recent.length ? "/admin/orders" : undefined} />
          {data.recent.length === 0 ? (
            <EmptyState title="No orders yet" message="Your first order will appear here the moment someone checks out." />
          ) : (
            <DataList label="Recent orders">
              {data.recent.map((order) => (
                <DataRow
                  key={order.id}
                  title={
                    <Link href={`/admin/orders/${order.orderNumber}`} className="hover:underline">
                      {order.orderNumber}
                    </Link>
                  }
                  subtitle={`${order.customerName} · placed ${uaeDate(order.createdAt)}`}
                  meta={
                    <>
                      <span className="font-medium tabular-nums text-olive">{formatFils(Number(order.totalFils))}</span>
                      <StatusBadge value={order.paymentStatus} kind="payment" />
                      <StatusBadge value={order.fulfilmentStatus} />
                    </>
                  }
                  actions={
                    <RowAction href={`/admin/orders/${order.orderNumber}`} label={`Open order ${order.orderNumber}`}>
                      Open
                    </RowAction>
                  }
                />
              ))}
            </DataList>
          )}
        </div>

        <div className="min-w-0">
          <SectionHeading title="Recent enquiries" href={data.recentEnquiries.length ? "/admin/enquiries" : undefined} />
          {data.recentEnquiries.length === 0 ? (
            <EmptyState title="No enquiries yet" message="Wedding, event and contact enquiries will appear here as they come in." />
          ) : (
            <DataList label="Recent enquiries">
              {data.recentEnquiries.map((enquiry) => (
                <DataRow
                  key={enquiry.id}
                  title={
                    <Link href={`/admin/enquiries/${enquiry.id}`} className="hover:underline">
                      {enquiry.subject}
                    </Link>
                  }
                  subtitle={`${enquiry.contactName} · ${humanStatus(enquiry.type)} · ${uaeDate(enquiry.createdAt)}`}
                  meta={
                    <>
                      <StatusBadge value={enquiry.status} kind="plain" />
                      {OPEN_ENQUIRY.has(enquiry.status) && (enquiry.priority === "URGENT" || enquiry.priority === "HIGH") ? (
                        <Pill tone={enquiry.priority === "URGENT" ? "halt" : "attention"}>
                          {humanStatus(enquiry.priority)} priority
                        </Pill>
                      ) : null}
                    </>
                  }
                  actions={
                    <RowAction href={`/admin/enquiries/${enquiry.id}`} label={`Open enquiry ${enquiry.enquiryNumber ?? enquiry.subject}`}>
                      Open
                    </RowAction>
                  }
                />
              ))}
            </DataList>
          )}
        </div>
      </section>
    </>
  );
}
