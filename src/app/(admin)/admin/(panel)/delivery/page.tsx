import { ComingSoon } from "@admin/components/ComingSoon";
import { getAdminI18n } from "@admin/i18n/server";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("nav.delivery") };
}

export default function DeliveryPage() {
  return <ComingSoon title="nav.delivery" section="nav.sections.operations" note="placeholders.delivery" icon="truck" />;
}
