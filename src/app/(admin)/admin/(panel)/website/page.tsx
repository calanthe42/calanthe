import Link from "next/link";
import { getAdminI18n } from "@admin/i18n/server";
import { WebsiteSwitches } from "@admin/components/WebsiteSwitches";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getSiteFlags } from "@backend/data/site-flags";

/**
 * Website — the parts of the storefront the owner can show or hide herself:
 * the Events page and the guest favours inside it. Owner only.
 */
export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("website.title") };
}

export const dynamic = "force-dynamic";

export default async function AdminWebsitePage() {
  const [{ t }, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const breadcrumbs = [{ label: t("nav.sections.system") }, { label: t("website.title") }];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("website.title")} breadcrumbs={breadcrumbs} />
        <EmptyState icon="settings" title={t("website.ownerOnlyTitle")} body={t("website.ownerOnlyBody")} />
      </>
    );
  }

  const flags = await getSiteFlags();
  return (
    <>
      <PageHeader title={t("website.title")} description={t("website.description")} breadcrumbs={breadcrumbs} />
      <WebsiteSwitches initial={flags} />
      <p className="mt-4 max-w-2xl text-sm text-ink-3">
        {t("website.preview")}{" "}
        <Link href="/events" target="_blank" className="underline underline-offset-4 hover:text-ink">
          /events
        </Link>
      </p>
    </>
  );
}
