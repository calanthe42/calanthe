import { getPayload, type Where } from "payload";
import config from "@payload-config";
import { notFound } from "next/navigation";
import { getAdminSession } from "@backend/data/admin-session";
import { PageHeader } from "@admin/ui/PageHeader";
import { Badge, type Tone } from "@admin/ui/Badge";
import { Table, Td, Tr, type Column } from "@admin/ui/Table";
import { EmptyState } from "@admin/ui/States";
import { FilterBar, FilterSelect } from "@admin/ui/FilterBar";
import { Pagination, listHref, parsePage } from "@admin/ui/Pagination";
import { getAdminI18n } from "@admin/i18n/server";
import type { Translator } from "@admin/i18n/translate";

/**
 * Who did what, and what it was before.
 *
 * OWNER ONLY, ENFORCED TWICE. The route checks the session and 404s for
 * staff — not 403, because a "forbidden" page confirms the page exists — and
 * the query runs with `overrideAccess: false`, so Payload's own
 * `activity-log.read: isAdmin` refuses it even if this check were ever
 * removed. Hiding the nav link is not enforcement; these two are.
 *
 * Price changes, hides and deletions are flagged `notable`, so the question
 * the owner actually has — "who changed a price?" — is one filter away
 * rather than a scroll through every save.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("activity.title") };
}

const PAGE_SIZE = 40;

/*
 * WHAT THE LINE SAYS IS BUILT HERE, NOT READ FROM THE LOG.
 *
 * Each entry stores an English `summary` written when it was saved. The
 * report used to print that, so an owner reading the admin in Arabic got an
 * Arabic page full of English sentences. The entry also stores what the
 * sentence was made from — the action, the item and each field's before and
 * after — so the line is composed from those in the reader's language. The
 * stored summary is still the fallback for an entry that carries nothing
 * else (a status change recorded by an older build, for instance).
 */
const STATUS_FIELDS: Record<string, "fulfilment" | "payment"> = {
  fulfilmentStatus: "fulfilment",
  paymentStatus: "payment",
};

function valueIn(i18n: Translator, field: string, value: unknown): string {
  const raw = String(value ?? "");
  const status = STATUS_FIELDS[field];
  if (status) return i18n.label(status, raw);
  const count = /^(\d+) items?$/.exec(raw);
  if (count) return i18n.plural("activity.items", Number(count[1]));
  if (/^AED /.test(raw)) return raw;
  return i18n.label("activityValue", raw);
}

function describe(i18n: Translator, row: Record<string, unknown>): string {
  const { t, label } = i18n;
  const item = String(row.itemLabel ?? row.itemId ?? "");
  const changes = Array.isArray(row.changes)
    ? (row.changes as Record<string, unknown>[])
    : [];
  switch (row.action) {
    case "create":
      return t("activity.summary.created", { item });
    case "delete":
      return t("activity.summary.deleted", { item });
    case "email":
      return t("activity.summary.emailed", { item });
  }
  if (changes.length === 0) {
    return row.action === "update"
      ? t("activity.summary.noChanges", { item })
      : String(row.summary ?? item);
  }
  const parts = changes.slice(0, 3).map((c) => {
    const field = String(c.field);
    return `${label("activityField", field)} ${valueIn(i18n, field, c.before)} → ${valueIn(i18n, field, c.after)}`;
  });
  const more =
    changes.length > 3
      ? ` ${t("activity.summary.more", { count: changes.length - 3 })}`
      : "";
  /* The Arabic list takes the Arabic comma. */
  return `${item}: ${parts.join(i18n.locale === "ar" ? "، " : ", ")}${more}`;
}

const AREA_TONE: Record<string, Tone> = {
  orders: "info",
  products: "neutral",
  other: "neutral",
};

type Search = {
  page?: string;
  who?: string;
  area?: string;
  notable?: string;
  from?: string;
};

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await getAdminSession();
  const i18n = await getAdminI18n();
  const { t, label, date } = i18n;
  const COLUMNS: readonly Column[] = [
    { key: "when", label: t("activity.when") },
    { key: "who", label: t("activity.who") },
    { key: "what", label: t("activity.what") },
    { key: "area", label: t("activity.area") },
  ];
  /* Staff get the same answer as a stranger: this page does not exist. */
  if (!session?.isAdmin) notFound();

  const params = await searchParams;
  const page = parsePage(params.page);
  const payload = await getPayload({ config });

  const and: Where[] = [];
  if (params.who) and.push({ actorEmail: { equals: params.who } });
  if (params.area) and.push({ area: { equals: params.area } });
  if (params.notable === "1") and.push({ notable: { equals: true } });
  if (params.from) and.push({ createdAt: { greater_than_equal: params.from } });

  const result = await payload.find({
    collection: "activity-log",
    ...(and.length ? { where: { and } } : {}),
    limit: PAGE_SIZE,
    page,
    depth: 0,
    sort: "-createdAt",
    user: session.user,
    /* Payload's own rule refuses this for anyone but the owner. */
    overrideAccess: false,
  });

  /* The people who have actually done something, for the filter. */
  const everyone = await payload.find({
    collection: "activity-log",
    limit: 200,
    depth: 0,
    sort: "-createdAt",
    overrideAccess: true,
  });
  const actors = [
    ...new Map(
      (everyone.docs as unknown as Record<string, unknown>[]).map((d) => [
        String(d.actorEmail),
        String(d.actorName ?? d.actorEmail),
      ]),
    ).entries(),
  ];

  const rows = result.docs as unknown as Record<string, unknown>[];

  return (
    <>
      <PageHeader title={t("activity.title")} />

      <p className="mb-6 text-sm text-ink-2">{t("activity.intro")}</p>

      <FilterBar
        action="/admin/activity"
        active={Boolean(params.who || params.area || params.notable || params.from)}
        searchValue=""
        searchPlaceholder={t("activity.search")}
      >
        <FilterSelect
          id="who"
          label={t("activity.person")}
          value={params.who ?? ""}
          placeholder={t("activity.everyone")}
          options={actors.map(([email, name]) => ({ value: email, label: name }))}
        />
        <FilterSelect
          id="area"
          label={t("activity.type")}
          value={params.area ?? ""}
          placeholder={t("activity.everything")}
          options={["orders", "products", "other"].map((value) => ({
            value,
            label: label("activityArea", value),
          }))}
        />
        <FilterSelect
          id="notable"
          label={t("activity.show")}
          value={params.notable ?? ""}
          placeholder={t("activity.allActions")}
          options={[{ value: "1", label: t("activity.notableOnly") }]}
        />
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState
          icon="box"
          title={t("activity.emptyTitle")}
          body={t("activity.emptyBody")}
        />
      ) : (
        <>
          <Table caption={t("activity.caption")} columns={COLUMNS}>
            {rows.map((row) => {
              const changes = Array.isArray(row.changes)
                ? (row.changes as Record<string, unknown>[])
                : [];
              return (
                <Tr key={String(row.id)}>
                  <Td label={t("activity.when")}>
                    <span className="whitespace-nowrap">
                      {date(String(row.createdAt), "datetime")}
                    </span>
                  </Td>
                  <Td label={t("activity.who")}>
                    <span>{String(row.actorName ?? row.actorEmail)}</span>
                    <span className="block text-xs text-ink-2">
                      {row.actorRole === "admin"
                        ? t("activity.owner")
                        : t("activity.staff")}
                    </span>
                  </Td>
                  <Td label={t("activity.what")} primary>
                    <span>{describe(i18n, row)}</span>
                    {changes.length > 0 && (
                      <span className="mt-1 block text-xs text-ink-2">
                        {changes.map((c, i) => (
                          <span key={i} className="me-3 whitespace-nowrap">
                            {label("activityField", String(c.field))}:{" "}
                            {valueIn(i18n, String(c.field), c.before)} →{" "}
                            {valueIn(i18n, String(c.field), c.after)}
                          </span>
                        ))}
                      </span>
                    )}
                  </Td>
                  <Td label={t("activity.area")}>
                    <Badge tone={AREA_TONE[String(row.area)] ?? "neutral"}>
                      {label("activityArea", String(row.area))}
                    </Badge>
                    {row.notable === true && (
                      <Badge tone="warning" className="ms-1">
                        {t("activity.notable")}
                      </Badge>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </Table>

          <Pagination
            page={page}
            totalPages={result.totalPages}
            hrefFor={(p) => listHref("/admin/activity", { ...params, page: p })}
          />
        </>
      )}
    </>
  );
}
