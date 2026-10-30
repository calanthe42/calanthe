import { CostSettingsForm } from "@admin/components/costs/CostSettingsForm";
import { getAdminI18n } from "@admin/i18n/server";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getCostSettings } from "@backend/data/costs";

/**
 * Cost settings — the numbers every product's cost and margin are worked out
 * with. OWNER ONLY, like everything under /admin/costs. Until she saves her
 * own, the loader returns the defaults (60% target, AED 60 an hour, 10% of
 * flowers lost, VAT reclaimed at 5%), so the form never opens empty.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("costs.settings.title") };
}

export default async function CostSettingsPage() {
  const [{ t }, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const breadcrumbs = [{ label: t("nav.sections.costs") }, { label: t("costs.settings.title") }];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("costs.settings.title")} breadcrumbs={breadcrumbs} />
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
      <PageHeader title={t("costs.settings.title")} breadcrumbs={breadcrumbs} description={t("costs.settings.description")} />
      <CostSettingsForm values={settings} />
    </>
  );
}
