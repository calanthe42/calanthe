import Link from "next/link";
import { getAdminI18n } from "@admin/i18n/server";
import { Badge, type Tone } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { FilterBar } from "@admin/ui/FilterBar";
import { PageHeader } from "@admin/ui/PageHeader";
import { Pagination, listHref, parsePage } from "@admin/ui/Pagination";
import { EmptyState, Notice } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import { listInvoices } from "@backend/data/invoices";

/**
 * Invoices: every invoice, in the order its number was issued.
 *
 * A website order gets its number the moment it is paid. An invoice written
 * by hand ("Create invoice" opens the same form as "Create order") gets its
 * number when it is created, so it can be downloaded and sent first; it
 * shows as Unpaid until the money arrives, and as Void if it is cancelled.
 * Either way the number comes from one counter, so the series has no gaps.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("invoices.title") };
}

const PAGE_SIZE = 25;
const STATUS_TONE: Record<string, Tone> = { paid: "success", unpaid: "warning", void: "neutral" };

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const page = parsePage(params.page);

  const [{ t, plural, label, money, date }, list] = await Promise.all([
    getAdminI18n(),
    listInvoices({ q, page, pageSize: PAGE_SIZE }),
  ]);
  const filtered = q.trim() !== "";
  const href = (p: number) => listHref("/admin/invoices", { q, page: p });

  return (
    <>
      <PageHeader
        title={t("invoices.title")}
        breadcrumbs={[{ label: t("nav.sections.sales") }, { label: t("invoices.title") }]}
        description={list.total > 0 ? plural("invoices.count", list.total) : t("invoices.description")}
        actions={
          <ButtonLink href="/admin/orders/new?from=invoices" variant="primary" icon="plus">
            {t("invoices.newButton")}
          </ButtonLink>
        }
      />

      {list.awaitingPayment > 0 ? (
        <Notice tone="info">
          {plural("invoices.awaiting", list.awaitingPayment)}{" "}
          <Link
            href="/admin/orders?attention=awaiting-payment"
            className="font-medium text-ink underline underline-offset-4"
          >
            {t("invoices.awaitingLink")}
          </Link>
        </Notice>
      ) : null}

      <FilterBar
        action="/admin/invoices"
        active={filtered}
        searchValue={q}
        searchPlaceholder={t("invoices.searchPlaceholder")}
      />

      {list.rows.length === 0 ? (
        <EmptyState
          icon={filtered ? "search" : "receipt"}
          title={filtered ? t("invoices.emptyFiltered") : t("invoices.empty")}
          body={filtered ? undefined : t("invoices.emptyBody")}
          action={
            filtered ? (
              <ButtonLink href="/admin/invoices">{t("common.clearFilters")}</ButtonLink>
            ) : (
              <ButtonLink href="/admin/orders/new?from=invoices" variant="primary" icon="plus">
                {t("invoices.newButton")}
              </ButtonLink>
            )
          }
        />
      ) : (
        <>
          <Table
            caption={t("invoices.title")}
            columns={[
              { key: "number", label: t("invoices.number") },
              { key: "date", label: t("invoices.date") },
              { key: "customer", label: t("invoices.customer") },
              { key: "status", label: t("invoices.status") },
              { key: "method", label: t("invoices.method") },
              { key: "total", label: t("invoices.total"), align: "end" },
              { key: "view", label: t("invoices.view"), align: "end", hidden: true },
            ]}
          >
            {list.rows.map((row) => (
              <Tr key={row.orderId}>
                <Td primary>
                  <span dir="ltr" className="font-medium text-ink tabular">
                    {row.invoiceNumber}
                  </span>
                  <Link
                    href={`/admin/orders/${encodeURIComponent(row.orderNumber)}`}
                    className="mt-0.5 block text-sm text-ink-2 underline-offset-4 hover:underline"
                  >
                    {t("invoices.order")} <span dir="ltr">{row.orderNumber}</span>
                  </Link>
                </Td>
                <Td label={t("invoices.date")}>{row.date ? date(row.date, "short") : "—"}</Td>
                <Td label={t("invoices.customer")}>
                  <span className="block">{row.customerName}</span>
                  <span dir="ltr" className="block text-sm text-ink-2">
                    {row.customerPhone}
                  </span>
                </Td>
                <Td label={t("invoices.status")}>
                  <Badge tone={STATUS_TONE[row.status] ?? "neutral"} dot>
                    {label("invoiceStatus", row.status)}
                  </Badge>
                </Td>
                <Td label={t("invoices.method")}>
                  {row.status === "paid" ? label("paymentMethod", row.method) : "—"}
                </Td>
                <Td label={t("invoices.total")} align="end">
                  <span className="font-semibold tabular" dir="ltr">
                    {money(row.totalFils)}
                  </span>
                </Td>
                <Td actions align="end">
                  <ButtonLink
                    href={row.url}
                    external
                    size="sm"
                    icon="external"
                    aria-label={t("invoices.viewLabel", { number: row.invoiceNumber })}
                  >
                    {t("invoices.view")}
                  </ButtonLink>
                </Td>
              </Tr>
            ))}
          </Table>
          <Pagination page={page} totalPages={list.totalPages} hrefFor={href} />
        </>
      )}
    </>
  );
}
