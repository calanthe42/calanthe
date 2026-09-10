import Link from "next/link";
import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { formatFils } from "@/lib/money";
import { Card, DetailList, PageHeader, StatusBadge, humanStatus, uaeDate } from "@admin/components/ui";
import { EnquiryWorkflow } from "@admin/components/WorkflowForm";

/**
 * One enquiry: what was asked, by whom, and the working record beside it.
 *
 * The type-specific details — a build-your-own brief, a membership interest,
 * a custom request — are shown in full. Before, only the free-text message
 * was visible, so a florist could not see the colours or budget a customer
 * had actually chosen without opening the developer CMS.
 */

export const metadata = { title: "Enquiry" };

const pretty = (value?: string | null) => (value ? humanStatus(value) : null);
const prettyList = (values?: readonly string[] | null) =>
  values && values.length > 0 ? values.map(humanStatus).join(", ") : null;
const money = (fils?: number | null) => (typeof fils === "number" && fils > 0 ? formatFils(fils) : null);
const day = (iso?: string | null) => (iso ? uaeDate(iso, "long") : null);

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 font-display text-xl font-light text-olive">{children}</h2>;
}

export default async function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const enquiry = await payload
    .findByID({ collection: "enquiries", id: numericId, depth: 1, user, overrideAccess: false })
    .catch(() => null);
  if (!enquiry) notFound();

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

  const byo = enquiry.buildYourOwn;
  const membership = enquiry.membership;
  const custom = enquiry.customRequest;
  const relatedEventId =
    typeof enquiry.relatedEvent === "object" && enquiry.relatedEvent
      ? enquiry.relatedEvent.id
      : enquiry.relatedEvent;

  const typeDetails: [string, React.ReactNode][] | null =
    enquiry.type === "BUILD_YOUR_OWN" && byo
      ? [
          ["Style", pretty(byo.style)],
          ["Flowers", prettyList(byo.flowers)],
          ["Colours", prettyList(byo.colours)],
          ["Size", pretty(byo.size)],
          ["Quantity", byo.quantity ? String(byo.quantity) : null],
          ["Budget", money(byo.budgetFils)],
          ["Delivery date", day(byo.deliveryDate)],
          ["Delivery location", byo.deliveryLocation],
          ["Card message", byo.cardMessage],
          ["Special instructions", byo.specialInstructions],
        ]
      : enquiry.type === "MEMBERSHIP" && membership
        ? [
            ["Preferred plan", pretty(membership.preferredPlan)],
            ["How often", pretty(membership.frequency)],
            ["Delivered to", pretty(membership.deliveryPreference)],
            ["Preferred start", day(membership.preferredStartDate)],
            ["Budget per delivery", money(membership.budgetFils)],
            ["Notes", membership.notes],
          ]
        : enquiry.type === "CUSTOM_REQUEST" && custom
          ? [
              ["Kind of request", pretty(custom.category)],
              ["Details", custom.description],
              ["Budget", money(custom.budgetFils)],
              ["Needed by", day(custom.requestedDate)],
            ]
          : null;

  const communication: [string, React.ReactNode][] = [
    ["Last contacted", enquiry.lastContactedAt ? uaeDate(enquiry.lastContactedAt, "datetime") : null],
    ["By", pretty(enquiry.lastContactMethod)],
    ["What was said", enquiry.communicationNotes],
  ];
  const hasCommunication = communication.some(([, v]) => Boolean(v));

  return (
    <>
      <PageHeader
        title={enquiry.subject}
        breadcrumb={[
          { label: "Orders" },
          { label: "Enquiries", href: "/admin/enquiries" },
          { label: enquiry.enquiryNumber ?? "Enquiry" },
        ]}
        description={`${enquiry.enquiryNumber ?? "Enquiry"} · ${humanStatus(enquiry.type)} · received ${uaeDate(enquiry.createdAt, "long")} · via ${humanStatus(enquiry.source)}`}
        action={<StatusBadge value={enquiry.status} kind="plain" />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <section>
            <SectionTitle>What they asked</SectionTitle>
            <Card>
              <p className="whitespace-pre-line break-words text-sm leading-relaxed text-olive">
                {enquiry.message || "No message was left."}
              </p>
            </Card>
          </section>

          {typeDetails ? (
            <section>
              <SectionTitle>Their request</SectionTitle>
              <Card>
                <DetailList rows={typeDetails} />
              </Card>
            </section>
          ) : null}

          {enquiry.type === "EVENT" && typeof relatedEventId === "number" ? (
            <section>
              <SectionTitle>The event</SectionTitle>
              <Card>
                <p className="text-sm text-sage">
                  Venue, guests and services are kept on the event record.
                </p>
                <Link
                  href={`/admin/events/${relatedEventId}`}
                  className="mt-2 inline-flex min-h-11 items-center text-sm text-olive underline underline-offset-4"
                >
                  Open the event
                </Link>
              </Card>
            </section>
          ) : null}

          <section>
            <SectionTitle>Who asked</SectionTitle>
            <Card>
              <p className="font-medium text-olive">{enquiry.contactName}</p>
              <p className="mt-1 break-all text-sm">
                <a href={`mailto:${enquiry.contactEmail}`} className="text-sage underline-offset-4 hover:text-olive hover:underline">
                  {enquiry.contactEmail}
                </a>
              </p>
              {enquiry.contactPhone ? (
                <p className="text-sm">
                  <a href={`tel:${enquiry.contactPhone}`} className="text-sage underline-offset-4 hover:text-olive hover:underline">
                    {enquiry.contactPhone}
                  </a>
                </p>
              ) : null}
              {enquiry.company ? <p className="mt-1 text-sm text-sage">{enquiry.company}</p> : null}
              <p className="mt-2 text-xs text-sage">
                {enquiry.customer ? "Has a customer account" : "No customer account"}
              </p>
            </Card>
          </section>

          {hasCommunication ? (
            <section>
              <SectionTitle>Conversation so far</SectionTitle>
              <Card>
                <DetailList rows={communication} />
              </Card>
            </section>
          ) : null}
        </div>

        <div className="min-w-0">
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
            staff={team.docs.map((m) => ({ label: m.name || m.email, value: String(m.id) }))}
          />
        </div>
      </div>
    </>
  );
}
