import Link from "next/link";
import { notFound } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
import { getPayload } from "payload";
import config from "@payload-config";
import { getAdminI18n } from "@admin/i18n/server";
import { toneFor } from "@admin/lib/status";
import { Badge } from "@admin/ui/Badge";
import { Card, StatCard } from "@admin/ui/Card";
import { DescriptionList } from "@admin/ui/Content";
import { PageHeader } from "@admin/ui/PageHeader";
import { EmptyState } from "@admin/ui/States";
import { Table, Td, Tr } from "@admin/ui/Table";
import { Tabs } from "@admin/ui/Tabs";
import { displayName } from "@backend/data/admin-session";

/**
 * One customer, with the order history computed from orders rather than
 * stored on the account — a cached "total spent" is a number that quietly
 * goes wrong after the first refund.
 *
 * Read under the caller's own permissions. Payload's access rules mean a
 * staff member cannot open this page for anyone but themselves, which is the
 * intended behaviour (docs/SECURITY.md §3).
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("customers.title") };
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) notFound();

  const [i18n, payload] = await Promise.all([getAdminI18n(), getPayload({ config })]);
  const { t, label, money, date } = i18n;
  const { user } = await payload.auth({ headers: await nextHeaders() });

  const customer = await payload
    .findByID({ collection: "users", id: numericId, depth: 0, user, overrideAccess: false })
    .catch(() => null);
  if (!customer || customer.role !== "customer") notFound();

  const orders = await payload.find({
    collection: "orders",
    where: { customer: { equals: numericId } },
    sort: "-createdAt",
    limit: 100,
    depth: 0,
    user,
    overrideAccess: false,
  });

  const paidFils = orders.docs
    .filter((o) => o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_REFUNDED")
    .reduce((sum, o) => sum + Number(o.totalFils ?? 0), 0);
  const name = displayName(customer);
  const addresses = customer.addresses ?? [];

  const history =
    orders.docs.length === 0 ? (
      <EmptyState icon="bag" title={t("customers.detail.noOrders")} body={t("customers.detail.noOrdersBody")} />
    ) : (
      <Table
        caption={t("customers.detail.history")}
        columns={[
          { key: "order", label: t("orders.columns.order") },
          { key: "total", label: t("orders.columns.total"), align: "end" },
          { key: "payment", label: t("orders.columns.payment") },
          { key: "status", label: t("orders.columns.status") },
        ]}
      >
        {orders.docs.map((order) => (
          <Tr key={order.id}>
            <Td primary>
              <Link href={`/admin/orders/${encodeURIComponent(order.orderNumber ?? "")}`} className="font-medium text-ink hover:underline">
                {order.orderNumber}
              </Link>
              <span className="block text-xs text-ink-3">{t("customers.detail.placed", { date: date(order.createdAt, "long") })}</span>
            </Td>
            <Td label={t("orders.columns.total")} align="end" className="tabular">
              {money(Number(order.totalFils))}
            </Td>
            <Td label={t("orders.columns.payment")}>
              <Badge tone={toneFor("payment", order.paymentStatus)}>{label("payment", order.paymentStatus)}</Badge>
            </Td>
            <Td label={t("orders.columns.status")}>
              <Badge tone={toneFor("fulfilment", order.fulfilmentStatus)} dot>
                {label("fulfilment", order.fulfilmentStatus)}
              </Badge>
            </Td>
          </Tr>
        ))}
      </Table>
    );

  const information = (
    <Card>
      <DescriptionList
        emptyLabel={t("common.nothingProvided")}
        rows={[
          [
            t("orders.detail.customer"),
            <a key="email" href={`mailto:${customer.email}`} className="break-all underline-offset-4 hover:underline" dir="ltr">
              {customer.email}
            </a>,
          ],
          [
            t("orders.detail.recipientPhone"),
            customer.phone ? (
              <a href={`tel:${customer.phone}`} className="underline-offset-4 hover:underline" dir="ltr">
                {customer.phone}
              </a>
            ) : null,
          ],
          [
            t("customers.detail.marketing"),
            customer.marketing?.subscribed
              ? customer.marketing.consentAt
                ? t("customers.detail.subscribedOn", { date: date(customer.marketing.consentAt, "long") })
                : t("customers.subscribed")
              : t("customers.notSubscribed"),
          ],
          [t("customers.detail.account"), label("accountStatus", String(customer.accountStatus ?? "active"))],
        ]}
      />
    </Card>
  );

  const addressList =
    addresses.length === 0 ? (
      <EmptyState icon="truck" variant="card" title={t("customers.detail.noAddresses")} />
    ) : (
      <div className="grid gap-3 sm:grid-cols-2">
        {addresses.map((address, index) => (
          <Card key={address.id ?? index}>
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              {address.label || t("customers.detail.address", { n: index + 1 })}
              {address.isDefault ? <Badge>{t("customers.detail.default")}</Badge> : null}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              {[address.street, address.apartment, address.area, label("emirate", address.emirate)].filter(Boolean).join(", ")}
            </p>
          </Card>
        ))}
      </div>
    );

  return (
    <>
      <PageHeader
        title={name}
        breadcrumbs={[
          { label: t("nav.sections.sales") },
          { label: t("customers.title"), href: "/admin/customers" },
          { label: name },
        ]}
        description={t("customers.detail.since", { date: date(customer.createdAt, "monthYear") })}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={t("customers.detail.orders")} icon="bag" value={String(orders.totalDocs)} />
        <StatCard label={t("customers.detail.totalSpent")} icon="trendUp" value={money(paidFils)} secondary={t("customers.detail.paidOnly")} />
        <StatCard
          label={t("customers.detail.lastOrder")}
          icon="calendar"
          value={orders.docs[0] ? date(orders.docs[0].createdAt, "short") : t("common.never")}
        />
      </div>

      <Tabs
        label={name}
        tabs={[
          { value: "history", label: t("customers.detail.history"), badge: orders.totalDocs, content: history },
          { value: "information", label: t("customers.detail.information"), content: information },
          { value: "addresses", label: t("customers.detail.addresses"), badge: addresses.length, content: addressList },
        ]}
      />
    </>
  );
}
