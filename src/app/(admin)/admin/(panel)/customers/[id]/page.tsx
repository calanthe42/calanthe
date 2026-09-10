import Link from "next/link";
import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { formatFils } from "@/lib/money";
import {
  Card,
  DataList,
  DataRow,
  EmptyState,
  PageHeader,
  RowAction,
  StatCard,
  StatusBadge,
  emirateLabel,
  humanStatus,
  uaeDate,
} from "@admin/components/ui";

/**
 * One customer, with the order history computed from orders rather than
 * stored on the account — a cached "total spent" is a number that quietly
 * goes wrong after the first refund.
 *
 * Read under the caller's own permissions. Payload's access rules mean a
 * staff member cannot open this page for anyone but themselves, which is the
 * intended behaviour: the customer list is the business's most valuable asset
 * and stays with the owner (docs/SECURITY.md §3).
 */

export const metadata = { title: "Customer" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const customer = await payload
    .findByID({ collection: "users", id: numericId, depth: 0, user, overrideAccess: false })
    .catch(() => null);

  if (!customer || customer.role !== "customer") notFound();

  const orders = await payload.find({
    collection: "orders",
    where: { customer: { equals: numericId } },
    sort: "-createdAt",
    limit: 100,
    depth: 0,
    user,
    overrideAccess: false,
  });

  const paidFils = orders.docs
    .filter((o) => o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_REFUNDED")
    .reduce((sum, o) => sum + Number(o.totalFils ?? 0), 0);

  const name =
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.name ||
    customer.email;

  const marketing = customer.marketing?.subscribed
    ? `Subscribed${customer.marketing.consentAt ? ` on ${uaeDate(customer.marketing.consentAt, "long")}` : ""}`
    : "Not subscribed";

  return (
    <>
      <PageHeader
        title={name}
        breadcrumb={[
          { label: "Orders" },
          { label: "Customers", href: "/admin/customers" },
          { label: name },
        ]}
        description={`Customer since ${new Date(customer.createdAt).toLocaleDateString("en-AE", {
          month: "long",
          year: "numeric",
          timeZone: "Asia/Dubai",
        })}`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard label="Orders" value={String(orders.totalDocs)} />
        <StatCard label="Total spent" value={formatFils(paidFils)} hint="Paid orders only" />
        <StatCard
          label="Last order"
          value={orders.docs[0] ? uaeDate(orders.docs[0].createdAt, "short") : "Never"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <h2 className="mb-3 font-display text-xl font-light text-olive">Order history</h2>
          {orders.docs.length === 0 ? (
            <EmptyState
              title="No orders yet"
              message="This customer has an account but has not ordered — or ordered as a guest before registering."
            />
          ) : (
            <DataList label="Order history">
              {orders.docs.map((order) => {
                const href = `/admin/orders/${order.orderNumber}`;
                return (
                  <DataRow
                    key={order.id}
                    title={
                      <Link href={href} className="hover:underline">
                        {order.orderNumber}
                      </Link>
                    }
                    subtitle={`Placed ${uaeDate(order.createdAt, "long")}`}
                    meta={
                      <>
                        <span className="font-medium tabular-nums text-olive">{formatFils(Number(order.totalFils))}</span>
                        <StatusBadge value={order.paymentStatus} kind="payment" />
                        <StatusBadge value={order.fulfilmentStatus} />
                      </>
                    }
                    actions={
                      <RowAction href={href} label={`Open order ${order.orderNumber}`}>
                        Open
                      </RowAction>
                    }
                  />
                );
              })}
            </DataList>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <div>
            <h2 className="mb-3 font-display text-xl font-light text-olive">Customer information</h2>
            <Card>
              <p className="break-all text-sm">
                <a href={`mailto:${customer.email}`} className="text-olive underline-offset-4 hover:underline">
                  {customer.email}
                </a>
              </p>
              {customer.phone ? (
                <p className="text-sm">
                  <a href={`tel:${customer.phone}`} className="text-sage underline-offset-4 hover:text-olive hover:underline">
                    {customer.phone}
                  </a>
                </p>
              ) : null}
              <dl className="mt-3 space-y-1 text-xs text-sage">
                <div>
                  <dt className="inline">Marketing: </dt>
                  <dd className="inline text-olive">{marketing}</dd>
                </div>
                <div>
                  <dt className="inline">Account: </dt>
                  <dd className="inline text-olive">{humanStatus(String(customer.accountStatus ?? "active"))}</dd>
                </div>
              </dl>
            </Card>
          </div>

          <div>
            <h2 className="mb-3 font-display text-xl font-light text-olive">Saved addresses</h2>
            {(customer.addresses ?? []).length === 0 ? (
              <p className="text-sm text-sage">No saved addresses.</p>
            ) : (
              <div className="space-y-3">
                {(customer.addresses ?? []).map((address, i) => (
                  <Card key={address.id ?? i}>
                    <p className="text-sm font-medium text-olive">
                      {address.label || `Address ${i + 1}`}
                      {address.isDefault ? <span className="ml-2 text-xs font-normal text-sage">Default</span> : null}
                    </p>
                    <p className="mt-1 text-sm text-sage">
                      {[address.street, address.apartment, address.area, emirateLabel(address.emirate)]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
