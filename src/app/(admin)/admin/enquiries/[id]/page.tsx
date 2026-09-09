import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { formatFils } from "@/lib/money";
import { Card, PageHeader, StatusBadge, humanStatus } from "@admin/components/ui";
import { EnquiryWorkflow } from "@admin/components/WorkflowForm";

export const metadata = { title: "Enquiry" };

export default async function EnquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const enquiry = await payload
    .findByID({ collection: "enquiries", id: numericId, depth: 1, user })
    .catch(() => null);
  if (!enquiry) notFound();

  const team = await payload
    .find({
      collection: "users",
      where: { role: { in: ["admin", "staff"] } },
      limit: 50,
      depth: 0,
      user,
    })
    .catch(() => ({ docs: [] as { id: number; name?: string | null; email: string }[] }));

  const budgetFils =
    enquiry.buildYourOwn?.budgetFils ??
    enquiry.customRequest?.budgetFils ??
    enquiry.membership?.budgetFils;

  return (
    <>
      <PageHeader
        title={enquiry.subject}
        breadcrumb={[
          { label: "Orders" },
          { label: "Enquiries", href: "/admin/enquiries" },
          { label: enquiry.enquiryNumber ?? "Enquiry" },
        ]}
        description={`${enquiry.enquiryNumber} · ${humanStatus(enquiry.type)} · received ${new Date(
          enquiry.createdAt,
        ).toLocaleDateString("en-AE", { day: "numeric", month: "long" })}`}
        action={<StatusBadge value={enquiry.status} kind="plain" />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <h2 className="mb-3 font-display text-xl font-light text-olive">What they asked</h2>
            <Card>
              <p className="whitespace-pre-line text-sm leading-relaxed text-olive">
                {enquiry.message || "No message was left."}
              </p>
              {budgetFils ? (
                <p className="mt-3 text-sm text-sage">
                  Budget mentioned:{" "}
                  <span className="tabular-nums text-olive">
                    {formatFils(Number(budgetFils))}
                  </span>
                </p>
              ) : null}
            </Card>
          </div>

          <div>
            <h2 className="mb-3 font-display text-xl font-light text-olive">Who asked</h2>
            <Card>
              <p className="font-medium">{enquiry.contactName}</p>
              <p className="mt-1 text-sm text-sage">{enquiry.contactEmail}</p>
              {enquiry.contactPhone ? (
                <p className="text-sm text-sage">{enquiry.contactPhone}</p>
              ) : null}
              {enquiry.company ? (
                <p className="mt-1 text-sm text-sage">{enquiry.company}</p>
              ) : null}
              <p className="mt-2 text-xs text-sage">
                {enquiry.customer ? "Registered customer" : "Not a registered account"} · via{" "}
                {humanStatus(enquiry.source)}
              </p>
            </Card>
          </div>
        </div>

        <div>
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
