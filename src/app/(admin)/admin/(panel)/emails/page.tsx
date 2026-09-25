import { getPayload } from "payload";
import config from "@payload-config";
import { PageHeader } from "@admin/ui/PageHeader";
import { Badge, type Tone } from "@admin/ui/Badge";
import { Table, Td, Tr, type Column } from "@admin/ui/Table";
import { EmptyState } from "@admin/ui/States";
import { Pagination, listHref, parsePage } from "@admin/ui/Pagination";
import { internalEmailDestination } from "@backend/actions/emails";
import { ResendButton } from "./ResendButton";

/**
 * Every email the shop tried to send.
 *
 * This is the answer to "did the customer get it?", which before had none: a
 * failed send was a line in a server log nobody reads. The provider's
 * message id is shown because it is the only thing that can be looked up in
 * Resend afterwards — "sent" here means the provider ACCEPTED it, which is
 * not the same as delivered, and the id is how that difference is settled.
 */

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: "Emails" };
}

const PAGE_SIZE = 30;

const COLUMNS: readonly Column[] = [
  { key: "when", label: "When" },
  { key: "to", label: "To" },
  { key: "subject", label: "Email" },
  { key: "status", label: "Status" },
  { key: "providerId", label: "Provider id" },
  { key: "actions", label: "Actions", hidden: true, align: "end" },
];

const TONE: Record<string, Tone> = {
  sent: "success",
  failed: "danger",
  suppressed: "warning",
  skipped: "neutral",
};

const EXPLAIN: Record<string, string> = {
  sent: "Accepted by the provider",
  failed: "The provider refused it",
  suppressed: "Blocked by the non-production allowlist",
  skipped: "No email provider configured",
};

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const payload = await getPayload({ config });

  const result = await payload.find({
    collection: "email-log",
    ...(params.status ? { where: { status: { equals: params.status } } } : {}),
    limit: PAGE_SIZE,
    page,
    depth: 0,
    sort: "-createdAt",
    overrideAccess: true,
  });

  const internal = await internalEmailDestination();
  const rows = result.docs as unknown as Record<string, unknown>[];

  return (
    <>
      <PageHeader title="Emails" />

      {internal && (
        <p className="mb-6 text-sm text-ink-2">
          Owner and florist notifications go to <strong>{internal}</strong> until real
          addresses are set.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon="box"
          title="No emails yet"
          body="Emails appear here the moment the shop tries to send one."
        />
      ) : (
        <>
          <Table caption="Emails the shop has attempted to send" columns={COLUMNS}>
            {rows.map((row) => {
              const status = String(row.status);
              /* Verification and reset links are one-time and deliberately
                 not stored, so resending one would send a dead link. */
              const isAuth = row.type === "verify-address" || row.type === "password-reset";
              return (
                <Tr key={String(row.id)}>
                  <Td label="When">
                    <span className="whitespace-nowrap">
                      {new Date(String(row.createdAt)).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {row.environment && row.environment !== "production" ? (
                      <span className="ms-2 text-xs text-ink-2">{String(row.environment)}</span>
                    ) : null}
                  </Td>
                  <Td label="To">
                    <span>{String(row.to)}</span>
                    {row.orderNumber ? (
                      <span className="block text-xs text-ink-2">{String(row.orderNumber)}</span>
                    ) : null}
                  </Td>
                  <Td label="Email" primary>
                    {String(row.subject)}
                  </Td>
                  <Td label="Status">
                    <Badge tone={TONE[status] ?? "neutral"}>{status}</Badge>
                    <span className="mt-1 block max-w-xs text-xs text-ink-2">
                      {row.error ? String(row.error) : (EXPLAIN[status] ?? "")}
                    </span>
                  </Td>
                  <Td label="Provider id">
                    <code className="text-xs text-ink-2">
                      {row.providerId ? String(row.providerId) : "—"}
                    </code>
                  </Td>
                  <Td label="Actions" actions align="end">
                    <ResendButton
                      id={String(row.id)}
                      disabled={isAuth}
                      reason={isAuth ? "One-time link — ask for a new one" : undefined}
                    />
                  </Td>
                </Tr>
              );
            })}
          </Table>

          <Pagination
            page={page}
            totalPages={result.totalPages}
            hrefFor={(p) => listHref("/admin/emails", { ...params, page: p })}
          />
        </>
      )}
    </>
  );
}
