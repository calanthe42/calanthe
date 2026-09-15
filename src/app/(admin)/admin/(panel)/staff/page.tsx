import { ComingSoon } from "@admin/components/ComingSoon";
import { getAdminI18n } from "@admin/i18n/server";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("nav.staff") };
}

export default function StaffPage() {
  return <ComingSoon title="nav.staff" section="nav.sections.system" note="placeholders.staff" icon="staff" />;
}
