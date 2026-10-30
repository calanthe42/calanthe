import { InvoiceEditor } from "@admin/components/costs/InvoiceEditor";
import { getAdminI18n } from "@admin/i18n/server";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { listCostItems, listSuppliers } from "@backend/data/costs";
import { dubaiDateInputValue } from "@backend/domain/dates";
import { BUSINESS } from "@/lib/business";

/**
 * Add an invoice — the one place she adds what she bought. Typed for now:
 * the lines are sentences ("5 bunches of 20 stems for AED 300") and the
 * price of one stem is worked out as she types. Reading a photo of the
 * invoice arrives in Release 2.
 *
 * OWNER ONLY: the page checks the session, the loaders return nothing to
 * anyone else, and the save action checks again.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("costs.invoice.newTitle") };
}

export default async function AddInvoicePage() {
  const [{ t }, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const breadcrumbs = [
    { label: t("nav.sections.costs") },
    { label: t("costs.invoices.title"), href: "/admin/costs/invoices" },
    { label: t("costs.invoice.newTitle") },
  ];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("costs.invoice.newTitle")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon="lock"
          title={t("costs.ownerOnlyTitle")}
          body={t("costs.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("costs.back")}</ButtonLink>}
        />
      </>
    );
  }

  const [suppliers, items] = await Promise.all([listSuppliers(), listCostItems({ includeArchived: true })]);

  return (
    <>
      <PageHeader
        title={t("costs.invoice.newTitle")}
        breadcrumbs={breadcrumbs}
        description={t("costs.invoice.newDescription")}
      />
      <InvoiceEditor
        invoice={null}
        suppliers={suppliers}
        items={items}
        today={dubaiDateInputValue(new Date().toISOString())}
        vatRegistered={BUSINESS.vatRegistered}
      />
    </>
  );
}
