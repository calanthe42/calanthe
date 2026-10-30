import Link from "next/link";
import { notFound } from "next/navigation";
import { CostItemSentence } from "@admin/components/costs/CostItemSentence";
import { countText, perOneText, priceLineText } from "@admin/components/costs/cost-view";
import { getAdminI18n } from "@admin/i18n/server";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { FormSection } from "@admin/ui/Content";
import { Icon } from "@admin/ui/icons";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState, Notice } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { getCostItem } from "@backend/data/costs";
import { uaeMidnight } from "@backend/domain/dates";

/**
 * One thing she buys: how it comes, as one sentence she can change, its
 * price for one and where that price came from, and which arrangements use
 * it — so before she changes how a rose comes she can see what that moves.
 *
 * Its last invoices are listed beside it, each opening the invoice its
 * price came from, so she can always check a price.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("costs.buy.title") };
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
          title={t("costs.buy.title")}
          breadcrumbs={[{ label: t("nav.sections.costs") }, { label: t("costs.buy.title") }]}
        />
        <EmptyState
          icon="lock"
          title={t("costs.ownerOnlyTitle")}
          body={t("costs.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("costs.back")}</ButtonLink>}
        />
      </>
    );
  }

  const item = await getCostItem(numericId);
  if (!item) notFound();

  const aside = (
    <>
      <FormSection id="cost-item-used" title={plural("costs.item.usedIn", item.usedInProducts.length)}>
        {item.usedInProducts.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-3">{t("costs.item.usedInNone")}</p>
        ) : (
          <ul className="-my-2 divide-y divide-line">
            {item.usedInProducts.map((product) => (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}/edit#product-cost`}
                  aria-label={t("costs.item.openProduct", { name: product.name })}
                  className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-ink hover:underline"
                >
                  <span className="min-w-0 truncate">{product.name}</span>
                  <span className="flex shrink-0 items-center gap-1 text-ink-2 tabular">
                    {countText(i18n, product.quantity, item.one)}
                    <Icon name="chevronRight" className="h-4 w-4 text-ink-3" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </FormSection>

      {item.recentPrices.length > 0 ? (
        <FormSection id="cost-item-recent" title={t("costs.item.recent")}>
          <ul className="-my-2 divide-y divide-line">
            {item.recentPrices.map((line, index) => {
              const day = i18n.date(uaeMidnight(line.invoiceDate).toISOString(), "short");
              return (
                <li key={`${line.invoiceId}-${index}`}>
                  <Link
                    href={`/admin/costs/invoices/${line.invoiceId}`}
                    aria-label={t("costs.item.openInvoice", { date: day })}
                    className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm text-ink hover:underline"
                  >
                    <span className="min-w-0">
                      <span className="block tabular">{day}</span>
                      {line.supplier ? (
                        <span className="block truncate text-xs text-ink-3">{line.supplier.name}</span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 font-medium tabular">
                      {perOneText(i18n, line.priceForOneFils, item.one)}
                      <Icon name="chevronRight" className="h-4 w-4 text-ink-3" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </FormSection>
      ) : null}

      {item.aliases.length > 0 ? (
        <FormSection
          id="cost-item-names"
          title={t("costs.item.invoiceNames")}
          description={t("costs.item.invoiceNamesHint")}
        >
          <ul className="flex flex-wrap gap-2">
            {item.aliases.map((alias) => (
              <li key={alias} dir="auto" className="rounded-sm bg-sunken px-2 py-1 text-xs text-ink-2">
                {alias}
              </li>
            ))}
          </ul>
        </FormSection>
      ) : null}
    </>
  );

  return (
    <>
      <PageHeader
        title={item.name}
        description={priceLineText(i18n, item)}
        breadcrumbs={[
          { label: t("nav.sections.costs") },
          { label: t("costs.buy.title"), href: "/admin/costs/buy" },
          { label: item.name },
        ]}
        badge={
          item.archived ? <Badge>{t("costs.buy.stoppedBadge")}</Badge> : <Badge>{t(`costs.group.${item.group}`)}</Badge>
        }
      />

      {created ? <Notice tone="success">{t("costs.item.created")}</Notice> : null}
      {item.archived ? <Notice tone="warning">{t("costs.item.stoppedNotice")}</Notice> : null}

      <CostItemSentence key={item.id} values={item} aside={aside} />
    </>
  );
}
