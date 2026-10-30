import { AddonsForm } from "@admin/components/AddonsForm";
import { getAdminI18n } from "@admin/i18n/server";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState, Notice } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getAddonsForAdmin } from "@backend/data/store-settings";

/**
 * Add-ons — the "Something extra" list on every product: what each is
 * called in English and Arabic, what it costs, whether it is shown, and in
 * what order. OWNER ONLY, like the discounts: her prices. Staff see a plain
 * sentence saying who to ask; the action and the global refuse them anyway.
 *
 * Until she saves, the shop offers its default list, and this screen opens
 * on it and says so — nothing changes for customers until she presses Save.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("addons.title") };
}

export const dynamic = "force-dynamic";

export default async function AdminAddonsPage() {
  const [{ t }, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const breadcrumbs = [{ label: t("nav.sections.system") }, { label: t("addons.title") }];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("addons.title")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon="gift"
          title={t("addons.ownerOnlyTitle")}
          body={t("addons.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("addons.back")}</ButtonLink>}
        />
      </>
    );
  }

  const { addons, saved, version } = await getAddonsForAdmin();

  return (
    <>
      <PageHeader title={t("addons.title")} description={t("addons.description")} breadcrumbs={breadcrumbs} />
      {saved ? null : <Notice className="max-w-2xl">{t("addons.defaults")}</Notice>}
      <AddonsForm addons={addons} version={version} />
    </>
  );
}
