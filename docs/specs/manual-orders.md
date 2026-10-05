# Spec: manual-orders

## summary

FEATURE B SPEC — create an order in the admin (WhatsApp / phone sales). Spec only; no project file, database or commit was touched.

WHAT I VERIFIED IN THE TREE (C:\dev\calanthe), because it changes the design:
- Payment requests (quote-pay) are BUILT: src/backend/actions/quotes.ts, src/backend/payments/{pay-link,intent,invoice-number,paid,verdict}.ts, src/backend/data/{quote,pay}.ts, src/admin/components/QuotePayment.tsx, /pay/[token], migration 20261004_193027_quote_pay_link. Discounts are NOT built yet: src/backend/domain/pricing.ts still hardcodes discountFils = 0 and there is no src/collections/Discounts.ts. The code-discount part of this feature therefore depends on docs/specs/discounts.md landing first; everything else does not.
- Every "this is a pay-link order" rule is keyed on the literal source "admin-quote": findOrderByPayToken (src/backend/data/pay.ts), loadQuoteOrder (quotes.ts), getQuoteForOrder (data/quote.ts), isUnpaidQuote (pay-link.ts), guardUnpaidQuoteFulfilment and validateBespokeLines (orderIntegrity.ts), isAwaitingQuote / REAL_ORDER_WHERE (dashboard), SHOP_ORDERS / PAID_REQUESTS (admin-pulse.ts), isQuote in paid.ts. All must widen to a set of two sources.
- validateBespokeLines currently REFUSES any non-quote order with a product-less line, and any quote with more than one line. A manual order needs its own branch.
- guardPaymentStatus only guards UPDATE. An order can today be CREATED already PAID by any overrideAccess caller or by the owner in /cms (scripts/qa-fixtures.mts line 159 does exactly that). This spec closes that.
- Orders.customerEmail is required (NOT NULL). A WhatsApp customer often has no email, so it must become optional for manual orders only. 19 files read customerEmail (listed in dataModel).
- Staff cannot read the users collection (isAdminOrSelf), so "search an existing customer" must search ORDER snapshots for staff.
- The pay page and payment emails assume one line (items[0].productName, "Delivery: Complimentary", "Paid by card on {date}").
- No CSV export exists anywhere in src today; I give the column contract for whoever builds it.
- Admin Arabic in src/admin/i18n/ar.ts is neutral masculine singular imperative (أكّد، انسخ، اختر); storefront/email Arabic is plural (ادفعوا). Strings below follow each.

DESIGN IN ONE PARAGRAPH. /admin/orders/new is a one-page Shopify-style draft order: items (catalogue products with size/add-ons/quantity, and/or custom lines), customer, delivery, optional discount, notes, then ONE of two payment choices. Either way the server creates a single order with source "admin-manual", paymentStatus PENDING and a pay token, priced on the server by priceOrder (catalogue lines) plus typed custom lines. (a) "Send payment link" reuses the payment-request mechanism unchanged: email if there is one, copy link / Send on WhatsApp, the signed webhook marks PAID, claims the invoice number, sends the emails. (b) "Paid outside the website" (owner only) is a SECOND, separate, narrow door in guardPaymentStatus: a server-only context flag that is honoured only for an admin-manual order going PENDING -> PAID with an explicit non-card payment method, a required reference and the recorder's name, backed by two database CHECK constraints. It then runs the same gap-free claimInvoice and the same emails. A card payment can still only ever be marked paid by the webhook, and the webhook now flags (never swallows) a card payment that lands on an order already recorded as paid by hand. Website checkout is not touched except for two hardening lines (webhook writes paymentMethod "card"; receipt_email omitted when empty).

RECOMMENDATION ON WHO: create order + send link = owner and staff (same power staff already have with payment requests). Record a payment taken outside the website = OWNER ONLY, on creation or later from the order page. Manual amount-off discount = owner only; discount codes = owner and staff.

## dataModel

ONE NEW MIGRATION, `pnpm migrate:create manual_orders`, generated on the same branch AFTER whichever of quote_pay_link / discounts is already in src/migrations (snapshots are cumulative; never generate in parallel). Register in C:\dev\calanthe\src\migrations\index.ts, then `pnpm generate:types`. Deploy rule unchanged: migrate production -> verify -> deploy code.

A. CONSTANTS — C:\dev\calanthe\src\backend\payments\pay-link.ts (no "server-only"; loaded by the Payload CLI)
- export const MANUAL_SOURCE = "admin-manual";
- export const PAY_LINK_SOURCES = [QUOTE_SOURCE, MANUAL_SOURCE] as const;
- export function isPayLinkSource(source: string | null | undefined): boolean
- isUnpaidQuote: widen to isPayLinkSource(order.source) && !isSettled(order.paymentStatus). Keep the name (callers: actions/admin.ts) and add the alias `export const isUnpaidPayLinkOrder = isUnpaidQuote`.
- export const PAYMENT_METHODS = ["card", "cash", "bank-transfer", "card-machine", "other"] as const; export type PaymentMethod; export const OFFLINE_PAYMENT_METHODS = ["cash", "bank-transfer", "card-machine", "other"] as const; export type OfflinePaymentMethod; export function isOfflineMethod(v: unknown): v is OfflinePaymentMethod.
- export const SALES_CHANNELS = ["whatsapp", "phone", "instagram", "in-person", "other"] as const; export type SalesChannel.
- export function paymentMethodOf(order: { paymentStatus?: string | null; paymentMethod?: string | null }): PaymentMethod | null — stored value if set; else "card" when isSettled (every historical paid order went through Stripe); else null. No data backfill is run.
C:\dev\calanthe\src\backend\domain\dashboard.ts (must stay import-free of Node): add MANUAL_ORDER_SOURCE = "admin-manual" and PAY_LINK_ORDER_SOURCES; the existing test that holds QUOTE_ORDER_SOURCE equal to QUOTE_SOURCE gains the same assertion for the new pair.

B. C:\dev\calanthe\src\collections\Orders.ts — new fields (all nullable/defaulted)
| field | type | column | access |
| paymentMethod | select PAYMENT_METHODS | payment_method enum_orders_payment_method NULL | { create: serverOnlyField, update: serverOnlyField }; readable by the order's owner (shown on the invoice) |
| paymentReference | text maxLength 140 | payment_reference varchar | { create: serverOnlyField, read: isStaffField, update: serverOnlyField } |
| paymentRecordedBy | relationship -> users, filterOptions role in admin/staff | payment_recorded_by_id integer FK ON DELETE SET NULL, index | same as paymentReference |
| paymentRecordedByName | text maxLength 140 (snapshot, survives the user being deleted) | payment_recorded_by_name varchar | same |
| createdBy | relationship -> users | created_by_id integer FK ON DELETE SET NULL, index | { ...immutableAfterCreate, read: isStaffField } |
| salesChannel | select SALES_CHANNELS | sales_channel enum_orders_sales_channel NULL | { ...immutableAfterCreate, read: isStaffField } |
| manualDiscountFils | filsField, defaultValue 0 | manual_discount_fils numeric DEFAULT 0 | immutableAfterCreate (in the Totals collapsible) |
| manualDiscountReason | text maxLength 140 | manual_discount_reason varchar | { ...immutableAfterCreate, read: isStaffField } |
customerEmail: remove `required: true`; add `validate`: empty is allowed ONLY when siblingData/data.source === MANUAL_SOURCE, otherwise "An email address is required."; when present it must match the email pattern. Stored as null (never ""). Column: customer_email DROP NOT NULL.
source description gains "admin-manual" for an order created in the admin. paymentStatus description changes to: "Card payments: set by the payment provider only. An order created in the admin can be recorded as paid outside the website by the owner."
No change to items. A custom line is stored exactly like the bespoke line: { product: null, productName: <description>, productSlug: BESPOKE_SLUG, quantity 1..20, unitPriceFils, lineTotalFils = unit x qty, selectedOptions: [] } — reusing BESPOKE_SLUG means the account page's existing "do not link to /product" guard already covers it.
The order ALWAYS gets payTokenSalt / payTokenHash at creation (both modes): the same /pay/[token] URL is where the invoice is viewed and printed afterwards. payLinkExpiresAt = now + 7 days for "send link"; = the creation instant for "paid outside" (never payable).

C. HAND-ADDED SQL in the migration `up`, after the generated ALTERs, marked like the previous migration:
1) ALTER TABLE "orders" ADD CONSTRAINT "orders_offline_payment_documented" CHECK ("payment_method" IS NULL OR "payment_method" = 'card' OR ("payment_reference" IS NOT NULL AND length(btrim("payment_reference")) >= 3 AND "payment_recorded_by_name" IS NOT NULL));
2) ALTER TABLE "orders" ADD CONSTRAINT "orders_offline_payment_manual_only" CHECK ("payment_method" IS NULL OR "payment_method" = 'card' OR "source" = 'admin-manual');
3) ALTER TABLE "orders" ADD CONSTRAINT "orders_manual_discount_has_reason" CHECK (coalesce("manual_discount_fils", 0) = 0 OR ("source" = 'admin-manual' AND "manual_discount_reason" IS NOT NULL AND length(btrim("manual_discount_reason")) >= 3));
Old code never writes these columns, so all three pass for it (backward compatible). Expected generated part: CREATE TYPE enum_orders_payment_method, enum_orders_sales_channel; seven ADD COLUMNs; two FKs + two indexes; ALTER COLUMN customer_email DROP NOT NULL. `down`: drop the three constraints, FKs, indexes, columns and types; do NOT restore NOT NULL on customer_email if any row is null (write it as a guarded DO block that sets NOT NULL only when no null exists, with a comment).
No new email_log enum value and no activity_log enum change (area "orders" exists).

D. HOOKS — C:\dev\calanthe\src\backend\payload\hooks\orderIntegrity.ts
- export const MANUAL_PAYMENT_CONTEXT = "manualPaymentWrite"; (server-side context only; no REST/GraphQL request can set it).
- guardPaymentStatus, rewritten rule set:
  CREATE: paymentStatus must be undefined or "PENDING" for every caller, else APIError 403 "An order is created unpaid. Payment is recorded afterwards." (closes the create-as-PAID door; update scripts/qa-fixtures.mts to create PENDING then update under PAYMENT_PROVIDER_CONTEXT).
  UPDATE, status unchanged: pass. UPDATE with PAYMENT_PROVIDER_CONTEXT: pass (unchanged). UPDATE with MANUAL_PAYMENT_CONTEXT passes ONLY when ALL hold: originalDoc.source === MANUAL_SOURCE; originalDoc.paymentStatus === "PENDING"; data.paymentStatus === "PAID"; originalDoc.fulfilmentStatus !== "CANCELLED"; isOfflineMethod(data.paymentMethod); typeof data.paymentReference === "string" with trimmed length 3..140; data.paymentRecordedByName non-empty. Anything else: the existing 403.
- NEW beforeChange guardPaymentRecord: on update, if originalDoc.paymentMethod is set and data.paymentMethod / paymentReference / paymentRecordedBy / paymentRecordedByName is defined and differs -> 403 "A recorded payment cannot be changed." (same shape as guardInvoiceNumber). Also: data.paymentMethod defined while neither context flag is present -> 403.
- validateBespokeLines gains a third branch BEFORE the "anything else" branch:
  source === MANUAL_SOURCE -> enquiry must be empty; 1..30 lines; each line EITHER has a product and productSlug !== BESPOKE_SLUG, OR has no product and productSlug === BESPOKE_SLUG with a non-empty productName; totalFils integer >= MIN_CHARGE_FILS; createdBy and salesChannel present; payTokenHash present.
  The quote branch and the default branch are unchanged (web checkout is not loosened).
- validateOrderTotals additions (create only), merged with the discounts spec's rules: manual = Number(data.manualDiscountFils ?? 0) is an integer >= 0; manual > 0 requires source === MANUAL_SOURCE and a trimmed reason of 3..140; discountFils === Number(data.couponDiscountFils ?? 0) + manual (replaces the reviewers' "discountFils === couponDiscountFils"); manual > 0 and a coupon may not both be present.
- guardUnpaidQuoteFulfilment: replace `originalDoc?.source !== QUOTE_SOURCE` with `!isPayLinkSource(originalDoc?.source)`; error text for the manual case: "A cancelled order cannot be reopened. Create a new order." Register guardPaymentRecord in Orders.hooks.beforeChange.

E. TYPE RIPPLE of customerEmail becoming `string | null` (fix each, do not cast): src/backend/payments/intent.ts (receipt_email only when present), src/backend/payments/paid.ts (OrderDoc), src/backend/domain/invoice.ts (InvoiceOrder.customerEmail?: string | null; billTo.email: string | null), src/backend/email/quote-emails.ts + order-emails.ts + status-email.ts (skip the customer send when empty; status-email already returns on empty), src/backend/actions/quotes.ts + emails.ts, src/backend/data/quote.ts + src/admin/lib/quote-card.ts + src/admin/components/QuotePayment.tsx (customerEmail: string | null), the two admin orders pages, src/components/commerce/PayInvoice.tsx (omit the email line). checkout.ts and CheckoutForm.tsx still always send one.

F. InvoiceView (src/backend/domain/invoice.ts) gains `paymentMethod: PaymentMethod` (from paymentMethodOf; "card" for old orders) and InvoiceOrder gains paymentMethod?, manualDiscountFils?. `discount` becomes { code: string | null; fils: number } as today; a manual discount prints as a plain "Discount" row (the internal reason is never printed).

G. CSV CONTRACT (no export exists yet; whoever builds it must include): order_number, created_at, source, sales_channel, payment_status, payment_method (paymentMethodOf), payment_reference, payment_recorded_by, paid_at, invoice_number, subtotal, discount, coupon_code, manual_discount, manual_discount_reason, delivery_fee, total, created_by. source + payment_method are what distinguish a hand-recorded payment from a card payment forever.

## serverLogic

All paths under C:\dev\calanthe\. Money is integer fils; nothing the browser sends is used as a price for a catalogue line.

1. PURE DOMAIN — NEW src/backend/domain/manual-order.ts (no Payload, no clock; `now`/`todayDubai` passed in)
export type ManualLineDraft = { kind: "product"; productId: string; sizeId: SizeId; addonIds: AddonId[]; quantity: number } | { kind: "custom"; description: string; unitPriceAed: string; quantity: number };
export type ManualDiscountDraft = { kind: "none" } | { kind: "code"; code: string } | { kind: "manual"; amountAed: string; reason: string };
export type ManualOrderDraft = { requestId: string; channel: SalesChannel; lines: ManualLineDraft[]; customer: { name: string; phone: string; email?: string; customerId?: number }; locale: "en" | "ar"; delivery: { date: string /* YYYY-MM-DD */; timeSlot: string; address: string; notes?: string }; gift?: { recipientName?: string; recipientPhone?: string; cardMessage?: string }; customerNote?: string; internalNotes?: string; discount: ManualDiscountDraft };
export type ManualPayment = { mode: "link" } | { mode: "offline"; method: OfflinePaymentMethod; reference: string; alreadyDelivered: boolean };
export const manualOrderDraftSchema / manualPaymentSchema — Zod 4 (already a dependency) for SHAPE only (strings capped, arrays max 30, uuid requestId); business rules below throw FormInputError (existing class) so the admin shows translated sentences.
export function parseManualOrder(input: unknown, ctx: { todayDubai: string; slots: readonly string[]; allowPastDays: number }): ParsedManualOrder
 - phone: normalisePhone from src/lib/checkout-fields.ts then E.164, else "phoneFormat". "050 123 4567" is accepted.
 - email optional; lowercased; "emailFormat" when present and invalid. name 1..140 one line ("nameRequired").
 - custom line: description 1..140 one line ("customDescriptionRequired"); price via parseAedToFils with the same comma rule as parseQuoteForm ("customPriceRequired"), 100 fils <= unit <= MAX_PRICE_AED*100; quantity integer 1..20.
 - product line: quantity integer 1..20; sizeId / addonIds checked later by priceLine.
 - at least one line ("itemsRequired"), at most 30 ("tooManyItems").
 - date: same construction as parseQuoteForm (UAE noon, round-trip check). allowPastDays = 0 for mode link ("deliveryDatePast"), 60 for mode offline ("deliveryDateTooOld"). slot must be in ctx.slots; address 1..600.
 - recipientPhone normalised + E.164 when present; cardMessage <= 300; customerNote <= 600; delivery notes <= 600; internalNotes <= 2000.
 - discount manual: amount via parseAedToFils > 0, reason 3..140 ("discountReasonRequired"); code: normalised uppercase, <= 24, pattern from the discounts spec.
export type PricedManualLine = { kind: "product" | "custom"; productId: number | null; productName: string; productSlug: string; quantity: number; unitPriceFils: number; lineTotalFils: number; selectedOptions: { label: string; value: string }[]; compareAtUnitPriceFils?: number | null; sale?: PricedLine["sale"] };
export type PricedManualOrder = { lines: PricedManualLine[]; subtotalFils: number; couponCode: string | null; couponDiscountFils: number; manualDiscountFils: number; discountFils: number; deliveryFeeFils: number; totalFils: number; couponRefusal: { reason: string; shortfallFils?: number } | null; coupon: CouponRule | null };
export function priceManualOrder(parsed: ParsedManualOrder, products: Map<string, Product>, opts: { discounts?: OrderDiscounts; actorIsOwner: boolean }): PricedManualOrder
 1) catalogue lines -> CheckoutLineRequest[] -> priceOrder(lines, products, "abu-dhabi", opts.discounts) — the SAME function checkout uses, so automatic sales, size uplifts and add-on prices are identical to the website. Skipped when there are no catalogue lines (priceOrder throws on an empty basket).
 2) custom lines: lineTotalFils = unitPriceFils * quantity.
 3) lines re-assembled in the order they were entered.
 4) subtotalFils = catalogue subtotal + custom subtotal.
 5) couponDiscountFils = what priceOrder returned — a code discounts catalogue lines only; a custom line's price is already the price (same principle as "no discount on a payment request"). A refused code sets couponRefusal and the caller refuses the order.
 6) manual discount: requires opts.actorIsOwner, else FormInputError("…", "discountOwnerOnly"); not allowed together with a code.
 7) discountFils = couponDiscountFils + manualDiscountFils; deliveryFeeFils = deliveryFeeFils("abu-dhabi", subtotalFils - discountFils) (re-computed on the whole order); totalFils = subtotalFils - discountFils + fee.
 8) totalFils < MIN_CHARGE_FILS -> FormInputError "discountTooHigh" when a discount is present, else "totalTooLow". Not a safe integer -> throw.
export function manualOrderData(parsed, priced, extra: { customerId?: number; createdBy: number; salt: string; tokenHash: string; expiresAt: Date }) -> the exact orders.create payload: source MANUAL_SOURCE, salesChannel, locale, customerType registered|guest, customerEmail (or null), deliveryEmirate "abu-dhabi", items, subtotalFils, deliveryFeeFils, discountFils, couponCode/couponDiscountFils/couponDiscount/discountSnapshot (discounts spec fields, when present), manualDiscountFils + manualDiscountReason, totalFils, currency AED, paymentStatus "PENDING", fulfilmentStatus "NEW", createdBy, internalNotes, payTokenSalt, payTokenHash, payLinkExpiresAt.

2. DATA — NEW src/backend/data/manual-order.ts (session first via getAdminSession; reads as the user, overrideAccess false)
export async function getOrderBuilderData(): Promise<{ products: { id: string; name: string; priceFils: number; salePriceFils: number | null; thumbnailUrl: string | null; category: string }[]; sizes: { id: SizeId; name: string; deltaFils: number }[]; addons: { id: AddonId; name: string; priceFils: number }[]; slots: readonly string[]; todayDubai: string; isOwner: boolean; codesEnabled: boolean; paymentsConfigured: boolean } | null> — products: available = true, limit 500, depth 1 for the first image only. Prices are sent for DISPLAY; the server re-prices.
export async function getOrderPrefill(orderNumber: string): Promise<ManualOrderDraft | null> — for "Create a similar order" (/admin/orders/new?from=CAL-000123): copies customer, delivery address, gift fields and catalogue lines whose product still exists and is available; never copies prices, discount, date or payment.

3. ACTIONS — NEW src/backend/actions/manual-orders.ts ("use server"). Header comment documents THE THIRD overrideAccess EXCEPTION (after checkout.ts and quotes.ts): orders.create is owner-only by collection rule; staff may create a manual order because every price is computed on the server, the collection re-checks the shape (validateBespokeLines manual branch), and each one is named in the activity log. Reuse staffSession() by exporting it from a new non-"use server" module src/backend/actions/admin-auth-shared.ts, or copy the eight lines.

a) export async function searchOrderCustomers(query: string): Promise<{ name: string; phone: string; email: string | null; customerId: number | null; lastAddress: string | null; orders: number }[]>
 staff/owner only; query trimmed, 3..60 chars else []. Reads orders AS THE USER (overrideAccess false): where or [customerPhone like q-digits, customerName like q, customerEmail like q], sort -createdAt, limit 40, select customerName/customerPhone/customerEmail/customer/deliveryAddress; de-duplicated by phone, newest snapshot wins, max 8. Owner only: additionally users where role = customer and (phone/email/name like q), merged. Staff never read the users collection (unchanged rule).

b) export async function quoteManualOrder(draft: unknown): Promise<{ ok: true; quote: { lines: { lineTotalFils: number; unitPriceFils: number; wasUnitFils: number | null }[]; subtotalFils; discountFils; couponCode: string | null; deliveryFeeFils; totalFils } } | { ok: false; code: string; message: string; vars?: ActionVars }>
 staff/owner; parses with allowPastDays 60 and RELAXED required fields (only lines + discount are needed to quote: pass a `partial: true` flag to parseManualOrder that skips customer/delivery checks); loads products + discounts; priceManualOrder; creates nothing. This is the only source of the totals shown in the Summary card.

c) export async function createManualOrder(draft: unknown, payment: unknown, shownTotalFils: number): Promise<ActionResult>
 1. staffSession -> else actions.permission.
 2. Zod parse both; payment.mode === "offline" requires role admin -> else { ok:false, code:"actions.manualOrder.ownerOnly" }. reference trimmed 3..140 ("referenceRequired"); method in OFFLINE_PAYMENT_METHODS ("methodRequired"); alreadyDelivered only with offline.
 3. mode "link": getStripe() && cardPaymentsConfigured() else actions.quote.paymentsOff (never create an order nobody can pay).
 4. Duplicate-submit guard: new LIMITS.manualOrderOnce = { name: "manual-order-once", limit: 1, windowSeconds: minutes(10) } keyed `${user.id}:${requestId}` -> refused => { ok:false, code:"actions.manualOrder.duplicate" }. And LIMITS.manualOrder = { name: "manual-order", limit: 60, windowSeconds: hours(1) } keyed by user id.
 5. parseManualOrder(ctx.allowPastDays = offline ? 60 : 0).
 6. Products: payload.find products where available = true and id in ids, user, overrideAccess false; a missing one -> actions.manualOrder.productUnavailable.
 7. Discounts (only when the discounts feature exists — feature-detect by importing from @backend/data/discounts; until then `codesEnabled` is false and a code draft is refused): sales = getLiveSaleRules(); code -> findCoupon; once-per-customer codes need an email ("codeNeedsEmail") and use emailHasRedeemed; use the same live-claim counting/lock the discounts build ends up with (reviews.md blocker 1). Unknown/expired/exhausted -> the discounts messages.
 8. priced = priceManualOrder(...). priced.couponRefusal -> refuse. priced.totalFils !== shownTotalFils -> { ok:false, code:"actions.manualOrder.priceChanged" } and nothing is created (an assertion only; never used in arithmetic).
 9. Customer link: only when draft.customer.customerId was explicitly picked; verify a users row with that id and role customer exists (overrideAccess true, select id+role); otherwise guest. Never match by typed email.
 10. salt/token/hash as in quotes.ts; expiresAt = link ? payLinkExpiry(now) : now.
 11. payload.create orders, overrideAccess: true, data = manualOrderData(...).
 12. mode "link": if customerEmail -> sendEmail(buildPaymentRequestEmail({ order: quoteFactsFromOrder(order), payUrl, expiresAt, locale })). recordActivity { action:"create", area:"orders", itemLabel: orderNumber, summary: `Order ${n} created by hand (${channel}) — ${amount}, payment link ${sent ? "sent to " + email : "to be shared"}`, changes:[{ field:"totalFils", label:"amount", after: amount }, ...(manual discount ? [{ field:"manualDiscountFils", label:"discount", after: `${amount} — ${reason}` }] : [])] }. Return ok with code actions.manualOrder.created (vars number, email) or actions.manualOrder.createdCopyLink (vars number) when there is no email or the outcome is not "sent"; `id` = order.id. The client navigates to /admin/orders/{number}.
 13. mode "offline": result = await applyOfflinePayment(payload, { orderId, method, reference, actor: user, alreadyDelivered, now }). paid -> code actions.manualOrder.createdPaid (vars number, invoice). Anything else -> ok:true, code actions.manualOrder.createdNotPaid (the order exists unpaid; the owner presses "Record payment" on it).
 14. revalidatePath /admin/orders, /admin/orders/[orderNumber] (page), /admin.
 Wrapped in try/catch -> failure(error, "The order could not be created.", "actions.manualOrder.failed").

d) export async function recordOfflinePayment(orderId: number, form: FormData): Promise<ActionResult> — OWNER ONLY (role === "admin"), fields method, reference, alreadyDelivered. Calls applyOfflinePayment. Codes: actions.manualOrder.paymentRecorded (vars invoice), .notManual, .alreadyPaid, .cancelledOrder, actions.quote.paymentInProgress, .recordFailed.

4. THE OFFLINE PAID PATH — NEW src/backend/payments/offline-paid.ts (import "server-only"; NOT a "use server" file, so it is not a browser-callable endpoint)
export type OfflinePaidResult = { kind: "paid"; invoiceNumber: string } | { kind: "already-paid" } | { kind: "not-manual" } | { kind: "cancelled" } | { kind: "payment-in-progress" };
export async function applyOfflinePayment(payload: Payload, input: { orderId: number; method: OfflinePaymentMethod; reference: string; actor: { id: number; name?: string | null; email?: string | null; role?: string | null }; alreadyDelivered: boolean; now: Date }, deps: PaidDeps = DEFAULT_DEPS): Promise<OfflinePaidResult>
 THE ORDER OF THE STEPS IS THE SAFETY (mirror of cancelPaymentRequest):
 1. Load (overrideAccess true, depth 0). source !== MANUAL_SOURCE -> not-manual. isSettled -> already-paid. fulfilmentStatus CANCELLED -> cancelled. actor.role must be "admin" (re-checked here, not only in the action).
 2. KILL THE LINK FIRST: if payLinkExpiresAt > now, update { payLinkExpiresAt: now } (server-only field, overrideAccess true). From this instant startQuotePayment answers EXPIRED and its own re-read cancels any intent it had just minted.
 3. Re-read. If stripePaymentIntentId: stripe.paymentIntents.cancel(id); on refusal retrieve it — status succeeded/processing means the customer is paying by card RIGHT NOW: restore the previous payLinkExpiresAt and return payment-in-progress (the webhook will mark it paid by card; nothing is recorded by hand). Status canceled -> continue. If Stripe is not configured and an intent id exists -> payment-in-progress (cannot prove it dead).
 4. THE ONE WRITE: payload.update({ collection:"orders", id, overrideAccess: true, context: { [MANUAL_PAYMENT_CONTEXT]: true }, data: { paymentStatus: "PAID", paymentMethod: method, paymentReference: reference, paymentRecordedBy: actor.id, paymentRecordedByName: actor.name || actor.email, paidAt: now.toISOString(), fulfilmentStatus: alreadyDelivered ? "DELIVERED" : (order.fulfilmentStatus === "NEW" ? "CONFIRMED" : order.fulfilmentStatus) } }). No status email is sent for this move (same as a paid quote).
 5. redeemCoupon(payload, orderId) in its own try/catch when the discounts feature exists (the documented slot).
 6. claim = deps.claimInvoice(payload, { orderId, year: invoiceYear(now), vatRateBps: currentVatRateBps(), vatIncludedFils, paidAtIso }) — the SAME gap-free series, the same single-winner gate. A throw propagates to the action (the order is PAID without an invoice; pressing "Record payment" again returns already-paid, so ALSO add: when already-paid and invoiceNumber is empty and paymentMethod is offline, run steps 5–7 — the same self-healing the webhook has).
 7. Winner only (claim.claimedNow): emails (section 6) through sendAfterCommit, in try/catch; then recordActivity { action:"status", area:"orders", itemLabel: orderNumber, summary: `${orderNumber} recorded as PAID by hand — ${amount}, ${method}, ref "${reference}"`, changes: [{ field:"paymentStatus", label:"payment status", before:"PENDING", after:"PAID" }, { field:"paymentMethod", label:"payment method", after: method }, { field:"paymentReference", label:"payment reference", after: reference }] }. Add "paymentStatus" and "manualDiscountFils" to NOTABLE and paymentMethod / paymentReference / manualDiscountFils to LABELS in src/backend/activity/record.ts so the entry is highlighted on /admin/activity.
 paidAt and the invoice date are the moment of RECORDING, not the delivery date, even for a back-dated sale (a gap-free series is issued in order of issue).

5. CHANGES TO EXISTING PAYMENT CODE
- src/backend/payments/paid.ts: `isQuote` -> `isPayLink = isPayLinkSource(o.source)`; the mark-paid write adds `paymentMethod: "card"` (webhook context; guardPaymentRecord allows the first write); rename afterQuotePaid -> afterPayLinkPaid, export it, and make it take `{ paymentMethod, recordedByName?, reference?, alreadyDelivered? }`; the enquiry update already no-ops without an enquiry. OrderDoc gains paymentMethod, salesChannel, manualDiscountFils, customerEmail: string | null. PAID_AFTER_CANCEL_NOTE applies to manual orders too.
- src/backend/payments/verdict.ts: OrderFacts gains `paymentMethod?: string | null`. New rule placed immediately after `const settled = …`: if (settled && order.paymentMethod && order.paymentMethod !== "card") return { action: "flag", reason: `card payment ${intent.id} arrived for an order already recorded as paid by ${order.paymentMethod} — refund it in Stripe` }. Without this the existing rule would answer "already-paid" and swallow a double payment.
- src/backend/payments/intent.ts: IntentOrder.customerEmail: string | null; `...(order.customerEmail ? { receipt_email: order.customerEmail } : {})`.
- src/backend/data/pay.ts: findOrderByPayToken where source IN PAY_LINK_SOURCES. PayRequestView gains `lines: { name: string; detail?: string; quantity: number; lineTotalFils: number }[]`, subtotalFils, discountFils, deliveryFeeFils, `kind: "quote" | "order"`. Still an allow-list; never notes, reference, recorder, phone.
- src/backend/actions/pay.ts: no logic change (state machine already refuses expired/cancelled/paid).
- src/backend/actions/quotes.ts: loadQuoteOrder accepts isPayLinkSource; resendPaymentRequest with no customerEmail extends the link, skips the send and returns code actions.manualOrder.linkRenewed; cancelPaymentRequest works unchanged for a manual order (no enquiry). Activity summaries say "order" instead of "payment request" for manual ones.
- src/backend/actions/admin.ts updateOrderFulfilment: already delegates through isUnpaidQuote (now widened) to cancelPaymentRequest for CANCELLED and refuses other moves.
- src/backend/data/quote.ts getQuoteForOrder / summarise: accept isPayLinkSource; customerEmail nullable.
- src/backend/domain/dashboard.ts: isAwaitingQuote and isPaidQuoteToStart use PAY_LINK_ORDER_SOURCES; add `export function paidByMethod(orders): { cardFils: number; offlineFils: number }` (PAID/PARTIALLY_REFUNDED only; null method on a settled order counts as card). src/backend/data/dashboard.ts: REAL_ORDER_WHERE uses `source: { not_in: [...] }`; DashboardData gains paidSplit (blanked for staff like the other money).
- src/backend/data/admin-pulse.ts: SHOP_ORDERS / PAID_REQUESTS use the two sources, so a manual order rings the bell when it is PAID (either way), not when the owner creates it.

6. EMAILS (reuse src/backend/email/quote-emails.ts; no new EmailType)
- QuoteOrderFacts gains optional `lines?: { name: string; quantity: number; detail?: string }[]`, `deliveryFeeFils?`, `discountFils?`, `kind?: "quote" | "order"`, customerEmail: string | null. quoteFactsFromOrder fills them for a manual order (description stays items[0].productName for quotes).
- payment-request for kind "order": subject/heading/body from new COPY.request.order* keys; the facts table lists each line ("2 × Amber Hour — Deluxe, Vase") instead of "Arrangement"; the delivery row shows the fee when > 0 and "Complimentary" when 0; a Discount row when > 0.
- Paid (both modes): buildQuotePaidEmails sends (1) customer `payment-received` with the HTML invoice ONLY when customerEmail is set; the "Paid by …" line comes from invoice.paymentMethod (COPY.invoice.paidBy.{card|cash|bank-transfer|card-machine|other}); when alreadyDelivered the body is COPY.paid.bodyDelivered; (2) owner `owner-quote-paid`: subject `Paid: CAL-000123 — AED 650 (WhatsApp, cash)`; body line "Total AED 650 — paid by cash, recorded by Sara, ref "…". Invoice CAL-INV-2026-00042." or "… paid by card (Stripe)" for a link; (3) `florist-job-sheet` with every line (not sent when alreadyDelivered). All through sendAfterCommit, logged in email_log against the order, never inside a hook.
- src/backend/actions/emails.ts resendLoggedEmail: payment-received / owner-quote-paid for a manual order rebuild through the same builders; payment-request already delegates to resendPaymentRequest.
- Status emails (order-status) keep working for a manual order that has an email and are silently skipped when it has none (status-email.ts already returns on an empty address).

7. SECURITY SUMMARY
- Catalogue prices never come from the browser; custom prices and the manual discount are typed by authenticated staff/owner, parsed and bounded on the server, frozen by immutableAfterCreate.
- CARD: unchanged — only the signed webhook under PAYMENT_PROVIDER_CONTEXT. OFFLINE: only applyOfflinePayment under MANUAL_PAYMENT_CONTEXT, only owner, only source admin-manual, only PENDING -> PAID, only with method + reference + recorder; enforced three times (action role check, collection hook, database CHECK constraints). REST, GraphQL and /cms still cannot change paymentStatus (field access update: () => false) and can no longer create a PAID order.
- A recorded payment cannot be edited or re-attributed (guardPaymentRecord); the invoice number cannot change (guardInvoiceNumber).
- No new secrets or env vars.

## adminUx

Built only from src/admin/ui primitives; logical CSS only (rtl-guard.test.ts); every string through t()/label(); semantic admin tokens (page / surface / ink / line / accent / danger from (admin)/admin.css — which already map to the brand palette; no raw hex, Burnt Orange never as a fill); corners 2–4px; 44px targets; body text >= 16px in inputs (prevents iOS zoom); motion limited to the Dialog's existing transition. Designed at 390px first, then lg two-column. Checked in English and Arabic (RTL), light and dark.

NEW UI PRIMITIVES (src/admin/ui, because screens may not restyle inline): Stepper.tsx (− value +, 44px buttons, aria-live value), ChoiceCards.tsx (radio group rendered as full-width cards with title + hint; used for payment choice and payment method), Chips.tsx (single/multi select chips; used for channel, size, add-ons, time window). If the discounts build has already added a segmented control, reuse it instead of Chips for single-select.

ENTRY POINTS
- /admin/orders: PageHeader `actions` = primary ButtonLink "Create order" (icon plus) -> /admin/orders/new. On a phone it sits directly under the title, full width.
- /admin (dashboard) header: secondary ButtonLink "Create order".
- Order detail of a manual order: RowMenu item "Create a similar order" -> /admin/orders/new?from={orderNumber}.

SCREEN 1 — /admin/orders/new
Files: src/app/(admin)/admin/(panel)/orders/new/page.tsx (Server Component: getAdminSession, getOrderBuilderData(), optional getOrderPrefill(from); breadcrumbs Sales / Orders / Create order) and src/admin/components/OrderBuilder.tsx ("use client"). Layout: one column on a phone; from lg `grid lg:grid-cols-[minmax(0,1fr)_22rem]` with the Summary/Payment card sticky in the side column. On a phone a fixed bottom bar (padding-bottom max(env(safe-area-inset-bottom), 0.75rem)) shows "Total AED 650" at the start and the primary button "Take payment" at the end; the page has pb-28 so nothing hides under it. UnsavedChangesGuard is active once anything is typed. The draft is also kept in sessionStorage (key calanthe-admin-order-draft) so a phone call or an app switch on her iPhone does not lose it; cleared on success.

Cards, in the order she fills them:
0. Channel — Chips, single: WhatsApp (preselected) · Phone · Instagram · In person · Other.
1. Items — list of added lines (name, "Deluxe · Vase", "2 × AED 620", line total at the end, a 44px remove IconButton with aria-label "Remove {name}", Stepper for quantity inline). Empty: "Nothing added yet." Two buttons: "Add product" (primary on empty) and "Add custom item".
   Click path "Add product": Dialog variant "sheet" (full height on a phone) -> SearchInput autofocused, filtering the preloaded catalogue by name as she types (no request per keystroke) -> rows with 44px thumbnail, name, price ("AED 480", struck regular price when on offer) -> tap a row: the row expands in place with Size Chips ("Standard", "Deluxe +AED 140", "Premium +AED 320"), Add-on Chips (multi), Stepper -> sticky sheet footer "Add to order — AED 620" -> sheet closes, line appears, focus returns to "Add product".
   Click path "Add custom item": Dialog sheet -> Description (Input, 140) · Price (PrefixInput "AED", inputMode decimal) · Stepper -> "Add to order". Hint: "For something that is not in the catalogue. The customer sees this description."
   Line prices shown in the list are a local preview; the Summary numbers always come from quoteManualOrder.
2. Customer — SearchInput "Search by phone, name or email" (debounced 300ms, min 3 chars -> searchOrderCustomers). Results list "Previous customers": name, phone (dir=ltr), "3 orders"; tapping one fills name/phone/email, offers "Use last address" in the Delivery card, and — only if the result carries an account — shows a chip "Linked to the account of {name}" with "Remove link". Below: Name (required), Phone (required, inputMode tel, dir=ltr, hint "A UAE number like 050 123 4567 is fine."), Email (optional, inputMode email, hint "Used for the payment link and the invoice. Leave empty if you only use WhatsApp."), Customer's language (Select English / العربية; controls the email, the pay page and the WhatsApp sentence).
3. Delivery — Delivery date (type=date; min = today for "send link"; when the date is in the past an info Notice "This date is in the past. The order is saved as an earlier sale." and only "Paid outside the website" stays enabled), Time window (Chips from timeSlots, dir=ltr), Delivery address (Textarea; "Abu Dhabi only" as read-only text), Directions for the driver (optional). A collapsed "Gift details" section: Recipient name, Recipient phone, Card message (300, counter). "Note to the customer" (optional; shown in the email and on the pay page).
4. Discount — collapsed row "Add discount". Opens ChoiceCards: "No discount" · "Discount code" (Input uppercase, dir=ltr, monospaced + "Apply"; success line "{code} applied: −AED 65"; hint "Codes apply to catalogue products, not to custom items."; hidden entirely while codesEnabled is false) · "Amount off" (owner only: PrefixInput AED + Reason Input, hint "Saved on the order and in the activity log."; for staff the card is disabled with "Only the owner can take an amount off. You can apply a discount code.").
5. Internal note — collapsed Textarea, hint "Only the team sees this."
6. Summary (side column / last card on a phone) — per-line totals, Subtotal, Discount (with code), Delivery ("Free" when 0), Total in larger type. While a quote request is in flight the amounts dim and "Calculating…" is announced via aria-live=polite; a quote error (unknown code, product gone, total too low) shows inline in a role="alert" line and disables payment.

"Take payment" (bottom bar on a phone, button in the Summary card on desktop) opens Dialog sheet "Payment" with ChoiceCards:
 (a) "Send payment link" — hint "The customer pays by card, Apple Pay or Google Pay. The order becomes Paid by itself." When there is no email: info line "No email: you will get a link to paste into WhatsApp." Disabled with the reason when card payments are not configured.
 (b) "Paid outside the website" — hint "Cash, bank transfer or the card machine. You confirm that the money has been received." For staff: disabled, with "Only the owner can record a payment taken outside the website. Send a payment link instead, or ask the owner to record it on the order." When chosen it reveals: "How was it paid?" ChoiceCards (Cash · Bank transfer · Card machine · Other), "Reference or note" (required Input, hint "For example the transfer reference, the receipt number, or who took the cash."), Switch "Already handed over or delivered" (hint "For a sale you are recording afterwards. No delivery updates are emailed.").
 Footer (sticky, safe-area): "Cancel" and the primary — (a) "Create order and send link — AED 650"; (b) "Create order as paid — AED 650".
 (b) asks once more with ConfirmDialog (role alertdialog): title "Record AED 650 as received?", body "The order will be marked as paid (Cash) and an invoice number issued. The invoice is emailed to x@y. This cannot be undone." (or the no-email variant), confirm "Yes, payment received".
 While saving the dialog is not dismissible. Failure keeps everything typed and shows the translated reason inline (a PRICE_CHANGED refusal re-runs the quote so the new total is visible). Success: router.push(/admin/orders/{number}) with the toast from the action code.
Minimum taps for the common case (repeat customer, one product, link): Create order -> Add product -> tap product -> Add to order -> type phone -> tap the match -> date -> time chip -> Take payment -> Create order and send link. No field is asked twice.

SCREEN 2 — /admin/orders/[orderNumber] for a manual order (edit src/app/(admin)/admin/(panel)/orders/[orderNumber]/page.tsx)
- Header description "Placed 5 Oct, 14:02 · WhatsApp / manual"; a neutral Badge with the channel ("WhatsApp"); under the header "Created by {name}".
- UNPAID (state awaiting or expired): the existing Notice + <QuotePayment variant="notice"> (Copy payment link · Send on WhatsApp · Resend email / Send new link — the email buttons hidden when there is no email · Cancel request), text orders.detail.awaitingManual. For the OWNER a second primary button in the same notice: "Record payment" -> Dialog sheet "Record a payment taken outside the website" with the same method / reference / already-delivered fields and the same ConfirmDialog -> recordOfflinePayment. New client island src/admin/components/RecordPayment.tsx. OrderOps receives awaitingPayment=true (cancel only) — unchanged component.
- PAID BY LINK: as a paid quote today: "Invoice {number} · paid {date}" + "View invoice" (opens /pay/[token]).
- PAID OUTSIDE: Payment card shows Badge success "Paid" + a neutral Badge with the method ("Cash"), the line "Paid by Cash · recorded by Sara on 5 Oct, 14:05", "Reference: …" (staff-visible, never on the invoice), a muted line "This payment was recorded by hand. It did not go through the website.", the invoice line and "View invoice". The method badge and that sentence are what make it distinguishable at a glance, forever.
- Totals: a manual discount row reads "Discount (reason)"; a code row is unchanged.
- orders.detail.noManualPayment is reworded (see i18n) — the old sentence "Nobody can change a payment status by hand — not staff, and not the owner" would now be untrue. Same for the comment at the top of OrderOps.tsx and orders.ops.paymentUnaffected stays.
- getQuoteForOrder is now called when orderSourceKey is "quote" OR "manual".

SCREEN 3 — /admin/orders list (edit orders/page.tsx)
- orderSourceKey (src/admin/lib/status.ts) gains "manual", tested FIRST (/manual/), then quote, cod, checkout. The row's second line shows "Placed 5 Oct · WhatsApp / manual" for manual orders AND the item count.
- Payment cell: unpaid manual order -> the payRequest badge (Awaiting payment / Link expired), as quotes; paid -> "Paid" badge followed by a small muted method word when paymentMethodOf is not "card" ("Cash").
- New FilterSelect "Source": Website · Payment link · WhatsApp / manual (source equals / like). New FilterSelect "Paid by": Card · Cash · Bank transfer · Card machine · Other (paymentMethod equals; "Card" also matches settled orders with a null method).
- The existing attention filters awaiting-payment / link-expired / paid-to-start switch from `source equals admin-quote` to `source in PAY_LINK_SOURCES`, so manual orders appear in the same queues.
- Add `q` matching on couponCode is the discounts spec's; nothing else here.

SCREEN 4 — dashboard (src/app/(admin)/admin/(panel)/page.tsx): unpaid manual orders are excluded from revenue, new orders, today's deliveries and overdue exactly like unpaid quotes (same predicate). Under the revenue StatCard's "Paid" line add one muted line for the owner: "Card AED 4,200 · Outside the website AED 1,150". No new chart, no chart library (existing BarChart/StatusBar in src/admin/components/Charts.tsx untouched). Needs-attention rows for payment requests now count manual orders too; relabel them (i18n) from "payment requests" wording that implied enquiries only.

SCREEN 5 — bell (AdminPulse): a manual order appears as a "payment" item when it becomes paid, by link or by hand.

SCREEN 6 — /admin/activity (owner): "Order CAL-000131 created by hand (whatsapp) — AED 650, payment link sent to x@y" and, highlighted as notable, "CAL-000131 recorded as PAID by hand — AED 650, cash, ref "received by Sara"", each with the person's name.

CUSTOMER SIDE (/pay/[token], src/app/(frontend)/(storefront)/pay/[token]/page.tsx + PayRequestForm.tsx + PayInvoice.tsx) — load the calanthe-design skill before touching these: when view.kind is "order" the h1 uses pay.orderTitle, the summary card lists each line with its quantity and line total, Subtotal / Discount / Delivery rows, then Total; the paid state's invoice prints "Paid in cash on {date}" etc. from invoice.paymentMethod. Layout, tokens, motion and the Stripe sequence are unchanged; verify at 390px in EN and AR and re-run Lighthouse mobile (>= 90).

ROLES: owner — everything. Staff — create an order, send/resend/copy/cancel the link, apply a code; cannot record an offline payment, cannot take an amount off. Customers never reach /admin.

## i18n

A. ADMIN — C:\dev\calanthe\src\admin\i18n\en.ts and ar.ts (ar is typed against en; Arabic follows the file's existing neutral singular imperative). Reuse existing keys where they exist: enquiries.quote.{deliveryDate,timeSlot,chooseSlot,address,emirate,gift,recipientName,recipientPhone,cardMessage,note,noteHint,copy,copied,whatsapp,resend,newLink,cancel,cancelTitle,cancelBody,viewInvoice}, orders.detail.{subtotal,deliveryFee,free,discount,discountWithCode,total}, actions.validation.{emailFormat,phoneFormat,deliveryDateRequired,deliveryDatePast,slotRequired,addressRequired}, actions.quote.{paymentsOff,paymentInProgress}.

orders.create: "Create order" | "إنشاء طلب"
orders.new.title: "Create order" | "إنشاء طلب"
orders.new.description: "For a sale taken on WhatsApp, by phone or in person." | "لبيع تم عبر واتساب أو الهاتف أو حضوريًا."
orders.new.channel: "Where did this order come from?" | "من أين جاء هذا الطلب؟"
orders.new.items: "Items" | "البنود"
orders.new.addProduct: "Add product" | "إضافة منتج"
orders.new.addCustom: "Add custom item" | "إضافة بند خاص"
orders.new.searchProducts: "Search products" | "ابحث في المنتجات"
orders.new.noProducts: "No product matches." | "لا يوجد منتج مطابق."
orders.new.size: "Size" | "الحجم"
orders.new.addons: "Add-ons" | "الإضافات"
orders.new.quantity: "Quantity" | "الكمية"
orders.new.decrease: "One fewer" | "إنقاص واحد"
orders.new.increase: "One more" | "زيادة واحد"
orders.new.addToOrder: "Add to order — {amount}" | "إضافة إلى الطلب — {amount}"
orders.new.customDescription: "Description" | "الوصف"
orders.new.customPrice: "Price" | "السعر"
orders.new.customHint: "For something that is not in the catalogue. The customer sees this description." | "لشيء غير موجود في قائمة المنتجات. يرى العميل هذا الوصف."
orders.new.customBadge: "Custom" | "خاص"
orders.new.removeItem: "Remove {name}" | "إزالة {name}"
orders.new.emptyItems: "Nothing added yet." | "لم يُضَف شيء بعد."
orders.new.customer: "Customer" | "العميل"
orders.new.customerSearch: "Search by phone, name or email" | "ابحث بالهاتف أو الاسم أو البريد الإلكتروني"
orders.new.previousCustomers: "Previous customers" | "عملاء سابقون"
orders.new.customerOrders: { one: "{count} order", other: "{count} orders" } | { zero: "لا طلبات", one: "طلب واحد", two: "طلبان", few: "{count} طلبات", many: "{count} طلبًا", other: "{count} طلب" }
orders.new.noCustomerMatch: "No previous customer matches. Type the details below." | "لا يوجد عميل سابق مطابق. اكتب البيانات أدناه."
orders.new.name: "Name" | "الاسم"
orders.new.phone: "Phone" | "الهاتف"
orders.new.phoneHint: "A UAE number like 050 123 4567 is fine." | "يكفي رقم إماراتي مثل ‎050 123 4567."
orders.new.email: "Email (optional)" | "البريد الإلكتروني (اختياري)"
orders.new.emailHint: "Used for the payment link and the invoice. Leave empty if you only use WhatsApp." | "يُستخدم لإرسال رابط الدفع والفاتورة. اتركه فارغًا إذا كان التواصل عبر واتساب فقط."
orders.new.linkedAccount: "Linked to the account of {name}" | "مرتبط بحساب {name}"
orders.new.unlink: "Remove link" | "إزالة الربط"
orders.new.language: "Customer's language" | "لغة العميل"
orders.new.delivery: "Delivery" | "التوصيل"
orders.new.useLastAddress: "Use last address" | "استخدام آخر عنوان"
orders.new.deliveryNotes: "Directions for the driver" | "إرشادات للسائق"
orders.new.pastDate: "This date is in the past. The order is saved as an earlier sale." | "هذا التاريخ في الماضي. سيُحفظ الطلب كبيع سابق."
orders.new.discount: "Discount" | "الخصم"
orders.new.addDiscount: "Add discount" | "إضافة خصم"
orders.new.discountNone: "No discount" | "بدون خصم"
orders.new.discountCode: "Discount code" | "رمز الخصم"
orders.new.apply: "Apply" | "تطبيق"
orders.new.codeApplied: "{code} applied: −{amount}" | "طُبّق {code}: −{amount}"
orders.new.codeNotOnCustom: "Codes apply to catalogue products, not to custom items." | "تنطبق الرموز على منتجات القائمة، لا على البنود الخاصة."
orders.new.discountManual: "Amount off" | "خصم مبلغ"
orders.new.manualReason: "Reason" | "السبب"
orders.new.manualReasonHint: "Saved on the order and in the activity log." | "يُحفظ في الطلب وفي سجل النشاط."
orders.new.manualOwnerOnly: "Only the owner can take an amount off. You can apply a discount code." | "خصم مبلغ من الطلب متاح للمالك فقط. يمكنك تطبيق رمز خصم."
orders.new.internalNote: "Internal note" | "ملاحظة داخلية"
orders.new.internalNoteHint: "Only the team sees this." | "لا يراها إلا الفريق."
orders.new.summary: "Summary" | "الملخّص"
orders.new.calculating: "Calculating…" | "جارٍ الحساب…"
orders.new.takePayment: "Take payment" | "تحصيل الدفع"
orders.new.payment: "Payment" | "الدفع"
orders.new.payLink: "Send payment link" | "إرسال رابط الدفع"
orders.new.payLinkHint: "The customer pays by card, Apple Pay or Google Pay. The order becomes Paid by itself." | "يدفع العميل بالبطاقة أو Apple Pay أو Google Pay، ويصبح الطلب مدفوعًا تلقائيًا."
orders.new.payLinkNoEmail: "No email: you will get a link to paste into WhatsApp." | "لا يوجد بريد إلكتروني: ستحصل على رابط تلصقه في واتساب."
orders.new.paidOutside: "Paid outside the website" | "دُفع خارج الموقع"
orders.new.paidOutsideHint: "Cash, bank transfer or the card machine. You confirm that the money has been received." | "نقدًا أو بتحويل بنكي أو عبر جهاز البطاقات. أنت تؤكّد أن المبلغ استُلم."
orders.new.paidOutsideOwnerOnly: "Only the owner can record a payment taken outside the website. Send a payment link instead, or ask the owner to record it on the order." | "تسجيل دفعة خارج الموقع متاح للمالك فقط. أرسل رابط دفع، أو اطلب من المالك تسجيلها في الطلب."
orders.new.method: "How was it paid?" | "كيف تم الدفع؟"
orders.new.reference: "Reference or note" | "المرجع أو ملاحظة"
orders.new.referenceHint: "For example the transfer reference, the receipt number, or who took the cash." | "مثل رقم التحويل أو رقم الإيصال أو اسم من استلم النقد."
orders.new.alreadyDelivered: "Already handed over or delivered" | "سُلّم الطلب بالفعل"
orders.new.alreadyDeliveredHint: "For a sale you are recording afterwards. No delivery updates are emailed." | "لبيع تسجّله بعد إتمامه. لن تُرسل تحديثات التوصيل بالبريد."
orders.new.submitLink: "Create order and send link — {amount}" | "إنشاء الطلب وإرسال الرابط — {amount}"
orders.new.submitPaid: "Create order as paid — {amount}" | "إنشاء الطلب كمدفوع — {amount}"
orders.new.confirmPaidTitle: "Record {amount} as received?" | "تسجيل استلام {amount}؟"
orders.new.confirmPaidBodyEmail: "The order will be marked as paid ({method}) and an invoice number issued. The invoice is emailed to {email}. This cannot be undone." | "سيُسجَّل الطلب كمدفوع ({method}) ويصدر له رقم فاتورة. تُرسل الفاتورة إلى {email}. لا يمكن التراجع عن ذلك."
orders.new.confirmPaidBodyNoEmail: "The order will be marked as paid ({method}) and an invoice number issued. No email is sent to the customer. This cannot be undone." | "سيُسجَّل الطلب كمدفوع ({method}) ويصدر له رقم فاتورة. لن تُرسل رسالة إلى العميل. لا يمكن التراجع عن ذلك."
orders.new.confirmPaidConfirm: "Yes, payment received" | "نعم، استُلم المبلغ"
orders.filters.source: "Source" | "المصدر"
orders.filters.method: "Paid by" | "طريقة الدفع"
orders.detail.createdBy: "Created by {name}" | "أنشأه {name}"
orders.detail.awaitingManual: "Awaiting payment. This order cannot be prepared until it is paid." | "بانتظار الدفع. لا يمكن تحضير الطلب قبل الدفع."
orders.detail.recordPayment: "Record payment" | "تسجيل الدفع"
orders.detail.recordPaymentTitle: "Record a payment taken outside the website" | "تسجيل دفعة خارج الموقع"
orders.detail.paidOutsideLine: "Paid by {method} · recorded by {name} on {date}" | "مدفوع ({method}) · سجّله {name} بتاريخ {date}"
orders.detail.paymentReference: "Reference: {reference}" | "المرجع: {reference}"
orders.detail.manualPaymentNote: "This payment was recorded by hand. It did not go through the website." | "سُجّلت هذه الدفعة يدويًا ولم تمر عبر الموقع."
orders.detail.manualDiscount: "Discount ({reason})" | "خصم ({reason})"
orders.detail.noEmail: "No email address" | "لا يوجد بريد إلكتروني"
orders.detail.similar: "Create a similar order" | "إنشاء طلب مشابه"
orders.detail.noManualPayment (CHANGED TEXT): "A card payment can never be marked as paid by hand. Only an order created in the admin can be recorded as paid outside the website, and only by the owner." | "لا يمكن تسجيل دفعة بالبطاقة يدويًا. الطلب المُنشأ من لوحة الإدارة وحده يمكن تسجيله كمدفوع خارج الموقع، وذلك للمالك فقط."
dashboard.kpi.paidSplit: "Card {card} · Outside the website {offline}" | "بالبطاقة {card} · خارج الموقع {offline}"
labels.source.manual: "WhatsApp / manual" | "واتساب / يدوي"
labels.salesChannel: whatsapp "WhatsApp" | "واتساب"; phone "Phone" | "الهاتف"; instagram "Instagram" | "إنستغرام"; "in-person" "In person" | "حضوريًا"; other "Other" | "أخرى"
labels.paymentMethod: card "Card" | "بطاقة"; cash "Cash" | "نقدًا"; "bank-transfer" "Bank transfer" | "تحويل بنكي"; "card-machine" "Card machine" | "جهاز البطاقات"; other "Other" | "أخرى"
labels.emailType["owner-quote-paid"] (CHANGED TEXT): "Owner — payment received" | "المالك — استلام دفعة"
labels.activityField.paymentMethod: "payment method" | "طريقة الدفع"; .paymentReference: "payment reference" | "مرجع الدفع"; .manualDiscountFils: "discount" | "الخصم"
Add `salesChannel` and `paymentMethod` to LabelGroup (src/admin/i18n/translate.ts) and, if tones are wanted, to TONES in src/admin/lib/status.ts (all neutral).
actions.manualOrder.created: "Order {number} created. Payment link sent to {email}." | "أُنشئ الطلب {number} وأُرسل رابط الدفع إلى {email}."
actions.manualOrder.createdCopyLink: "Order {number} created. Copy the payment link and send it on WhatsApp." | "أُنشئ الطلب {number}. انسخ رابط الدفع وأرسله عبر واتساب."
actions.manualOrder.createdPaid: "Order {number} created and recorded as paid. Invoice {invoice}." | "أُنشئ الطلب {number} وسُجّل كمدفوع. الفاتورة {invoice}."
actions.manualOrder.createdNotPaid: "Order {number} was created, but the payment could not be recorded. Open the order and press Record payment." | "أُنشئ الطلب {number} لكن تعذّر تسجيل الدفعة. افتح الطلب واضغط «تسجيل الدفع»."
actions.manualOrder.paymentRecorded: "Payment recorded. Invoice {invoice}." | "سُجّلت الدفعة. الفاتورة {invoice}."
actions.manualOrder.linkRenewed: "The link is valid again. Copy it and send it on WhatsApp." | "أصبح الرابط صالحًا من جديد. انسخه وأرسله عبر واتساب."
actions.manualOrder.ownerOnly: "Only the owner can record a payment taken outside the website." | "تسجيل دفعة خارج الموقع متاح للمالك فقط."
actions.manualOrder.notManual: "Only an order created in the admin can be recorded as paid by hand." | "لا يُسجَّل الدفع يدويًا إلا لطلب أُنشئ من لوحة الإدارة."
actions.manualOrder.alreadyPaid: "This order is already paid." | "هذا الطلب مدفوع بالفعل."
actions.manualOrder.cancelledOrder: "This order is cancelled." | "هذا الطلب ملغى."
actions.manualOrder.priceChanged: "A price changed while you were working. Check the new total and try again." | "تغيّر أحد الأسعار أثناء العمل. راجع الإجمالي الجديد وحاول مجددًا."
actions.manualOrder.productUnavailable: "One of the products is no longer available. Remove it and try again." | "أحد المنتجات لم يعد متاحًا. أزله وحاول مجددًا."
actions.manualOrder.duplicate: "This order was already created. Check the orders list." | "أُنشئ هذا الطلب بالفعل. راجع قائمة الطلبات."
actions.manualOrder.failed: "The order could not be created." | "تعذّر إنشاء الطلب."
actions.manualOrder.recordFailed: "The payment could not be recorded." | "تعذّر تسجيل الدفعة."
actions.validation.itemsRequired: "Add at least one item." | "أضف بندًا واحدًا على الأقل."
actions.validation.tooManyItems: "An order can have up to 30 lines." | "يمكن أن يضم الطلب 30 بندًا على الأكثر."
actions.validation.customDescriptionRequired: "Describe the custom item." | "اكتب وصف البند الخاص."
actions.validation.customPriceRequired: "Enter the price of the custom item in dirhams." | "أدخل سعر البند الخاص بالدرهم."
actions.validation.nameRequired: "Enter the customer's name." | "أدخل اسم العميل."
actions.validation.methodRequired: "Choose how it was paid." | "اختر طريقة الدفع."
actions.validation.referenceRequired: "Enter a reference or a short note for this payment." | "أدخل مرجعًا أو ملاحظة قصيرة لهذه الدفعة."
actions.validation.discountReasonRequired: "Say why the discount is given." | "اذكر سبب الخصم."
actions.validation.discountOwnerOnly: "Only the owner can take an amount off an order." | "خصم مبلغ من الطلب متاح للمالك فقط."
actions.validation.discountTooHigh: "The discount leaves less than AED 2 to pay." | "الخصم يُبقي أقل من AED 2 للدفع."
actions.validation.totalTooLow: "The total must be at least AED 2." | "يجب ألا يقل الإجمالي عن AED 2."
actions.validation.deliveryDateTooOld: "The delivery date is more than 60 days ago." | "تاريخ التوصيل أقدم من 60 يومًا."
actions.validation.codeNeedsEmail: "This code can be used once per customer. Enter the customer's email to use it." | "هذا الرمز يُستخدم مرة واحدة لكل عميل. أدخل بريد العميل لاستخدامه."
Reword (payment requests now include manual orders): dashboard.attention.quotesAwaiting / quotesExpired / quotesPaid and orders.filters.awaitingPayment / linkExpired / paidToStart — keep the keys; change "payment request(s)" to "order(s) awaiting payment by link" / "paid orders to start" in both languages after reading the current strings.

B. STOREFRONT — C:\dev\calanthe\src\lib\i18n\dictionary.ts (en and ar; Arabic addresses everyone in the plural; no "same day", no طازج)
pay.orderTitle: "Your order is confirmed." | "تم تأكيد طلبكم."
pay.orderIntro: "Please check the details below and pay securely to complete your order." | "يُرجى مراجعة التفاصيل أدناه والدفع بأمان لإتمام طلبكم."
pay.items: "Your order" | "طلبكم"
pay.discount: "Discount" | "الخصم"
pay.deliveryFee: "Delivery" | "رسوم التوصيل"
pay.whatsappMessageOrder: "Your Calanthe order is ready. Pay securely here: {url}" | "طلبكم من كالانثي جاهز. ادفعوا بأمان من هنا: {url}"
pay.invoice.paidByCash: "Paid in cash on {date}" | "مدفوعة نقدًا بتاريخ {date}"
pay.invoice.paidByTransfer: "Paid by bank transfer on {date}" | "مدفوعة بتحويل بنكي بتاريخ {date}"
pay.invoice.paidOther: "Paid on {date}" | "مدفوعة بتاريخ {date}"
(card and card-machine both use the existing pay.invoice.paidByCard.)

C. EMAIL COPY — C:\dev\calanthe\src\backend\email\quote-emails.ts COPY (en + ar, `satisfies` keeps them in step)
request.orderSubject: "Your Calanthe order — {amount} to pay" | "طلبكم من كالانثي — المبلغ المطلوب {amount}"
request.orderHeading: "Your order is ready to pay" | "طلبكم جاهز للدفع"
request.orderBody: "Thank you for your order. Please complete the payment to confirm it." | "شكرًا لطلبكم. يُرجى إتمام الدفع لتأكيده."
facts.items: "Items" | "المنتجات"
facts.discount: "Discount" | "الخصم"
paid.bodyDelivered: "Thank you for your order. Your invoice is below." | "شكرًا لطلبكم. تجدون الفاتورة أدناه."
invoice.paidByCash / paidByTransfer / paidOther: same sentences as the dictionary keys above; paidByCard unchanged.
The dictionary and email parity tests (dictionary.test.ts, quote-emails.test.ts) must stay green.

## tests

Vitest (`pnpm test`); pure modules get exhaustive tests, hooks and the paid path use the existing fake-payload pattern (paid.test.ts, orderIntegrity.test.ts). Then `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

1. NEW src/backend/domain/manual-order.test.ts (money rules)
- priceManualOrder, catalogue only: totals equal priceOrder's for the same lines (parity test — one product x2 Deluxe + Vase).
- custom only: 2 x "Ceramic vase" at AED 75.50 -> unit 7550, line 15100, subtotal = total = 15100; no priceOrder call.
- mixed: lines come back in the order entered; subtotal = catalogue + custom; lineTotal = unit x qty for every line (property test over quantities 1..20).
- manual discount: owner, AED 50 off 650 -> discount 5000, total 60000; staff -> FormInputError code discountOwnerOnly; discount leaving 199 fils -> discountTooHigh; leaving exactly 200 -> allowed; reason shorter than 3 chars -> discountReasonRequired; code + manual together -> refused.
- code discount (with a fake OrderDiscounts): applies to catalogue subtotal only — custom lines excluded from the percentage and from the minimum spend; refused code surfaces couponRefusal.
- delivery fee recomputed on (subtotal − discount) with a zone fee stubbed > 0 and the free threshold on both sides.
- total < MIN_CHARGE_FILS with no discount -> totalTooLow. Unsafe integers throw.
- parseManualOrder: "050 123 4567" -> +971501234567; bad phone -> phoneFormat; empty email accepted, "a@b" rejected; "12,50" price rejected, "1,250" accepted as 125000; description with newline collapsed to one line; quantity 0 / 21 / 1.5 rejected; 0 lines -> itemsRequired; 31 lines -> tooManyItems; 2026-02-31 rejected; yesterday rejected with allowPastDays 0 and accepted with 60; 61 days ago -> deliveryDateTooOld; slot not in list -> slotRequired.
- manualOrderData: output passes validateOrderTotals + validateBespokeLines (run the real hooks on it); paymentStatus is PENDING; customerEmail null when empty; discountFils === couponDiscountFils + manualDiscountFils.

2. src/backend/payload/hooks/orderIntegrity.test.ts (extend)
- guardPaymentStatus: create with PAID -> 403 for any context; create PENDING passes. Update PENDING->PAID with no context -> 403 (unchanged). Provider context -> passes (unchanged). Manual context: passes only with source admin-manual + PENDING + offline method + reference >= 3 + recorder name; each of these removed one at a time -> 403: source web-checkout-card, source admin-quote, method "card", method missing, reference "ab", recorder missing, original CANCELLED, original already PAID with a different target (PAID->REFUNDED).
- guardPaymentRecord: changing paymentMethod / paymentReference / recorder once set -> 403; first write allowed; paymentMethod without either context -> 403.
- validateBespokeLines manual branch: mixed product + custom lines pass; custom line with a product id -> 400; product line with BESPOKE_SLUG -> 400; enquiry set -> 400; missing createdBy / salesChannel / payTokenHash -> 400; total 199 -> 400; 31 lines -> 400. Web checkout order with a product-less line still -> 400 (not loosened). Quote branch tests unchanged.
- validateOrderTotals: manualDiscountFils > 0 on a non-manual source -> 400; without reason -> 400; discountFils !== coupon + manual -> 400.
- guardUnpaidQuoteFulfilment: unpaid admin-manual NEW->CONFIRMED refused, ->CANCELLED allowed, CANCELLED->NEW refused; paid manual moves freely.

3. NEW src/backend/payments/offline-paid.test.ts
- happy path: writes PAID with method/reference/recorder under MANUAL_PAYMENT_CONTEXT, calls claimInvoice once, returns the invoice number, queues customer + owner + florist emails, records a notable activity entry.
- no customer email -> no customer email queued; owner + florist still sent.
- alreadyDelivered -> fulfilment DELIVERED, no florist sheet.
- not-manual (web order, quote order), already-paid, cancelled -> no write at all.
- actor role staff -> refused before any write.
- link neutralised BEFORE the paid write: payLinkExpiresAt write precedes everything (assert call order).
- stored intent: cancel succeeds -> continues; Stripe refuses and the intent is succeeded/processing -> expiry restored, result payment-in-progress, paymentStatus untouched; intent already canceled -> continues.
- claimedNow false (double press) -> no emails, no second activity entry.
- crash recovery: order PAID offline with no invoiceNumber -> a second call issues the invoice and sends emails once.

4. src/backend/payments/verdict.test.ts: settled + paymentMethod "cash" + succeeded intent -> flag with "refund"; settled + paymentMethod "card" or null + same intent -> already-paid (unchanged).
5. src/backend/payments/paid.test.ts: admin-manual order paid by webhook -> paymentMethod "card" in the PAID write, NEW -> CONFIRMED, bilingual pay-link emails with every line, no enquiry update attempted; a web-checkout order still takes the buildOrderEmails branch (regression).
6. src/backend/payments/intent.test.ts: no customerEmail -> create params contain no receipt_email.
7. src/backend/payments/pay-link.test.ts: isPayLinkSource; isUnpaidQuote true for unpaid admin-manual; paymentMethodOf (stored value, null+PAID -> card, null+PENDING -> null); constants equal to the dashboard's copies.
8. src/backend/domain/invoice.test.ts: buildInvoice for a manual order with a manual discount reconciles (lines + delivery − discount === total) and carries paymentMethod; billTo.email null allowed; a mismatch still throws.
9. src/backend/domain/dashboard.test.ts: unpaid admin-manual excluded from summariseOrders revenue, dailySeries, topProducts, newOrders, isOverdue; paid admin-manual counted; paidByMethod splits card vs offline and treats legacy null as card; quoteQueue counts manual orders.
10. src/backend/data/admin-pulse.test.ts: a manual order never appears as an "order" item at creation and appears as a "payment" item at paidAt.
11. src/backend/email/quote-emails.test.ts: payment-request for kind "order" lists all lines, escapes a `<script>` description, strips CR/LF from the subject; invoice text says "Paid in cash" / "مدفوعة نقدًا" for cash; AED amounts use formatFils (650.50 never 650.5); no email built when customerEmail is null.
12. src/backend/security/throttle.test.ts: manualOrderOnce refuses the second call with the same key.
13. src/admin/rtl-guard.test.ts passes with the new components; src/lib/i18n/dictionary.test.ts and the admin en/ar type check pass.
14. Scripts: update scripts/qa-fixtures.mts (create PENDING, then PAID under provider context); scripts/cod-security-test.mts and scripts/orders-permission-test.mts keep asserting that REST cannot set PAID — add: REST PATCH with paymentMethod is stripped; REST POST /api/orders with paymentStatus PAID as owner is refused.

MANUAL CHECKLIST (dev database, Stripe test mode + Stripe CLI), at 390px in EN and AR, light and dark:
- Create with link + email: email arrives, link pays with Apple Pay/Google Pay/card, order turns Paid, invoice number allocated, three emails, bell rings.
- Create with link, no email: toast says copy link; Copy and Send on WhatsApp work; pay page shows all lines.
- Create paid outside (owner): confirm dialog, order Paid · Cash, invoice in sequence with the card ones (no gap, no duplicate), invoice page says "Paid in cash".
- Staff: option (b) and "Amount off" disabled with reasons; calling the actions directly (devtools) is refused.
- Record payment later on an unpaid manual order while the pay page is open in another tab: the tab can no longer pay.
- Start paying by card (leave 3-D Secure pending) then press Record payment: refused with "payment in progress".
- Cancel an unpaid manual order; the link says cancelled; "Create a similar order" prefills.
- Website checkout end to end is unchanged; Lighthouse mobile >= 90 on /pay/[token].

## edgeCases

1. Customer has no email. Allowed for manual orders only (collection validate + nullable column). No payment email, no status emails, no Stripe receipt; the link is shared by Copy / Send on WhatsApp; the invoice is viewed at the same link. The UI says so before she presses.
2. Email typed wrongly. customerEmail is immutable after creation: cancel the unpaid order and use "Create a similar order". For a paid-outside order the invoice link can still be sent on WhatsApp.
3. Paid by card while the owner is recording cash (race). applyOfflinePayment expires the link first, then cancels the Stripe intent; if Stripe says the intent is processing/succeeded nothing is recorded by hand and the webhook marks it paid by card. If a card payment still lands on an order recorded as paid by hand (e.g. Stripe unreachable at the time), paymentVerdict FLAGS it ("⚠ PAYMENT CHECK … refund it in Stripe") instead of answering already-paid.
4. Double press / two tabs. useAction's saving state + non-dismissible dialog; server: manualOrderOnce throttle on requestId for creation; for recording, the second call sees PAID -> already-paid; claimInvoice is the single-winner gate so emails go once; guardPaymentRecord stops the second press overwriting the method.
5. Crash between PAID and the invoice (offline). Pressing "Record payment" again finds PAID-without-invoice with an offline method and finishes steps 5–7. The order page shows "Record payment" for exactly that state too.
6. Price or sale changed between quote and create. shownTotalFils assertion -> priceChanged, nothing created, quote re-run.
7. Product hidden/deleted while she builds the order. productUnavailable; the line is highlighted. An existing order is unaffected (snapshot).
8. Recording an earlier sale. Delivery date up to 60 days back, only with "Paid outside"; "Already handed over" sets DELIVERED so it never shows as new, today's delivery or overdue. Invoice date = the day it is recorded (the series stays gap-free and in order). Dashboard daily revenue buckets it on createdAt (the day it was entered), not the delivery day — stated in docs.
9. Unpaid manual order past its delivery date or with an expired link. Not revenue, not overdue, not on today's list (same predicate as quotes); it appears under "Link expired" until cancelled or re-sent.
10. Cancelling. Unpaid: "Cancel request" (cancelPaymentRequest: CANCELLED first, then the Stripe intent, revert if the customer is paying). Paid outside: the normal "Cancel order" fulfilment move; payment stays PAID and the invoice stays issued — the money is returned outside the system and noted in internal notes. There is no "mark refunded" button and no credit note in v1 (open question).
11. A cancelled order cannot be reopened (collection hook). Use "Create a similar order".
12. Wrong amount or wrong method recorded. Cannot be edited (by design: accounting record). Procedure: add an internal note; if the amount is wrong, cancel the order and create a correct one — the first invoice number remains used (never reused, never deleted). Documented in docs/ADMIN.md.
13. Discount codes. Only catalogue lines are discounted; once-per-customer codes need an email; usage is counted when the order becomes PAID (link or hand) via the same redeemCoupon slot; a code that expires before a link is paid follows the discounts feature's stale-order rule. A manual discount and a code never combine. A payment request from an enquiry (admin-quote) still accepts no discount at all.
14. Staff set custom prices. Allowed (they can already send any amount by payment request); every creation is in the activity log with the amount; a custom price is bounded 1 AED .. MAX_PRICE_AED. Staff cannot reduce a catalogue price except with a valid code.
15. Linking to an account. Only when a search result carrying an account id is explicitly chosen; never by matching a typed email. The linked customer then sees the order in their account; custom lines do not link to /product (BESPOKE_SLUG guard). A staff member never reads the users collection.
16. Gift orders. Recipient emails/job sheets carry no price (existing RecipientFacing types); the payment reference and recorder are staff-read only and never appear on the invoice or pay page.
17. PAYLOAD_SECRET rotated. Old links (including invoice links of hand-paid orders) stop resolving until "Send new link" is pressed, which re-hashes; for a paid order add the same re-hash on "View invoice" in getQuoteForOrder (compute, compare, write hash if different).
18. Card payments not configured. "Send payment link" disabled with the reason; "Paid outside" still works for the owner.
19. Old code against the new schema, and new code before the migration. Migration is additive and the three CHECKs pass for old writes; new code selects the new columns, so migrate production FIRST.
20. Website checkout is not affected: it never sets source admin-manual, always sends an email, creates PENDING (so the new create rule passes), and its paid path gains only `paymentMethod: "card"`. /cms: the owner still cannot change paymentStatus there and can no longer create a PAID order.
21. Customer's own REST read of their order shows paymentMethod (fine) but not paymentReference, recorder, createdBy, salesChannel or the discount reason (field read: isStaffField).
22. Arabic. Phone numbers, order numbers, time windows, codes and AED amounts are wrapped dir="ltr"; chips and steppers mirror; the WhatsApp sentence is sent in the CUSTOMER's language, not the admin's.
23. Free or zero-total orders (a gift from the owner) are refused in v1 (total must be >= AED 2).
24. Dashboard "top products": custom lines group by their typed description; a note in the UI is not needed, but identical items typed differently appear as separate rows.

## buildOrder

1. 0. Preconditions: quote-pay is in the tree and its migration applied to the dev database. Decide the open questions (at least 1, 2 and 3). Do not start step 3 while another branch has an ungenerated migration: migrations are created strictly one after another on one branch (discounts first if it is ready, otherwise this one first and discounts re-generates after).
2. 1. Constants and pure helpers, no behaviour change: MANUAL_SOURCE, PAY_LINK_SOURCES, isPayLinkSource, payment method / sales channel constants and paymentMethodOf in src/backend/payments/pay-link.ts; mirrored constants in src/backend/domain/dashboard.ts; tests in pay-link.test.ts. Commit: feat(orders): manual order constants.
3. 2. Pure domain src/backend/domain/manual-order.ts (Zod shape schema, parseManualOrder, priceManualOrder, manualOrderData) with manual-order.test.ts written first. Code discounts are wired through the optional OrderDiscounts parameter and stay unused until the discounts feature exists.
4. 3. Schema: Orders.ts fields (paymentMethod, paymentReference, paymentRecordedBy, paymentRecordedByName, createdBy, salesChannel, manualDiscountFils, manualDiscountReason; customerEmail optional with validate) -> `pnpm migrate:create manual_orders` -> hand-add the three CHECK constraints and the guarded `down` -> register in src/migrations/index.ts -> `pnpm generate:types` -> apply to the DEV database only.
5. 4. Hooks in src/backend/payload/hooks/orderIntegrity.ts: MANUAL_PAYMENT_CONTEXT, guardPaymentStatus (create rule + manual branch), guardPaymentRecord, validateBespokeLines manual branch, validateOrderTotals manual-discount rule, guardUnpaidQuoteFulfilment widened; extend orderIntegrity.test.ts; fix scripts/qa-fixtures.mts.
6. 5. Fix the customerEmail-nullable type ripple (intent.ts, paid.ts, invoice.ts, quote-emails.ts, order-emails.ts, emails.ts, quotes.ts, data/quote.ts, quote-card.ts, QuotePayment.tsx, both admin order pages, PayInvoice.tsx) until `pnpm typecheck` is clean; intent.test.ts for the missing receipt_email.
7. 6. Payment core: verdict.ts offline-paid flag rule + tests; paid.ts (isPayLink, paymentMethod 'card', exported afterPayLinkPaid) + tests; InvoiceView.paymentMethod + invoice tests; NEW src/backend/payments/offline-paid.ts (applyOfflinePayment) with offline-paid.test.ts. Verify web checkout and a quote payment end to end with the Stripe CLI before going further.
8. 7. Emails: QuoteOrderFacts lines / kind / fees, order* copy, method-aware 'Paid by' line, bodyDelivered, owner subject and body, skip customer send without an email; resendLoggedEmail for manual orders; quote-emails.test.ts.
9. 8. Pay-link plumbing for the second source: data/pay.ts (source IN, PayRequestView lines), data/quote.ts, quotes.ts (loadQuoteOrder, resend without email, cancel wording), admin.ts delegate; LIMITS.manualOrder and manualOrderOnce in throttle.ts.
10. 9. Dashboard and bell correctness BEFORE any UI ships: isAwaitingQuote / isPaidQuoteToStart / quoteQueue / REAL_ORDER_WHERE / pulse filters on both sources; paidByMethod and DashboardData.paidSplit; dashboard.test.ts and admin-pulse.test.ts; orders list attention filters switched to PAY_LINK_SOURCES.
11. 10. Server actions and data: src/backend/data/manual-order.ts (getOrderBuilderData, getOrderPrefill) and src/backend/actions/manual-orders.ts (searchOrderCustomers, quoteManualOrder, createManualOrder, recordOfflinePayment) with the documented overrideAccess header; activity LABELS/NOTABLE additions.
12. 11. Admin i18n (en.ts + ar.ts, LabelGroup, status.ts orderSourceKey 'manual' first) and the three UI primitives (Stepper, ChoiceCards, Chips) in src/admin/ui.
13. 12. Screen /admin/orders/new: page.tsx + src/admin/components/OrderBuilder.tsx (items sheet, customer search, delivery, discount, summary from quoteManualOrder, payment sheet, confirm dialog, sticky bar, sessionStorage draft). Verify at 390px EN + AR, light + dark, then at lg.
14. 13. Order detail and list: manual notice with QuotePayment variant notice, src/admin/components/RecordPayment.tsx (owner), method badge / recorded-by line / reference, created-by, similar-order menu item, reworded noManualPayment; list source badge, Source and Paid-by filters; dashboard paid split line and header button; 'Create order' in the orders PageHeader.
15. 14. Customer side: /pay/[token] multi-line summary and orderTitle, PayInvoice method-aware line, storefront dictionary keys (load the calanthe-design skill first); check 390px EN/AR and Lighthouse mobile >= 90.
16. 15. Discount codes in the builder: only after the discounts feature's data layer and redeemCoupon exist — switch codesEnabled on, wire loadOrderDiscounts into quoteManualOrder/createManualOrder and redeemCoupon into applyOfflinePayment; add the code tests.
17. 16. Docs: docs/ADMIN.md (0.3 screens, §3 rule reworded, the wrong-amount procedure), docs/PAYMENTS.md §2 ('only the webhook marks a CARD payment paid; an offline payment is recorded by the owner on an admin-manual order') + a 'Manual orders' section, docs/ORDERS.md (sources, payment methods), docs/SECURITY.md (third overrideAccess exception, MANUAL_PAYMENT_CONTEXT), docs/OWNER_TODO.md; update the comments in OrderOps.tsx, Orders.ts and actions/admin.ts that say nothing marks an order paid.
18. 17. Release: pnpm lint && pnpm typecheck && pnpm test && pnpm build; run the manual checklist; `pnpm migrate` against production, verify, THEN deploy the code; one conventional commit per step.

## openQuestionsForOwner

- Do you ever deliver BEFORE the customer has paid (cash at the door)? As specified, an order created in the admin cannot be prepared until it is paid by link or recorded as paid by you. If you do take cash on delivery, we add a third choice, 'Pay on delivery', that lets the florist prepare an unpaid order and you record the cash afterwards.
- Who may record a payment taken outside the website? The spec says only you (the owner); staff can create the order and send a payment link. If you want your florist to record cash herself, we can allow it and show you every such entry highlighted in the activity log and on the dashboard.
- May staff type a custom price (a custom item) on an order, as they already can for a payment request? If not, custom items become owner-only and staff can sell only catalogue products.
- Which ways of paying outside the website do you really use: cash, bank transfer, card machine? Anything else to name (for example a payment app), or to remove from the list?
- Is the customer's email really optional for WhatsApp sales? Without it they get no emailed invoice; you send the invoice link on WhatsApp instead.
- Should a discount code also reduce a custom item, or only catalogue products (as specified)?
- When you record a sale that already happened last week, the invoice is dated the day you record it, and it appears in that day's sales on the dashboard. Is that acceptable to your accountant, or should the dashboard count it on the delivery day?
- If a hand-recorded payment turns out to be wrong, the spec has no edit and no 'refund' button: you cancel the order, create the correct one, and the first invoice number stays used. Do you need a credit note / refund record for your accountant in this version?
- The sales channel list is WhatsApp, Phone, Instagram, In person, Other. Is that the right list, and do you want sales by channel on the dashboard later?
- Should the owner receive an email every time staff create an order by hand, or is the activity log plus the 'paid' email enough (as specified)?
- The invoice still has no legal name, address, trade licence or TRN (src/lib/business.ts placeholders). Hand-recorded sales will issue invoices too — can you provide these details before launch?
- Developer note, not a question for the owner: the code-discount part of this screen depends on the discounts feature, which is not built in the tree yet; everything else can ship without it.