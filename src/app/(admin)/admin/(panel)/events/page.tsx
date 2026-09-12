import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import type { Where } from "payload";
import config from "@payload-config";
import { getAdminI18n } from "@admin/i18n/server";
import { toneFor } from "@admin/lib/status";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { FilterBar, FilterSelect } from "@admin/ui/FilterBar";
import { PageHeader } from "@admin/ui/PageHeader";
import { Pagination, listHref, parsePage } from "@admin/ui/Pagination";
import { EmptyState } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";

/** Weddings, corporate work and large orders, filtered and paged in the database. */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("events.title") };
}

const PAGE_SIZE = 25;
const STATUSES = ["NEW", "CONTACTED", "QUOTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const TYPES = ["wedding", "corporate", "birthday", "engagement", "private", "decoration", "large-order", "other"];

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { q = "", status = "", type = "" } = params;
  const page = parsePage(params.page);

  const [i18n, payload] = await Promise.all([getAdminI18n(), getPayload({ config })]);
  const { t, plural, label, money, date, number } = i18n;
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const and: Where[] = [];
  if (STATUSES.includes(status)) and.push({ status: { equals: status } });
  if (TYPES.includes(type)) and.push({ eventType: { equals: type } });
  const query = q.trim();
  if (query) {
    and.push({
      or: [
        { name: { like: query } },
        { email: { like: query } },
        { company: { like: query } },
        { eventLocation: { like: query } },
      ],
    });
  }

  const result = await payload.find({
    collection: "events",
    where: and.length ? { and } : {},
    sort: "-createdAt",
    limit: PAGE_SIZE,
    page,
    depth: 1,
    user,
    overrideAccess: false,
  });

  const filtered = Boolean(query || status || type);
  const href = (p: number) => listHref("/admin/events", { q, status, type, page: p });

  return (
    <>
      <PageHeader
        title={t("events.title")}
        breadcrumbs={[{ label: t("nav.sections.operations") }, { label: t("events.title") }]}
        description={
          result.totalDocs > 0 ? plural(filtered ? "events.countFiltered" : "events.count", result.totalDocs) : t("events.description")
        }
      />

      <FilterBar action="/admin/events" active={filtered} searchValue={q} searchPlaceholder={t("events.filters.searchPlaceholder")}>
        <FilterSelect
          id="status"
          label={t("events.filters.status")}
          value={status}
          placeholder={t("common.all")}
          options={STATUSES.map((s) => ({ value: s, label: label("eventStatus", s) }))}
        />
        <FilterSelect
          id="type"
          label={t("events.filters.type")}
          value={type}
          placeholder={t("common.all")}
          options={TYPES.map((v) => ({ value: v, label: label("eventType", v) }))}
        />
      </FilterBar>

      {result.docs.length === 0 ? (
        filtered ? (
          <EmptyState
            icon="search"
            title={t("events.empty.noMatch")}
            body={t("events.empty.noMatchBody")}
            action={<ButtonLink href="/admin/events">{t("common.clearFilters")}</ButtonLink>}
          />
        ) : (
          <EmptyState icon="sparkles" title={t("events.empty.title")} body={t("events.empty.body")} />
        )
      ) : (
        <>
          <Table
            caption={t("events.title")}
            columns={[
              { key: "client", label: t("events.columns.client") },
              { key: "type", label: t("events.columns.type") },
              { key: "status", label: t("events.columns.status") },
              { key: "date", label: t("events.columns.date") },
              { key: "guests", label: t("events.columns.guests"), align: "end" },
              { key: "quote", label: t("events.columns.quote"), align: "end" },
              { key: "actions", label: t("common.actions"), hidden: true },
            ]}
          >
            {result.docs.map((event) => {
              const detailHref = `/admin/events/${event.id}`;
              const assigned =
                typeof event.assignedStaff === "object" && event.assignedStaff
                  ? event.assignedStaff.name || event.assignedStaff.email
                  : null;
              return (
                <Tr key={event.id}>
                  <Td primary>
                    <Link href={detailHref} className="font-medium text-ink hover:underline">
                      {event.name}
                    </Link>
                    <span className="block truncate text-xs text-ink-3">
                      {[event.company, event.eventLocation, assigned].filter(Boolean).join(" · ") || event.email}
                    </span>
                  </Td>
                  <Td label={t("events.columns.type")} className="text-ink-2">
                    {label("eventType", event.eventType)}
                  </Td>
                  <Td label={t("events.columns.status")}>
                    <Badge tone={toneFor("eventStatus", event.status)} dot>
                      {label("eventStatus", event.status)}
                    </Badge>
                  </Td>
                  <Td label={t("events.columns.date")} className="whitespace-nowrap text-ink-2">
                    {event.eventDate ? date(event.eventDate, "long") : t("events.dateNotFixed")}
                  </Td>
                  <Td label={t("events.columns.guests")} align="end" className="tabular">
                    {event.estimatedGuests ? number(event.estimatedGuests) : "—"}
                  </Td>
                  <Td label={t("events.columns.quote")} align="end" className="tabular">
                    {event.quoteAmountFils ? money(Number(event.quoteAmountFils)) : "—"}
                  </Td>
                  <Td actions>
                    <ButtonLink href={detailHref} size="sm" iconEnd="chevronRight" aria-label={t("events.openLabel", { name: event.name })}>
                      {t("common.open")}
                    </ButtonLink>
                  </Td>
                </Tr>
              );
            })}
          </Table>
          <Pagination page={result.page ?? page} totalPages={result.totalPages} hrefFor={href} />
        </>
      )}
    </>
  );
}
