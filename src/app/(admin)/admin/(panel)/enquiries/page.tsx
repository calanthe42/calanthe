import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import type { Where } from "payload";
import config from "@payload-config";
import {
  ActionLink,
  DataList,
  DataRow,
  EmptyState,
  FilterBar,
  FilterField,
  FilterSelect,
  PageHeader,
  Pill,
  RowAction,
  StatusBadge,
  filterInputClass,
  humanStatus,
  uaeDate,
} from "@admin/components/ui";
import { dubaiDateInputValue } from "@backend/domain/dates";

/**
 * The lead queue.
 *
 * Filtering happens in the database, not the browser, so this stays usable
 * when the shop has years of enquiries rather than none.
 *
 * A follow-up day that has arrived on an enquiry that is still open is shown
 * in red on the row. That is the whole point of setting one.
 */

export const metadata = { title: "Enquiries" };

const STATUSES = ["NEW", "IN_REVIEW", "WAITING_FOR_CUSTOMER", "QUOTED", "CONVERTED", "RESOLVED", "SPAM", "CANCELLED"];
const PRIORITIES = ["URGENT", "HIGH", "NORMAL", "LOW"];
const TYPES = ["BUILD_YOUR_OWN", "EVENT", "MEMBERSHIP", "CONTACT", "CUSTOM_REQUEST"];
const OPEN = new Set(["NEW", "IN_REVIEW", "WAITING_FOR_CUSTOMER", "QUOTED"]);

const options = (values: string[]) => values.map((value) => ({ value, label: humanStatus(value) }));

export default async function AdminEnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string; type?: string }>;
}) {
  const { q = "", status = "", priority = "", type = "" } = await searchParams;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const and: Where[] = [];
  if (STATUSES.includes(status)) and.push({ status: { equals: status } });
  if (PRIORITIES.includes(priority)) and.push({ priority: { equals: priority } });
  if (TYPES.includes(type)) and.push({ type: { equals: type } });
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
    limit: 100,
    depth: 1,
    user,
    overrideAccess: false,
  });

  const filtered = Boolean(query || status || priority || type);
  const today = dubaiDateInputValue(new Date().toISOString());

  return (
    <>
      <PageHeader
        title="Enquiries"
        breadcrumb={[{ label: "Orders" }, { label: "Enquiries" }]}
        description={
          result.totalDocs > 0
            ? `${result.totalDocs} enquir${result.totalDocs === 1 ? "y" : "ies"}${filtered ? " matching your filters" : ""}`
            : "Build-your-own, event, membership and contact requests."
        }
      />

      <FilterBar action="/admin/enquiries" active={filtered}>
        <FilterField label="Search" name="q" wide>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Reference, name, email or subject" className={filterInputClass} />
        </FilterField>
        <FilterField label="Status" name="status">
          <FilterSelect name="status" value={status} options={options(STATUSES)} />
        </FilterField>
        <FilterField label="Priority" name="priority">
          <FilterSelect name="priority" value={priority} options={options(PRIORITIES)} />
        </FilterField>
        <FilterField label="Type" name="type">
          <FilterSelect name="type" value={type} options={options(TYPES)} />
        </FilterField>
      </FilterBar>

      {result.docs.length === 0 ? (
        filtered ? (
          <EmptyState
            title="Nothing matches those filters"
            message="Try clearing the search or choosing a different status."
            action={<ActionLink href="/admin/enquiries">Clear filters</ActionLink>}
          />
        ) : (
          <EmptyState
            title="No enquiries yet"
            message="Wedding, event and contact enquiries will appear here as they come in."
          />
        )
      ) : (
        <DataList label="Enquiries">
          {result.docs.map((enquiry) => {
            const href = `/admin/enquiries/${enquiry.id}`;
            const assigned =
              typeof enquiry.assignedStaff === "object" && enquiry.assignedStaff
                ? enquiry.assignedStaff.name || enquiry.assignedStaff.email
                : null;
            const followDay = dubaiDateInputValue(enquiry.followUpAt);
            const due = Boolean(followDay) && OPEN.has(enquiry.status) && followDay <= today;
            return (
              <DataRow
                key={enquiry.id}
                title={
                  <Link href={href} className="hover:underline">
                    {enquiry.subject}
                  </Link>
                }
                subtitle={`${enquiry.enquiryNumber ?? "Enquiry"} · ${enquiry.contactName} · ${enquiry.contactEmail}`}
                meta={
                  <>
                    <span>{humanStatus(enquiry.type)}</span>
                    <StatusBadge value={enquiry.status} kind="plain" />
                    {enquiry.priority === "URGENT" ? (
                      <Pill tone="halt">Urgent</Pill>
                    ) : enquiry.priority === "HIGH" ? (
                      <Pill tone="attention">High priority</Pill>
                    ) : (
                      <span>{humanStatus(enquiry.priority)} priority</span>
                    )}
                    <span>{assigned ? `Assigned to ${assigned}` : "Unassigned"}</span>
                    {followDay ? (
                      due ? (
                        <Pill tone="halt">
                          Follow up {followDay === today ? "today" : `overdue since ${uaeDate(enquiry.followUpAt)}`}
                        </Pill>
                      ) : (
                        <span>Follow up {uaeDate(enquiry.followUpAt, "weekday")}</span>
                      )
                    ) : null}
                    <span>Received {uaeDate(enquiry.createdAt)}</span>
                  </>
                }
                actions={
                  <RowAction href={href} variant="primary" label={`Open enquiry ${enquiry.enquiryNumber ?? enquiry.subject}`}>
                    Open
                  </RowAction>
                }
              />
            );
          })}
        </DataList>
      )}
    </>
  );
}
