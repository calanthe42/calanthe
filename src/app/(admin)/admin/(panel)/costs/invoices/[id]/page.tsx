import { notFound } from "next/navigation";
import { InvoiceEditor } from "@admin/components/costs/InvoiceEditor";
import { getAdminI18n } from "@admin/i18n/server";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getInvoice, listCostItems, listSuppliers } from "@backend/data/costs";
import { dubaiDateInputValue } from "@backend/domain/dates";
import { BUSINESS } from "@/lib/business";

/**
 * One supplier invoice, in the same editor she added it with: change a line
 * and save, and every price it set follows; or delete it, after a question.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("costs.invoices.title") };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [{ t }, session] = await Promise.all([getAdminI18n(), getAdminSession()]);

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader
          title={t("costs.invoices.title")}
          breadcrumbs={[{ label: t("nav.sections.costs") }, { label: t("costs.invoices.title") }]}
        />
        <EmptyState
          icon="lock"
          title={t("costs.ownerOnlyTitle")}
          body={t("costs.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("costs.back")}</ButtonLink>}
        />
      </>
    );
  }

  const [invoice, suppliers, items] = await Promise.all([
    getInvoice(numericId),
    listSuppliers(),
    listCostItems({ includeArchived: true }),
  ]);
  if (!invoice) notFound();

  const title = t("costs.invoice.editTitle", { supplier: invoice.supplier.name });

  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: t("nav.sections.costs") },
          { label: t("costs.invoices.title"), href: "/admin/costs/invoices" },
          { label: title },
        ]}
        description={t("costs.invoice.editDescription")}
      />
      <InvoiceEditor
        key={invoice.id}
        invoice={invoice}
        suppliers={suppliers}
        items={items}
        today={dubaiDateInputValue(new Date().toISOString())}
        vatRegistered={BUSINESS.vatRegistered}
      />
    </>
  );
}
