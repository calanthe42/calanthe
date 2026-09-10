import Link from "next/link";
import { formatFils } from "@/lib/money";
import {
  DataList,
  DataRow,
  EmptyState,
  FilterBar,
  FilterField,
  PageHeader,
  Pill,
  RowAction,
  filterInputClass,
  uaeDate,
} from "@admin/components/ui";
import { getAdminCustomers, getCustomerOrderStats } from "@backend/data/admin-metrics";
import { getAdminSession } from "@backend/data/admin-session";

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
  const [session, all, stats] = await Promise.all([
    getAdminSession(),
    getAdminCustomers(),
    getCustomerOrderStats(),
  ]);

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title="Customers" breadcrumb={[{ label: "Orders" }, { label: "Customers" }]} />
        <EmptyState
          title="Customer details are for the owner"
          message="Everything needed to fulfil an order — names, phone numbers, addresses — is on the order itself."
        />
      </>
    );
  }

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
            ? `${all.length} customer account${all.length === 1 ? "" : "s"}. Guests who bought without an account are on their orders.`
            : "People who have created an account on the shop."
        }
      />

      {all.length === 0 ? (
        <EmptyState
          title="No customer accounts yet"
          message="Customers can buy as guests without an account, so orders may arrive before anyone appears here."
        />
      ) : (
        <>
          <FilterBar action="/admin/customers" active={Boolean(query)}>
            <FilterField label="Search" name="q" wide>
              <input id="q" name="q" type="search" defaultValue={q} placeholder="Name, email or phone" className={filterInputClass} />
            </FilterField>
          </FilterBar>

          {customers.length === 0 ? (
            <EmptyState title="Nobody matches that search" message={`No customer matches “${q}”.`} />
          ) : (
            <DataList label="Customers">
              {customers.map((customer) => {
                const stat = stats.get(customer.id) ?? { orders: 0, spentFils: 0, lastOrderAt: null };
                const name =
                  [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
                  customer.name ||
                  customer.email;
                const href = `/admin/customers/${customer.id}`;
                return (
                  <DataRow
                    key={customer.id}
                    title={
                      <Link href={href} className="hover:underline">
                        {name}
                      </Link>
                    }
                    subtitle={[customer.email, customer.phone].filter(Boolean).join(" · ")}
                    meta={
                      <>
                        <span className="tabular-nums">
                          {stat.orders} order{stat.orders === 1 ? "" : "s"}
                        </span>
                        <span className="tabular-nums text-olive">Spent {formatFils(stat.spentFils)}</span>
                        <span>Last order {stat.lastOrderAt ? uaeDate(stat.lastOrderAt, "long") : "never"}</span>
                        {customer.marketing?.subscribed ? <Pill tone="done">Subscribed</Pill> : null}
                      </>
                    }
                    actions={
                      <RowAction href={href} variant="primary" label={`Open customer ${name}`}>
                        Open
                      </RowAction>
                    }
                  />
                );
              })}
            </DataList>
          )}
        </>
      )}
    </>
  );
}
