import Link from "next/link";
import { cn } from "@/lib/cn";
import { boughtAsText, perUnitText } from "@admin/components/costs/cost-view";
import { Swatch } from "@admin/components/costs/Swatch";
import { getAdminI18n } from "@admin/i18n/server";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { Checkbox } from "@admin/ui/Field";
import { FilterBar } from "@admin/ui/FilterBar";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import { getAdminSession } from "@backend/data/admin-session";
import { listCostItems } from "@backend/data/costs";
import { COST_KINDS, isCostKind, type CostItemRow } from "@backend/domain/costs";

/**
 * Flowers and materials — everything the owner buys, and what one stem,
 * piece or metre of it costs her now.
 *
 * OWNER ONLY. Costs are her numbers: the collection refuses a florist, the
 * navigation hides the door, and a florist who types the address gets a
 * plain sentence instead of an error.
 *
 * The library is tens of items, not thousands: one read, then the kind,
 * search and archived filters run here on those rows, so every count in the
 * kind filter agrees with the rows it leads to. The filters are links and a
 * GET form, so the view can be bookmarked and Back undoes a filter.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("costs.items.title") };
}

type Kind = CostItemRow["kind"];

/** Every word she typed appears in the name, a note or a name on an invoice. */
function matches(item: CostItemRow, words: string[]): boolean {
  if (words.length === 0) return true;
  const haystack = [item.name, item.packName ?? "", item.notes ?? "", ...item.aliases].join(" ").toLocaleLowerCase();
  return words.every((word) => haystack.includes(word));
}

export default async function CostItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string; archived?: string }>;
}) {
  const { q = "", kind: kindParam = "", archived } = await searchParams;
  const [i18n, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const { t, plural, number } = i18n;
  const breadcrumbs = [{ label: t("nav.sections.costs") }, { label: t("costs.items.title") }];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("costs.items.title")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon="lock"
          title={t("costs.items.ownerOnlyTitle")}
          body={t("costs.items.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("costs.items.back")}</ButtonLink>}
        />
      </>
    );
  }

  const showArchived = archived === "1";
  const kind: Kind | "" = isCostKind(kindParam) ? kindParam : "";
  const all = await listCostItems({ includeArchived: showArchived });

  const words = q.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const searched = all.filter((item) => matches(item, words));
  const rows = kind ? searched.filter((item) => item.kind === kind) : searched;
  const counts = new Map<Kind, number>();
  for (const item of searched) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  const filtering = Boolean(words.length > 0 || kind || showArchived);

  /* A kind link keeps the search and the archived switch. */
  const kindHref = (value: Kind | "") => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (value) params.set("kind", value);
    if (showArchived) params.set("archived", "1");
    const query = params.toString();
    return `/admin/costs/items${query ? `?${query}` : ""}`;
  };

  const addButton = (
    <ButtonLink href="/admin/costs/items/new" variant="primary" icon="plus">
      {t("costs.items.add")}
    </ButtonLink>
  );

  if (all.length === 0 && !showArchived) {
    return (
      <>
        <PageHeader title={t("costs.items.title")} breadcrumbs={breadcrumbs} description={t("costs.items.description")} />
        <EmptyState
          icon="flower"
          title={t("costs.items.empty.title")}
          body={t("costs.items.empty.body")}
          action={
            <ButtonLink href="/admin/costs/items/new" variant="primary" icon="plus">
              {t("costs.items.addFirst")}
            </ButtonLink>
          }
        />
      </>
    );
  }

  /* Only the kinds she actually has, so the filter never offers an empty
     "Cards (0)" — except the one she is looking at. */
  const kinds = COST_KINDS.filter((value) => (counts.get(value) ?? 0) > 0 || value === kind);

  return (
    <>
      <PageHeader
        title={t("costs.items.title")}
        breadcrumbs={breadcrumbs}
        description={t("costs.items.description")}
        actions={addButton}
      />

      <nav aria-label={t("costs.items.kindFilter")} className="mb-3 min-w-0">
        <ul className="admin-scroll-x flex max-w-full gap-1 rounded-md border border-line bg-surface p-1 shadow-card sm:inline-flex">
          {(["", ...kinds] as (Kind | "")[]).map((value) => {
            const active = value === kind;
            const count = value ? (counts.get(value) ?? 0) : searched.length;
            return (
              <li key={value || "all"} className="shrink-0">
                <Link
                  href={kindHref(value)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-sm px-3 text-sm font-medium transition-colors duration-150 lg:min-h-9",
                    active ? "bg-ink text-page" : "text-ink-2 hover:bg-hover hover:text-ink",
                  )}
                >
                  {t(`costs.items.kinds.${value || "all"}`)}
                  <span className={cn("text-xs tabular", active ? "text-page/75" : "text-ink-3")}>{number(count)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <FilterBar
        action="/admin/costs/items"
        active={filtering}
        searchValue={q}
        searchPlaceholder={t("costs.items.searchPlaceholder")}
      >
        {kind ? <input type="hidden" name="kind" value={kind} /> : null}
        <Checkbox name="archived" value="1" defaultChecked={showArchived} label={t("costs.items.showArchived")} />
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          icon="search"
          title={t("costs.items.empty.noMatch")}
          body={t("costs.items.empty.noMatchBody")}
          action={<ButtonLink href="/admin/costs/items">{t("costs.items.empty.showAll")}</ButtonLink>}
        />
      ) : (
        <Table
          caption={t("costs.items.title")}
          columns={[
            { key: "item", label: t("costs.items.columns.item") },
            { key: "kind", label: t("costs.items.columns.kind") },
            { key: "boughtAs", label: t("costs.items.columns.boughtAs") },
            { key: "cost", label: t("costs.items.columns.cost"), align: "end" },
            { key: "actions", label: t("common.actions"), hidden: true },
          ]}
        >
          {rows.map((item) => {
            const href = `/admin/costs/items/${item.id}`;
            return (
              <Tr key={item.id} className={item.archived ? "opacity-70" : undefined}>
                <Td primary>
                  <div className="flex min-w-0 items-center gap-3">
                    <Swatch color={item.swatch} />
                    <div className="min-w-0">
                      <Link href={href} className="-my-3 block truncate py-3 font-medium text-ink hover:underline">
                        {item.name}
                      </Link>
                      <span className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                        {plural("costs.items.usedIn", item.usedIn)}
                        {item.archived ? <Badge>{t("costs.items.archived")}</Badge> : null}
                      </span>
                    </div>
                  </div>
                </Td>
                <Td label={t("costs.items.columns.kind")} className="text-ink-2">
                  {t(`costs.items.kind.${item.kind}`)}
                </Td>
                <Td label={t("costs.items.columns.boughtAs")} className="text-ink-2">
                  {boughtAsText(i18n, item)}
                </Td>
                <Td label={t("costs.items.columns.cost")} align="end">
                  {item.currentUnitCostFils > 0 ? (
                    <>
                      <span className="block font-medium tabular">
                        {perUnitText(i18n, item.currentUnitCostFils, item.useUnit)}
                      </span>
                      <span className="block text-xs text-ink-3">
                        {item.costSource === "purchase" ? t("costs.items.fromPurchase") : t("costs.items.typedByHand")}
                      </span>
                    </>
                  ) : (
                    <span className="text-warning">{t("costs.items.noCost")}</span>
                  )}
                </Td>
                <Td actions>
                  <ButtonLink href={href} size="sm" icon="edit" aria-label={t("costs.items.editLabel", { name: item.name })}>
                    {t("common.edit")}
                  </ButtonLink>
                </Td>
              </Tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
