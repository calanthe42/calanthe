import { CostItemForm } from "@admin/components/costs/CostItemForm";
import { getAdminI18n } from "@admin/i18n/server";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getCostSettings } from "@backend/data/costs";

/**
 * A new flower or material.
 *
 * `?name=` starts the form with a name: the product editor's picker links
 * here, in a new tab, with whatever she searched for and did not find.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("costs.items.new.title") };
}

export default async function NewCostItemPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name = "" } = await searchParams;
  const [{ t }, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const breadcrumbs = [
    { label: t("nav.sections.costs") },
    { label: t("costs.items.title"), href: "/admin/costs/items" },
    { label: t("costs.items.new.title") },
  ];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("costs.items.new.title")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon="lock"
          title={t("costs.items.ownerOnlyTitle")}
          body={t("costs.items.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("costs.items.back")}</ButtonLink>}
        />
      </>
    );
  }

  const settings = await getCostSettings();

  return (
    <>
      <PageHeader
        title={t("costs.items.new.title")}
        breadcrumbs={breadcrumbs}
        description={t("costs.items.new.description")}
      />
      <CostItemForm
        vatReclaimable={settings.vatReclaimable}
        values={{
          name: name.trim().slice(0, 120),
          kind: "flower",
          useUnit: "stem",
          packName: "",
          unitsPerPack: 1,
          currentUnitCostFils: 0,
          costSource: "manual",
          swatch: null,
          notes: "",
          aliases: [],
          archived: false,
        }}
      />
    </>
  );
}
