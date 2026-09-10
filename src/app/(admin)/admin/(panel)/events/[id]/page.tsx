import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { formatFils } from "@/lib/money";
import {
  Card,
  DetailList,
  PageHeader,
  StatusBadge,
  eventTypeLabel,
  humanStatus,
  uaeDate,
} from "@admin/components/ui";
import { EventWorkflow } from "@admin/components/WorkflowForm";
import { getAdminSession } from "@backend/data/admin-session";

export const metadata = { title: "Event" };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-display text-xl font-light text-olive">{children}</h2>;
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [session, payload] = await Promise.all([getAdminSession(), getPayload({ config })]);
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const event = await payload
    .findByID({ collection: "events", id: numericId, depth: 1, user, overrideAccess: false })
    .catch(() => null);
  if (!event) notFound();

  const team = await payload
    .find({
      collection: "users",
      where: { role: { in: ["admin", "staff"] } },
      limit: 50,
      depth: 0,
      user,
      overrideAccess: false,
    })
    .catch(() => ({ docs: [] as { id: number; name?: string | null; email: string }[] }));

  const services = (event.requestedServices ?? []).map(humanStatus).join(", ");

  return (
    <>
      <PageHeader
        title={event.name}
        breadcrumb={[
          { label: "Orders" },
          { label: "Events", href: "/admin/events" },
          { label: event.name },
        ]}
        description={`${eventTypeLabel(event.eventType)} · enquired ${uaeDate(event.createdAt, "long")}`}
        action={<StatusBadge value={event.status} kind="plain" />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section>
            <SectionTitle>The event</SectionTitle>
            <Card>
              <DetailList
                rows={[
                  ["Type", eventTypeLabel(event.eventType)],
                  ["Date", event.eventDate ? uaeDate(event.eventDate, "long") : "Not fixed yet"],
                  ["Venue", event.eventLocation],
                  ["Guests", event.estimatedGuests ? String(event.estimatedGuests) : null],
                  ["Client budget", event.budgetFils ? formatFils(Number(event.budgetFils)) : "Not stated"],
                  ["Current quote", event.quoteAmountFils ? formatFils(Number(event.quoteAmountFils)) : null],
                  ["Services requested", services || null],
                ]}
              />
            </Card>
          </section>

          <section>
            <SectionTitle>In their words</SectionTitle>
            <Card>
              <p className="whitespace-pre-line break-words text-sm leading-relaxed text-olive">
                {event.description}
              </p>
            </Card>
          </section>

          <section>
            <SectionTitle>Client</SectionTitle>
            <Card>
              <p className="font-medium text-olive">{event.name}</p>
              {event.company ? <p className="text-sm text-sage">{event.company}</p> : null}
              <p className="mt-1 break-all text-sm">
                <a href={`mailto:${event.email}`} className="text-sage underline-offset-4 hover:text-olive hover:underline">
                  {event.email}
                </a>
              </p>
              <p className="text-sm">
                <a href={`tel:${event.phone}`} className="text-sage underline-offset-4 hover:text-olive hover:underline">
                  {event.phone}
                </a>
              </p>
            </Card>
          </section>
        </div>

        <div className="min-w-0">
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
