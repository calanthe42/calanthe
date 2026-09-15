import { ComingSoon } from "@admin/components/ComingSoon";
import { getAdminI18n } from "@admin/i18n/server";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("nav.settings") };
}

export default function SettingsPage() {
  return <ComingSoon title="nav.settings" section="nav.sections.system" note="placeholders.settings" icon="settings" />;
}
