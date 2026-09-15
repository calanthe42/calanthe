import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { EventWorkflow } from "@admin/components/WorkflowForm";
import { getAdminI18n } from "@admin/i18n/server";
import { humanize } from "@admin/i18n/translate";
import { toneFor } from "@admin/lib/status";
import { Badge } from "@admin/ui/Badge";
import { Card, CardHeader } from "@admin/ui/Card";
import { DescriptionList } from "@admin/ui/Content";
import { Icon } from "@admin/ui/icons";
import { PageHeader } from "@admin/ui/PageHeader";
import { getTeamOptions } from "@backend/data/admin-metrics";
import { getAdminSession } from "@backend/data/admin-session";

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("events.title") };
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [i18n, session, payload] = await Promise.all([getAdminI18n(), getAdminSession(), getPayload({ config })]);
  const { t, label, money, date, number } = i18n;
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const event = await payload
    .findByID({ collection: "events", id: numericId, depth: 1, user, overrideAccess: false })
    .catch(() => null);
  if (!event) notFound();

  const staff = await getTeamOptions();
  const services = (event.requestedServices ?? []).map(humanize).join(", ");

  return (
    <>
      <PageHeader
        title={event.name}
        breadcrumbs={[
          { label: t("nav.sections.operations") },
          { label: t("events.title"), href: "/admin/events" },
          { label: event.name },
        ]}
        description={t("events.detail.summary", {
          type: label("eventType", event.eventType),
          date: date(event.createdAt, "long"),
        })}
        badge={
          <Badge tone={toneFor("eventStatus", event.status)} dot>
            {label("eventStatus", event.status)}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("events.detail.event")} />
            <div className="mt-3">
              <DescriptionList
                emptyLabel={t("common.nothingProvided")}
                rows={[
                  [t("events.detail.type"), label("eventType", event.eventType)],
                  [t("events.detail.date"), event.eventDate ? date(event.eventDate, "long") : t("events.detail.notFixed")],
                  [t("events.detail.venue"), event.eventLocation],
                  [t("events.detail.guests"), event.estimatedGuests ? number(event.estimatedGuests) : null],
                  [t("events.detail.budget"), event.budgetFils ? money(Number(event.budgetFils)) : t("events.detail.notStated")],
                  [t("events.detail.quote"), event.quoteAmountFils ? money(Number(event.quoteAmountFils)) : null],
                  [t("events.detail.services"), services || null],
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader title={t("events.detail.words")} />
            <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-ink">{event.description}</p>
          </Card>

          <Card>
            <CardHeader title={t("events.detail.client")} />
            <p className="mt-1 font-medium text-ink">{event.name}</p>
            {event.company ? <p className="text-sm text-ink-2">{event.company}</p> : null}
            <p className="mt-1.5 flex min-w-0 items-center gap-2 text-sm">
              <Icon name="mail" className="h-4 w-4 text-ink-3" />
              <a href={`mailto:${event.email}`} className="truncate text-ink-2 underline-offset-4 hover:text-ink hover:underline" dir="ltr">
                {event.email}
              </a>
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <Icon name="phone" className="h-4 w-4 text-ink-3" />
              <a href={`tel:${event.phone}`} className="text-ink-2 underline-offset-4 hover:text-ink hover:underline" dir="ltr">
                {event.phone}
              </a>
            </p>
          </Card>
        </div>

        <div className="min-w-0 lg:sticky lg:top-24">
          <EventWorkflow
            id={event.id}
            status={event.status}
            assignedStaffId={
              typeof event.assignedStaff === "object" && event.assignedStaff ? event.assignedStaff.id : (event.assignedStaff ?? undefined)
            }
            internalNotes={event.internalNotes ?? undefined}
            quoteAmountAed={event.quoteAmountFils ? String(Number(event.quoteAmountFils) / 100) : undefined}
            canQuote={Boolean(session?.isAdmin)}
            staff={staff}
          />
        </div>
      </div>
    </>
  );
}
