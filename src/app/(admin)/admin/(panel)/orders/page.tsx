import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import type { Where } from "payload";
import config from "@payload-config";
import { formatFils } from "@/lib/money";
import {
  ActionLink,
  DataList,
  DataRow,
  EmptyState,
  FilterBar,
  FilterField,
  FilterSelect,
  PageHeader,
  RowAction,
  StatusBadge,
  filterInputClass,
  statusLabel,
  uaeDate,
} from "@admin/components/ui";

/**
 * Orders, newest first, with the filters an operator actually reaches for.
 *
 * Filtering is done in the database query, not in the browser: the shop will
 * eventually have more orders than anyone wants to ship to a page.
 *
 * Two statuses on every row, never merged. Where the money is and where the
 * flowers are are different questions — payment moves only through a provider
 * webhook, fulfilment is the part staff control.
 */

export const metadata = { title: "Orders" };

const FULFILMENT = ["NEW", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
const PAYMENT = ["PENDING", "AUTHORIZED", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; payment?: string; from?: string; to?: string }>;
}) {
  const { q = "", status = "", payment = "", from = "", to = "" } = await searchParams;

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const and: Where[] = [];
  if (FULFILMENT.includes(status)) and.push({ fulfilmentStatus: { equals: status } });
  if (PAYMENT.includes(payment)) and.push({ paymentStatus: { equals: payment } });
  /* Delivery days are UAE days. */
  if (DAY.test(from)) {
    and.push({ deliveryDate: { greater_than_equal: new Date(`${from}T00:00:00+04:00`).toISOString() } });
  }
  if (DAY.test(to)) {
    const end = new Date(new Date(`${to}T00:00:00+04:00`).getTime() + 86_400_000);
    and.push({ deliveryDate: { less_than: end.toISOString() } });
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
      ],
    });
  }

  const result = await payload.find({
    collection: "orders",
    where: and.length > 0 ? { and } : {},
    sort: "-createdAt",
    limit: 100,
    depth: 0,
    user,
    overrideAccess: false,
  });

  const filtered = Boolean(query || status || payment || from || to);

  return (
    <>
      <PageHeader
        title="Orders"
        breadcrumb={[{ label: "Orders" }]}
        description={
          result.totalDocs > 0
            ? `${result.totalDocs} order${result.totalDocs === 1 ? "" : "s"}${filtered ? " matching your filters" : ""}`
            : "Every order placed on the shop."
        }
      />

      <FilterBar action="/admin/orders" active={filtered}>
        <FilterField label="Search" name="q" wide>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Order number, name, email or phone" className={filterInputClass} />
        </FilterField>
        <FilterField label="Order status" name="status">
          <FilterSelect name="status" value={status} options={FULFILMENT.map((s) => ({ value: s, label: statusLabel(s) }))} />
        </FilterField>
        <FilterField label="Payment" name="payment">
          <FilterSelect name="payment" value={payment} options={PAYMENT.map((s) => ({ value: s, label: statusLabel(s, "payment") }))} />
        </FilterField>
        <FilterField label="Delivery from" name="from">
          <input id="from" name="from" type="date" defaultValue={from} className={filterInputClass} />
        </FilterField>
        <FilterField label="Delivery to" name="to">
          <input id="to" name="to" type="date" defaultValue={to} className={filterInputClass} />
        </FilterField>
      </FilterBar>

      {result.docs.length === 0 ? (
        filtered ? (
          <EmptyState
            title="Nothing matches those filters"
            message="Try widening the date range or clearing the search."
            action={<ActionLink href="/admin/orders">Clear filters</ActionLink>}
          />
        ) : (
          <EmptyState
            title="No orders yet"
            message="Your first order will appear here the moment someone checks out."
          />
        )
      ) : (
        <DataList label="Orders">
          {result.docs.map((order) => {
            const href = `/admin/orders/${encodeURIComponent(order.orderNumber ?? "")}`;
            const items = (order.items ?? []).reduce((n, item) => n + Number(item.quantity ?? 0), 0);
            return (
              <DataRow
                key={order.id}
                title={
                  order.orderNumber ? (
                    <Link href={href} className="hover:underline">
                      {order.orderNumber}
                    </Link>
                  ) : (
                    "Order"
                  )
                }
                subtitle={`${order.customerName} · ${order.customerType === "guest" ? "Guest" : "Account"} · placed ${uaeDate(order.createdAt)}`}
                meta={
                  <>
                    <span className="font-medium tabular-nums text-olive">{formatFils(Number(order.totalFils))}</span>
                    <StatusBadge value={order.paymentStatus} kind="payment" />
                    <StatusBadge value={order.fulfilmentStatus} />
                    <span>
                      Delivery {uaeDate(order.deliveryDate, "weekday")} · {order.deliveryTimeSlot}
                    </span>
                    <span>
                      {items} item{items === 1 ? "" : "s"}
                    </span>
                  </>
                }
                actions={
                  order.orderNumber ? (
                    <RowAction href={href} variant="primary" label={`Open order ${order.orderNumber}`}>
                      Open
                    </RowAction>
                  ) : undefined
                }
              />
            );
          })}
        </DataList>
      )}
    </>
  );
}
