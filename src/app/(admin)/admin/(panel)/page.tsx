import Link from "next/link";
import { cn } from "@/lib/cn";
import { BarChart, StatusBar } from "@admin/components/Charts";
import { getAdminI18n } from "@admin/i18n/server";
import type { MessageKey, PluralKey } from "@admin/i18n/translate";
import { toneFor } from "@admin/lib/status";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { Card, CardHeader, StatCard, type Trend } from "@admin/ui/Card";
import { DateRangePresets } from "@admin/ui/DateRange";
import { Icon, type IconName } from "@admin/ui/icons";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import { displayName, getAdminSession } from "@backend/data/admin-session";
import { getDashboardData } from "@backend/data/dashboard";
import { DASHBOARD_PERIODS, parsePeriod, percentChange } from "@backend/domain/dashboard";
import { dubaiDateInputValue } from "@backend/domain/dates";

/**
 * The owner's first screen: how the business is doing, what needs her, what
 * is happening today.
 *
 * Every number is read from the database. Where the business has no data yet,
 * the panel says so plainly rather than showing a plausible-looking number —
 * a dashboard the owner cannot trust is worse than none, because she would
 * act on it. "Needs attention" lists only conditions that are actually true.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("nav.dashboard") };
}

type Attention = { key: string; tone: "danger" | "warning" | "info"; icon: IconName; text: string; href: string };

const PERIOD_LABEL: Record<number, MessageKey> = {
  7: "dashboard.range.d7",
  30: "dashboard.range.d30",
  90: "dashboard.range.d90",
};

const STATUS_COLOUR: Record<string, string> = {
  NEW: "bg-ink/70",
  CONFIRMED: "bg-ink/35",
  PREPARING: "bg-accent",
  READY: "bg-accent/60",
  OUT_FOR_DELIVERY: "bg-accent/30",
};

/* The owner is in Dubai; the server is not. */
function greetingKey(): MessageKey {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Dubai" }).format(new Date()),
  );
  if (hour < 12) return "dashboard.greeting.morning";
  if (hour < 18) return "dashboard.greeting.afternoon";
  return "dashboard.greeting.evening";
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: rawPeriod } = await searchParams;
  const period = parsePeriod(rawPeriod);

  const [i18n, session, data] = await Promise.all([getAdminI18n(), getAdminSession(), getDashboardData(period)]);
  const { t, plural, money, number, date, label } = i18n;
  const isOwner = Boolean(session?.isAdmin);
  const firstName = session ? displayName(session.user).split(" ")[0] ?? "" : "";

  const trend = (current: number, previous: number): Trend | undefined => {
    const change = percentChange(current, previous);
    if (change === null) return current > 0 ? { direction: "flat", label: t("dashboard.kpi.noPrevious") } : undefined;
    if (change === 0) return { direction: "flat", label: t("dashboard.kpi.flat") };
    return change > 0
      ? { direction: "up", label: t("dashboard.kpi.up", { percent: change }) }
      : { direction: "down", label: t("dashboard.kpi.down", { percent: Math.abs(change) }) };
  };

  const today = dubaiDateInputValue(new Date().toISOString());
  const attention: Attention[] = [];
  const add = (count: number, key: PluralKey, item: Omit<Attention, "text" | "key">) => {
    if (count > 0) attention.push({ ...item, key, text: plural(key, count) });
  };
  add(data.overdue, "dashboard.attention.overdue", { tone: "danger", icon: "clock", href: "/admin/orders?attention=overdue" });
  add(data.newOrders, "dashboard.attention.newOrders", { tone: "warning", icon: "bag", href: "/admin/orders?status=NEW" });
  add(data.enquiriesWaiting, "dashboard.attention.enquiries", { tone: "warning", icon: "message", href: "/admin/enquiries?status=waiting" });
  add(data.followUpsDue, "dashboard.attention.followUps", { tone: "warning", icon: "calendar", href: "/admin/enquiries?followUp=due" });
  add(data.products.outOfStock, "dashboard.attention.outOfStock", { tone: "danger", icon: "box", href: "/admin/products?availability=out-of-stock" });
  add(data.products.noPhoto, "dashboard.attention.noPhoto", { tone: "info", icon: "image", href: "/admin/products?availability=no-photos" });
  add(data.products.hidden, "dashboard.attention.hidden", { tone: "info", icon: "eye", href: "/admin/products?availability=hidden" });
  add(data.todaysDeliveries.length, "dashboard.attention.deliveriesToday", { tone: "info", icon: "truck", href: `/admin/orders?from=${today}&to=${today}` });

  const days = data.series.length;
  const dayLabel = (day: string) => date(`${day}T12:00:00+04:00`, "short");
  const revenueBars = data.series.map((p) => ({ key: p.day, label: dayLabel(p.day), value: p.revenueFils, display: money(p.revenueFils) }));
  const orderBars = data.series.map((p) => ({ key: p.day, label: dayLabel(p.day), value: p.orders, display: number(p.orders) }));

  return (
    <>
      <PageHeader
        title={t(greetingKey(), { name: firstName })}
        description={t("dashboard.subtitle")}
        actions={
          <DateRangePresets
            label={t("dashboard.range.label")}
            presets={DASHBOARD_PERIODS.map((p) => ({
              label: t(PERIOD_LABEL[p] ?? "dashboard.range.d7"),
              href: p === 7 ? "/admin" : `/admin?period=${p}`,
              active: p === period,
              description: plural("dashboard.lastDays", p),
            }))}
          />
        }
      />

      <section aria-label={t("dashboard.quick.label")} className="mb-6 flex flex-wrap gap-2">
        {isOwner ? (
          <ButtonLink href="/admin/products/new" variant="primary" icon="plus">
            {t("dashboard.quick.addProduct")}
          </ButtonLink>
        ) : null}
        <ButtonLink href="/admin/discounts" icon="tag">
          {t("dashboard.quick.createDiscount")}
          <Badge className="ms-0.5">{t("common.soon")}</Badge>
        </ButtonLink>
        <ButtonLink href="/admin/orders" icon="bag">
          {t("dashboard.quick.viewOrders")}
        </ButtonLink>
        <ButtonLink href="/admin/enquiries" icon="message">
          {t("dashboard.quick.viewEnquiries")}
        </ButtonLink>
      </section>

      <section aria-label={t("nav.sections.overview")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("dashboard.kpi.revenue")}
          icon="trendUp"
          value={money(data.current.revenueFils)}
          trend={trend(data.current.revenueFils, data.previous.revenueFils)}
          secondary={
            <>
              {t("dashboard.kpi.paid", { amount: money(data.current.paidFils) })}
              <br />
              {t("dashboard.kpi.revenueBasis")}
            </>
          }
        />
        <StatCard
          label={t("dashboard.kpi.orders")}
          icon="bag"
          href="/admin/orders"
          value={number(data.current.orders)}
          trend={trend(data.current.orders, data.previous.orders)}
          secondary={t("dashboard.kpi.ordersAllTime", { count: number(data.ordersAllTime) })}
        />
        <StatCard
          label={t("dashboard.kpi.customers")}
          icon="users"
          href={data.customers ? "/admin/customers" : undefined}
          value={data.customers ? number(data.customers.total) : "—"}
          secondary={
            data.customers
              ? t("dashboard.kpi.customersNew", { count: number(data.customers.newInPeriod) })
              : t("dashboard.kpi.customersOwnerOnly")
          }
        />
        <StatCard
          label={t("dashboard.kpi.products")}
          icon="flower"
          href="/admin/products"
          value={number(data.products.total)}
          secondary={t("dashboard.kpi.productsBreakdown", {
            live: number(data.products.live),
            hidden: number(data.products.hidden),
          })}
        />
      </section>

      <Card as="section" className="mt-6">
        <CardHeader title={t("dashboard.attention.title")} />
        {attention.length === 0 ? (
          <div className="mt-2 flex items-start gap-3 rounded-md bg-success/[0.07] px-4 py-3">
            <Icon name="checkCircle" className="mt-0.5 text-success" />
            <div>
              <p className="text-sm font-medium text-ink">{t("dashboard.attention.allClear")}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-3">{t("dashboard.attention.allClearBody")}</p>
            </div>
          </div>
        ) : (
          <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {attention.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="group flex min-h-14 items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-line-strong hover:bg-hover"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                      item.tone === "danger" && "bg-danger/10 text-danger",
                      item.tone === "warning" && "bg-warning/10 text-warning",
                      item.tone === "info" && "bg-sunken text-ink-2",
                    )}
                  >
                    <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-ink">{item.text}</span>
                  <Icon name="chevronRight" className="h-4 w-4 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t("dashboard.charts.revenue")}
            description={plural("dashboard.lastDays", days)}
            action={<span className="text-lg font-semibold text-ink tabular">{money(data.current.revenueFils)}</span>}
          />
          <div className="mt-4">
            <BarChart
              bars={revenueBars}
              emptyText={t("dashboard.charts.emptyRevenue")}
              summary={t("dashboard.charts.summary", { title: t("dashboard.charts.revenue"), total: money(data.current.revenueFils), days })}
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title={t("dashboard.charts.orders")}
            description={plural("dashboard.lastDays", days)}
            action={<span className="text-lg font-semibold text-ink tabular">{number(data.current.orders)}</span>}
          />
          <div className="mt-4">
            <BarChart
              bars={orderBars}
              tone="ink"
              emptyText={t("dashboard.charts.emptyOrders")}
              summary={t("dashboard.charts.summary", { title: t("dashboard.charts.orders"), total: number(data.current.orders), days })}
            />
          </div>
        </Card>
      </section>
      {data.current.orders === 0 ? <p className="mt-2 text-xs leading-relaxed text-ink-3">{t("dashboard.charts.quiet")}</p> : null}

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={t("dashboard.charts.status")} />
          <div className="mt-4">
            <StatusBar
              emptyText={t("dashboard.charts.emptyStatus")}
              summary={data.openStatus.map((s) => `${label("fulfilment", s.status)}: ${s.count}`).join(", ")}
              segments={data.openStatus.map((s) => ({
                key: s.status,
                label: label("fulfilment", s.status),
                count: s.count,
                className: STATUS_COLOUR[s.status] ?? "bg-ink/20",
              }))}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title={t("dashboard.topProducts")} description={plural("dashboard.lastDays", days)} />
          {data.top.length === 0 ? (
            <EmptyState variant="plain" icon="flower" title={t("dashboard.noSales")} body={t("dashboard.noSalesBody")} />
          ) : (
            <ol className="mt-3 divide-y divide-line">
              {data.top.map((row, index) => (
                <li key={row.key} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 shrink-0 text-sm text-ink-3 tabular">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{row.name}</span>
                    <span className="block text-xs text-ink-3">{plural("dashboard.unitsSold", row.units)}</span>
                  </span>
                  <span className="shrink-0 text-sm text-ink tabular">{money(row.revenueFils)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <CardHeader title={t("dashboard.todaysDeliveries")} />
          {data.todaysDeliveries.length === 0 ? (
            <EmptyState variant="plain" icon="truck" title={t("dashboard.noDeliveries")} body={t("dashboard.noDeliveriesBody")} />
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.todaysDeliveries.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${encodeURIComponent(order.orderNumber ?? "")}`}
                    className="-mx-2 flex min-h-14 items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-hover"
                  >
                    <span dir="ltr" className="w-24 shrink-0 text-xs font-medium text-ink-2 tabular">
                      {order.deliveryTimeSlot}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{order.recipientName || order.customerName}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {order.orderNumber} · {label("emirate", order.deliveryEmirate)}
                      </span>
                    </span>
                    <Badge tone={toneFor("fulfilment", order.fulfilmentStatus)}>{label("fulfilment", order.fulfilmentStatus)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-5">
        <div className="min-w-0 xl:col-span-3">
          <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">{t("dashboard.recentOrders")}</h2>
            {data.recentOrders.length > 0 ? (
              <ButtonLink href="/admin/orders" variant="ghost" size="sm" iconEnd="chevronRight">
                {t("dashboard.viewAll")}
              </ButtonLink>
            ) : null}
          </div>
          {data.recentOrders.length === 0 ? (
            <EmptyState icon="bag" title={t("dashboard.noOrders")} body={t("dashboard.noOrdersBody")} />
          ) : (
            <Table
              caption={t("dashboard.recentOrders")}
              columns={[
                { key: "order", label: t("orders.columns.order") },
                { key: "total", label: t("orders.columns.total"), align: "end" },
                { key: "status", label: t("orders.columns.status") },
                { key: "payment", label: t("orders.columns.payment") },
              ]}
            >
              {data.recentOrders.map((order) => (
                <Tr key={order.id}>
                  <Td primary>
                    <Link href={`/admin/orders/${encodeURIComponent(order.orderNumber ?? "")}`} className="font-medium text-ink hover:underline">
                      {order.orderNumber}
                    </Link>
                    <span className="block text-xs text-ink-3">
                      {order.customerName} · {date(order.createdAt, "short")}
                    </span>
                  </Td>
                  <Td label={t("orders.columns.total")} align="end" className="tabular">
                    {money(Number(order.totalFils))}
                  </Td>
                  <Td label={t("orders.columns.status")}>
                    <Badge tone={toneFor("fulfilment", order.fulfilmentStatus)}>{label("fulfilment", order.fulfilmentStatus)}</Badge>
                  </Td>
                  <Td label={t("orders.columns.payment")}>
                    <Badge tone={toneFor("payment", order.paymentStatus)}>{label("payment", order.paymentStatus)}</Badge>
                  </Td>
                </Tr>
              ))}
            </Table>
          )}
        </div>

        <div className="min-w-0 xl:col-span-2">
          <div className="mb-2 flex min-h-11 items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">{t("dashboard.recentEnquiries")}</h2>
            {data.recentEnquiries.length > 0 ? (
              <ButtonLink href="/admin/enquiries" variant="ghost" size="sm" iconEnd="chevronRight">
                {t("dashboard.viewAll")}
              </ButtonLink>
            ) : null}
          </div>
          {data.recentEnquiries.length === 0 ? (
            <EmptyState icon="message" title={t("dashboard.noEnquiries")} body={t("dashboard.noEnquiriesBody")} />
          ) : (
            <Card padded={false}>
              <ul className="divide-y divide-line">
                {data.recentEnquiries.map((enquiry) => (
                  <li key={enquiry.id}>
                    <Link
                      href={`/admin/enquiries/${enquiry.id}`}
                      className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{enquiry.subject}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {enquiry.contactName} · {label("enquiryType", enquiry.type)} · {date(enquiry.createdAt, "short")}
                        </span>
                      </span>
                      <Badge tone={toneFor("enquiryStatus", enquiry.status)}>{label("enquiryStatus", enquiry.status)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </section>
    </>
  );
}
