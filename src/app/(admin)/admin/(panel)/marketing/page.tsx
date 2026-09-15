import { ComingSoon } from "@admin/components/ComingSoon";
import { getAdminI18n } from "@admin/i18n/server";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("nav.campaigns") };
}

export default function CampaignsPage() {
  return <ComingSoon title="nav.campaigns" section="nav.sections.marketing" note="placeholders.campaigns" icon="megaphone" />;
}
