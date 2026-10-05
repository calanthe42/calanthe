import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import type { Where } from "payload";
import config from "@payload-config";
import { getAdminI18n } from "@admin/i18n/server";
import { OPEN_FULFILMENT, orderSourceKey, toneFor } from "@admin/lib/status";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { DateRangeFields } from "@admin/ui/DateRange";
import { FilterBar, FilterSelect } from "@admin/ui/FilterBar";
import { PageHeader } from "@admin/ui/PageHeader";
import { Pagination, listHref, parsePage } from "@admin/ui/Pagination";
import { EmptyState } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import {
  QUOTE_ORDER_SOURCE,
  SETTLED_PAYMENT_STATUSES,
  isAwaitingQuote,
  uaeDayStart,
} from "@backend/domain/dashboard";
import { REAL_ORDER_WHERE } from "@backend/data/dashboard";
import { uaeMidnight } from "@backend/domain/dates";
import { payRequestState } from "@backend/payments/pay-link";

/**
 * Orders, newest first, with the filters an operator actually reaches for.
 *
 * Filtering and paging happen in the database query, not in the browser: the
 * store will eventually have more orders than anyone wants to ship to a page.
 *
 * Two statuses on every row, never merged. Where the money is and where the
 * flowers are are different questions — payment moves only through a provider
 * webhook, fulfilment is the part staff control.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("orders.title") };
}

const PAGE_SIZE = 25;
const FULFILMENT = ["NEW", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
const PAYMENT = ["PENDING", "AUTHORIZED", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

type Search = { q?: string; status?: string; payment?: string; from?: string; to?: string; attention?: string; page?: string };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const { q = "", status = "", payment = "", from = "", to = "", attention = "" } = params;
  const page = parsePage(params.page);

  const [i18n, payload] = await Promise.all([getAdminI18n(), getPayload({ config })]);
  const { t, plural, label, money, date } = i18n;
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const and: Where[] = [];
  if (FULFILMENT.includes(status)) and.push({ fulfilmentStatus: { equals: status } });
  if (PAYMENT.includes(payment)) and.push({ paymentStatus: { equals: payment } });
  /* Delivery days are UAE days. */
  if (DAY.test(from)) and.push({ deliveryDate: { greater_than_equal: uaeMidnight(from).toISOString() } });
  if (DAY.test(to)) and.push({ deliveryDate: { less_than: new Date(uaeMidnight(to).getTime() + DAY_MS).toISOString() } });
  if (attention === "overdue") {
    and.push({ fulfilmentStatus: { in: [...OPEN_FULFILMENT] } });
    and.push({ deliveryDate: { less_than: uaeDayStart(new Date()).toISOString() } });
    /* An unpaid payment request is never overdue: nothing is owed to the
       customer until they pay. Same rule as the dashboard's count. */
    and.push(REAL_ORDER_WHERE);
  }
  /*
   * PAYMENT REQUESTS, apart from everything else. "Payment: awaiting" alone
   * mixes them with abandoned website checkouts, which need nothing from
   * anyone. These three are the queues the dashboard counts (quoteQueue in
   * backend/domain/dashboard.ts), written as the same rules in the database:
   * waiting on the customer, link run out, and paid but not yet started.
   */
  if (attention === "awaiting-payment" || attention === "link-expired") {
    const nowIso = new Date().toISOString();
    and.push({ source: { equals: QUOTE_ORDER_SOURCE } });
    and.push({ paymentStatus: { not_in: [...SETTLED_PAYMENT_STATUSES] } });
    and.push({ fulfilmentStatus: { not_equals: "CANCELLED" } });
    and.push(
      attention === "awaiting-payment"
        ? { payLinkExpiresAt: { greater_than: nowIso } }
        : { or: [{ payLinkExpiresAt: { less_than_equal: nowIso } }, { payLinkExpiresAt: { exists: false } }] },
    );
  }
  if (attention === "paid-to-start") {
    and.push({ source: { equals: QUOTE_ORDER_SOURCE } });
    and.push({ paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] } });
    and.push({ fulfilmentStatus: { equals: "CONFIRMED" } });
  }
  const query = q.trim();
  if (query) {
    and.push({
      or: [
        { orderNumber: { like: query } },
        { customerName: { like: query } },
        { customerEmail: { like: query } },
        { customerPhone: { like: query } },
        { recipientName: { like: query } },
        /* The discount code an order used: "View orders" on a code in
           Discounts lands here, and a florist can look a code up by hand. */
        { couponCode: { like: query } },
      ],
    });
  }

  const result = await payload.find({
    collection: "orders",
    where: and.length > 0 ? { and } : {},
    sort: "-createdAt",
    limit: PAGE_SIZE,
    page,
    depth: 0,
    user,
    overrideAccess: false,
  });

  const filtered = Boolean(query || status || payment || from || to || attention);
  const renderedAt = new Date();
  const href = (p: number) => listHref("/admin/orders", { q, status, payment, from, to, attention, page: p });

  return (
    <>
      <PageHeader
        title={t("orders.title")}
        breadcrumbs={[{ label: t("nav.sections.sales") }, { label: t("orders.title") }]}
        description={
          result.totalDocs > 0
            ? plural(filtered ? "orders.countFiltered" : "orders.count", result.totalDocs)
            : t("orders.description")
        }
      />

      <FilterBar action="/admin/orders" active={filtered} searchValue={q} searchPlaceholder={t("orders.filters.searchPlaceholder")}>
        <FilterSelect
          id="status"
          label={t("orders.filters.status")}
          value={status}
          placeholder={t("common.all")}
          options={FULFILMENT.map((s) => ({ value: s, label: label("fulfilment", s) }))}
        />
        <FilterSelect
          id="payment"
          label={t("orders.filters.payment")}
          value={payment}
          placeholder={t("common.all")}
          options={PAYMENT.map((s) => ({ value: s, label: label("payment", s) }))}
        />
        <FilterSelect
          id="attention"
          label={t("orders.filters.attention")}
          value={attention}
          placeholder={t("common.all")}
          options={[
            { value: "overdue", label: t("orders.filters.overdue") },
            { value: "awaiting-payment", label: t("orders.filters.awaitingPayment") },
            { value: "link-expired", label: t("orders.filters.linkExpired") },
            { value: "paid-to-start", label: t("orders.filters.paidToStart") },
          ]}
        />
        <DateRangeFields
          legend={t("orders.filters.deliveryDates")}
          from={{ name: "from", value: from, label: t("common.from") }}
          to={{ name: "to", value: to, label: t("common.to") }}
        />
      </FilterBar>

      {result.docs.length === 0 ? (
        filtered ? (
          <EmptyState
            icon="search"
            title={t("orders.empty.noMatch")}
            body={t("orders.empty.noMatchBody")}
            action={<ButtonLink href="/admin/orders">{t("common.clearFilters")}</ButtonLink>}
          />
        ) : (
          <EmptyState icon="bag" title={t("orders.empty.title")} body={t("orders.empty.body")} />
        )
      ) : (
        <>
          <Table
            caption={t("orders.title")}
            columns={[
              { key: "order", label: t("orders.columns.order") },
              { key: "customer", label: t("orders.columns.customer") },
              { key: "total", label: t("orders.columns.total"), align: "end" },
              { key: "payment", label: t("orders.columns.payment") },
              { key: "status", label: t("orders.columns.status") },
              { key: "delivery", label: t("orders.columns.delivery") },
              { key: "actions", label: t("common.actions"), hidden: true },
            ]}
          >
            {result.docs.map((order) => {
              const number = order.orderNumber ?? "";
              const orderHref = `/admin/orders/${encodeURIComponent(number)}`;
              const items = (order.items ?? []).reduce((n, item) => n + Number(item.quantity ?? 0), 0);
              const isQuote = orderSourceKey(order.source) === "quote";
              /* An unpaid payment request says where its LINK stands — "link
                 expired" is the useful fact, and plain "awaiting payment"
                 would hide it. */
              const payState =
                isAwaitingQuote(order) && order.fulfilmentStatus !== "CANCELLED"
                  ? payRequestState(order, renderedAt)
                  : null;
              return (
                <Tr key={order.id}>
                  <Td primary>
                    <Link href={orderHref} className="-my-3 py-3 font-medium text-ink hover:underline">
                      {number || t("orders.columns.order")}
                    </Link>
                    <span className="block text-xs text-ink-3">
                      {t("orders.placed", { date: date(order.createdAt, "short") })} ·{" "}
                      {isQuote ? label("source", "quote") : plural("orders.items", items)}
                    </span>
                  </Td>
                  <Td label={t("orders.columns.customer")}>
                    <span className="block truncate">{order.customerName}</span>
                    <span className="block text-xs text-ink-3">
                      {label("customerType", order.customerType === "guest" ? "guest" : "account")}
                    </span>
                  </Td>
                  <Td label={t("orders.columns.total")} align="end" className="font-medium tabular">
                    {money(Number(order.totalFils))}
                  </Td>
                  <Td label={t("orders.columns.payment")}>
                    {payState ? (
                      <Badge tone={toneFor("payRequest", payState)}>{label("payRequest", payState)}</Badge>
                    ) : (
                      <Badge tone={toneFor("payment", order.paymentStatus)}>{label("payment", order.paymentStatus)}</Badge>
                    )}
                  </Td>
                  <Td label={t("orders.columns.status")}>
                    <Badge tone={toneFor("fulfilment", order.fulfilmentStatus)} dot>
                      {label("fulfilment", order.fulfilmentStatus)}
                    </Badge>
                  </Td>
                  <Td label={t("orders.columns.delivery")} className="whitespace-nowrap">
                    <span className="block">{date(order.deliveryDate, "weekday")}</span>
                    <span dir="ltr" className="block text-xs text-ink-3 tabular">
                      {order.deliveryTimeSlot}
                    </span>
                  </Td>
                  <Td actions>
                    {number ? (
                      <ButtonLink href={orderHref} size="sm" iconEnd="chevronRight" aria-label={t("orders.openLabel", { number })}>
                        {t("common.open")}
                      </ButtonLink>
                    ) : null}
                  </Td>
                </Tr>
              );
            })}
          </Table>
          <Pagination page={result.page ?? page} totalPages={result.totalPages} hrefFor={href} />
        </>
      )}
    </>
  );
}
