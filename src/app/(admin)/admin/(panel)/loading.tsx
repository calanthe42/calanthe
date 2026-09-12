import { getAdminI18n } from "@admin/i18n/server";
import { LoadingState } from "@admin/ui/States";

/**
 * Shown while a screen's data is being read.
 *
 * A skeleton rather than a spinner: the shape of what is coming reduces the
 * sense of waiting, and it keeps the layout from jumping when content lands.
 */
export default async function AdminLoading() {
  const { t } = await getAdminI18n();
  return <LoadingState label={t("common.loading")} shape="list" />;
}
