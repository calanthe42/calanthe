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

export default async function AdminCustomersPage() {
  const [customers, stats] = await Promise.all([getAdminCustomers(), getCustomerOrderStats()]);

  return (
    <>
      <PageHeader
        title="Customers"
        breadcrumb={[{ label: "Orders" }, { label: "Customers" }]}
        description={
          customers.length > 0
            ? `${customers.length} registered account${customers.length === 1 ? "" : "s"}`
            : undefined
        }
      />

      {customers.length === 0 ? (
        <EmptyState
          title="No customer accounts yet"
          message="Customers can buy as guests without an account, so orders may arrive before anyone appears here."
        />
      ) : (
        <Table head={["Name", "Email", "Phone", "Orders", "Total spent", "Marketing", "Last order"]}>
          {customers.map((customer) => {
            const stat = stats.get(customer.id) ?? { orders: 0, spentFils: 0, lastOrderAt: null };
            const marketing = customer.marketing?.subscribed;
            return (
              <tr key={customer.id} className="border-b border-hairline/50 last:border-0">
                <Td className="font-medium">
                  {[customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
                    customer.name ||
                    "—"}
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
