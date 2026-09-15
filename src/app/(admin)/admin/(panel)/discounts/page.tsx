import { ComingSoon } from "@admin/components/ComingSoon";
import { getAdminI18n } from "@admin/i18n/server";

/**
 * Discounts are the next phase: codes validated on the server at checkout,
 * with the order storing a snapshot of the discount. Nothing is built here
 * yet, so nothing here can be used — and the screen says exactly that.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("nav.discounts") };
}

export default function DiscountsPage() {
  return <ComingSoon title="nav.discounts" section="nav.sections.catalog" note="placeholders.discounts" icon="tag" />;
}
