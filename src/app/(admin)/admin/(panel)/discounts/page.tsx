import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { CreateDiscountButton } from "@admin/components/CreateDiscountButton";
import { DiscountRowActions } from "@admin/components/DiscountRowActions";
import { getAdminI18n } from "@admin/i18n/server";
import { datesText, summaryLine, termsOf } from "@admin/lib/discount-view";
import { toneFor } from "@admin/lib/status";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { FilterBar, FilterSelect } from "@admin/ui/FilterBar";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState, Notice } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import { getAdminSession } from "@backend/data/admin-session";
import { getDiscountUsage } from "@backend/data/discount-usage";
import { discountStatus, type DiscountStatus } from "@/lib/discounts";

/**
 * Discounts — the owner's sales and codes, newest first.
 *
 * OWNER ONLY. Prices are her decision: the collection refuses a florist, the
 * navigation hides the door, and a florist who types the address gets a
 * plain sentence saying who to ask rather than an error.
 *
 * STATUS IS DERIVED, NEVER STORED (lib/discounts.ts `discountStatus`): a sale
 * scheduled for Friday becomes Active on Friday with nobody touching it. So
 * the status filter runs here, on the rows already read, the way the
 * occasions list filters — a database filter could not know what time it is.
 *
 * NOTHING ON THIS SCREEN GOES LIVE ON ONE CLICK. "Activate" in a row's menu
 * shows what would change, in numbers, and waits for her yes
 * (DiscountRowActions → DiscountConfirm).
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("discounts.title") };
}

const STATUSES: readonly DiscountStatus[] = ["active", "scheduled", "expired", "draft"];

export default async function AdminDiscountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; created?: string; deleted?: string }>;
}) {
  const { q = "", status = "", type = "", created, deleted } = await searchParams;
  const [i18n, session] = await Promise.all([getAdminI18n(), getAdminSession()]);
  const { t, label, number } = i18n;
  const breadcrumbs = [{ label: t("nav.sections.marketing") }, { label: t("discounts.title") }];

  if (!session?.isAdmin) {
    return (
      <>
        <PageHeader title={t("discounts.title")} breadcrumbs={breadcrumbs} />
        <EmptyState
          icon="tag"
          title={t("discounts.ownerOnlyTitle")}
          body={t("discounts.ownerOnlyBody")}
          action={<ButtonLink href="/admin">{t("discounts.back")}</ButtonLink>}
        />
      </>
    );
  }

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const found = await payload.find({
    collection: "discounts",
    limit: 200,
    sort: "-createdAt",
    depth: 0,
    user,
    overrideAccess: false,
  });
  const all = found.docs;

  /* A code counts its own uses (the webhook writes `timesUsed`); a sale's
     are counted from the paid orders that carry it — one query for all.
     Null when that count could not be read: the row then shows a dash. */
  const usage = await getDiscountUsage(all.filter((d) => d.kind === "automatic").map((d) => d.id));

  const now = new Date();
  const query = q.trim().toLowerCase();
  const rows = all
    .map((doc) => ({
      doc,
      status: discountStatus({ active: doc.active === true, startsAt: doc.startsAt, endsAt: doc.endsAt }, now),
    }))
    .filter(({ doc, status: is }) => {
      if (query && ![doc.title, doc.code ?? ""].some((v) => v.toLowerCase().includes(query))) return false;
      if (status && is !== status) return false;
      if (type && doc.kind !== type) return false;
      return true;
    });
  const filtering = Boolean(query || status || type);

  return (
    <>
      <PageHeader
        title={t("discounts.title")}
        breadcrumbs={breadcrumbs}
        description={t("discounts.description")}
        actions={<CreateDiscountButton />}
      />

      {created ? <Notice tone="success">{t("discounts.created")}</Notice> : null}
      {deleted ? <Notice tone="success">{t("discounts.deleted")}</Notice> : null}

      {all.length === 0 ? (
        <EmptyState
          icon="tag"
          title={t("discounts.empty.title")}
          body={t("discounts.empty.body")}
          action={<CreateDiscountButton />}
        />
      ) : (
        <>
          <FilterBar
            action="/admin/discounts"
            active={filtering}
            searchValue={q}
            searchPlaceholder={t("discounts.filters.searchPlaceholder")}
          >
            <FilterSelect
              id="status"
              label={t("discounts.filters.status")}
              value={status}
              placeholder={t("discounts.filters.all")}
              options={STATUSES.map((value) => ({ value, label: label("discountStatus", value) }))}
            />
            <FilterSelect
              id="type"
              label={t("discounts.filters.type")}
              value={type}
              placeholder={t("discounts.filters.all")}
              options={[
                { value: "automatic", label: t("discounts.kind.automatic") },
                { value: "code", label: t("discounts.kind.code") },
              ]}
            />
          </FilterBar>

          {rows.length === 0 ? (
            <EmptyState
              icon="search"
              title={t("discounts.empty.noMatch")}
              body={t("discounts.empty.noMatchBody")}
              action={<ButtonLink href="/admin/discounts">{t("common.clearFilters")}</ButtonLink>}
            />
          ) : (
            <Table
              caption={t("discounts.title")}
              columns={[
                { key: "discount", label: t("discounts.columns.discount") },
                { key: "type", label: t("discounts.columns.type") },
                { key: "status", label: t("discounts.columns.status") },
                { key: "dates", label: t("discounts.columns.dates") },
                { key: "used", label: t("discounts.columns.used"), align: "end" },
                { key: "actions", label: t("common.actions"), hidden: true },
              ]}
            >
              {rows.map(({ doc, status: is }) => {
                const editHref = `/admin/discounts/${doc.id}/edit`;
                const used =
                  doc.kind === "code" ? Number(doc.timesUsed ?? 0) : usage ? (usage.get(doc.id)?.orders ?? 0) : null;
                return (
                  <Tr key={doc.id}>
                    <Td primary>
                      <div className="min-w-0">
                        <Link href={editHref} className="-my-3 block truncate py-3 font-medium text-ink hover:underline">
                          {doc.title}
                        </Link>
                        {/* Value and what it applies to, in one line:
                            "20% off · 3 products". */}
                        <span className="block text-xs text-ink-3">{summaryLine(i18n, termsOf(doc))}</span>
                        {doc.kind === "code" && doc.code ? (
                          <span
                            dir="ltr"
                            className="mt-1.5 inline-block max-w-full truncate rounded-sm border border-line-strong px-1.5 py-0.5 font-mono text-xs tracking-wide text-ink"
                          >
                            {doc.code}
                          </span>
                        ) : null}
                      </div>
                    </Td>
                    <Td label={t("discounts.columns.type")} className="text-ink-2">
                      {t(`discounts.kind.${doc.kind}`)}
                    </Td>
                    <Td label={t("discounts.columns.status")}>
                      <Badge tone={toneFor("discountStatus", is)} dot={is === "active"}>
                        {label("discountStatus", is)}
                      </Badge>
                    </Td>
                    <Td label={t("discounts.columns.dates")} className="text-ink-2">
                      {datesText(i18n, doc.startsAt, doc.endsAt)}
                    </Td>
                    <Td label={t("discounts.columns.used")} align="end" className="tabular">
                      {used === null
                        ? "—"
                        : doc.kind === "code" && doc.usageLimit
                          ? t("discounts.usedOf", { used: number(used), limit: number(doc.usageLimit) })
                          : number(used)}
                    </Td>
                    <Td actions>
                      <ButtonLink
                        href={editHref}
                        size="sm"
                        icon="edit"
                        aria-label={t("discounts.editLabel", { name: doc.title })}
                      >
                        {t("common.edit")}
                      </ButtonLink>
                      <DiscountRowActions
                        id={doc.id}
                        name={doc.title}
                        active={doc.active === true}
                        expired={is === "expired"}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </Table>
          )}
        </>
      )}
    </>
  );
}
