import Link from "next/link";
import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import type { ReactNode } from "react";
import { EnquiryWorkflow } from "@admin/components/WorkflowForm";
import { getAdminI18n } from "@admin/i18n/server";
import { humanize } from "@admin/i18n/translate";
import { toneFor } from "@admin/lib/status";
import { Badge } from "@admin/ui/Badge";
import { Card, CardHeader } from "@admin/ui/Card";
import { DescriptionList } from "@admin/ui/Content";
import { Icon } from "@admin/ui/icons";
import { PageHeader } from "@admin/ui/PageHeader";
import { getTeamOptions } from "@backend/data/admin-metrics";

/**
 * One enquiry: what was asked, by whom, and the working record beside it.
 *
 * The type-specific details — a build-your-own brief, a membership interest,
 * a custom request — are shown in full, so a florist can see the colours or
 * budget a customer actually chose without opening the developer CMS.
 *
 * The enquirer's own words are the record of what someone sent, and are not
 * editable here.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("enquiries.title") };
}

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [i18n, payload] = await Promise.all([getAdminI18n(), getPayload({ config })]);
  const { t, label, money, date } = i18n;
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const enquiry = await payload
    .findByID({ collection: "enquiries", id: numericId, depth: 1, user, overrideAccess: false })
    .catch(() => null);
  if (!enquiry) notFound();

  const staff = await getTeamOptions();

  const pretty = (value?: string | null) => (value ? humanize(value) : null);
  const prettyList = (values?: readonly string[] | null) => (values && values.length > 0 ? values.map(humanize).join(", ") : null);
  const amount = (fils?: number | null) => (typeof fils === "number" && fils > 0 ? money(fils) : null);
  const day = (iso?: string | null) => (iso ? date(iso, "long") : null);

  const byo = enquiry.buildYourOwn;
  const membership = enquiry.membership;
  const custom = enquiry.customRequest;
  const relatedEventId =
    typeof enquiry.relatedEvent === "object" && enquiry.relatedEvent ? enquiry.relatedEvent.id : enquiry.relatedEvent;

  const typeDetails: [string, ReactNode][] | null =
    enquiry.type === "BUILD_YOUR_OWN" && byo
      ? [
          [t("enquiries.detail.byo.style"), pretty(byo.style)],
          [t("enquiries.detail.byo.flowers"), prettyList(byo.flowers)],
          [t("enquiries.detail.byo.colours"), prettyList(byo.colours)],
          [t("enquiries.detail.byo.size"), pretty(byo.size)],
          [t("enquiries.detail.byo.quantity"), byo.quantity ? String(byo.quantity) : null],
          [t("enquiries.detail.byo.budget"), amount(byo.budgetFils)],
          [t("enquiries.detail.byo.deliveryDate"), day(byo.deliveryDate)],
          [t("enquiries.detail.byo.deliveryLocation"), byo.deliveryLocation],
          [t("enquiries.detail.byo.cardMessage"), byo.cardMessage],
          [t("enquiries.detail.byo.instructions"), byo.specialInstructions],
        ]
      : enquiry.type === "MEMBERSHIP" && membership
        ? [
            [t("enquiries.detail.membership.plan"), pretty(membership.preferredPlan)],
            [t("enquiries.detail.membership.frequency"), pretty(membership.frequency)],
            [t("enquiries.detail.membership.deliveredTo"), pretty(membership.deliveryPreference)],
            [t("enquiries.detail.membership.start"), day(membership.preferredStartDate)],
            [t("enquiries.detail.membership.budget"), amount(membership.budgetFils)],
            [t("enquiries.detail.membership.notes"), membership.notes],
          ]
        : enquiry.type === "CUSTOM_REQUEST" && custom
          ? [
              [t("enquiries.detail.custom.kind"), pretty(custom.category)],
              [t("enquiries.detail.custom.details"), custom.description],
              [t("enquiries.detail.custom.budget"), amount(custom.budgetFils)],
              [t("enquiries.detail.custom.neededBy"), day(custom.requestedDate)],
            ]
          : null;

  const communication: [string, ReactNode][] = [
    [t("enquiries.detail.lastContacted"), enquiry.lastContactedAt ? date(enquiry.lastContactedAt, "datetime") : null],
    [t("enquiries.detail.by"), pretty(enquiry.lastContactMethod)],
    [t("enquiries.detail.said"), enquiry.communicationNotes],
  ];
  const hasCommunication = communication.some(([, value]) => Boolean(value));
  const ref = enquiry.enquiryNumber ?? t("enquiries.columns.enquiry");

  return (
    <>
      <PageHeader
        title={enquiry.subject}
        breadcrumbs={[
          { label: t("nav.sections.sales") },
          { label: t("enquiries.title"), href: "/admin/enquiries" },
          { label: ref },
        ]}
        description={t("enquiries.detail.summary", {
          ref,
          type: label("enquiryType", enquiry.type),
          date: date(enquiry.createdAt, "long"),
          source: humanize(enquiry.source ?? ""),
        })}
        badge={
          <>
            <Badge tone={toneFor("enquiryStatus", enquiry.status)} dot>
              {label("enquiryStatus", enquiry.status)}
            </Badge>
            <Badge tone={toneFor("priority", enquiry.priority)}>{label("priority", enquiry.priority)}</Badge>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("enquiries.detail.asked")} />
            <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-ink">
              {enquiry.message || t("enquiries.detail.noMessage")}
            </p>
          </Card>

          {typeDetails ? (
            <Card>
              <CardHeader title={t("enquiries.detail.request")} />
              <div className="mt-3">
                <DescriptionList rows={typeDetails} emptyLabel={t("common.nothingProvided")} />
              </div>
            </Card>
          ) : null}

          {enquiry.type === "EVENT" && typeof relatedEventId === "number" ? (
            <Card>
              <CardHeader title={t("enquiries.detail.event")} description={t("enquiries.detail.eventBody")} />
              <Link
                href={`/admin/events/${relatedEventId}`}
                className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                {t("enquiries.detail.openEvent")}
                <Icon name="chevronRight" className="h-4 w-4" />
              </Link>
            </Card>
          ) : null}

          <Card>
            <CardHeader title={t("enquiries.detail.who")} />
            <p className="mt-1 font-medium text-ink">{enquiry.contactName}</p>
            {enquiry.company ? <p className="text-sm text-ink-2">{enquiry.company}</p> : null}
            <p className="mt-1.5 flex min-w-0 items-center gap-2 text-sm">
              <Icon name="mail" className="h-4 w-4 text-ink-3" />
              <a href={`mailto:${enquiry.contactEmail}`} className="truncate text-ink-2 underline-offset-4 hover:text-ink hover:underline" dir="ltr">
                {enquiry.contactEmail}
              </a>
            </p>
            {enquiry.contactPhone ? (
              <p className="mt-1 flex items-center gap-2 text-sm">
                <Icon name="phone" className="h-4 w-4 text-ink-3" />
                <a href={`tel:${enquiry.contactPhone}`} className="text-ink-2 underline-offset-4 hover:text-ink hover:underline" dir="ltr">
                  {enquiry.contactPhone}
                </a>
              </p>
            ) : null}
            <p className="mt-3 text-xs text-ink-3">
              {enquiry.customer ? t("enquiries.detail.hasAccount") : t("enquiries.detail.noAccount")}
            </p>
          </Card>

          {hasCommunication ? (
            <Card>
              <CardHeader title={t("enquiries.detail.conversation")} />
              <div className="mt-3">
                <DescriptionList rows={communication} emptyLabel={t("common.nothingProvided")} />
              </div>
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 lg:sticky lg:top-24">
          <EnquiryWorkflow
            id={enquiry.id}
            status={enquiry.status}
            priority={enquiry.priority}
            assignedStaffId={
              typeof enquiry.assignedStaff === "object" && enquiry.assignedStaff
                ? enquiry.assignedStaff.id
                : (enquiry.assignedStaff ?? undefined)
            }
            internalNotes={enquiry.internalNotes ?? undefined}
            followUpAt={enquiry.followUpAt ?? undefined}
            staff={staff}
          />
        </div>
      </div>
    </>
  );
}
