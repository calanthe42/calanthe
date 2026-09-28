import { getPayload } from "payload";
import config from "@payload-config";
import { PageHeader } from "@admin/ui/PageHeader";
import { Badge, type Tone } from "@admin/ui/Badge";
import { Table, Td, Tr, type Column } from "@admin/ui/Table";
import { EmptyState } from "@admin/ui/States";
import { Pagination, listHref, parsePage } from "@admin/ui/Pagination";
import { internalEmailDestination } from "@backend/actions/emails";
import { ResendButton } from "./ResendButton";
import { getAdminI18n } from "@admin/i18n/server";

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

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("emailLog.title") };
}

const PAGE_SIZE = 30;

const TONE: Record<string, Tone> = {
  sent: "success",
  failed: "danger",
  suppressed: "warning",
  skipped: "neutral",
};

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string }>;
}) {
  const params = await searchParams;
  const { t, label, date } = await getAdminI18n();
  const COLUMNS: readonly Column[] = [
    { key: "when", label: t("emailLog.when") },
    { key: "to", label: t("emailLog.to") },
    { key: "subject", label: t("emailLog.email") },
    { key: "status", label: t("emailLog.status") },
    { key: "providerId", label: t("emailLog.providerId") },
    { key: "actions", label: t("emailLog.actions"), hidden: true, align: "end" },
  ];
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
      <PageHeader title={t("emailLog.title")} />

      {internal && (
        <p className="mb-6 text-sm text-ink-2">
          {t("emailLog.internalNote")
            .split("{address}")
            .map((part, i) => (
              <span key={i}>
                {i > 0 && <strong dir="ltr">{internal}</strong>}
                {part}
              </span>
            ))}
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon="box"
          title={t("emailLog.emptyTitle")}
          body={t("emailLog.emptyBody")}
        />
      ) : (
        <>
          <Table caption={t("emailLog.caption")} columns={COLUMNS}>
            {rows.map((row) => {
              const status = String(row.status);
              /* Verification and reset links are one-time and deliberately
                 not stored, so resending one would send a dead link. */
              const isAuth =
                row.type === "verify-address" || row.type === "password-reset";
              return (
                <Tr key={String(row.id)}>
                  <Td label={t("emailLog.when")}>
                    <span className="whitespace-nowrap">
                      {date(String(row.createdAt), "datetime")}
                    </span>
                    {row.environment && row.environment !== "production" ? (
                      <span className="ms-2 text-xs text-ink-2">
                        {String(row.environment)}
                      </span>
                    ) : null}
                  </Td>
                  <Td label={t("emailLog.to")}>
                    <span>{String(row.to)}</span>
                    {row.orderNumber ? (
                      <span className="block text-xs text-ink-2">
                        {String(row.orderNumber)}
                      </span>
                    ) : null}
                  </Td>
                  <Td label={t("emailLog.email")} primary>
                    {String(row.subject)}
                  </Td>
                  <Td label={t("emailLog.status")}>
                    <Badge tone={TONE[status] ?? "neutral"}>
                      {label("emailStatus", status)}
                    </Badge>
                    <span className="mt-1 block max-w-xs text-xs text-ink-2">
                      {/* A provider's own error text is kept as it came: it is
                          evidence, and translating it would lose the detail. */}
                      {row.error ? String(row.error) : label("emailExplain", status)}
                    </span>
                  </Td>
                  <Td label={t("emailLog.providerId")}>
                    <code className="text-xs text-ink-2">
                      {row.providerId ? String(row.providerId) : "—"}
                    </code>
                  </Td>
                  <Td label={t("emailLog.actions")} actions align="end">
                    <ResendButton
                      id={String(row.id)}
                      disabled={isAuth}
                      reason={isAuth ? t("emailLog.oneTimeLink") : undefined}
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
