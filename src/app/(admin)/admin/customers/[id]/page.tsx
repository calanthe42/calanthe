import Link from "next/link";
import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { formatFils } from "@/lib/money";
import { Card, EmptyState, PageHeader, StatusBadge, Table, Td } from "@admin/components/ui";

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
  if (!Number.isInteger(numericId)) notFound();

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const customer = await payload
    .findByID({ collection: "users", id: numericId, depth: 0, user })
    .catch(() => null);

  if (!customer || customer.role !== "customer") notFound();

  const orders = await payload.find({
    collection: "orders",
    where: { customer: { equals: numericId } },
    sort: "-createdAt",
    limit: 100,
    depth: 0,
    user,
  });

  const paidFils = orders.docs
    .filter((o) => o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_REFUNDED")
    .reduce((sum, o) => sum + Number(o.totalFils ?? 0), 0);

  const name =
    [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
    customer.name ||
    customer.email;

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
        })}`}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="font-brand text-[10px] uppercase tracking-brand text-sage">Orders</p>
          <p className="mt-2 font-display text-3xl font-light tabular-nums text-olive">
            {orders.totalDocs}
          </p>
        </Card>
        <Card>
          <p className="font-brand text-[10px] uppercase tracking-brand text-sage">Total spent</p>
          <p className="mt-2 font-display text-3xl font-light tabular-nums text-olive">
            {formatFils(paidFils)}
          </p>
          <p className="mt-1 text-xs text-sage">Paid orders only</p>
        </Card>
        <Card>
          <p className="font-brand text-[10px] uppercase tracking-brand text-sage">Last order</p>
          <p className="mt-2 font-display text-2xl font-light text-olive">
            {orders.docs[0]
              ? new Date(orders.docs[0].createdAt).toLocaleDateString("en-AE", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Never"}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 font-display text-xl font-light text-olive">Order history</h2>
          {orders.docs.length === 0 ? (
            <EmptyState
              title="No orders yet"
              message="This customer has an account but has not ordered — or ordered as a guest before registering."
            />
          ) : (
            <Table head={["Order", "Total", "Payment", "Status", "Placed"]}>
              {orders.docs.map((order) => (
                <tr key={order.id} className="border-b border-hairline/50 last:border-0">
                  <Td className="font-medium">
                    <Link href={`/admin/orders/${order.orderNumber}`} className="hover:underline">
                      {order.orderNumber}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {formatFils(Number(order.totalFils))}
                  </Td>
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
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="mb-3 font-display text-xl font-light text-olive">Contact</h2>
            <Card>
              <p className="text-sm text-olive">{customer.email}</p>
              {customer.phone ? <p className="text-sm text-sage">{customer.phone}</p> : null}
              <p className="mt-3 text-xs text-sage">
                Marketing:{" "}
                {customer.marketing?.subscribed
                  ? `subscribed${
                      customer.marketing.consentAt
                        ? ` on ${new Date(customer.marketing.consentAt).toLocaleDateString("en-AE")}`
                        : ""
                    }`
                  : "not subscribed"}
              </p>
              <p className="mt-1 text-xs text-sage">Account: {customer.accountStatus}</p>
            </Card>
          </div>

          {(customer.addresses ?? []).length > 0 ? (
            <div>
              <h2 className="mb-3 font-display text-xl font-light text-olive">Saved addresses</h2>
              <div className="space-y-3">
                {(customer.addresses ?? []).map((address, i) => (
                  <Card key={i}>
                    <p className="text-sm font-medium text-olive">
                      {address.label || `Address ${i + 1}`}
                      {address.isDefault ? (
                        <span className="ml-2 text-xs font-normal text-sage">Default</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-sage">
                      {[address.street, address.apartment, address.area, address.emirate]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
