import Link from "next/link";
import { getAdminI18n } from "@admin/i18n/server";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState, Notice } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import { getAdminSession } from "@backend/data/admin-session";
import { listInvoices } from "@backend/data/costs";
import { uaeMidnight } from "@backend/domain/dates";

/**
 * Supplier invoices — everything she bought, one invoice at a time, newest
 * invoice date first: the date, who it was from, the total and how many
 * lines. A row opens the invoice to change or delete it.
 *
 * OWNER ONLY, like everything under /admin/costs: the collection refuses a
 * florist, and a florist who types the address gets a plain sentence.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("costs.invoices.title") };
}

export default async function SupplierInvoicesPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  const [i18n, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const { t, plural, money, date } = i18n;
  const breadcrumbs = [{ label: t("nav.sections.costs") }, { label: t("costs.invoices.title") }];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("costs.invoices.title")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon="lock"
          title={t("costs.ownerOnlyTitle")}
          body={t("costs.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("costs.back")}</ButtonLink>}
        />
      </>
    );
  }

  const invoices = await listInvoices();
  const addButton = (
    <ButtonLink href="/admin/costs/invoices/new" variant="primary" icon="plus">
      {t("costs.invoices.add")}
    </ButtonLink>
  );
  /* The day printed on the invoice, read as that day in the UAE. */
  const day = (yyyyMmDd: string) => date(uaeMidnight(yyyyMmDd).toISOString(), "long");

  return (
    <>
      <PageHeader
        title={t("costs.invoices.title")}
        breadcrumbs={breadcrumbs}
        description={t("costs.invoices.description")}
        actions={
          <>
            <ButtonLink href="/admin/costs/buy" variant="ghost" icon="box">
              {t("costs.invoices.seeBuy")}
            </ButtonLink>
            {addButton}
          </>
        }
      />

      {deleted ? <Notice tone="success">{t("costs.invoices.deleted")}</Notice> : null}

      {invoices.length === 0 ? (
        <EmptyState
          icon="receipt"
          title={t("costs.invoices.empty.title")}
          body={t("costs.invoices.empty.body")}
          action={addButton}
        />
      ) : (
        <Table
          caption={t("costs.invoices.title")}
          columns={[
            { key: "date", label: t("costs.invoices.columns.date") },
            { key: "supplier", label: t("costs.invoices.columns.supplier") },
            { key: "lines", label: t("costs.invoices.columns.lines") },
            { key: "total", label: t("costs.invoices.columns.total"), align: "end" },
          ]}
        >
          {invoices.map((invoice) => (
            <Tr key={invoice.id}>
              <Td primary>
                <Link
                  href={`/admin/costs/invoices/${invoice.id}`}
                  aria-label={t("costs.invoices.open", { supplier: invoice.supplier.name, date: day(invoice.invoiceDate) })}
                  className="-my-3 block py-3 font-medium text-ink hover:underline"
                >
                  {day(invoice.invoiceDate)}
                </Link>
                {invoice.invoiceNumber ? (
                  <span className="block text-xs text-ink-3 tabular" dir="auto">
                    {t("costs.invoices.number", { number: invoice.invoiceNumber })}
                  </span>
                ) : null}
              </Td>
              <Td label={t("costs.invoices.columns.supplier")} className="text-ink-2">
                {invoice.supplier.name}
              </Td>
              <Td label={t("costs.invoices.columns.lines")} className="text-ink-2 tabular">
                {plural("costs.invoices.lines", invoice.lineCount)}
              </Td>
              <Td label={t("costs.invoices.columns.total")} align="end" className="font-medium tabular">
                {money(invoice.totalFils)}
              </Td>
            </Tr>
          ))}
        </Table>
      )}
    </>
  );
}
