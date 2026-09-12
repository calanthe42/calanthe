import { getAdminI18n } from "@admin/i18n/server";
import { ButtonLink } from "@admin/ui/Button";
import { EmptyState } from "@admin/ui/States";

/**
 * A record that does not exist, shown inside the admin — with the navigation
 * still there — rather than dropping the owner onto the storefront's 404.
 */
export default async function AdminNotFound() {
  const { t } = await getAdminI18n();
  return (
    <EmptyState
      icon="search"
      title={t("errors.notFoundTitle")}
      body={t("errors.notFoundBody")}
      action={
        <ButtonLink href="/admin" icon="arrowLeft">
          {t("errors.backToDashboard")}
        </ButtonLink>
      }
    />
  );
}
