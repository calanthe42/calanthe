import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import type { Where } from "payload";
import config from "@payload-config";
import { formatFils } from "@/lib/money";
import { EmptyState, PageHeader, StatusBadge, Table, Td, humanStatus } from "@admin/components/ui";

export const metadata = { title: "Events" };

const STATUSES = ["NEW", "CONTACTED", "QUOTED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "" } = await searchParams;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const and: Where[] = [];
  if (status) and.push({ status: { equals: status } });
  if (q) {
    and.push({
      or: [
        { name: { like: q } },
        { email: { like: q } },
        { company: { like: q } },
        { eventLocation: { like: q } },
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
  });

  const filtered = Boolean(q || status);

  return (
    <>
      <PageHeader
        title="Events"
        breadcrumb={[{ label: "Orders" }, { label: "Events" }]}
        description={
          result.totalDocs > 0 ? `${result.totalDocs} event enquiries` : undefined
        }
      />

      <form
        action="/admin/events"
        className="mb-5 grid gap-3 rounded-md border border-hairline/70 bg-white p-4 sm:grid-cols-4 sm:items-end"
      >
        <div className="sm:col-span-2">
          <label htmlFor="q" className="mb-1.5 block text-xs font-medium text-olive">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Name, email, company or venue"
            className="min-h-11 w-full rounded-md border border-hairline px-3 text-sm text-olive placeholder:text-sage/60"
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-xs font-medium text-olive">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="min-h-11 w-full rounded-md border border-hairline px-3 text-sm text-olive"
          >
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanStatus(s)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-burnt-orange px-4 text-sm font-medium text-cream"
        >
          Filter
        </button>
      </form>

      {result.docs.length === 0 ? (
        filtered ? (
          <EmptyState
            title="Nothing matches those filters"
            message="Try clearing the search or choosing a different status."
            action={
              <Link
                href="/admin/events"
                className="inline-flex min-h-11 items-center rounded-md border border-hairline bg-white px-4 text-sm text-olive"
              >
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No event enquiries yet"
            message="Weddings, corporate work and large orders will appear here."
          />
        )
      ) : (
        <Table head={["Client", "Type", "Date", "Venue", "Guests", "Status", "Quote", "Assigned"]}>
          {result.docs.map((event) => (
            <tr key={event.id} className="border-b border-hairline/50 last:border-0">
              <Td className="font-medium">
                <Link href={`/admin/events/${event.id}`} className="hover:underline">
                  {event.name}
                </Link>
                {event.company ? (
                  <span className="block text-xs text-sage">{event.company}</span>
                ) : null}
              </Td>
              <Td className="whitespace-nowrap text-sage">{humanStatus(event.eventType)}</Td>
              <Td className="whitespace-nowrap text-sage">
                {event.eventDate
                  ? new Date(event.eventDate).toLocaleDateString("en-AE", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Not fixed"}
              </Td>
              <Td className="max-w-[12rem] truncate text-sage">{event.eventLocation ?? "—"}</Td>
              <Td className="tabular-nums text-sage">{event.estimatedGuests ?? "—"}</Td>
              <Td>
                <StatusBadge value={event.status} kind="plain" />
              </Td>
              <Td className="whitespace-nowrap tabular-nums">
                {event.quoteAmountFils ? formatFils(Number(event.quoteAmountFils)) : "—"}
              </Td>
              <Td className="text-sage">
                {typeof event.assignedStaff === "object" && event.assignedStaff
                  ? event.assignedStaff.name || event.assignedStaff.email
                  : "Unassigned"}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
