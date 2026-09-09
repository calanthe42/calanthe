import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { formatFils } from "@/lib/money";
import { Card, PageHeader, StatusBadge, humanStatus } from "@admin/components/ui";
import { EventWorkflow } from "@admin/components/WorkflowForm";
import { getAdminSession } from "@backend/data/admin-session";

export const metadata = { title: "Event" };

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });
  const session = await getAdminSession();

  const event = await payload
    .findByID({ collection: "events", id: numericId, depth: 1, user })
    .catch(() => null);
  if (!event) notFound();

  const team = await payload
    .find({
      collection: "users",
      where: { role: { in: ["admin", "staff"] } },
      limit: 50,
      depth: 0,
      user,
    })
    .catch(() => ({ docs: [] as { id: number; name?: string | null; email: string }[] }));

  return (
    <>
      <PageHeader
        title={event.name}
        breadcrumb={[
          { label: "Orders" },
          { label: "Events", href: "/admin/events" },
          { label: event.name },
        ]}
        description={`${humanStatus(event.eventType)} · enquired ${new Date(
          event.createdAt,
        ).toLocaleDateString("en-AE", { day: "numeric", month: "long" })}`}
        action={<StatusBadge value={event.status} kind="plain" />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h2 className="mb-3 font-display text-xl font-light text-olive">The event</h2>
            <Card>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-sage">Date</dt>
                  <dd className="text-sm text-olive">
                    {event.eventDate
                      ? new Date(event.eventDate).toLocaleDateString("en-AE", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "Not fixed yet"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-sage">Venue</dt>
                  <dd className="text-sm text-olive">{event.eventLocation ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-sage">Guests</dt>
                  <dd className="text-sm tabular-nums text-olive">
                    {event.estimatedGuests ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-sage">Client budget</dt>
                  <dd className="text-sm tabular-nums text-olive">
                    {event.budgetFils ? formatFils(Number(event.budgetFils)) : "Not stated"}
                  </dd>
                </div>
              </dl>

              {(event.requestedServices ?? []).length > 0 ? (
                <div className="mt-4">
                  <p className="text-xs text-sage">Services requested</p>
                  <p className="mt-1 text-sm text-olive">
                    {(event.requestedServices ?? []).map(humanStatus).join(" · ")}
                  </p>
                </div>
              ) : null}

              <div className="mt-4">
                <p className="text-xs text-sage">In their words</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-olive">
                  {event.description}
                </p>
              </div>
            </Card>
          </div>

          <div>
            <h2 className="mb-3 font-display text-xl font-light text-olive">Client</h2>
            <Card>
              <p className="font-medium">{event.name}</p>
              <p className="mt-1 text-sm text-sage">{event.email}</p>
              <p className="text-sm text-sage">{event.phone}</p>
              {event.company ? <p className="mt-1 text-sm text-sage">{event.company}</p> : null}
            </Card>
          </div>
        </div>

        <div>
          <EventWorkflow
            id={event.id}
            status={event.status}
            assignedStaffId={
              typeof event.assignedStaff === "object" && event.assignedStaff
                ? event.assignedStaff.id
                : (event.assignedStaff ?? undefined)
            }
            internalNotes={event.internalNotes ?? undefined}
            quoteAmountAed={
              event.quoteAmountFils ? String(Number(event.quoteAmountFils) / 100) : undefined
            }
            /* The quote is admin-only at field level. Hiding it from staff
               here matches what the server would do anyway — it avoids
               offering a control that would silently be ignored. */
            canQuote={Boolean(session?.isAdmin)}
            staff={team.docs.map((m) => ({ label: m.name || m.email, value: String(m.id) }))}
          />
        </div>
      </div>
    </>
  );
}
