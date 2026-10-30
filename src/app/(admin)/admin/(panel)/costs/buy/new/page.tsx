import { CostItemSentence } from "@admin/components/costs/CostItemSentence";
import { getAdminI18n } from "@admin/i18n/server";
import { ButtonLink } from "@admin/ui/Button";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";

/**
 * Something she buys that no invoice has yet — "about AED 45 a cake from
 * the bakery". Everything else arrives from her invoices.
 *
 * `?name=` starts the sentence with a name: the product editor's picker
 * links here, in a new tab, with whatever she searched for and did not find.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("costs.item.newTitle") };
}

export default async function NewCostItemPage({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name = "" } = await searchParams;
  const [{ t }, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const breadcrumbs = [
    { label: t("nav.sections.costs") },
    { label: t("costs.buy.title"), href: "/admin/costs/buy" },
    { label: t("costs.item.newTitle") },
  ];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("costs.item.newTitle")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon="lock"
          title={t("costs.ownerOnlyTitle")}
          body={t("costs.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("costs.back")}</ButtonLink>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("costs.item.newTitle")} breadcrumbs={breadcrumbs} description={t("costs.item.newDescription")} />
      <CostItemSentence
        values={{
          name: name.trim().slice(0, 80),
          group: "flowers",
          packName: "bunch",
          unitsPerPack: 20,
          one: "stem",
          priceForOneFils: null,
          costSource: "typed",
          lastPaidAt: null,
          lastSupplier: null,
          archived: false,
        }}
      />
    </>
  );
}
