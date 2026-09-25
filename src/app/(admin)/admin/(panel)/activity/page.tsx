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

export function generateMetadata() {
  return { title: "Activity" };
}

const PAGE_SIZE = 40;

const COLUMNS: readonly Column[] = [
  { key: "when", label: "When" },
  { key: "who", label: "Who" },
  { key: "what", label: "What changed" },
  { key: "area", label: "Area" },
];

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
      <PageHeader title="Activity" />

      <p className="mb-6 text-sm text-ink-2">
        Every action by you and your staff. Entries can never be edited or deleted — not
        by staff, and not by you.
      </p>

      <FilterBar
        action="/admin/activity"
        active={Boolean(params.who || params.area || params.notable || params.from)}
        searchValue=""
        searchPlaceholder="Search by person, item or change"
      >
        <FilterSelect
          id="who"
          label="Person"
          value={params.who ?? ""}
          placeholder="Everyone"
          options={actors.map(([email, name]) => ({ value: email, label: name }))}
        />
        <FilterSelect
          id="area"
          label="Type"
          value={params.area ?? ""}
          placeholder="Everything"
          options={[
            { value: "orders", label: "Orders" },
            { value: "products", label: "Products" },
            { value: "other", label: "Other" },
          ]}
        />
        <FilterSelect
          id="notable"
          label="Show"
          value={params.notable ?? ""}
          placeholder="All actions"
          options={[{ value: "1", label: "Prices, hides and deletions" }]}
        />
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState icon="box" title="Nothing yet" body="Actions appear here as they happen." />
      ) : (
        <>
          <Table caption="Everything staff and the owner have done" columns={COLUMNS}>
            {rows.map((row) => {
              const changes = Array.isArray(row.changes)
                ? (row.changes as Record<string, unknown>[])
                : [];
              return (
                <Tr key={String(row.id)}>
                  <Td label="When">
                    <span className="whitespace-nowrap">
                      {new Date(String(row.createdAt)).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </Td>
                  <Td label="Who">
                    <span>{String(row.actorName ?? row.actorEmail)}</span>
                    <span className="block text-xs text-ink-2">
                      {row.actorRole === "admin" ? "Owner" : "Staff"}
                    </span>
                  </Td>
                  <Td label="What changed" primary>
                    <span>{String(row.summary)}</span>
                    {changes.length > 0 && (
                      <span className="mt-1 block text-xs text-ink-2">
                        {changes.map((c, i) => (
                          <span key={i} className="me-3 whitespace-nowrap">
                            {String(c.label ?? c.field)}: {String(c.before)} → {String(c.after)}
                          </span>
                        ))}
                      </span>
                    )}
                  </Td>
                  <Td label="Area">
                    <Badge tone={AREA_TONE[String(row.area)] ?? "neutral"}>
                      {String(row.area)}
                    </Badge>
                    {row.notable === true && (
                      <Badge tone="warning" className="ms-1">
                        notable
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
