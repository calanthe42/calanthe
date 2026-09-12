import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import type { Where } from "payload";
import config from "@payload-config";
import { getAdminI18n } from "@admin/i18n/server";
import { OPEN_ENQUIRY, WAITING_ENQUIRY, toneFor } from "@admin/lib/status";
import { Badge } from "@admin/ui/Badge";
import { ButtonLink } from "@admin/ui/Button";
import { FilterBar, FilterSelect } from "@admin/ui/FilterBar";
import { PageHeader } from "@admin/ui/PageHeader";
import { Pagination, listHref, parsePage } from "@admin/ui/Pagination";
import { EmptyState } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import { dubaiDateInputValue } from "@backend/domain/dates";

/**
 * The lead queue.
 *
 * Filtering and paging happen in the database, so this stays usable when the
 * store has years of enquiries rather than none. A follow-up day that has
 * arrived on an enquiry that is still open is flagged on the row — that is
 * the whole point of setting one.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("enquiries.title") };
}

const PAGE_SIZE = 25;
const STATUSES = ["NEW", "IN_REVIEW", "WAITING_FOR_CUSTOMER", "QUOTED", "CONVERTED", "RESOLVED", "SPAM", "CANCELLED"];
const PRIORITIES = ["URGENT", "HIGH", "NORMAL", "LOW"];
const TYPES = ["BUILD_YOUR_OWN", "EVENT", "MEMBERSHIP", "CONTACT", "CUSTOM_REQUEST"];
const OPEN = new Set<string>(OPEN_ENQUIRY);

type Search = { q?: string; status?: string; priority?: string; type?: string; followUp?: string; page?: string };

export default async function AdminEnquiriesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const { q = "", status = "", priority = "", type = "", followUp = "" } = params;
  const page = parsePage(params.page);

  const [i18n, payload] = await Promise.all([getAdminI18n(), getPayload({ config })]);
  const { t, plural, label, date } = i18n;
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const now = new Date();
  const and: Where[] = [];
  if (status === "waiting") and.push({ status: { in: [...WAITING_ENQUIRY] } });
  else if (STATUSES.includes(status)) and.push({ status: { equals: status } });
  if (PRIORITIES.includes(priority)) and.push({ priority: { equals: priority } });
  if (TYPES.includes(type)) and.push({ type: { equals: type } });
  if (followUp === "due") {
    and.push({ status: { in: [...OPEN_ENQUIRY] } });
    and.push({ followUpAt: { less_than_equal: now.toISOString() } });
  }
  const query = q.trim();
  if (query) {
    and.push({
      or: [
        { enquiryNumber: { like: query } },
        { contactName: { like: query } },
        { contactEmail: { like: query } },
        { subject: { like: query } },
      ],
    });
  }

  const result = await payload.find({
    collection: "enquiries",
    where: and.length ? { and } : {},
    sort: "-createdAt",
    limit: PAGE_SIZE,
    page,
    depth: 1,
    user,
    overrideAccess: false,
  });

  const filtered = Boolean(query || status || priority || type || followUp);
  const today = dubaiDateInputValue(now.toISOString());
  const href = (p: number) => listHref("/admin/enquiries", { q, status, priority, type, followUp, page: p });

  return (
    <>
      <PageHeader
        title={t("enquiries.title")}
        breadcrumbs={[{ label: t("nav.sections.sales") }, { label: t("enquiries.title") }]}
        description={
          result.totalDocs > 0
            ? plural(filtered ? "enquiries.countFiltered" : "enquiries.count", result.totalDocs)
            : t("enquiries.description")
        }
      />

      <FilterBar action="/admin/enquiries" active={filtered} searchValue={q} searchPlaceholder={t("enquiries.filters.searchPlaceholder")}>
        <FilterSelect
          id="status"
          label={t("enquiries.filters.status")}
          value={status}
          placeholder={t("common.all")}
          options={[
            { value: "waiting", label: t("enquiries.filters.waiting") },
            ...STATUSES.map((s) => ({ value: s, label: label("enquiryStatus", s) })),
          ]}
        />
        <FilterSelect
          id="priority"
          label={t("enquiries.filters.priority")}
          value={priority}
          placeholder={t("common.all")}
          options={PRIORITIES.map((p) => ({ value: p, label: label("priority", p) }))}
        />
        <FilterSelect
          id="type"
          label={t("enquiries.filters.type")}
          value={type}
          placeholder={t("common.all")}
          options={TYPES.map((v) => ({ value: v, label: label("enquiryType", v) }))}
        />
        <FilterSelect
          id="followUp"
          label={t("enquiries.filters.followUp")}
          value={followUp}
          placeholder={t("common.all")}
          options={[{ value: "due", label: t("enquiries.filters.due") }]}
        />
      </FilterBar>

      {result.docs.length === 0 ? (
        filtered ? (
          <EmptyState
            icon="search"
            title={t("enquiries.empty.noMatch")}
            body={t("enquiries.empty.noMatchBody")}
            action={<ButtonLink href="/admin/enquiries">{t("common.clearFilters")}</ButtonLink>}
          />
        ) : (
          <EmptyState icon="message" title={t("enquiries.empty.title")} body={t("enquiries.empty.body")} />
        )
      ) : (
        <>
          <Table
            caption={t("enquiries.title")}
            columns={[
              { key: "enquiry", label: t("enquiries.columns.enquiry") },
              { key: "type", label: t("enquiries.columns.type") },
              { key: "status", label: t("enquiries.columns.status") },
              { key: "priority", label: t("enquiries.columns.priority") },
              { key: "followUp", label: t("enquiries.columns.followUp") },
              { key: "assigned", label: t("enquiries.columns.assigned") },
              { key: "actions", label: t("common.actions"), hidden: true },
            ]}
          >
            {result.docs.map((enquiry) => {
              const detailHref = `/admin/enquiries/${enquiry.id}`;
              const assigned =
                typeof enquiry.assignedStaff === "object" && enquiry.assignedStaff
                  ? enquiry.assignedStaff.name || enquiry.assignedStaff.email
                  : null;
              const followDay = dubaiDateInputValue(enquiry.followUpAt);
              const due = Boolean(followDay) && OPEN.has(enquiry.status) && followDay <= today;
              const ref = enquiry.enquiryNumber ?? enquiry.subject;
              return (
                <Tr key={enquiry.id}>
                  <Td primary>
                    <Link href={detailHref} className="font-medium text-ink hover:underline">
                      {enquiry.subject}
                    </Link>
                    <span className="block truncate text-xs text-ink-3">
                      {enquiry.enquiryNumber ? `${enquiry.enquiryNumber} · ` : ""}
                      {enquiry.contactName} · {date(enquiry.createdAt, "short")}
                    </span>
                  </Td>
                  <Td label={t("enquiries.columns.type")} className="text-ink-2">
                    {label("enquiryType", enquiry.type)}
                  </Td>
                  <Td label={t("enquiries.columns.status")}>
                    <Badge tone={toneFor("enquiryStatus", enquiry.status)} dot>
                      {label("enquiryStatus", enquiry.status)}
                    </Badge>
                  </Td>
                  <Td label={t("enquiries.columns.priority")}>
                    <Badge tone={toneFor("priority", enquiry.priority)}>{label("priority", enquiry.priority)}</Badge>
                  </Td>
                  <Td label={t("enquiries.columns.followUp")}>
                    {followDay ? (
                      due ? (
                        <Badge tone="danger">
                          {followDay === today
                            ? t("enquiries.followToday")
                            : t("enquiries.followOverdue", { date: date(enquiry.followUpAt, "short") })}
                        </Badge>
                      ) : (
                        <span className="text-ink-2">{date(enquiry.followUpAt, "weekday")}</span>
                      )
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                  <Td label={t("enquiries.columns.assigned")} className="text-ink-2">
                    {assigned ?? <span className="text-ink-3">{t("enquiries.unassigned")}</span>}
                  </Td>
                  <Td actions>
                    <ButtonLink href={detailHref} size="sm" iconEnd="chevronRight" aria-label={t("enquiries.openLabel", { ref })}>
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
