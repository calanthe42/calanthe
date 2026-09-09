import Link from "next/link";
import { formatFils } from "@/lib/money";
import { EmptyState, PageHeader, Table, Td } from "@admin/components/ui";
import { getAdminCustomers, getCustomerOrderStats } from "@backend/data/admin-metrics";

/**
 * Customers — registered accounts only.
 *
 * Guests are deliberately absent: a guest has no account, only an order, and
 * their details live in that order's snapshot. Listing them here would invent
 * a customer record the business does not have.
 *
 * Order counts and spend are COMPUTED from orders rather than stored on the
 * user, so they cannot drift after a refund.
 *
 * This screen runs under Payload's access control, so a staff member sees
 * nothing here — the customer list is admin-only by design (docs/SECURITY.md §3).
 */

export const metadata = { title: "Customers" };

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [all, stats] = await Promise.all([getAdminCustomers(), getCustomerOrderStats()]);

  const query = q.trim().toLowerCase();
  const customers = query
    ? all.filter((c) =>
        [c.firstName, c.lastName, c.name, c.email, c.phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query)),
      )
    : all;

  return (
    <>
      <PageHeader
        title="Customers"
        breadcrumb={[{ label: "Orders" }, { label: "Customers" }]}
        description={
          all.length > 0
            ? `${all.length} registered account${all.length === 1 ? "" : "s"}`
            : undefined
        }
      />

      <form action="/admin/customers" className="mb-5 max-w-sm">
        <label htmlFor="customer-search" className="sr-only">
          Search customers
        </label>
        <input
          id="customer-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Name, email or phone…"
          className="min-h-11 w-full rounded-md border border-hairline bg-white px-3 text-sm text-olive placeholder:text-sage/60"
        />
      </form>

      {all.length === 0 ? (
        <EmptyState
          title="No customer accounts yet"
          message="Customers can buy as guests without an account, so orders may arrive before anyone appears here."
        />
      ) : customers.length === 0 ? (
        <EmptyState
          title="Nobody matches that search"
          message={`No customer matches “${q}”.`}
        />
      ) : (
        <Table head={["Name", "Email", "Phone", "Orders", "Total spent", "Marketing", "Last order"]}>
          {customers.map((customer) => {
            const stat = stats.get(customer.id) ?? { orders: 0, spentFils: 0, lastOrderAt: null };
            const marketing = customer.marketing?.subscribed;
            return (
              <tr key={customer.id} className="border-b border-hairline/50 last:border-0">
                <Td className="font-medium">
                  <Link href={`/admin/customers/${customer.id}`} className="hover:underline">
                    {[customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
                      customer.name ||
                      customer.email}
                  </Link>
                </Td>
                <Td className="text-sage">{customer.email}</Td>
                <Td className="whitespace-nowrap text-sage">{customer.phone ?? "—"}</Td>
                <Td className="tabular-nums">{stat.orders}</Td>
                <Td className="whitespace-nowrap tabular-nums">{formatFils(stat.spentFils)}</Td>
                <Td>
                  <span className={marketing ? "text-olive" : "text-sage"}>
                    {marketing ? "Subscribed" : "No"}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-sage">
                  {stat.lastOrderAt
                    ? new Date(stat.lastOrderAt).toLocaleDateString("en-AE", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
