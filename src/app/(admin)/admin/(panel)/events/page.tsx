import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import type { Where } from "payload";
import config from "@payload-config";
import { formatFils } from "@/lib/money";
import {
  ActionLink,
  DataList,
  DataRow,
  EmptyState,
  FilterBar,
  FilterField,
  FilterSelect,
  PageHeader,
  RowAction,
  StatusBadge,
  eventTypeLabel,
  filterInputClass,
  humanStatus,
  uaeDate,
} from "@admin/components/ui";

export const metadata = { title: "Events" };

const STATUSES = ["NEW", "CONTACTED", "QUOTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const TYPES = ["wedding", "corporate", "birthday", "engagement", "private", "decoration", "large-order", "other"];

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  const { q = "", status = "", type = "" } = await searchParams;
  const payload = await getPayload({ config });
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
    limit: 100,
    depth: 1,
    user,
    overrideAccess: false,
  });

  const filtered = Boolean(query || status || type);

  return (
    <>
      <PageHeader
        title="Events"
        breadcrumb={[{ label: "Orders" }, { label: "Events" }]}
        description={
          result.totalDocs > 0
            ? `${result.totalDocs} event enquir${result.totalDocs === 1 ? "y" : "ies"}${filtered ? " matching your filters" : ""}`
            : "Weddings, corporate work and large orders."
        }
      />

      <FilterBar action="/admin/events" active={filtered}>
        <FilterField label="Search" name="q" wide>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Name, email, company or venue" className={filterInputClass} />
        </FilterField>
        <FilterField label="Status" name="status">
          <FilterSelect name="status" value={status} options={STATUSES.map((s) => ({ value: s, label: humanStatus(s) }))} />
        </FilterField>
        <FilterField label="Type" name="type">
          <FilterSelect name="type" value={type} options={TYPES.map((t) => ({ value: t, label: eventTypeLabel(t) }))} />
        </FilterField>
      </FilterBar>

      {result.docs.length === 0 ? (
        filtered ? (
          <EmptyState
            title="Nothing matches those filters"
            message="Try clearing the search or choosing a different status."
            action={<ActionLink href="/admin/events">Clear filters</ActionLink>}
          />
        ) : (
          <EmptyState
            title="No event enquiries yet"
            message="Weddings, corporate work and large orders will appear here."
          />
        )
      ) : (
        <DataList label="Events">
          {result.docs.map((event) => {
            const href = `/admin/events/${event.id}`;
            const assigned =
              typeof event.assignedStaff === "object" && event.assignedStaff
                ? event.assignedStaff.name || event.assignedStaff.email
                : null;
            return (
              <DataRow
                key={event.id}
                title={
                  <Link href={href} className="hover:underline">
                    {event.name}
                  </Link>
                }
                subtitle={[event.company, event.email, event.phone].filter(Boolean).join(" · ")}
                meta={
                  <>
                    <span>{eventTypeLabel(event.eventType)}</span>
                    <StatusBadge value={event.status} kind="plain" />
                    <span>{event.eventDate ? uaeDate(event.eventDate, "long") : "Date not fixed"}</span>
                    {event.eventLocation ? <span>{event.eventLocation}</span> : null}
                    {event.estimatedGuests ? <span>{event.estimatedGuests} guests</span> : null}
                    {event.quoteAmountFils ? (
                      <span className="tabular-nums text-olive">Quoted {formatFils(Number(event.quoteAmountFils))}</span>
                    ) : null}
                    <span>{assigned ? `Assigned to ${assigned}` : "Unassigned"}</span>
                  </>
                }
                actions={
                  <RowAction href={href} variant="primary" label={`Open event for ${event.name}`}>
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
