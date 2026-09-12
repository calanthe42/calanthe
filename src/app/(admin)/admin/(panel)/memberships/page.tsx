import { ComingSoon } from "@admin/components/ComingSoon";
import { getAdminI18n } from "@admin/i18n/server";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("nav.memberships") };
}

export default function MembershipsPage() {
  return <ComingSoon title="nav.memberships" section="nav.sections.operations" note="placeholders.memberships" icon="star" />;
}
