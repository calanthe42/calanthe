import Link from "next/link";
import { cn } from "@/lib/cn";
import { comesAsText, perOneText, whereFromText } from "@admin/components/costs/cost-view";
import { getAdminI18n } from "@admin/i18n/server";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { Checkbox } from "@admin/ui/Field";
import { FilterBar } from "@admin/ui/FilterBar";
import { Icon } from "@admin/ui/icons";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { getAdminSession } from "@backend/data/admin-session";
import { listCostItems } from "@backend/data/costs";
import { COST_GROUPS, isCostGroup, type CostGroup, type CostItemRow } from "@backend/domain/costs";

/**
 * What you buy — every flower, green, piece of packaging and extra on her
 * invoices, each with its price for one: "Peach Avalanche rose — a bunch of
 * 20 — AED 3.23 a stem, last paid 26 Oct, Al Aweer".
 *
 * OWNER ONLY. The collection refuses a florist, the navigation hides the
 * door, and a florist who types the address gets a plain sentence.
 *
 * The list is tens of things, not thousands: one read, then the group,
 * search and "don't buy any more" filters run here on those rows, so every
 * count in the group switch agrees with the rows it leads to. The filters
 * are links and a GET form, so Back undoes a filter.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("costs.buy.title") };
}

/** Every word she typed appears in the name or a name printed on one of her invoices. */
function matches(item: CostItemRow, words: string[]): boolean {
  if (words.length === 0) return true;
  const haystack = [item.name, ...item.aliases].join(" ").toLocaleLowerCase();
  return words.every((word) => haystack.includes(word));
}

export default async function WhatYouBuyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string; stopped?: string }>;
}) {
  const { q = "", group: groupParam = "", stopped } = await searchParams;
  const [i18n, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const { t, number } = i18n;
  const breadcrumbs = [{ label: t("nav.sections.costs") }, { label: t("costs.buy.title") }];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("costs.buy.title")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon="lock"
          title={t("costs.ownerOnlyTitle")}
          body={t("costs.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("costs.back")}</ButtonLink>}
        />
      </>
    );
  }

  const showStopped = stopped === "1";
  const group: CostGroup | "" = isCostGroup(groupParam) ? groupParam : "";
  const all = await listCostItems({ includeArchived: showStopped });

  const words = q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const searched = all.filter((item) => matches(item, words));
  const rows = group ? searched.filter((item) => item.group === group) : searched;
  const counts = new Map<CostGroup, number>();
  for (const item of searched) counts.set(item.group, (counts.get(item.group) ?? 0) + 1);
  const filtering = Boolean(words.length > 0 || group || showStopped);

  /* A group link keeps the search and the "don't buy any more" switch. */
  const groupHref = (value: CostGroup | "") => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (value) params.set("group", value);
    if (showStopped) params.set("stopped", "1");
    const query = params.toString();
    return `/admin/costs/buy${query ? `?${query}` : ""}`;
  };

  const actions = (
    <>
      <ButtonLink href="/admin/costs/invoices" variant="ghost" icon="receipt">
        {t("costs.buy.invoices")}
      </ButtonLink>
      <ButtonLink href="/admin/costs/buy/new" icon="plus">
        {t("costs.buy.add")}
      </ButtonLink>
      <ButtonLink href="/admin/costs/invoices/new" variant="primary" icon="plus">
        {t("costs.buy.addInvoice")}
      </ButtonLink>
    </>
  );

  if (all.length === 0 && !showStopped) {
    return (
      <>
        <PageHeader title={t("costs.buy.title")} breadcrumbs={breadcrumbs} description={t("costs.buy.description")} />
        <EmptyState
          icon="receipt"
          title={t("costs.buy.empty.title")}
          body={t("costs.buy.empty.body")}
          action={
            <>
              <ButtonLink href="/admin/costs/invoices/new" variant="primary" icon="plus">
                {t("costs.buy.addInvoice")}
              </ButtonLink>
              <ButtonLink href="/admin/costs/buy/new" variant="ghost">
                {t("costs.buy.add")}
              </ButtonLink>
            </>
          }
        />
      </>
    );
  }

  /* Only the groups she has, so the switch never offers an empty "Greenery
     (0)" — except the one she is looking at. */
  const groups = COST_GROUPS.filter((value) => (counts.get(value) ?? 0) > 0 || value === group);

  return (
    <>
      <PageHeader
        title={t("costs.buy.title")}
        breadcrumbs={breadcrumbs}
        description={t("costs.buy.description")}
        actions={actions}
      />

      <nav aria-label={t("costs.buy.groupFilter")} className="mb-3 min-w-0">
        <ul className="admin-scroll-x flex max-w-full gap-1 rounded-md border border-line bg-surface p-1 shadow-card sm:inline-flex">
          {(["", ...groups] as (CostGroup | "")[]).map((value) => {
            const active = value === group;
            const count = value ? (counts.get(value) ?? 0) : searched.length;
            return (
              <li key={value || "all"} className="shrink-0">
                <Link
                  href={groupHref(value)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-sm px-3 text-sm font-medium transition-colors duration-150 lg:min-h-9",
                    active ? "bg-ink text-page" : "text-ink-2 hover:bg-hover hover:text-ink",
                  )}
                >
                  {value ? t(`costs.group.${value}`) : t("costs.buy.all")}
                  <span className={cn("text-xs tabular", active ? "text-page/75" : "text-ink-3")}>{number(count)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <FilterBar
        action="/admin/costs/buy"
        active={filtering}
        searchValue={q}
        searchPlaceholder={t("costs.buy.searchPlaceholder")}
      >
        {group ? <input type="hidden" name="group" value={group} /> : null}
        <Checkbox name="stopped" value="1" defaultChecked={showStopped} label={t("costs.buy.showStopped")} />
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("costs.buy.noMatch")}
          body={t("costs.buy.noMatchBody")}
          action={<ButtonLink href="/admin/costs/buy">{t("costs.buy.showAll")}</ButtonLink>}
        />
      ) : (
        <ul
          aria-label={t("costs.buy.title")}
          className="divide-y divide-line overflow-hidden rounded-md border border-line bg-surface shadow-card"
        >
          {rows.map((item) => (
            <li key={item.id} className={item.archived ? "opacity-70" : undefined}>
              <Link
                href={`/admin/costs/buy/${item.id}`}
                className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="break-words text-sm font-medium text-ink">{item.name}</span>
                    {item.archived ? <Badge>{t("costs.buy.stoppedBadge")}</Badge> : null}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">
                    {t(`costs.group.${item.group}`)} · {comesAsText(i18n, item)}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  {item.priceForOneFils === null ? (
                    <span className="text-sm text-warning">{t("costs.noPrice")}</span>
                  ) : (
                    <>
                      <span className="block text-sm font-medium text-ink tabular">
                        {perOneText(i18n, item.priceForOneFils, item.one)}
                      </span>
                      <span className="block text-xs text-ink-3">{whereFromText(i18n, item)}</span>
                    </>
                  )}
                </span>
                <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
