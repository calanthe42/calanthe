# Spec: dashboard-invoices

## summary

FEATURE A SPEC — SALES DASHBOARD AND INVOICES (spec only; no project file was touched). All paths under C:\dev\calanthe\.

What I verified in the tree (the tree wins over the specs):
- Quote-pay IS in the tree: Orders has enquiry, locale, customerNote, payTokenSalt/Hash, payLinkExpiresAt, stripePaymentIntentId, paidAt (indexed), invoiceNumber (unique index), vatRateBps, vatIncludedFils, source. src/backend/payments/paid.ts claims an invoice number for EVERY card order the webhook marks PAID (website checkout too, not only payment requests), via claimInvoice (src/backend/payments/invoice-number.ts). src/backend/domain/invoice.ts already has the pure buildInvoice(order, BUSINESS) -> InvoiceView that the email (quote-emails.ts invoiceHtml) and the pay page (src/components/commerce/PayInvoice.tsx) both render.
- Discounts is NOT in the tree yet (no src/collections/Discounts.ts). Orders already has discountFils, couponCode, couponDiscountFils; the discounts spec will add items[].compareAtUnitPriceFils, discountSnapshot, couponDiscount. This spec reads those optionally so it works before and after.
- The dashboard already exists and is good: src/backend/domain/dashboard.ts (pure, tested), src/backend/data/dashboard.ts (reads as the signed-in user, blanks money for staff on the server), src/admin/components/Charts.tsx (inline-SVG BarChart + StatusBar, no library, RTL by flipping the SVG). Its revenue today = PLACED orders by createdAt (a leftover from cash-on-delivery days). Checkout now only creates "web-checkout-card" orders, so that basis is out of date.
- Refunds: the Stripe webhook does NOT change paymentStatus on charge.refunded; it only writes an internal note. No refundedFils column exists. REFUNDED / PARTIALLY_REFUNDED are therefore never set by code today.
- There is no manual/WhatsApp order source in the tree yet; another spec owns it.

What this spec delivers
1. Dashboard (extends /admin, same file, same primitives): period switch Today / 7D / 30D / 90D in Asia/Dubai days with a like-for-like previous period; five headline numbers (Paid sales, Paid orders, Average order, Awaiting payment, Discounts given); a Paid-sales chart (daily, hourly for Today) with a screen-reader summary and a "show as table" fallback; Best sellers for the period (bespoke grouped as one line); Sales by source (website / payment link / manual); the existing Needs attention, Today's deliveries, Open orders by status, Recent orders and Recent enquiries stay.
2. Invoices (new nav item under Sales): /admin/invoices list of every paid order (search, date range on payment day, source and status filters, paging), owner-only CSV export, and /admin/invoices/[invoiceNumber] which renders the invoice from the order snapshot in English or Arabic, prints to PDF through the browser with a print stylesheet, and has "Send again to customer".

The money rule, stated once: PAID SALES = sum of totalFils of orders whose paymentStatus is PAID or PARTIALLY_REFUNDED and whose fulfilmentStatus is not CANCELLED, dated by paidAt (fallback createdAt when paidAt is empty), bucketed by Dubai day. REFUNDED orders count as zero. PARTIALLY_REFUNDED counts at its full total minus refundedFils when that field exists (it does not yet, so today: full total, with a visible footnote). A paid order that was cancelled is NOT revenue and is shown as a footnote with its amount ("refund it in Stripe"). PENDING / AUTHORIZED / FAILED are never revenue.

No schema change and no migration are needed: everything is derived from columns that already exist. The invoice has no table of its own — it is always rebuilt from the order by buildInvoice, so there is no second source of truth.

Roles: owner sees everything. Staff see counts and units but no aggregated money (blanked on the server, not just hidden); staff can open, print and resend a single invoice (they already see each order's total on the Orders screen) but get no list total and no CSV (404).

## dataModel

NO NEW COLLECTION, NO NEW COLUMN, NO MIGRATION.

Why no "invoices" collection: an invoice row would be a copy of the order snapshot that could drift. The order is already immutable (immutableAfterCreate on every commercial field), the number is allocated once and guarded (guardInvoiceNumber), and buildInvoice re-asserts the arithmetic. The Invoices area is a VIEW over orders.

Migration contents: none. Indexes already present and sufficient: orders_paid_at_idx, orders_invoice_number_idx (unique), payment_status, fulfilment_status, created_at, customer_email, customer_phone, order_number. Do NOT run migrate:create for this feature (the discounts team has a pending generated migration; an extra snapshot would conflict). The "send again" email reuses the existing email-log type "payment-received" precisely so that no enum value has to be added.

ORDER FIELDS READ (all existing unless marked)
Dashboard (src/backend/domain/sales.ts): createdAt, paidAt, paymentStatus, fulfilmentStatus, source, totalFils, subtotalFils, discountFils, couponDiscountFils, couponCode, payLinkExpiresAt, deliveryDate, items[].product, items[].productName, items[].productSlug, items[].quantity, items[].unitPriceFils, items[].lineTotalFils. Optional, read if present, never required: items[].compareAtUnitPriceFils (discounts spec), refundedFils (does not exist; seam for a later refunds feature), paymentMethod (manual-orders spec, if it adds one).
Invoice (buildInvoice, existing InvoiceOrder type): invoiceNumber, paidAt, orderNumber, customerName, customerEmail, items[].productName/quantity/unitPriceFils/lineTotalFils/selectedOptions/compareAtUnitPriceFils, subtotalFils, deliveryFeeFils, discountFils, couponCode, totalFils, vatRateBps, vatIncludedFils. Plus, new and optional on InvoiceOrder: source, stripePaymentIntentId, paymentMethod (for the "paid by" line). Seller block: BUSINESS in src/lib/business.ts (nulls are omitted, never printed as placeholders). Language default: order.locale.
Never read for an invoice or a figure: items[].product relation for names or prices (reporting key only), the live product, the live discount.

NEW PURE TYPES — src/backend/domain/sales.ts
  import { DAY_MS, QUOTE_ORDER_SOURCE, uaeDayStart, type OrderLike, type OrderItemLike, type PeriodWindow } from "./dashboard";
  export type SaleItemLike = OrderItemLike & { productSlug?: string | null; unitPriceFils?: number | null; compareAtUnitPriceFils?: number | null };
  export type SaleOrderLike = Omit<OrderLike, "items"> & { paidAt?: string | null; subtotalFils?: number | null; discountFils?: number | null; refundedFils?: number | null; payLinkExpiresAt?: string | null; items?: readonly SaleItemLike[] | null };
  export type SalesChannel = "website" | "request" | "manual" | "other";
  export const SALES_CHANNELS = ["website", "request", "manual", "other"] as const;
  export type SalesSummary = { paidFils: number; orders: number; averageFils: number; discountFils: number; discountedOrders: number; excluded: { refundedCount: number; refundedFils: number; cancelledPaidCount: number; cancelledPaidFils: number; partiallyRefundedCount: number } };
  export type SalesPoint = { key: string; /* "YYYY-MM-DD" or "HH" */ paidFils: number; orders: number };
  export type BestSeller = { key: string; kind: "product" | "bespoke"; name: string; units: number; revenueFils: number };
  export type SourceRow = { channel: SalesChannel; orders: number; paidFils: number };
  export type Awaiting = { count: number; fils: number };
  export type SalesReport = { current: SalesSummary; previous: SalesSummary; series: SalesPoint[]; granularity: "day" | "hour"; bestSellers: BestSeller[]; bySource: SourceRow[]; awaiting: Awaiting; truncated: boolean };

CHANGED PURE TYPES — src/backend/domain/dashboard.ts (additive)
  export const DASHBOARD_PERIODS = [1, 7, 30, 90] as const;   // 1 = Today
  parsePeriod: "1" -> 1, "30" -> 30, "90" -> 90, anything else -> 7 (default stays 7).
  PeriodWindow gains previousEnd: Date = new Date(now.getTime() - days * DAY_MS)  (the same elapsed time one period earlier; the UAE has no DST so this is exact). previousStart is unchanged.
  export const BESPOKE_PRODUCT_SLUG = "bespoke-arrangement";  // same value as BESPOKE_SLUG in backend/payments/pay-link.ts; a test holds the two together, exactly as QUOTE_ORDER_SOURCE is held today.

NEW PURE TYPES — src/backend/domain/invoice-list.ts
  export type InvoicePaymentMethod = "card" | "cash" | "bank_transfer" | "other";
  export type InvoiceFilters = { q: string; from: string; to: string; source: "" | "website" | "request" | "manual"; status: "" | "PAID" | "REFUNDED" | "PARTIALLY_REFUNDED" };   // from/to are "YYYY-MM-DD" Dubai days or ""
  export type InvoiceRow = { orderId: number; orderNumber: string; invoiceNumber: string | null; issuedAt: string; customerName: string; customerEmail: string; customerPhone: string; channel: SalesChannel; method: InvoicePaymentMethod; paymentStatus: string; cancelled: boolean; subtotalFils: number; deliveryFeeFils: number; discountFils: number; couponCode: string | null; vatIncludedFils: number; totalFils: number; stripePaymentIntentId: string | null };

CHANGED — src/backend/domain/invoice.ts (additive, coordinate with the quote-pay team who own the file)
  InvoiceOrder gains optional: source?: string | null; stripePaymentIntentId?: string | null; paymentMethod?: string | null.
  InvoiceView gains: paymentMethod: InvoicePaymentMethod  (set by buildInvoice from invoicePaymentMethod(order); "card" for every order that exists today, so the email and pay page render exactly as before).

CHANGED — src/backend/data/dashboard.ts DashboardData
  Remove: current, previous, series, top (the placed-orders figures). Add: sales: SalesReport. Everything else (window, openStatus, openTotal, newOrders, overdue, quotes, todaysDeliveries, recentOrders, recentEnquiries, ordersAllTime, enquiriesWaiting, followUpsDue, products, customers) stays. summariseOrders, dailySeries and topProducts stay exported in dashboard.ts with their tests, marked @deprecated in a comment; they are simply no longer called by the page.

CONTRACT WITH THE MANUAL/WHATSAPP-ORDER FEATURE (owned by another spec; stated here so the two meet)
  1. Its orders carry a source that salesChannel() maps to "manual" (matcher: /manual|whatsapp|phone|instagram|walk-?in/i). When that spec fixes the exact value, replace the regex branch with its exported constant and keep the test.
  2. When such an order is recorded as paid (cash / transfer — not a card, so not the webhook), that path MUST call claimInvoice with paidAtIso, so the order gets paidAt and an invoice number in the same statement. Then it appears in Paid sales and in Invoices with no further work here.
  3. If it stores how the money arrived, the field is orders.paymentMethod with values card | cash | bank_transfer | other; invoicePaymentMethod reads it first.

## serverLogic

A. src/backend/domain/sales.ts — PURE, no imports that need Node, no clock (now is passed in). Money is integer fils; use the same guard as dashboard.ts (non-finite or negative -> 0, Math.round).

  export const isSale = (o: SaleOrderLike): boolean => (o.paymentStatus === "PAID" || o.paymentStatus === "PARTIALLY_REFUNDED") && o.fulfilmentStatus !== "CANCELLED";
  export const saleAt = (o: SaleOrderLike): string => o.paidAt || o.createdAt;          // legacy paid orders have no paidAt
  export const saleFils = (o: SaleOrderLike): number => Math.max(0, fils(o.totalFils) - fils(o.refundedFils));
  export function discountGivenFils(o: SaleOrderLike): number  // fils(o.discountFils) + sum over items of max(0, compareAtUnitPriceFils - unitPriceFils) * quantity (0 when compareAt is absent)
  export function salesChannel(source: string | null | undefined): SalesChannel
     // order of tests matters: /quote/i -> "request"; /manual|whatsapp|phone|instagram|walk-?in/i -> "manual"; /checkout|web/i -> "website"; else "other" (null/empty -> "other")
  export function splitSales(orders, window: PeriodWindow, now: Date): { current: SaleOrderLike[]; previous: SaleOrderLike[] }
     // by saleAt time t: current when window.start <= t <= now; previous when window.previousStart <= t < window.previousEnd; otherwise neither. Applied to ALL rows (not only sales) so the excluded-footnotes are period-correct.
  export function summariseSales(orders): SalesSummary
     // isSale: paidFils += saleFils; orders += 1; if discountGivenFils > 0 { discountFils += it; discountedOrders += 1 }; if PARTIALLY_REFUNDED partiallyRefundedCount += 1
     // paymentStatus REFUNDED (any fulfilment): excluded.refundedCount += 1; refundedFils += fils(totalFils)
     // paymentStatus PAID or PARTIALLY_REFUNDED and CANCELLED: excluded.cancelledPaidCount += 1; cancelledPaidFils += fils(totalFils)
     // averageFils = orders > 0 ? Math.round(paidFils / orders) : 0
  export function salesSeries(orders, window, now): { granularity: "day" | "hour"; points: SalesPoint[] }
     // days > 1: one point per Dubai day from window.start, zeros included (same bucket walk as dailySeries), key "YYYY-MM-DD" via dubaiDateInputValue(saleAt)
     // days === 1: one point per Dubai hour from "00" up to and including the current Dubai hour of `now` (a future hour is not a zero), key "HH"; hour = Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Asia/Dubai" })
     // only isSale orders; value saleFils
  export function bestSellers(orders, limit = 5): BestSeller[]
     // only isSale orders. A line is bespoke when item.productSlug === BESPOKE_PRODUCT_SLUG, or when it has no product id and order.source === QUOTE_ORDER_SOURCE -> key "bespoke", kind "bespoke", name "" (the page prints the dictionary label). Otherwise key `id:${id}` or `name:${productName}`, latest name wins (as topProducts). units += quantity; revenueFils += lineTotalFils. Sort: units desc, revenueFils desc, name asc.
  export function salesBySource(orders): SourceRow[]   // isSale only; always returns website, request, manual in that order (zeros included) and "other" only when it has orders
  export function awaitingPayment(openOrders, now): Awaiting
     // not CANCELLED, paymentStatus not in PAID/REFUNDED/PARTIALLY_REFUNDED, and EITHER (salesChannel === "request" and payLinkExpiresAt > now) OR salesChannel === "manual". Website PENDING rows are abandoned checkouts and are NOT counted. count += 1; fils += totalFils.
  export function buildSalesReport(input: { windowOrders: readonly SaleOrderLike[]; openOrders: readonly SaleOrderLike[]; window: PeriodWindow; now: Date; truncated: boolean }): SalesReport
  export function blankSalesForStaff(report: SalesReport): SalesReport
     // every *Fils in current, previous, series, bestSellers, bySource, awaiting and excluded set to 0; counts and units kept. This is what a staff session receives.

B. src/backend/domain/dashboard.ts — changes listed in dataModel (period 1, previousEnd, BESPOKE_PRODUCT_SLUG). Rewrite the header comment paragraph "REVENUE COUNTS PLACED ORDERS" to say the page now reports paid sales from domain/sales.ts and why.

C. src/backend/data/dashboard.ts — getDashboardData(period)
  Replace the first query (windowOrders) with ONE read that serves both periods and both roles:
    payload.find({ collection: "orders", where: { or: [ { paidAt: { greater_than_equal: window.previousStart.toISOString() } }, { createdAt: { greater_than_equal: window.previousStart.toISOString() } } ] }, sort: "createdAt", limit: 5000, depth: 0, select: { createdAt: true, paidAt: true, paymentStatus: true, fulfilmentStatus: true, source: true, totalFils: true, subtotalFils: true, discountFils: true, items: true }, user, overrideAccess: false })
    (the createdAt branch is what catches legacy paid rows with no paidAt and nothing else; rows that are in neither window are dropped by splitSales.) truncated = result.totalDocs > result.docs.length.
  The existing openOrders query already returns what awaitingPayment needs (payLinkExpiresAt, totalFils, source); no extra query.
  const report = buildSalesReport({ windowOrders: windowOrders.docs, openOrders: openOrders.docs, window, now, truncated });
  return { ..., sales: isOwner ? report : blankSalesForStaff(report) };
  Delete the blankMoney helper and the current/previous/series/top fields. customersNew keeps using window.start. Number of queries is unchanged (11).

D. src/backend/domain/invoice-list.ts — PURE
  export function parseInvoiceFilters(params: Record<string, string | undefined>): InvoiceFilters   // trims q to 80 chars; from/to must match /^\d{4}-\d{2}-\d{2}$/ else ""; if both set and from > to, swap; source/status must be in the allowed sets else ""
  export function invoiceWhere(f: InvoiceFilters): Where
     base: { or: [ { invoiceNumber: { exists: true } }, { paymentStatus: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } } ] }
     date (Dubai days on the payment moment), fromIso = uaeMidnight(from), toIso = uaeMidnight(to) + 1 day:
        { or: [ { and: [ paidAt >= fromIso, paidAt < toIso ] }, { and: [ { paidAt: { exists: false } }, createdAt >= fromIso, createdAt < toIso ] } ] }  (omit a bound that is not set)
     source: website -> { source: { like: "checkout" } }; request -> { source: { equals: "admin-quote" } }; manual -> { or: [ like "manual", like "whatsapp", like "phone" ] }
     status: { paymentStatus: { equals: status } }
     q: { or: [ invoiceNumber like q, orderNumber like q, customerName like q, customerEmail like q, customerPhone like q ] }
     result: { and: [ base, ...parts ] }
  export function invoicePaymentMethod(o: { paymentMethod?: string | null; stripePaymentIntentId?: string | null; source?: string | null }): InvoicePaymentMethod
     // a valid paymentMethod wins; else stripePaymentIntentId present, or source matches /card|quote/i -> "card"; else "other"
  export function invoiceRow(order): InvoiceRow            // issuedAt = paidAt || createdAt; channel = salesChannel(source); cancelled = fulfilmentStatus === "CANCELLED"
  export function invoiceListTotalFils(rows: readonly InvoiceRow[]): number   // sum of totalFils where paymentStatus is PAID or PARTIALLY_REFUNDED and not cancelled — the SAME rule as isSale, so the list total for a date range equals the dashboard's Paid sales for it
  export function filsToDecimal(fils: number): string       // integer maths only: `${Math.trunc(f / 100)}.${String(f % 100).padStart(2, "0")}`; throws on a non-integer or negative
  export function csvCell(value: string): string           // if it starts with = + - @ TAB or CR, prefix an apostrophe (spreadsheet formula guard); then wrap in quotes and double any quote when it contains , " CR or LF
  export function invoicesCsv(rows: readonly InvoiceRow[]): string
     // "﻿" + header + rows joined with "\r\n". Header (fixed English, whatever the admin language): Invoice number,Invoice date,Order number,Customer name,Customer email,Customer phone,Source,Payment method,Payment status,Subtotal (AED),Delivery (AED),Discount (AED),Discount code,VAT included (AED),Total (AED),Payment reference
     // Invoice date = dubaiDateInputValue(issuedAt); Source = Website | Payment link | Manual | Other; method = Card | Cash | Bank transfer | Other; status = Paid | Refunded | Partially refunded, with " (cancelled)" appended when cancelled; amounts via filsToDecimal; Payment reference = stripePaymentIntentId or ""
  export function monthRange(now: Date, offset: 0 | -1): { from: string; to: string }   // Dubai calendar month, for the two preset links
  export function invoiceExportFilename(f: InvoiceFilters): string  // "calanthe-invoices_{from|all}_{to|all}.csv"

E. src/backend/data/invoices.ts — reads as the signed-in user (payload.auth + overrideAccess: false, same pattern as data/admin-metrics.ts)
  export const INVOICE_PAGE_SIZE = 25; export const INVOICE_EXPORT_MAX = 20000;
  export async function getInvoicePage(filters: InvoiceFilters, page: number): Promise<{ rows: InvoiceRow[]; totalDocs: number; totalPages: number; listTotalFils: number | null; unnumbered: number }>
     // page query: where invoiceWhere(filters), sort ["-paidAt", "-createdAt"], limit 25, depth 0. Rows with no paidAt (legacy) sort first in Postgres DESC — intended: they sit at the top with a "No number yet" badge until numbered.
     // listTotalFils: owner only (null for staff): a second find with the same where, select { totalFils, paymentStatus, fulfilmentStatus }, limit INVOICE_EXPORT_MAX, pagination: false -> invoiceListTotalFils.
     // unnumbered: payload.count({ where: { and: [ { paymentStatus: { equals: "PAID" } }, { invoiceNumber: { exists: false } } ] } })
  export async function getInvoiceByNumber(invoiceNumber: string): Promise<Order | null>   // refuse anything not matching /^CAL-INV-\d{4}-\d{5,}$/ before querying; where invoiceNumber equals; limit 1; depth 0
  export async function getInvoicesForExport(filters: InvoiceFilters): Promise<{ rows: InvoiceRow[]; tooMany: boolean }>   // pages of 500, sort ["paidAt", "createdAt"] ascending (an accountant reads oldest first), stops at INVOICE_EXPORT_MAX
  export async function getInvoiceSends(orderId: number): Promise<{ at: string; to: string; status: string }[]>   // email-log where order equals id and type equals "payment-received", sort -createdAt, limit 5; catch -> []

F. src/backend/actions/invoices.ts — "use server"
  export async function resendInvoice(orderId: number): Promise<ActionResult>
    1. payload.auth; role must be admin or staff, else { ok: false, code: "actions.invoice.permission" }.
    2. order = payload.findByID({ collection: "orders", id, depth: 0, overrideAccess: true }) (needs payTokenSalt, which no role can read). Missing, or no invoiceNumber, or no paidAt -> code "actions.invoice.notPaid".
    3. throttle(LIMITS.invoiceResend, `invoice-${order.id}`) -> not allowed: code "actions.invoice.tooOften". Add to src/backend/security/throttle.ts LIMITS: invoiceResend: { name: "invoice-resend", limit: 5, windowSeconds: hours(1) }.
    4. invoice = buildInvoice(order, BUSINESS) inside try; a throw (does not reconcile) -> code "actions.invoice.broken"; log the error; send nothing.
    5. locale = order.locale === "ar" ? "ar" : "en". viewUrl only when order.source === QUOTE_SOURCE and payTokenSalt exists: payUrl(payLinkOrigin(SITE_ORIGIN, { env: process.env.VERCEL_ENV, branchUrl: process.env.VERCEL_BRANCH_URL }), payToken(env.PAYLOAD_SECRET, salt), locale).
    6. outcome = await sendEmail(payload, buildInvoiceCopyEmail({ orderId: order.id, orderNumber: String(order.orderNumber), customerName, customerEmail, invoice, locale, viewUrl })). The address is ALWAYS the order's own customerEmail snapshot; there is no free-text "send to" (an invoice carries a name, an address context and an amount).
    7. outcome.status !== "sent" -> { ok: false, message: outcome.error ?? "The invoice could not be sent.", code: "actions.invoice.failed" }.
    8. recordActivity(payload, { actor: actorOf(user), action: "email", area: "orders", collection: "orders", itemId: order.id, itemLabel: orderNumber, summary: `Invoice ${invoiceNumber} sent again to ${customerEmail}` }); revalidatePath(`/admin/invoices/${invoiceNumber}`); revalidatePath("/admin/emails").
    9. return { ok: true, message: `Invoice sent to ${customerEmail}`, code: "actions.invoice.resent", vars: { email: customerEmail } }.
  export async function issueMissingInvoiceNumbers(): Promise<ActionResult>   // OWNER ONLY (role === "admin"), else code "actions.invoice.ownerOnly"
    Finds orders where paymentStatus equals "PAID" and invoiceNumber does not exist, sort "createdAt" ascending, limit 200, overrideAccess: true. For each, in order, awaits claimInvoice(payload, { orderId, year: invoiceYear(new Date(at)), vatRateBps: currentVatRateBps(), vatIncludedFils: vatIncludedFils(order.totalFils, currentVatRateBps()), paidAtIso: at }) where at = order.paidAt ?? order.createdAt — exactly the arguments paid.ts uses on a late webhook replay. Counts claimedNow. Sends NO email. One activity entry (action "update", area "orders", summary `Issued ${n} invoice numbers to orders paid before numbering existed`). revalidatePath("/admin/invoices"). Returns code "actions.invoice.issued" vars { count } or "actions.invoice.nothingToIssue".
    This NEVER marks anything paid: claimInvoice's own SQL only matches payment_status = 'PAID' AND invoice_number IS NULL, and it is the same single-winner statement the webhook uses, so a webhook retry racing this button cannot produce two numbers.

G. src/backend/email/quote-emails.ts — additive (coordinate with the quote-pay team)
  COPY.en.invoice / COPY.ar.invoice gain: paidOn, paidByCash, paidByTransfer (strings in the i18n section). A small exported helper paidLine(invoice: InvoiceView, locale: Locale): string picks paidByCard | paidByCash | paidByTransfer | paidOn from invoice.paymentMethod; invoiceHtml and invoiceText call it instead of reading c.paidByCard directly.
  COPY.{en,ar}.invoiceCopy = { subject, heading, body, viewInvoice }.
  export function buildInvoiceCopyEmail(input: { orderId: number | string; orderNumber: string; customerName: string; customerEmail: string; invoice: InvoiceView; locale: Locale; viewUrl?: string }): SendRequest
     // shell(c.invoiceCopy.heading, para(greeting) + para(body with {order}) + invoiceHtml(invoice, locale) + (viewUrl ? button(viewUrl, c.invoiceCopy.viewInvoice, locale) : ""), locale); text twin with invoiceText; type: "payment-received"; subject headerSafe(fill(c.invoiceCopy.subject, { number: invoice.number })).
  src/backend/actions/emails.ts resendLoggedEmail: in the "payment-received" branch, when the order has an invoiceNumber but source !== QUOTE_SOURCE, render buildInvoiceCopyEmail(...) instead of returning notPaidYet (today that branch refuses every non-quote order).

H. src/components/commerce/PayInvoice.tsx + src/lib/i18n/dictionary.ts — the pay page's "Paid by card on {date}" line switches on invoice.paymentMethod the same way (keys pay.invoice.paidOn / paidByCash / paidByTransfer, EN + AR). Every existing invoice is "card", so nothing visible changes.

I. src/app/(admin)/admin/(panel)/invoices/export/route.ts — GET, export const dynamic = "force-dynamic"
  A route handler does not run the (panel) layout gate, so it checks for itself: const session = await getAdminSession(); no session -> 401 JSON; !session.isAdmin -> new Response("Not found", { status: 404 }) (staff are not told the export exists).
  filters = parseInvoiceFilters(Object.fromEntries(new URL(request.url).searchParams)); { rows, tooMany } = await getInvoicesForExport(filters); tooMany -> 400 plain text "Too many invoices for one file. Choose a shorter date range.".
  return new Response(invoicesCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${invoiceExportFilename(filters)}"`, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } }).

J. src/admin/lib/status.ts — orderSourceKey gains "manual" (same matcher as salesChannel, tested before "checkout"); labels.source gains manual. Skip if the manual-orders change has already added it.

Hard rules honoured: no code path here writes paymentStatus; all sums are computed on the server from integer fils; nothing uses any; all reads are as the signed-in user except the two documented overrideAccess reads inside session-checked actions (same exception pattern as actions/emails.ts and actions/quotes.ts).

## adminUx

Design basis: the existing admin kit only (src/admin/ui: PageHeader, DateRangePresets, StatCard, Card/CardHeader, Table/Tr/Td, FilterBar/FilterSelect/DateRangeFields, Pagination, Badge, EmptyState, ActionButton, ButtonLink) and the semantic tokens in (admin)/admin.css. No chart library, no new client data fetching; the only new client island is InvoiceActions. Logical CSS only (rtl-guard.test.ts). Designed at 390px first; every tap target >= 44px (the kit's min-h-11).

=== 1. DASHBOARD  /admin  (src/app/(admin)/admin/(panel)/page.tsx) ===
Click path: sign in -> lands here. Period switch in the header: Today | 7D | 30D | 90D (links: /admin?period=1, /admin, ?period=30, ?period=90; default 7). PERIOD_LABEL gains 1: "dashboard.range.today". The period's sentence is t("dashboard.range.todayLong") for 1, plural("dashboard.lastDays", n) otherwise.

Order of sections, top to bottom (same on phone and desktop; nothing is hidden on a phone):
 a. PageHeader (greeting, subtitle, period switch) — unchanged.
 b. Quick actions — unchanged, plus one ButtonLink "Invoices" (icon receipt) to /admin/invoices.
 c. Headline numbers. Owner: 5 StatCards in `grid grid-cols-2 gap-4 xl:grid-cols-5`; the first card has `col-span-2 xl:col-span-1` so at 390px Paid sales is full width and the other four sit 2 x 2.
    1. Paid sales — value money(sales.current.paidFils); trend from percentChange(current.paidFils, previous.paidFils) using the existing trend() helper; secondary: "Previous period: AED x" then t("dashboard.kpi.paidSalesBasis"); href /admin/invoices?from=<window start day>&to=<today>.
    2. Paid orders — number(current.orders); trend on orders; secondary "All time: n" (existing ordersAllTime); href /admin/orders?payment=PAID.
    3. Average order — money(current.averageFils); trend on averageFils; secondary t("dashboard.kpi.averageBasis"). When orders = 0 the value is "—" and there is no trend.
    4. Awaiting payment — money(awaiting.fils); no trend (it is "right now", not the period); secondary t("dashboard.kpi.awaitingCount", { count }) or awaitingNone; href /admin/orders?attention=awaiting-payment.
    5. Discounts given — money(current.discountFils); trend; secondary t("dashboard.kpi.discountedOrders", { count }) or noDiscounts; href /admin/discounts only once that screen exists, otherwise no link.
    Staff: cards 1, 3 and 5 are not rendered; card 2 as above; card 4 shows the COUNT as its value with no amount. Then the existing Customers and Products cards move to section h.
    Footnotes directly under the cards, owner only, each rendered only when its count > 0, as one small `text-xs text-ink-3` list: refunded-not-counted (count, amount), paid-but-cancelled (count, amount, "refund it in Stripe"), partly-refunded-counted-in-full (count), and the truncated warning (tone warning).
 d. Needs attention — unchanged list and rules.
 e. Charts row `grid gap-4 lg:grid-cols-2`:
    - Owner: "Paid sales" card. CardHeader title t("dashboard.charts.sales"), description = period sentence, action = big money(current.paidFils). BarChart tone accent, bars from sales.series (label: date(day, "short") for days, "HH:00" inside <span dir="ltr"> text for hours; display: money). emptyText t("dashboard.charts.emptySales").
    - Everyone: "Paid orders" card, BarChart tone ink from the same series' orders counts.
    Charts.tsx changes (small, additive): BarChart gets two optional props — `maxLabel?: string` printed above the plot at the inline-start edge in text-xs text-ink-3 tabular (the value of the top gridline, e.g. "AED 2,000"; export niceMax so the page can format it), and `table?: { caption: string; columns: [string, string]; rows: readonly { label: string; value: string }[]; toggleLabel: string }` rendered under the axis labels as a native <details> ("Show the numbers as a table") containing a real <table> with <caption className="sr-only">, th scope="col". This is the accessible and touch fallback: SVG <title> tooltips do not exist on a phone. The table is capped at max-h-64 with overflow-y-auto.
    Accessible summary (aria-label of the svg): t("dashboard.charts.summarySales", { total, period, day, amount }) where day/amount are the best point; when all zero the existing empty panel shows.
    RTL: unchanged mechanism — the svg keeps `rtl:-scale-x-100` so time runs right-to-left, the three axis labels are a flex row that follows dir, maxLabel sits at the inline-start edge, and money/hour strings stay LTR ("AED 1,200"). No transform on text.
    Motion: none added (existing hover opacity only). No animation of bars.
 f. Row `grid gap-4 lg:grid-cols-3`:
    - Best sellers (CardHeader title t("dashboard.bestSellers.title"), description period sentence). Ordered list exactly like today's Top products: rank, name (bespoke row prints t("dashboard.bestSellers.bespoke")), "n sold" (existing dashboard.unitsSold), revenue at the end (owner only; staff see units only). Under the list, owner only, text-xs: t("dashboard.bestSellers.revenueNote"). Empty: existing EmptyState with dashboard.noSales / noSalesBody.
    - Sales by source. StatusBar with three segments in fixed order website (bg-accent), payment link (bg-ink/70), manual (bg-ink/35), plus other (bg-ink/15) only when present. StatusSegment gains optional `display?: string`; the key shows display when given, else count. Owner: segment size = paidFils, display = money(paidFils), with the order count in text-ink-3 beside the label ("Website checkout · 12"). Staff: size and display = orders. Summary string for aria-label: "Website checkout: AED x, Payment link: AED y, …". Empty: t("dashboard.sources.empty").
    - Today's deliveries — unchanged.
 g. Recent orders (table, unchanged columns) and Recent enquiries — unchanged. In Recent orders, when an order has an invoiceNumber, the second line under the order number reads "customer · date · invoice no." with the number in <span dir="ltr">.
 h. Shop row `grid gap-4 lg:grid-cols-3`: Open orders by status (existing StatusBar card), Customers StatCard, Products StatCard (both existing, moved here unchanged).
 Remove the old Revenue StatCard, revenueBasis line and "quiet period" sentence wiring tied to data.current; keep the sentence, shown when sales.current.orders === 0.

=== 2. INVOICES LIST  /admin/invoices  (new page.tsx) ===
Nav: src/admin/shell/nav.ts, Sales group, directly after Orders: { href: "/admin/invoices", label: "nav.invoices", icon: "receipt" } (not ownerOnly). Add three icons to src/admin/ui/icons.tsx in the existing stroke style: receipt, download, printer.
Click path: menu -> Sales -> Invoices. Also: dashboard Paid sales card, and the invoice line on any order page.
 - PageHeader: title "Invoices"; breadcrumbs Sales / Invoices; description: owner "{n} invoices · AED total" (plural invoices.count / countFiltered + invoices.listTotal), staff the count only; when empty, invoices.description. Action (owner only): ButtonLink variant secondary icon download "Export CSV" -> /admin/invoices/export?<the current filters> (plain link, downloads the file; rendered with the `download` attribute). Below 640px the button drops under the title, full width.
 - Banner (only when unnumbered > 0): Card with warning icon: invoices.unnumbered.title/body with the count. Owner: ActionButton "Give them invoice numbers" with a confirm dialog (invoices.unnumbered.confirmTitle/confirmBody) -> issueMissingInvoiceNumbers. Staff: the sentence invoices.unnumbered.staff.
 - Two preset links above the filter bar (DateRangePresets): "This month", "Last month" (monthRange), plus "All".
 - FilterBar action="/admin/invoices", search placeholder invoices.filters.searchPlaceholder; children: DateRangeFields (legend "Payment date", names from / to), FilterSelect source (All / Website checkout / Payment link / Manual order), FilterSelect status (All / Paid / Refunded / Partially refunded).
 - Table (cards below 768px via the kit), caption "Invoices", columns:
     Invoice — primary cell: invoice number as link to /admin/invoices/[number] (dir="ltr"), second line date(issuedAt, "short"). A row with no number shows Badge neutral "No number yet" and links to /admin/orders/[orderNumber].
     Customer — name; second line order number (dir="ltr").
     Paid by — label("paymentMethod", method) · label("salesChannel", channel).
     Total — align end, tabular, money(totalFils).
     Status — Badge toneFor("payment", status) label("payment", status); plus a neutral "Cancelled" badge when cancelled.
 - Pagination with listHref("/admin/invoices", { q, from, to, source, status, page }).
 - Empty states: no invoices at all -> EmptyState icon receipt, invoices.empty.title/body; filters match nothing -> invoices.emptyFiltered.title/body with "Clear filters".

=== 3. INVOICE DETAIL  /admin/invoices/[invoiceNumber]  (new page.tsx) ===
Click path: Invoices -> tap a row. Or Orders -> an order -> "Invoice CAL-INV-… · paid …" line -> "Open invoice" (replace the quote-only external link in orders/[orderNumber]/page.tsx with an internal link shown for EVERY order that has invoiceNumber; keep the existing external "View invoice" link beside it for payment requests).
 - order = getInvoiceByNumber(decodeURIComponent(param)); null -> notFound().
 - searchParams.lang: "en" | "ar"; default order.locale ?? "en". This is the DOCUMENT language, independent of the admin language.
 - PageHeader: title = the invoice number (dir="ltr"); breadcrumbs Sales / Invoices / number; description "Order {orderNumber} · paid {date}". Actions (InvoiceActions, client): primary "Print or save as PDF" (icon printer, onClick window.print()); secondary "Send again to customer" (ActionButton with confirm: title invoices.resend.confirmTitle, body invoices.resend.confirmBody with the customer's email, confirm "Send"); after success the kit's toast shows actions.invoice.resent. At 390px the two buttons are a full-width stack directly under the title (thumb zone), print first.
 - Document-language switch: two links styled as DateRangePresets — "English" | "العربية" -> ?lang=en / ?lang=ar. A note beside it when lang !== order.locale: invoices.detail.customerLanguage ("The customer's copy is in {language}").
 - Layout `grid gap-4 xl:grid-cols-3`: the sheet spans 2 columns; the side card (not printed) lists: status Badge(s); Paid on (datetime); Paid by (method · channel); Customer name / email / phone (owner: link to /admin/customers/[id] when order.customer exists); "Open order" link; payment reference (stripePaymentIntentId, text-xs, dir ltr, owner only); "Sent to customer" — the last sends from getInvoiceSends (date, address, status) or invoices.detail.neverSent.
 - Banners above the sheet when true: REFUNDED -> invoices.detail.refunded; PARTIALLY_REFUNDED -> partlyRefunded; cancelled and paid -> cancelledPaid. These are admin-only notes; they are outside the printed sheet.
 - buildInvoice is called inside try; if it throws, do NOT render a sheet: show EmptyState tone danger invoices.detail.broken.title/body with the "Open order" link and no print/send buttons.
 - src/admin/components/InvoiceSheet.tsx (Server Component): props { invoice: InvoiceView; locale: "en" | "ar" }. Root: <article data-print-sheet lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className="invoice-sheet …">. Labels come from the STOREFRONT dictionary — dictionaryFor(locale).pay.invoice, .pay.deliveryCharge, .checkout.complimentary — i.e. the very strings PayInvoice prints, so the admin copy and the customer's copy cannot drift in wording. Content and order are identical to PayInvoice: title (Invoice / Tax invoice when invoice.vat), number, date, order, billed to (name, email), lines table (description + detail, qty, amount; a struck "was" unit price when wasUnitFils), subtotal, delivery (amount or "Complimentary"), discount (with code), VAT included (when vat), total, the paid line (by method), seller block (trading name, legal name, address, city/country, licence, TRN, email · phone — nulls omitted). Money always inside <span dir="ltr">. Wordmark "CALANTHE" at the top in Cinzel uppercase tracking 0.18em; in Arabic the labels fall back to Plex (existing :lang(ar) rule).
   The sheet is PAPER, so it does not follow dark mode: `.invoice-sheet` in (admin)/admin.css pins background #FFFDF8, text #2B2F1B, muted text #66674B, hairlines #CBC4A9, radius 4px, padding 24px (32px from 640px), max-width 720px. Olive on cream only; no orange on the sheet.
 - Print stylesheet, appended to src/app/(admin)/admin.css (scoped by :has so printing any other admin page is untouched):
     @media print {
       @page { size: A4; margin: 14mm; }
       body:has([data-print-sheet]) { background: #fff !important; }
       body:has([data-print-sheet]) [data-admin-chrome] { display: none !important; }
       body:has([data-print-sheet]) * { visibility: hidden; }
       body:has([data-print-sheet]) [data-print-sheet], body:has([data-print-sheet]) [data-print-sheet] * { visibility: visible; }
       body:has([data-print-sheet]) [data-print-sheet] { position: absolute; inset-block-start: 0; inset-inline: 0; max-width: none; border: 0; box-shadow: none; padding: 0; background: #fff; color: #2B2F1B; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
       [data-print-sheet] tr { break-inside: avoid; }
     }
   Add the attribute data-admin-chrome to the sidebar, the mobile top bar, the drawer and the toast region wrappers (src/admin/shell/AdminNav.tsx, (panel)/layout.tsx, src/admin/ui/Toast.tsx) so they are removed from the page flow in print rather than leaving blank pages.
   A server-generated PDF is a later step; the print dialog's "Save as PDF" is the PDF for now, and the button label says so.

=== ROLES (enforced on the server, mirrored in the UI) ===
 Owner (role admin): everything above.
 Staff: dashboard without aggregated money (blankSalesForStaff runs in getDashboardData, so nothing is in the HTML either); Invoices list and detail with per-invoice totals (the same totals they already see on Orders), print, send again; NO list total (listTotalFils null), NO Export button, export route answers 404, NO "give them invoice numbers" button, no payment reference.
 Customers: nothing — the (panel) layout gate already refuses them, and orders.read limits them to their own rows.
 Update docs/ADMIN.md §0.3 (Dashboard row, new Invoices row) and §0.5 with these rules.

## i18n

Convention followed: src/admin/i18n/en.ts is the schema, ar.ts is typed against it (a missing key is a compile error); stored values go through `labels`; plurals carry all six CLDR forms in Arabic; money and digits stay Western ("AED 1,234.50"); Arabic admin copy is neutral and plain. Keys marked (plural) are plural objects.

--- nav ---
nav.invoices: "Invoices" | "الفواتير"

--- dashboard (add) ---
dashboard.range.today: "Today" | "اليوم"
dashboard.range.todayLong: "Today so far" | "اليوم حتى الآن"
dashboard.quick.viewInvoices: "Invoices" | "الفواتير"
dashboard.kpi.paidSales: "Paid sales" | "المبيعات المدفوعة"
dashboard.kpi.paidSalesBasis: "Money received. Cancelled and refunded orders are not counted." | "المبالغ المستلمة فعلًا. لا تُحتسب الطلبات الملغاة أو المستردّة."
dashboard.kpi.previousValue: "Previous period: {value}" | "الفترة السابقة: {value}"
dashboard.kpi.paidOrders: "Paid orders" | "الطلبات المدفوعة"
dashboard.kpi.average: "Average order" | "متوسط قيمة الطلب"
dashboard.kpi.averageBasis: "Paid sales divided by paid orders" | "المبيعات المدفوعة مقسومة على عدد الطلبات المدفوعة"
dashboard.kpi.awaiting: "Awaiting payment" | "بانتظار الدفع"
dashboard.kpi.awaitingCount: "Orders not paid yet: {count}" | "طلبات لم تُدفع بعد: {count}"
dashboard.kpi.awaitingNone: "Nothing is waiting to be paid." | "لا توجد طلبات بانتظار الدفع."
dashboard.kpi.discounts: "Discounts given" | "الخصومات الممنوحة"
dashboard.kpi.discountedOrders: "Orders with a discount: {count}" | "طلبات استُخدم فيها خصم: {count}"
dashboard.kpi.noDiscounts: "No discounts in this period." | "لا خصومات في هذه الفترة."
dashboard.kpi.refundedNote: "Refunded orders, not counted: {count} ({amount})" | "طلبات مستردّة غير محتسبة: {count} ({amount})"
dashboard.kpi.cancelledPaidNote: "Paid orders that were cancelled, not counted: {count} ({amount}). Refund them in Stripe." | "طلبات مدفوعة أُلغيت وغير محتسبة: {count} ({amount}). يجب ردّ مبالغها من Stripe."
dashboard.kpi.partialRefundNote: "Partly refunded orders, counted at their full total: {count}. Refunds are recorded in Stripe." | "طلبات مستردّة جزئيًا ومحتسبة بكامل قيمتها: {count}. تُسجَّل المبالغ المستردّة في Stripe."
dashboard.kpi.truncated: "This period has more orders than the dashboard can add up, so these figures may be too low. Tell your developer." | "عدد الطلبات في هذه الفترة يتجاوز ما تستطيع لوحة المتابعة جمعه، وقد تكون الأرقام أقل من الواقع. أبلغ المطوّر."
dashboard.charts.sales: "Paid sales" | "المبيعات المدفوعة"
dashboard.charts.paidOrders: "Paid orders" | "الطلبات المدفوعة"
dashboard.charts.emptySales: "No paid sales in this period." | "لا مبيعات مدفوعة في هذه الفترة."
dashboard.charts.summarySales: "Paid sales: {total}, {period}. Best: {day} with {amount}." | "المبيعات المدفوعة: {total}، {period}. الأعلى: {day} بمبلغ {amount}."
dashboard.charts.maxLabel: "Top of scale: {value}" | "أعلى المقياس: {value}"
dashboard.charts.showTable: "Show the numbers as a table" | "عرض الأرقام في جدول"
dashboard.charts.tableDay: "Day" | "اليوم"
dashboard.charts.tableHour: "Hour" | "الساعة"
dashboard.bestSellers.title: "Best sellers" | "الأكثر مبيعًا"
dashboard.bestSellers.bespoke: "Bespoke arrangements" | "تنسيقات حسب الطلب"
dashboard.bestSellers.revenueNote: "Amounts are before order discounts and delivery." | "المبالغ قبل خصومات الطلب ورسوم التوصيل."
dashboard.sources.title: "Sales by source" | "المبيعات حسب المصدر"
dashboard.sources.empty: "No paid sales in this period." | "لا مبيعات مدفوعة في هذه الفترة."
(keep, now unused by the page but still valid: dashboard.kpi.revenue, revenueBasis, paid, charts.revenue, emptyRevenue, topProducts — delete them from BOTH files in the same commit if no other screen uses them; grep first.)

--- invoices (new top-level block) ---
invoices.title: "Invoices" | "الفواتير"
invoices.description: "Every paid order, with its invoice." | "كل طلب مدفوع مع فاتورته."
invoices.count (plural): en { one: "{count} invoice", other: "{count} invoices" } | ar { zero: "لا فواتير", one: "فاتورة واحدة", two: "فاتورتان", few: "{count} فواتير", many: "{count} فاتورة", other: "{count} فاتورة" }
invoices.countFiltered (plural): en { one: "{count} invoice matches", other: "{count} invoices match" } | ar { zero: "لا فواتير مطابقة", one: "فاتورة واحدة مطابقة", two: "فاتورتان مطابقتان", few: "{count} فواتير مطابقة", many: "{count} فاتورة مطابقة", other: "{count} فاتورة مطابقة" }
invoices.listTotal: "{amount} in paid sales" | "{amount} مبيعات مدفوعة"
invoices.export: "Export CSV" | "تصدير CSV"
invoices.exportHint: "Downloads the invoices in this list as a spreadsheet file." | "يُنزِّل فواتير هذه القائمة كملف جدول بيانات."
invoices.presets.label: "Quick dates" | "تواريخ سريعة"
invoices.presets.all: "All" | "الكل"
invoices.presets.thisMonth: "This month" | "هذا الشهر"
invoices.presets.lastMonth: "Last month" | "الشهر الماضي"
invoices.filters.searchPlaceholder: "Invoice or order number, name, email or phone" | "رقم الفاتورة أو الطلب، الاسم، البريد أو الهاتف"
invoices.filters.dates: "Payment date" | "تاريخ الدفع"
invoices.filters.source: "Source" | "المصدر"
invoices.filters.status: "Status" | "الحالة"
invoices.columns.invoice: "Invoice" | "الفاتورة"
invoices.columns.customer: "Customer" | "العميل"
invoices.columns.paidBy: "Paid by" | "طريقة الدفع"
invoices.columns.total: "Total" | "الإجمالي"
invoices.columns.status: "Status" | "الحالة"
invoices.noNumber: "No number yet" | "بلا رقم بعد"
invoices.cancelled: "Cancelled" | "ملغى"
invoices.empty.title: "No invoices yet" | "لا فواتير بعد"
invoices.empty.body: "An invoice appears here the moment an order is paid." | "تظهر الفاتورة هنا فور دفع أي طلب."
invoices.emptyFiltered.title: "No invoices match" | "لا فواتير مطابقة"
invoices.emptyFiltered.body: "Try other dates or clear the filters." | "جرّب تواريخ أخرى أو امسح عوامل التصفية."
invoices.unnumbered.title: "Paid orders without an invoice number: {count}" | "طلبات مدفوعة بلا رقم فاتورة: {count}"
invoices.unnumbered.body: "These were paid before invoice numbers existed. They are counted in your sales, but they have no invoice to print or send yet." | "دُفعت هذه الطلبات قبل بدء ترقيم الفواتير. هي محتسبة في المبيعات، لكن لا فاتورة لها للطباعة أو الإرسال بعد."
invoices.unnumbered.action: "Give them invoice numbers" | "إصدار أرقام فواتير لها"
invoices.unnumbered.confirmTitle: "Give these orders invoice numbers?" | "إصدار أرقام فواتير لهذه الطلبات؟"
invoices.unnumbered.confirmBody: "Each order gets the next free number, oldest first. A number cannot be changed or removed afterwards. No email is sent." | "يحصل كل طلب على الرقم التالي المتاح، الأقدم أولًا. لا يمكن تغيير الرقم أو حذفه لاحقًا. لن تُرسَل أي رسالة."
invoices.unnumbered.confirm: "Give numbers" | "إصدار الأرقام"
invoices.unnumbered.staff: "Ask the owner to give them invoice numbers." | "اطلب من المالك إصدار أرقام فواتير لها."
invoices.detail.subtitle: "Order {order} · paid {date}" | "الطلب {order} · دُفع في {date}"
invoices.detail.print: "Print or save as PDF" | "طباعة أو حفظ بصيغة PDF"
invoices.detail.language: "Invoice language" | "لغة الفاتورة"
invoices.detail.english: "English" | "English"
invoices.detail.arabic: "العربية" | "العربية"
invoices.detail.customerLanguage: "The customer’s copy is in {language}." | "نسخة العميل باللغة {language}."
invoices.detail.paidOn: "Paid on" | "تاريخ الدفع"
invoices.detail.paidBy: "Paid by" | "طريقة الدفع"
invoices.detail.customer: "Customer" | "العميل"
invoices.detail.openOrder: "Open order" | "فتح الطلب"
invoices.detail.openInvoice: "Open invoice" | "فتح الفاتورة"
invoices.detail.reference: "Payment reference" | "مرجع الدفع"
invoices.detail.sent: "Sent to customer" | "أُرسلت إلى العميل"
invoices.detail.neverSent: "Not sent from here yet." | "لم تُرسَل من هنا بعد."
invoices.detail.refunded: "This order was refunded. The invoice stays on record and is not counted in sales." | "تم ردّ مبلغ هذا الطلب. تبقى الفاتورة محفوظة ولا تُحتسب في المبيعات."
invoices.detail.partlyRefunded: "Part of this order was refunded in Stripe. The invoice shows the original total." | "رُدَّ جزء من مبلغ هذا الطلب عبر Stripe. تعرض الفاتورة الإجمالي الأصلي."
invoices.detail.cancelledPaid: "This order was cancelled after it was paid. Refund the payment in Stripe." | "أُلغي هذا الطلب بعد دفعه. يجب ردّ المبلغ من Stripe."
invoices.detail.broken.title: "This invoice cannot be shown" | "تعذّر عرض هذه الفاتورة"
invoices.detail.broken.body: "Its amounts do not add up, so it will not be printed or sent. Tell your developer and quote the order number." | "مبالغها غير متطابقة، لذلك لن تُطبع أو تُرسَل. أبلغ المطوّر واذكر رقم الطلب."
invoices.resend.action: "Send again to customer" | "إعادة الإرسال إلى العميل"
invoices.resend.confirmTitle: "Send this invoice again?" | "إعادة إرسال هذه الفاتورة؟"
invoices.resend.confirmBody: "A copy goes to {email}, in the language the customer ordered in." | "ستُرسَل نسخة إلى {email} باللغة التي طلب بها العميل."
invoices.resend.confirm: "Send" | "إرسال"

--- actions (server result codes) ---
actions.invoice.resent: "Invoice sent to {email}" | "أُرسلت الفاتورة إلى {email}"
actions.invoice.tooOften: "This invoice was sent a moment ago. Please wait before sending it again." | "أُرسلت هذه الفاتورة قبل قليل. انتظر قليلًا قبل إعادة الإرسال."
actions.invoice.notPaid: "This order has not been paid, so there is no invoice to send." | "هذا الطلب لم يُدفع بعد، فلا توجد فاتورة لإرسالها."
actions.invoice.broken: "This invoice does not add up, so it was not sent. Tell your developer." | "مبالغ هذه الفاتورة غير متطابقة، فلم تُرسَل. أبلغ المطوّر."
actions.invoice.failed: "The invoice could not be sent. Try again." | "تعذّر إرسال الفاتورة. حاول مرة أخرى."
actions.invoice.permission: "Sign in to the admin to do this." | "سجّل الدخول إلى لوحة الإدارة للقيام بذلك."
actions.invoice.ownerOnly: "Only the owner can do this." | "هذا الإجراء للمالك فقط."
actions.invoice.issued: "Invoice numbers given: {count}" | "أرقام الفواتير الصادرة: {count}"
actions.invoice.nothingToIssue: "Every paid order already has an invoice number." | "لكل طلب مدفوع رقم فاتورة بالفعل."

--- labels (stored values) ---
labels.salesChannel: website "Website checkout" | "الشراء عبر الموقع"; request "Payment link" | "رابط دفع"; manual "Manual order (WhatsApp, phone)" | "طلب يدوي (واتساب، هاتف)"; other "Other" | "أخرى"
labels.paymentMethod: card "Card" | "بطاقة"; cash "Cash" | "نقدًا"; bank_transfer "Bank transfer" | "تحويل بنكي"; other "Other" | "أخرى"
labels.source.manual: "Manual order (WhatsApp, phone)" | "طلب يدوي (واتساب، هاتف)"   (skip if the manual-orders change added it)

--- CUSTOMER-FACING copy (not the admin dictionary). Arabic addresses the reader in the plural, as everywhere on the site. ---
src/lib/i18n/dictionary.ts, pay.invoice (en | ar):
  paidOn: "Paid on {date}" | "مدفوعة بتاريخ {date}"
  paidByCash: "Paid in cash on {date}" | "مدفوعة نقدًا بتاريخ {date}"
  paidByTransfer: "Paid by bank transfer on {date}" | "مدفوعة بتحويل بنكي بتاريخ {date}"
src/backend/email/quote-emails.ts COPY.{en,ar}.invoice: the same three keys with the same strings (QuoteCopy type gains them, so a missing Arabic string is a compile error).
src/backend/email/quote-emails.ts COPY.{en,ar}.invoiceCopy:
  subject: "Your Calanthe invoice {number}" | "فاتورتكم من Calanthe رقم {number}"
  heading: "Your invoice" | "فاتورتكم"
  body: "Here is a copy of the invoice for your order {order}." | "نرسل لكم نسخة من فاتورة طلبكم {order}."
  viewInvoice: "View invoice" | "عرض الفاتورة"
  (greeting reuses COPY.greeting.) Update src/lib/i18n/dictionary.test.ts expectations if it counts keys.

CSV headers and CSV values are fixed English by design (a file for an accountant or an import; its columns must not change with the admin's language). The Arabic strings above were written for clarity; they carry the same "review by a native speaker before launch" caveat docs/ADMIN.md §6.1 already states.

## tests

All Vitest (npm test), pure unless stated. Money assertions use integer fils literals; none uses toBeCloseTo.

NEW src/backend/domain/sales.test.ts
 isSale / saleFils
  - PAID non-cancelled -> sale at totalFils. PARTIALLY_REFUNDED -> sale at full totalFils. PARTIALLY_REFUNDED with refundedFils 2000 on 5000 -> 3000 (the seam). refundedFils larger than total -> 0, never negative.
  - REFUNDED, PENDING, AUTHORIZED, FAILED -> not a sale. PAID + CANCELLED -> not a sale.
  - missing, NaN, negative, fractional totalFils never corrupt a sum (0 / rounded), as in the existing dashboard test.
 summariseSales (the money rule, one table-driven test): PAID 10000 + PARTIALLY_REFUNDED 5000 + REFUNDED 7000 + PAID-and-CANCELLED 3000 + PENDING 9000 -> paidFils 15000, orders 2, averageFils 7500, excluded { refundedCount 1, refundedFils 7000, cancelledPaidCount 1, cancelledPaidFils 3000, partiallyRefundedCount 1 }.
  - average rounds half up to a whole fil: 10001 over 2 -> 5001; 0 orders -> 0 (no division by zero).
  - all zeros for an empty period.
 discountGivenFils
  - discountFils 2500 only -> 2500. Line with compareAtUnitPriceFils 60000, unitPriceFils 48000, quantity 2 and no code -> 24000. Both -> sum. compareAt lower than unit or absent -> 0 for that line. Discount on a non-sale order is not in the summary.
 saleAt / splitSales / periods (now fixed, e.g. 2026-10-05T10:00:00Z = 14:00 Dubai)
  - paidAt 2026-10-04T20:30:00Z belongs to Dubai day 2026-10-05.
  - an order created in the previous period and paid in the current one is a CURRENT sale.
  - legacy paid order with no paidAt is dated by createdAt.
  - days 7: previous window is [previousStart, now - 7d); a sale at previousEnd + 1 minute is in neither window.
  - days 1: current = since Dubai midnight; previous = yesterday from midnight to the same clock time; a sale yesterday evening is in neither.
  - a sale stamped after `now` (clock skew) is not in current.
 salesSeries
  - 7 days -> 7 points, zeros included, ordered oldest first; a sale lands on its Dubai day; cancelled-paid and refunded are absent.
  - days 1 -> hourly keys "00" … current Dubai hour only; a 23:30 UTC sale of the previous UTC day lands in hour "03".
 bestSellers
  - groups by product id, latest name wins, deleted product (no id) groups by name (parity with topProducts).
  - two payment-request orders with different descriptions and slug "bespoke-arrangement" -> ONE row kind "bespoke", units 2, revenue summed; a product-less line on an "admin-quote" order with another slug is also bespoke.
  - unpaid, refunded and cancelled orders contribute nothing; sort units desc, then revenue, then name; limit respected.
  - BESPOKE_PRODUCT_SLUG equals BESPOKE_SLUG from backend/payments/pay-link (the "held together" test, placed beside the existing QUOTE_SOURCE one).
 salesChannel / salesBySource
  - table: "web-checkout-card" website; "admin-quote" request; "admin-manual", "whatsapp", "phone", "manual-whatsapp" manual; null, "", "import" other; a value containing both "quote" and "checkout" is request.
  - always returns website, request, manual rows (zeros included); "other" only when non-empty; sum of paidFils equals summariseSales().paidFils for the same orders.
 awaitingPayment
  - payment request, link in the future, PENDING -> counted with its total; expired link -> not counted; cancelled -> not; paid -> not; website PENDING (abandoned checkout) -> not; manual PENDING -> counted.
 blankSalesForStaff
  - walk the whole report recursively and assert every key ending in "Fils" is 0 while orders, units, counts are unchanged (this is the test that stops a future field leaking money to staff).
 Reconciliation property: for a fixed set of orders, summariseSales(current).paidFils === sum(series.paidFils) === sum(bySource.paidFils).

CHANGED src/backend/domain/dashboard.test.ts
  - parsePeriod: accepts 1, 7, 30, 90; "0", "2", "abc", undefined -> 7.
  - periodWindow: previousEnd = now - days * DAY_MS for 1 and 7; existing start/previousStart assertions unchanged.

NEW src/backend/domain/invoice-list.test.ts
  - parseInvoiceFilters: bad dates dropped, from > to swapped, unknown source/status dropped, q trimmed and capped.
  - invoiceWhere: no filters -> only the base clause; from "2026-10-01" -> bound 2026-09-30T20:00:00.000Z; to "2026-10-31" -> exclusive bound 2026-10-31T20:00:00.000Z; the legacy (paidAt missing -> createdAt) branch is present; each source maps to its clause; q searches the five fields.
  - invoicePaymentMethod: explicit paymentMethod wins; intent id -> card; "web-checkout-card" -> card; "admin-quote" -> card; unknown manual source without method -> other; an invalid paymentMethod string is ignored.
  - invoiceListTotalFils uses the isSale rule (refunded and cancelled rows add 0) and equals summariseSales().paidFils for the same orders.
  - filsToDecimal: 0 -> "0.00", 5 -> "0.05", 123450 -> "1234.50", 100 -> "1.00"; throws on 10.5 and on -1.
  - csvCell: plain text is quoted only when needed; comma, quote, CR/LF handled (quote doubled); "=SUM(A1)", "+971…", "-x", "@x", leading TAB get an apostrophe prefix; Arabic text is preserved byte for byte.
  - invoicesCsv: starts with U+FEFF, header exactly as specified, CRLF line ends, one line per row, a customer named `Al "Noor", LLC` round-trips through a CSV parser written in the test; a +971 phone is emitted with the guard apostrophe; cancelled row status reads "Paid (cancelled)".
  - monthRange for now = 2026-10-05 Dubai: this month 2026-10-01..2026-10-31; last month 2026-09-01..2026-09-30; January -> previous December of the previous year; a `now` of 2026-09-30T21:00:00Z is already October in Dubai.

CHANGED src/backend/domain/invoice.test.ts
  - buildInvoice sets paymentMethod "card" for the existing fixtures (no visible change) and "cash" when order.paymentMethod is "cash"; every existing assertion still passes.

CHANGED src/backend/email/quote-emails.test.ts
  - buildInvoiceCopyEmail: type "payment-received"; to = customerEmail; subject contains the invoice number and has no newline even if the name has one; html contains every line description, the total and the invoice number; no button when viewUrl is absent; Arabic version has dir="rtl" and the Arabic subject; text part contains the same total.
  - paidLine: card / cash / bank_transfer / other choose the right sentence in both languages; the existing payment-received email is byte-identical for a card order (snapshot or string equality against the pre-change output).

NEW src/backend/actions/invoices.test.ts (fake payload + injected sendEmail/claimInvoice/throttle, same style as payments/paid.test.ts; export an internal `resendInvoiceWith(deps, …)` / `issueMissingWith(deps, …)` for this, the "use server" exports being thin wrappers)
  - resendInvoice: no session or customer role -> permission, nothing sent; unpaid order -> notPaid; throttled -> tooOften; non-reconciling order -> broken and nothing sent; success sends exactly one email to the order's own email, writes one activity entry with action "email", and never calls payload.update on orders.
  - issueMissingInvoiceNumbers: staff -> ownerOnly; processes oldest first; passes year = Dubai year of paidAt ?? createdAt; counts only claimedNow; sends no email; an order that is not PAID is never passed to claimInvoice.

NEW src/admin/components/InvoiceSheet.test.tsx (renderToStaticMarkup, node environment)
  - for one InvoiceView with a discount code and two lines, the admin sheet and PayInvoice both contain: the number, both descriptions, "AED" total, the code, the paid line; Arabic sheet has dir="rtl" and lang="ar"; a null legal name / TRN prints no placeholder text; has the data-print-sheet attribute.

EXISTING guards that must stay green: src/admin/i18n/i18n.test.ts (EN/AR parity and plural forms), src/admin/rtl-guard.test.ts (no left/right classes in the new files), src/lib/i18n/dictionary.test.ts, src/backend/payments/paid.test.ts, tsc --noEmit (strict, no any), eslint.

MANUAL VERIFICATION (a task is done only at 390px): /admin at 390px in EN and AR, light and dark, as owner and as staff (view-source as staff: no "Fils" value other than 0 inside the sales payload); Today / 7D / 30D / 90D; chart "show as table" opens; /admin/invoices filters, paging and both empty states; CSV opens in Excel with Arabic names intact and phone numbers not turned into formulas; invoice detail in EN and AR; print preview shows only the sheet on one A4 page in Chrome and Safari iOS; "Send again" arrives, is logged in /admin/emails and in Activity; staff GET /admin/invoices/export -> 404.

## edgeCases

MONEY AND STATUS
- Refunds are not recorded by code today (webhook writes a note only; paymentStatus stays PAID; no refundedFils). So a refund made in Stripe does NOT lower Paid sales until someone builds refund recording. The rule is written to be correct the day it exists (REFUNDED -> 0, refundedFils subtracted). The dashboard footnotes say this plainly. Listed as an owner question.
- Paid then cancelled (including the quote "PAID AFTER CANCELLATION" case): excluded from Paid sales, shown in the period footnote with its amount, still listed in Invoices with a "Cancelled" badge and a banner on the detail page. The invoice number is never revoked or reused (gap-free series); there is no credit note in this step.
- Legacy cash-on-delivery orders (source matching "cod", paymentStatus PENDING for ever) are NOT paid sales and have no invoice. They remain in Orders. The dashboard's old "placed orders" revenue disappears; say so in the commit message and docs/ADMIN.md.
- Abandoned website checkouts (web-checkout-card, PENDING) are never revenue, never "awaiting payment". Observation outside this scope: the existing "new orders to confirm" count and isPlaced still include them; worth a follow-up with the checkout owners.
- An order paid just before midnight Dubai belongs to that day; the server's UTC day is irrelevant. "Today" compares with yesterday up to the same clock time, so the morning does not always read "down".
- Previous period has zero sales -> no percentage (existing "Nothing in the previous period to compare").
- Average order with zero orders -> "—", not AED 0.00.
- Best-seller revenue is line totals (after sale prices, before the order-level code discount and delivery), so the column does not sum to Paid sales; the note under the list says so.
- Discounts given before the discounts feature ships: discountFils is 0 on every order, the card reads AED 0.00 with "No discounts in this period." It lights up with no further change once couponDiscountFils / compareAtUnitPriceFils are written. Payment requests carry no code by rule.
- More than 5,000 orders in two periods (90D): figures would be short; `truncated` raises a visible warning instead of silently under-reporting. The real fix at that scale is SQL aggregation; not needed for this shop now.
- VAT: off (BUSINESS.vatRegistered false). The sheet titles itself "Invoice"; when VAT is turned on, buildInvoice already switches to "Tax invoice" from the per-order snapshot; the CSV already has the VAT column. Backfilled legacy numbers take the VAT rate current at the time of backfill — fine while it is 0; if VAT is ever switched on, run the backfill BEFORE switching.

INVOICES
- Orders paid before invoice numbers existed (PAID, no invoiceNumber, usually no paidAt): counted in the dashboard by createdAt; listed in Invoices with "No number yet" linking to the order; the owner's one button gives them numbers oldest first with the same SQL the webhook uses. Their invoice date is their payment date (createdAt fallback) while their number is the next free one, so number order and date order can differ for those few — same behaviour as the webhook's own late-replay healing. Flagged for the accountant.
- A webhook crash between PAID and the invoice claim heals itself on Stripe's retry (paid.ts); the backfill button is also safe to press during that window (single-winner row lock; only one number can ever be issued).
- buildInvoice throws when the snapshot does not reconcile or paidAt is missing: the detail page shows the "cannot be shown" state, and resend refuses. Never render a document that does not add up.
- Invoice number in the URL: validated against /^CAL-INV-\d{4}-\d{5,}$/ before any query; anything else is a 404. The static segment "export" cannot collide with a number.
- Guest orders: no customer link in the side card. Customer link is owner-only (staff cannot read users).
- "Send again" always goes to the order's snapshot email, in order.locale, max 5 per hour per order; it writes a new email-log row (type payment-received) and an activity entry. If the address on the order is wrong, the fix is outside this feature (orders are immutable) — staff forward the PDF by WhatsApp.
- EMAIL allowlist/preview environments: sendEmail's existing allowlist applies unchanged; a blocked send returns its status and the action reports actions.invoice.failed with the provider's message.
- Gift orders: the invoice shows prices and goes only to the buyer's email; nothing here emails the recipient.
- CSV: UTF-8 with BOM for Excel; formula-injection guard on every text cell (customer names are attacker-controlled input from checkout); amounts are decimal strings built by integer maths; no-store; owner only; more than 20,000 rows -> 400 asking for a shorter range. Contains personal data: it is the owner's responsibility once downloaded (note in docs/SECURITY.md).
- Print: only the sheet prints; dark mode never reaches paper (.invoice-sheet pins light colours); long invoices break between rows, not inside one; Arabic prints RTL because the sheet carries its own dir/lang, independent of the admin language.
- Staff see per-invoice totals but no aggregate; a staff session's dashboard payload contains zeros for every fils field (enforced by blankSalesForStaff and its recursive test).

COORDINATION (files other teams are editing right now — make these edits last, small and additive, and re-read the file first)
- src/backend/domain/invoice.ts, src/backend/email/quote-emails.ts, src/components/commerce/PayInvoice.tsx, src/lib/i18n/dictionary.ts, src/backend/actions/emails.ts (quote-pay team): only the paymentMethod line, buildInvoiceCopyEmail and one resend branch.
- src/admin/i18n/en.ts / ar.ts, src/admin/shell/nav.ts, src/admin/lib/status.ts, src/collections/Orders.ts (both teams): this feature adds keys and one nav line; it does not touch Orders.ts at all.
- Discounts team: this spec relies on their statement that subtotal = sum of lines after sale price and total = subtotal + delivery − discount (so buildInvoice keeps reconciling), and reads items[].compareAtUnitPriceFils if present. If they rename that field, update SaleItemLike and the one test.
- Manual/WhatsApp orders team: see the three-point contract in dataModel (source value, claimInvoice on payment, optional paymentMethod). Until that lands, the "Manual order" row shows zero and the code path is dormant.
- No migration in this feature. If a later decision adds a distinct email type (for example "invoice-copy") or refundedFils, that is its own additive migration, created after the discounts migration has been generated and merged, and applied to production before the code deploys (the migrate -> verify -> deploy order in docs/specs/reviews.md).

## buildOrder

1. 0. Before starting: pull the working tree state, run npm test and tsc --noEmit to get a green baseline; confirm with the quote-pay and discounts teams that src/backend/domain/invoice.ts, quote-emails.ts and the admin dictionaries are free to take small additive edits. No migration is created in this feature.
2. 1. Domain, test first: extend src/backend/domain/dashboard.ts (DASHBOARD_PERIODS with 1, parsePeriod, PeriodWindow.previousEnd, BESPOKE_PRODUCT_SLUG, rewritten header comment) and update dashboard.test.ts. Commit: feat(admin): today period and like-for-like comparison window.
3. 2. Domain, test first: create src/backend/domain/sales.ts and sales.test.ts exactly as specified (isSale, saleAt, saleFils, discountGivenFils, salesChannel, splitSales, summariseSales, salesSeries, bestSellers, salesBySource, awaitingPayment, buildSalesReport, blankSalesForStaff). All tests in the tests section must pass before any UI work. Commit: feat(admin): paid-sales arithmetic.
4. 3. Data: change getDashboardData in src/backend/data/dashboard.ts (single window query with select, sales report, staff blanking, remove current/previous/series/top). Commit with step 5.
5. 4. Charts: in src/admin/components/Charts.tsx export niceMax, add BarChart maxLabel and table props, add StatusSegment.display. Add icons receipt, download, printer to src/admin/ui/icons.tsx.
6. 5. Dictionary: add every dashboard.*, labels.salesChannel, labels.paymentMethod key to src/admin/i18n/en.ts and ar.ts; then rebuild src/app/(admin)/admin/(panel)/page.tsx in the section order specified (headline cards, footnotes, attention, two charts, best sellers / sales by source / today's deliveries, recent lists, shop row). Verify at 390px, EN and AR, light and dark, owner and staff. Commit: feat(admin): sales dashboard with paid sales, best sellers and sales by source.
7. 6. Domain, test first: create src/backend/domain/invoice-list.ts and invoice-list.test.ts (filters, where, payment method, row, list total, filsToDecimal, csvCell, invoicesCsv, monthRange, filename). Commit: feat(admin): invoice list rules and CSV.
8. 7. Invoice method line (additive, shared files): InvoiceOrder/InvoiceView.paymentMethod in src/backend/domain/invoice.ts; paidOn/paidByCash/paidByTransfer in quote-emails.ts COPY and src/lib/i18n/dictionary.ts; paidLine helper used by invoiceHtml, invoiceText and PayInvoice.tsx; update invoice.test.ts and quote-emails.test.ts and prove the card output is unchanged. Commit: feat(invoice): payment method on the invoice.
9. 8. Data: create src/backend/data/invoices.ts (getInvoicePage, getInvoiceByNumber, getInvoicesForExport, getInvoiceSends).
10. 9. Invoices list: add invoices.* keys EN + AR and nav.invoices; add the nav item in src/admin/shell/nav.ts; build src/app/(admin)/admin/(panel)/invoices/page.tsx (presets, FilterBar, table, paging, empty states, unnumbered banner without its button yet). Verify at 390px and RTL. Commit: feat(admin): invoices list.
11. 10. CSV export: src/app/(admin)/admin/(panel)/invoices/export/route.ts with its own session check (401 / 404 for staff), plus the owner-only Export button. Test by hand in Excel with an Arabic name and a +971 phone. Commit: feat(admin): owner-only invoice CSV export.
12. 11. Invoice sheet and print: src/admin/components/InvoiceSheet.tsx, .invoice-sheet and the @media print block in src/app/(admin)/admin.css, data-admin-chrome on the shell wrappers, InvoiceSheet.test.tsx; build src/app/(admin)/admin/(panel)/invoices/[invoiceNumber]/page.tsx with the language switch, side card, banners and the broken state. Check print preview in Chrome and iOS Safari. Commit: feat(admin): invoice view with print to PDF.
13. 12. Send again: LIMITS.invoiceResend in throttle.ts; COPY.invoiceCopy and buildInvoiceCopyEmail in quote-emails.ts (+ tests); src/backend/actions/invoices.ts resendInvoice (+ tests); src/admin/components/InvoiceActions.tsx; the non-quote branch in resendLoggedEmail (src/backend/actions/emails.ts). Commit: feat(admin): send an invoice again to the customer.
14. 13. Legacy numbers: issueMissingInvoiceNumbers action (+ tests) and the owner-only button with confirmation in the list banner. Commit: feat(admin): give invoice numbers to orders paid before numbering.
15. 14. Wiring: order detail page shows 'Open invoice' for every order with an invoiceNumber; Recent orders shows the invoice number; orderSourceKey/labels.source gain 'manual' if not already present; dashboard quick action to Invoices.
16. 15. Docs: docs/ADMIN.md §0.3 (Dashboard and Invoices rows, role rules), docs/ORDERS.md or docs/PAYMENTS.md (the paid-sales rule and how refunds/cancellations are treated, the contract for manual orders), docs/SECURITY.md (CSV is owner-only personal data), docs/OWNER_TODO.md (business details for the invoice). Commit: docs: sales dashboard and invoices.
17. 16. Final verification: npm test, tsc --noEmit, eslint, rtl-guard and i18n parity green; full manual pass at 390px in both languages and both roles; view-source as staff shows no money aggregates; then hand over for review. Nothing is deployed and no database is touched by this feature.

## openQuestionsForOwner

- Invoice details: what should the invoice say under 'From'? We need the legal company name (English and Arabic), the address, and the trade licence number. Until you give them, the invoice prints only 'Calanthe, Abu Dhabi, United Arab Emirates' with the email and phone.
- VAT: are you registered for VAT (do you have a TRN)? Today the system treats you as not registered, so invoices say 'Invoice' with no tax line. If you are registered, tell us before launch, because it changes the invoice title and adds the tax line.
- Refunds: today a refund is done in Stripe and the admin does not know about it, so the dashboard keeps counting that sale until we build refund recording. Is that acceptable for now, or should 'record refunds automatically' be the next piece of work?
- Staff and invoices: should your staff be able to open, print and resend a single invoice (they already see each order's total), or should the whole Invoices area be for you only? Either way, staff never see sales totals or the export.
- 'Best seller this week': do you mean the last 7 days (what we planned), or a calendar week? If a calendar week, which day does your week start on?
- Best sellers: should the ranking be by number sold (planned) or by money earned? For a few high-value bespoke orders the two lists can look different.
- Older orders: are there any orders that were paid before invoice numbers were added, or old cash-on-delivery orders that were paid in cash? Cash orders were never marked as paid in the system, so they will not appear in paid sales or invoices unless we agree how to handle them.
- For those older paid orders we can give invoice numbers now with one button. The number will be newer than the payment date. Please check with your accountant that this is fine.
- WhatsApp and phone orders: when a customer pays you in cash or by bank transfer, who will mark the order as paid, and should the invoice say 'Paid in cash' or 'Paid by bank transfer'? This decides when those sales appear in the dashboard.
- The export file for your accountant: is the list of columns enough (invoice number, date, order, customer, source, payment method, subtotal, delivery, discount, code, VAT, total, payment reference), and is English fine for the column names?
- Sending an invoice again: it goes to the email address on the order, in the language the customer ordered in. Do you also need to send it to a different address, or is forwarding the PDF on WhatsApp enough?