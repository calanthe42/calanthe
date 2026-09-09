import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import type { Where } from "payload";
import config from "@payload-config";
import { formatFils } from "@/lib/money";
import { EmptyState, PageHeader, StatusBadge, Table, Td } from "@admin/components/ui";

/**
 * Orders, newest first, with the filters an operator actually reaches for.
 *
 * Filtering is done in the database query, not in the browser: the shop will
 * eventually have more orders than anyone wants to ship to a page.
 *
 * Two status columns, never merged. Where the money is and where the flowers
 * are are different questions with different owners — payment moves only
 * through a provider webhook, fulfilment is the part staff control.
 */

export const metadata = { title: "Orders" };

const FULFILMENT = [
  "NEW", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; from?: string; to?: string }>;
}) {
  const { q = "", status = "", from = "", to = "" } = await searchParams;

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const and: Where[] = [];
  if (status) and.push({ fulfilmentStatus: { equals: status } });
  if (from) and.push({ deliveryDate: { greater_than_equal: new Date(from).toISOString() } });
  if (to) and.push({ deliveryDate: { less_than_equal: new Date(`${to}T23:59:59`).toISOString() } });
  if (q) {
    and.push({
      or: [
        { orderNumber: { like: q } },
        { customerName: { like: q } },
        { customerEmail: { like: q } },
        { customerPhone: { like: q } },
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
  });

  const filtered = Boolean(q || status || from || to);

  return (
    <>
      <PageHeader
        title="Orders"
        breadcrumb={[{ label: "Orders" }]}
        description={
          result.totalDocs > 0
            ? `${result.totalDocs} order${result.totalDocs === 1 ? "" : "s"}${filtered ? " matching your filters" : ""}`
            : undefined
        }
      />

      <form
        action="/admin/orders"
        className="mb-5 grid gap-3 rounded-md border border-hairline/70 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      >
        <div className="lg:col-span-2">
          <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-olive">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Order number, name, email or phone"
            className="min-h-11 w-full rounded-md border border-hairline px-3 text-sm text-olive placeholder:text-sage/60"
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-xs font-medium text-olive">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="min-h-11 w-full rounded-md border border-hairline px-3 text-sm text-olive"
          >
            <option value="">Any</option>
            {FULFILMENT.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase().replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="from" className="mb-1.5 block text-xs font-medium text-olive">
            Delivery from
          </label>
          <input id="from" name="from" type="date" defaultValue={from}
            className="min-h-11 w-full rounded-md border border-hairline px-3 text-sm text-olive" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor="to" className="mb-1.5 block text-xs font-medium text-olive">
              to
            </label>
            <input id="to" name="to" type="date" defaultValue={to}
              className="min-h-11 w-full rounded-md border border-hairline px-3 text-sm text-olive" />
          </div>
          <button
            type="submit"
            className="mt-6 inline-flex min-h-11 items-center rounded-md bg-burnt-orange px-4 text-sm font-medium text-cream"
          >
            Filter
          </button>
        </div>
      </form>

      {result.docs.length === 0 ? (
        filtered ? (
          <EmptyState
            title="Nothing matches those filters"
            message="Try widening the date range or clearing the search."
            action={
              <Link
                href="/admin/orders"
                className="inline-flex min-h-11 items-center rounded-md border border-hairline bg-white px-4 text-sm text-olive"
              >
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No orders yet"
            message="Your first order will appear here the moment someone checks out."
          />
        )
      ) : (
        <Table head={["Order", "Customer", "Items", "Total", "Payment", "Status", "Delivery", "Placed"]}>
          {result.docs.map((order) => (
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
