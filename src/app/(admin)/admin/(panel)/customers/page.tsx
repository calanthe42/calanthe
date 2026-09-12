import Link from "next/link";
import { getAdminI18n } from "@admin/i18n/server";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { FilterBar } from "@admin/ui/FilterBar";
import { PageHeader } from "@admin/ui/PageHeader";
import { Pagination, listHref, parsePage } from "@admin/ui/Pagination";
import { EmptyState } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import { getAdminCustomers, getCustomerOrderStats } from "@backend/data/admin-metrics";
import { displayName, getAdminSession } from "@backend/data/admin-session";

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
 * Runs under Payload's access control: a staff member sees nothing here — the
 * customer list is admin-only by design (docs/SECURITY.md §3).
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("customers.title") };
}

const PAGE_SIZE = 25;

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const [i18n, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const { t, plural, money, date } = i18n;
  const breadcrumbs = [{ label: t("nav.sections.sales") }, { label: t("customers.title") }];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("customers.title")} breadcrumbs={breadcrumbs} />
        <EmptyState icon="users" title={t("customers.ownerOnlyTitle")} body={t("customers.ownerOnlyBody")} />
      </>
    );
  }

  const [all, stats] = await Promise.all([getAdminCustomers(), getCustomerOrderStats()]);

  const query = q.trim().toLowerCase();
  const matching = query
    ? all.filter((c) =>
        [c.firstName, c.lastName, c.name, c.email, c.phone].filter(Boolean).some((v) => String(v).toLowerCase().includes(query)),
      )
    : all;
  const totalPages = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
  const page = Math.min(parsePage(params.page), totalPages);
  const rows = matching.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageHeader
        title={t("customers.title")}
        breadcrumbs={breadcrumbs}
        description={all.length > 0 ? plural("customers.count", all.length) : t("customers.description")}
      />

      {all.length === 0 ? (
        <EmptyState icon="users" title={t("customers.empty.title")} body={t("customers.empty.body")} />
      ) : (
        <>
          <FilterBar action="/admin/customers" active={Boolean(query)} searchValue={q} searchPlaceholder={t("customers.searchPlaceholder")} />

          {matching.length === 0 ? (
            <EmptyState
              icon="search"
              title={t("customers.empty.noMatch")}
              body={t("customers.empty.noMatchBody", { query: q })}
              action={<ButtonLink href="/admin/customers">{t("common.clearFilters")}</ButtonLink>}
            />
          ) : (
            <>
              <Table
                caption={t("customers.title")}
                columns={[
                  { key: "customer", label: t("customers.columns.customer") },
                  { key: "orders", label: t("customers.columns.orders"), align: "end" },
                  { key: "spent", label: t("customers.columns.spent"), align: "end" },
                  { key: "last", label: t("customers.columns.lastOrder") },
                  { key: "marketing", label: t("customers.columns.marketing") },
                  { key: "actions", label: t("common.actions"), hidden: true },
                ]}
              >
                {rows.map((customer) => {
                  const stat = stats.get(customer.id) ?? { orders: 0, spentFils: 0, lastOrderAt: null };
                  const name = displayName(customer);
                  const href = `/admin/customers/${customer.id}`;
                  return (
                    <Tr key={customer.id}>
                      <Td primary>
                        <Link href={href} className="font-medium text-ink hover:underline">
                          {name}
                        </Link>
                        <span className="block truncate text-xs text-ink-3" dir="ltr">
                          {[customer.email, customer.phone].filter(Boolean).join(" · ")}
                        </span>
                      </Td>
                      <Td label={t("customers.columns.orders")} align="end" className="tabular">
                        {stat.orders}
                      </Td>
                      <Td label={t("customers.columns.spent")} align="end" className="tabular">
                        {money(stat.spentFils)}
                      </Td>
                      <Td label={t("customers.columns.lastOrder")} className="text-ink-2">
                        {stat.lastOrderAt ? date(stat.lastOrderAt, "long") : t("common.never")}
                      </Td>
                      <Td label={t("customers.columns.marketing")}>
                        {customer.marketing?.subscribed ? (
                          <Badge tone="success">{t("customers.subscribed")}</Badge>
                        ) : (
                          <span className="text-xs text-ink-3">{t("customers.notSubscribed")}</span>
                        )}
                      </Td>
                      <Td actions>
                        <ButtonLink href={href} size="sm" iconEnd="chevronRight" aria-label={t("customers.openLabel", { name })}>
                          {t("common.open")}
                        </ButtonLink>
                      </Td>
                    </Tr>
                  );
                })}
              </Table>
              <Pagination page={page} totalPages={totalPages} hrefFor={(p) => listHref("/admin/customers", { q, page: p })} />
            </>
          )}
        </>
      )}
    </>
  );
}
