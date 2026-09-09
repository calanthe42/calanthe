import Link from "next/link";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import type { Where } from "payload";
import config from "@payload-config";
import { EmptyState, PageHeader, StatusBadge, Table, Td, humanStatus } from "@admin/components/ui";

/**
 * The lead queue.
 *
 * Filtering happens in the database, not the browser, so this stays usable
 * when the shop has years of enquiries rather than none.
 */

export const metadata = { title: "Enquiries" };

const STATUSES = [
  "NEW",
  "IN_REVIEW",
  "WAITING_FOR_CUSTOMER",
  "QUOTED",
  "CONVERTED",
  "RESOLVED",
  "SPAM",
  "CANCELLED",
];

export default async function AdminEnquiriesPage({
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
        { enquiryNumber: { like: q } },
        { contactName: { like: q } },
        { contactEmail: { like: q } },
        { subject: { like: q } },
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
  });

  const filtered = Boolean(q || status);

  return (
    <>
      <PageHeader
        title="Enquiries"
        breadcrumb={[{ label: "Orders" }, { label: "Enquiries" }]}
        description={
          result.totalDocs > 0
            ? `${result.totalDocs} enquiries${filtered ? " matching your filters" : ""}`
            : undefined
        }
      />

      <form
        action="/admin/enquiries"
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
            placeholder="Reference, name, email or subject"
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
                href="/admin/enquiries"
                className="inline-flex min-h-11 items-center rounded-md border border-hairline bg-white px-4 text-sm text-olive"
              >
                Clear filters
              </Link>
            }
          />
        ) : (
          <EmptyState
            title="No enquiries yet"
            message="Wedding, event and contact enquiries will appear here as they come in."
          />
        )
      ) : (
        <Table
          head={["Reference", "Type", "Subject", "From", "Status", "Priority", "Assigned", "Received"]}
        >
          {result.docs.map((enquiry) => (
            <tr key={enquiry.id} className="border-b border-hairline/50 last:border-0">
              <Td className="font-medium">
                <Link href={`/admin/enquiries/${enquiry.id}`} className="hover:underline">
                  {enquiry.enquiryNumber}
                </Link>
              </Td>
              <Td className="whitespace-nowrap text-sage">{humanStatus(enquiry.type)}</Td>
              <Td className="max-w-xs truncate">{enquiry.subject}</Td>
              <Td>
                {enquiry.contactName}
                <span className="block text-xs text-sage">{enquiry.contactEmail}</span>
              </Td>
              <Td>
                <StatusBadge value={enquiry.status} kind="plain" />
              </Td>
              <Td className="text-sage">{humanStatus(enquiry.priority)}</Td>
              <Td className="text-sage">
                {typeof enquiry.assignedStaff === "object" && enquiry.assignedStaff
                  ? enquiry.assignedStaff.name || enquiry.assignedStaff.email
                  : "Unassigned"}
              </Td>
              <Td className="whitespace-nowrap text-sage">
                {new Date(enquiry.createdAt).toLocaleDateString("en-AE", {
                  day: "numeric",
                  month: "short",
                })}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
