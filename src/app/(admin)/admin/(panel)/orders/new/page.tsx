import { getPayload } from "payload";
import config from "@payload-config";
import { ManualOrderForm, type ManualProductOption } from "@admin/components/ManualOrderForm";
import { getAdminI18n } from "@admin/i18n/server";
import { PageHeader } from "@admin/ui/PageHeader";
import { getAdminSession } from "@backend/data/admin-session";
import { dubaiDateInputValue } from "@backend/domain/dates";
import { cardPaymentsConfigured, getStripe } from "@backend/payments/stripe";
import { timeSlots } from "@/lib/data";

/**
 * Create an order by hand: a sale that arrived on WhatsApp, by phone or in
 * person. "Create invoice" in the Invoices area opens this same page
 * (`?from=invoices`) — an order written here IS the invoice, numbered from
 * the one series the moment it is paid.
 */

export async function generateMetadata() {
  const { t } = await getAdminI18n();
  return { title: t("orders.new.title") };
}

/** Fils as the string the price field starts with: 48000 → "480", 48050 → "480.50". */
function aedInput(fils: number): string {
  const whole = Math.floor(fils / 100);
  const rem = fils % 100;
  return rem === 0 ? String(whole) : `${whole}.${String(rem).padStart(2, "0")}`;
}

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const fromInvoices = from === "invoices";
  const [{ t, locale }, session, payload] = await Promise.all([
    getAdminI18n(),
    getAdminSession(),
    getPayload({ config }),
  ]);

  /* The whole catalogue, hidden products included: the shop may sell by hand
     something it does not show on the website. */
  const found = session
    ? await payload.find({
        collection: "products",
        sort: "name",
        limit: 500,
        depth: 0,
        overrideAccess: true,
        select: { name: true, priceFils: true },
      })
    : { docs: [] };
  const products: ManualProductOption[] = found.docs.map((product) => ({
    id: product.id,
    name: product.name,
    priceAed: aedInput(Number(product.priceFils ?? 0)),
  }));

  const title = fromInvoices ? t("orders.new.titleInvoice") : t("orders.new.title");

  return (
    <>
      <PageHeader
        title={title}
        breadcrumbs={[
          { label: t("nav.sections.sales") },
          fromInvoices
            ? { label: t("invoices.title"), href: "/admin/invoices" }
            : { label: t("orders.title"), href: "/admin/orders" },
          { label: title },
        ]}
        description={t("orders.new.description")}
      />
      <ManualOrderForm
        products={products}
        slots={timeSlots}
        todayDubai={dubaiDateInputValue(new Date().toISOString())}
        isOwner={Boolean(session?.isAdmin)}
        paymentsReady={Boolean(getStripe()) && cardPaymentsConfigured()}
        defaultLocale={locale === "ar" ? "ar" : "en"}
      />
    </>
  );
}
