import Link from "next/link";
import { notFound } from "next/navigation";
import { CostItemForm } from "@admin/components/costs/CostItemForm";
import { perUnitText, unitCountText } from "@admin/components/costs/cost-view";
import { Swatch } from "@admin/components/costs/Swatch";
import { getAdminI18n } from "@admin/i18n/server";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { FormSection } from "@admin/ui/Content";
import { Icon } from "@admin/ui/icons";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState, Notice } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getCostItem, getCostSettings } from "@backend/data/costs";

/**
 * One flower or material: the same form as "new", with what it costs her
 * now and which products use it beside it — so before she changes the cost
 * of a rose she can see which arrangements that moves.
 *
 * Price history and who sells it arrive with purchases (a later step); until
 * then there is nothing to show, and nothing is shown.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("costs.items.title") };
}

export default async function CostItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [i18n, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const { t, plural } = i18n;

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader
          title={t("costs.items.title")}
          breadcrumbs={[{ label: t("nav.sections.costs") }, { label: t("costs.items.title") }]}
        />
        <EmptyState
          icon="lock"
          title={t("costs.items.ownerOnlyTitle")}
          body={t("costs.items.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("costs.items.back")}</ButtonLink>}
        />
      </>
    );
  }

  const [item, settings] = await Promise.all([getCostItem(numericId), getCostSettings()]);
  if (!item) notFound();

  const detail = (
    <FormSection id="cost-item-detail" title={t("costs.items.detail.now")}>
      <div className="flex items-center gap-3">
        <Swatch color={item.swatch} className="h-5 w-5" />
        <p className="text-2xl font-semibold leading-tight text-ink tabular">
          {item.currentUnitCostFils > 0
            ? perUnitText(i18n, item.currentUnitCostFils, item.useUnit)
            : t("costs.items.noCost")}
        </p>
      </div>
      {item.currentUnitCostFils > 0 ? (
        <p className="-mt-3 text-xs text-ink-3">
          {item.costSource === "purchase" ? t("costs.items.fromPurchase") : t("costs.items.typedByHand")}
        </p>
      ) : null}

      <div className="border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-ink">{plural("costs.items.detail.usedIn", item.usedInProducts.length)}</h3>
        {item.usedInProducts.length === 0 ? (
          <p className="mt-1 text-sm leading-relaxed text-ink-3">{t("costs.items.detail.usedInNone")}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {item.usedInProducts.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}/edit#product-cost`}
                  aria-label={t("costs.items.detail.openProduct", { name: product.name })}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-ink hover:underline"
                >
                  <span className="min-w-0 truncate">{product.name}</span>
                  <span className="flex shrink-0 items-center gap-1 text-ink-2 tabular">
                    {unitCountText(i18n, product.quantity, item.useUnit)}
                    <Icon name="chevronRight" className="h-4 w-4 text-ink-3" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FormSection>
  );

  return (
    <>
      <PageHeader
        title={item.name}
        breadcrumbs={[
          { label: t("nav.sections.costs") },
          { label: t("costs.items.title"), href: "/admin/costs/items" },
          { label: item.name },
        ]}
        badge={item.archived ? <Badge>{t("costs.items.archived")}</Badge> : <Badge>{t(`costs.items.kind.${item.kind}`)}</Badge>}
      />

      {created ? <Notice tone="success">{t("costs.items.created")}</Notice> : null}
      {item.archived ? <Notice tone="warning">{t("costs.items.form.archivedNotice")}</Notice> : null}

      <CostItemForm
        key={item.id}
        vatReclaimable={settings.vatReclaimable}
        aside={detail}
        values={{
          id: item.id,
          name: item.name,
          kind: item.kind,
          useUnit: item.useUnit,
          packName: item.packName ?? "",
          unitsPerPack: item.unitsPerPack,
          currentUnitCostFils: item.currentUnitCostFils,
          costSource: item.costSource,
          swatch: item.swatch,
          notes: item.notes ?? "",
          aliases: item.aliases,
          archived: item.archived,
        }}
      />
    </>
  );
}
