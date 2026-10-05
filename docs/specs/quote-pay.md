# Spec: quote-pay

## summary

FEATURE 1 SPEC — confirm a bespoke/event enquiry and get paid by link. Spec only; nothing in the repo was changed.

What I verified in the code (it differs from the docs in places, and the spec follows the code):
- Orders.items[].product is ALREADY optional (src/collections/Orders.ts, items.product has no `required`), so a custom line needs no weakening. The spec instead ADDS a rule: a product-less line is allowed only on source "admin-quote".
- applySucceededIntent (src/backend/payments/paid.ts) has no atomic claim: two concurrent webhook deliveries can both pass the verdict and both send emails. The gap-free invoice allocation below doubles as the single-winner claim and fixes that.
- Stripe idempotency keys expire after about 24 hours. A 7-day pay link therefore cannot rely on `order-{id}` alone: the PaymentIntent id must be stored on the order and reused, otherwise a second intent (and a possible double charge) is created on day 2.
- Every existing email template is English-only (src/backend/email/templates.ts, `shell` is LTR). Enquiries store no language. Both are added (additively).
- `orders.create` is owner-only (isAdmin) and src/backend/actions/admin.ts uses no overrideAccess. Staff confirming a quote therefore needs a second documented overrideAccess exception, in its own file, exactly like actions/checkout.ts.
- The indicative total of a Build Your Own enquiry exists only inside the free-text `message` ("Indicative total: AED X"); `buildYourOwn.budgetFils` is the budget. Recipient name/phone are also only in `message`.
- OrderOps lets a florist advance any PENDING order and that sends "Your order is confirmed". Unpaid quote orders must be blocked from advancing.
- There is no Payload global for settings (payload.config.ts has collections only), so business/invoice details come from a constants module with null placeholders until the owner supplies them.

Design in one paragraph: Confirm creates a real Order (PENDING, source "admin-quote", one line "Bespoke arrangement", total = staff-entered amount, linked to the enquiry and to a verified customer account if one exists) plus a derived pay token (HMAC of a 32-byte random salt; only the salt and the SHA-256 of the token are stored). The customer gets a bilingual branded email with "Pay now — AED X" to /pay/[token]. That page is side-effect free on GET; pressing pay calls a server action that creates or reuses the PaymentIntent for exactly order.totalFils (idempotency key order-{id}, intent id stored on the order) and the browser confirms with Express Checkout (Apple Pay / Google Pay) or the Payment Element. The existing signed webhook → applySucceededIntent marks PAID, atomically allocates a gap-free invoice number (CAL-INV-YYYY-NNNNN, counter row, single SQL statement), then the one winning delivery sends: customer thank-you with HTML invoice, owner "paid" notice, florist job sheet. The same /pay/[token] URL then renders the invoice (printable; PDF later). Enquiry status moves NEW/IN_REVIEW → QUOTED (awaiting payment) → CONVERTED (paid); the payment state itself is always derived from the order, never stored twice.

## dataModel

ONE NEW MIGRATION, additive, backward compatible. Create with `pnpm migrate:create quote_pay_link` after editing the collections, then hand-add the three marked blocks (precedent: the hand-added sequences in 20260907_021741_orders.ts). Register in src/migrations/index.ts. Then `pnpm generate:types`.

A. src/collections/Orders.ts — new fields (all optional, so existing rows and web checkout are untouched)
| field | type | column | access / notes |
| enquiry | relationship → enquiries | enquiry_id integer NULL, FK ON DELETE SET NULL, index orders_enquiry_idx | immutableAfterCreate. sidebar. |
| locale | select 'en' | 'ar', defaultValue 'en' | locale enum_orders_locale DEFAULT 'en' | immutableAfterCreate. Language the customer is written to. |
| customerNote | textarea maxLength 600 | customer_note varchar | immutableAfterCreate. "Shown to the customer in the payment email and page." |
| payTokenSalt | text | pay_token_salt varchar | access { create: serverOnlyField, read: serverOnlyField, update: serverOnlyField }, admin.hidden true |
| payTokenHash | text, unique, index | pay_token_hash varchar, UNIQUE INDEX orders_pay_token_hash_idx | same server-only access, hidden. SHA-256 hex of the token. |
| payLinkExpiresAt | date | pay_link_expires_at timestamp(3) with time zone | access { create: isStaffField, update: serverOnlyField }, readOnly |
| stripePaymentIntentId | text, index | stripe_payment_intent_id varchar, index | server-only write, readOnly |
| paidAt | date | paid_at timestamp(3) with time zone | server-only write, readOnly |
| invoiceNumber | text, unique, index | invoice_number varchar, UNIQUE INDEX orders_invoice_number_idx | server-only write, readOnly. |
| vatRateBps | number, defaultValue 0 | vat_rate_bps numeric DEFAULT 0 | server-only write. Snapshot at payment. |
| vatIncludedFils | filsField, default 0 | vat_included_fils numeric DEFAULT 0 | server-only write. Snapshot at payment. |
`source` description gains "admin-quote". No change to items: a bespoke line is stored as { product: null, productName: <staff description, default "Bespoke arrangement">, productSlug: "bespoke-arrangement" (constant BESPOKE_SLUG), quantity: 1, unitPriceFils = lineTotalFils = amount, selectedOptions: [] }. Totals: subtotalFils = totalFils = amount, deliveryFeeFils 0, discountFils 0 → passes validateOrderTotals unchanged.

New hooks in src/backend/payload/hooks/orderIntegrity.ts, added to Orders.hooks:
- beforeValidate `validateBespokeLines` (create only): if data.source === "admin-quote" → `enquiry` required, every item has no product and productSlug === BESPOKE_SLUG, totalFils >= 200. Otherwise → every item MUST have a product id and productSlug !== BESPOKE_SLUG and `enquiry` must be empty. (This tightens normal orders; it does not loosen them.)
- beforeChange `guardInvoiceNumber`: on update, throw 403 if originalDoc.invoiceNumber is set and data.invoiceNumber differs.

B. src/collections/Enquiries.ts — new fields
| locale | select 'en' | 'ar' (no default; null = unknown) | locale enum_enquiries_locale NULL | immutableAfterCreate |
| buildYourOwn.indicativeTotalFils | filsField | build_your_own_indicative_total_fils numeric NULL | written by submitBespokeEnquiry from now on |
No back-reference to the order: "the enquiry's order" is `orders where enquiry = id sort -createdAt limit 1` (avoids a circular FK and a second write that can fail). No new enquiry status values: QUOTED = awaiting payment, CONVERTED = paid.

C. src/collections/EmailLog.ts and src/backend/email/types.ts (EmailType) — three new values: 'payment-request', 'payment-received', 'owner-quote-paid'.

D. HAND-ADDED SQL in the migration `up` (after the generated ALTERs):
1) `ALTER TYPE "public"."enum_email_log_type" ADD VALUE IF NOT EXISTS 'payment-request';` (and the other two). Postgres 12+ allows this inside the migration transaction as long as the values are not used in it.
2) Gap-free counter (deliberately NOT a sequence; sequences leave gaps on rollback):
`CREATE TABLE IF NOT EXISTS "invoice_counters" ("year" integer PRIMARY KEY, "last_value" integer NOT NULL CHECK ("last_value" >= 0));`
3) One live quote per enquiry, enforced by the database so a double-click or two staff cannot create two payable orders:
`CREATE UNIQUE INDEX "orders_one_live_quote_per_enquiry" ON "orders" ("enquiry_id") WHERE "enquiry_id" IS NOT NULL AND "fulfilment_status" <> 'CANCELLED';`
`down`: drop the index, the table, the new columns and the two locale enums. Enum values added to enum_email_log_type cannot be removed in Postgres; leave them and say so in a comment.

E. Invoice numbering mechanism — src/backend/payments/invoice-number.ts
`export async function claimInvoice(payload: Payload, input: { orderId: number; year: number; vatRateBps: number; vatIncludedFils: number; paidAtIso: string }): Promise<{ invoiceNumber: string; claimedNow: boolean }>`
One statement through `payload.db.drizzle.execute(sql`...`)` (same access pattern as sequentialNumber.ts), parameters bound, never interpolated:
WITH target AS (SELECT id FROM orders WHERE id = $orderId AND invoice_number IS NULL FOR UPDATE),
next AS (INSERT INTO invoice_counters (year, last_value) SELECT $year, 1 FROM target ON CONFLICT (year) DO UPDATE SET last_value = invoice_counters.last_value + 1 RETURNING last_value)
UPDATE orders o SET invoice_number = 'CAL-INV-' || $year || '-' || lpad(next.last_value::text, greatest(5, length(next.last_value::text)), '0'), paid_at = coalesce(o.paid_at, $paidAt), vat_rate_bps = $rate, vat_included_fils = $vat FROM next, target WHERE o.id = target.id RETURNING o.invoice_number;
One row returned → claimedNow true. Zero rows → SELECT invoice_number for the order and return claimedNow false. Why it is gap-free and single-winner: the counter only increments when `target` has a row (INSERT … SELECT FROM target), a concurrent second delivery blocks on the row lock and then sees invoice_number set, and a failed statement rolls the counter back with it. Year = Asia/Dubai year of the payment time. Numbers are allocated for EVERY order that becomes PAID (web checkout too) so the business has one series.

F. Business details — new src/lib/business.ts (not secrets; constants until a Settings screen exists)
`export const BUSINESS = { tradingName: "Calanthe", legalName: null as { en: string; ar: string } | null /* OWNER TO PROVIDE */, addressLines: null as { en: string[]; ar: string[] } | null /* OWNER TO PROVIDE */, city: { en: "Abu Dhabi", ar: "أبوظبي" }, country: { en: "United Arab Emirates", ar: "الإمارات العربية المتحدة" }, tradeLicence: null as string | null /* OWNER TO PROVIDE */, trn: null as string | null /* OWNER TO PROVIDE, 15 digits */, vatRegistered: false, vatRateBps: 500, email: CONTACT.email, phone: CONTACT.whatsapp } as const`
A null value is OMITTED from the invoice (a placeholder never reaches a customer). While vatRegistered is false the document is titled "Invoice", shows no VAT line and no TRN. When true: title "Tax invoice", TRN shown, line "Includes VAT (5%) AED Y" with Y = vatIncludedFils(total, 500). Prices are treated as VAT-inclusive; the order total never changes. Add the four placeholders to docs/OWNER_TODO.md.

G. Constants — src/backend/payments/pay-link.ts: PAY_LINK_TTL_DAYS = 7, BESPOKE_SLUG = "bespoke-arrangement", QUOTE_SOURCE = "admin-quote", QUOTE_MIN_FILS = 200 (Stripe's AED minimum), quote max = existing MAX_PRICE_AED in backend/domain/product-form.ts.

## serverLogic

1. PURE DOMAIN (no DB, no clock; all unit-tested)

src/backend/payments/pay-link.ts
- `newPayTokenSalt(): string` — randomBytes(32).toString("base64url").
- `payToken(secret: string, salt: string): string` — createHmac("sha256", secret).update(`calanthe-pay-link:v1:${salt}`).digest("base64url") (43 chars, 256 bits). Secret = env.PAYLOAD_SECRET. The database alone can never yield a working link, and resend can rebuild the SAME link.
- `hashPayToken(token: string): string` — sha256 hex.
- `isPayTokenShape(v: string): boolean` — /^[A-Za-z0-9_-]{43}$/.
- `payLinkExpiry(now: Date, days = PAY_LINK_TTL_DAYS): Date`.
- `type PayRequestState = "awaiting" | "expired" | "cancelled" | "paid"`
- `payRequestState(order: { paymentStatus: string; fulfilmentStatus: string; payLinkExpiresAt?: string | null }, now: Date): PayRequestState` — precedence: paymentStatus in PAID/REFUNDED/PARTIALLY_REFUNDED → "paid"; fulfilmentStatus CANCELLED → "cancelled"; expiry missing or <= now → "expired"; else "awaiting".
- `payUrl(origin: string, token: string, locale: "en" | "ar"): string` → `${origin}/pay/${token}?lang=${locale}`. Origin: SITE_ORIGIN (src/lib/site.ts), except on a Vercel preview use https://VERCEL_BRANCH_URL so a preview link opens the preview.

src/backend/domain/quote.ts
- `suggestedQuoteFils(enquiry): number | null` — buildYourOwn.indicativeTotalFils → else /Indicative total: AED (\d+(?:\.\d{1,2})?)/ in message → else buildYourOwn.budgetFils → else customRequest.budgetFils → else relatedEvent.quoteAmountFils → null.
- `parseBespokeMessage(message): { recipientName?: string; recipientPhone?: string }` (reads the "Recipient:" / "Recipient phone:" lines written by actions/enquiry.ts).
- `parseQuoteForm(form: FormData, ctx: { todayDubai: string; slots: readonly string[] }): ParsedQuote` — throws FormInputError (existing class, codes below). ParsedQuote = { description (1–140), amountFils (parseAedToFils(raw, "Final amount"); required; >= 200), deliveryDate (YYYY-MM-DD, >= todayDubai; stored as `${date}T12:00:00+04:00`), deliveryTimeSlot (must be in ctx.slots), deliveryAddress (1–600), customerPhone (E.164), recipientName?, recipientPhone? (E.164), cardMessage? (<=300), customerNote? (<=600), locale 'en'|'ar' }.
- `quoteOrderData(enquiry, parsed, extra: { customerId?: number; salt: string; tokenHash: string; expiresAt: Date })` → the exact orders.create payload (so totals are built in one tested place).

src/backend/domain/invoice.ts
- `formatInvoiceNumber(year: number, seq: number): string` (CAL-INV-2026-00001; widens past 99999; must match the SQL in claimInvoice).
- `invoiceYear(at: Date): number` (Asia/Dubai).
- `vatIncludedFils(totalFils: number, rateBps: number): number` = Math.round(totalFils * rateBps / (10000 + rateBps)); 0 when rateBps is 0.
- `buildInvoice(order, business): InvoiceView` — throws if order.invoiceNumber is empty. InvoiceView = { number, issuedAt (paidAt), orderNumber, billTo { name, email }, lines [{ description, quantity, unitFils, totalFils }], subtotalFils, deliveryFeeFils, discountFils, totalFils, vat: { rateBps, includedFils } | null, paidAt, seller }. Reads ONLY the order snapshot, never the product relation. Asserts sum(lines) + delivery − discount === total.

2. STATE MACHINE
Enquiry.status (existing enum): NEW | IN_REVIEW | WAITING_FOR_CUSTOMER → [confirm] → QUOTED → [webhook paid] → CONVERTED. QUOTED → [cancel request] → IN_REVIEW (can be confirmed again; a new order is created, the cancelled one stays as history). Staff may still set the status by hand; the Payment card always reads the ORDER.
Order (source admin-quote): created { paymentStatus PENDING, fulfilmentStatus NEW }.
- awaiting → paid: only applySucceededIntent (webhook). On paid: paymentStatus PAID, paidAt, invoiceNumber, and fulfilmentStatus NEW → CONFIRMED (the florist already confirmed it; no status email is sent for this move).
- awaiting → expired: time only (derived). expired → awaiting: resend (extends expiry).
- awaiting | expired → cancelled: cancelPaymentRequest (fulfilmentStatus CANCELLED). Terminal.
- paid is terminal for this feature (refunds stay in the Stripe dashboard, docs/PAYMENTS.md §7).
Cross-axis rule added: an admin-quote order whose paymentStatus is not PAID cannot move to any fulfilment status except CANCELLED.

3. ADMIN ACTIONS — new file src/backend/actions/quotes.ts ("use server"), returning the existing ActionResult shape from actions/admin.ts (export the type and reuse `failure`, `actorOf` by moving them to src/backend/actions/admin-shared.ts). Header comment documents this as the SECOND overrideAccess exception: orders.create is owner-only by collection rule, staff must be able to confirm, and it is safe because the caller is an authenticated admin/staff session and every amount is parsed and validated on the server.

`confirmEnquiryQuote(enquiryId: number, form: FormData): Promise<ActionResult>`
 1. payload.auth; role must be admin or staff, else actions.permission.
 2. Load the enquiry with `user, overrideAccess: false, depth: 1`. Refuse unless type is BUILD_YOUR_OWN, EVENT or CUSTOM_REQUEST and status is not SPAM (actions.quote.notQuotable).
 3. getStripe() + cardPaymentsConfigured() else actions.quote.paymentsOff (never create an order nobody can pay).
 4. parseQuoteForm.
 5. Customer link: enquiry.customer if set; otherwise a `users` row with role customer, the same email and `_verified: true` (overrideAccess true, limit 1). No verified match → guest.
 6. salt = newPayTokenSalt(); token = payToken(env.PAYLOAD_SECRET, salt); expiresAt = payLinkExpiry(now).
 7. payload.create orders, overrideAccess: true, data = quoteOrderData(...) with source "admin-quote", assignedStaff = enquiry.assignedStaff. A unique violation on orders_one_live_quote_per_enquiry → actions.quote.alreadyConfirmed.
 8. payload.update enquiries (user, overrideAccess false): { status: "QUOTED", lastContactedAt: now, lastContactMethod: "EMAIL" }.
 9. AFTER both writes returned: sendEmail(payment-request, to order.customerEmail, locale). Never inside a hook.
 10. recordActivity { actor, action: "create", area: "orders", collection: "orders", itemId: order.id, itemLabel: orderNumber, summary: `Payment request ${orderNumber} — AED X sent to ${email} (enquiry ${enquiryNumber})`, changes: [{ field: "totalFils", label: "amount", after: "AED X" }] }. This is how the owner sees who confirmed it.
 11. revalidatePath /admin/enquiries, /admin/enquiries/{id}, /admin/orders, /admin. Return ok with code actions.quote.confirmed, or actions.quote.confirmedEmailNotSent (still ok: true) when the email outcome is not "sent", so staff know to copy the link.
 NO PaymentIntent is created here.

`resendPaymentRequest(orderId: number): Promise<ActionResult>` — staff/owner; order must be admin-quote and state awaiting or expired (else actions.quote.notAwaiting). throttle(LIMITS.payResend, `order-${id}`). Recompute the token from the stored salt; if sha256(token) differs from payTokenHash (PAYLOAD_SECRET was rotated) write the new hash. Set payLinkExpiresAt = later of the current value and now + 7 days (overrideAccess true, only these fields). Send the same email. recordActivity action "email". Enquiry lastContactedAt updated.

`cancelPaymentRequest(orderId: number): Promise<ActionResult>` — staff/owner; state awaiting or expired. If stripePaymentIntentId: stripe.paymentIntents.cancel(id); if Stripe refuses because the intent is processing or succeeded → return actions.quote.paymentInProgress and change nothing. Then payload.update order { fulfilmentStatus: "CANCELLED" } (user, overrideAccess false) and enquiry { status: "IN_REVIEW" }. recordActivity action "status", summary `${orderNumber} payment request cancelled`. No customer email in v1 (see open questions).

Change in src/backend/actions/admin.ts `updateOrderFulfilment`: after reading `before`, if before.source === "admin-quote" and before.paymentStatus !== "PAID": when the requested status is CANCELLED → `return cancelPaymentRequest(id)`; otherwise → { ok: false, code: "actions.order.awaitingPayment" }.

Change in src/backend/actions/emails.ts `resendLoggedEmail`: handle the three new types by rebuilding from the order through the new builders (payment-request delegates to resendPaymentRequest; payment-received and owner-quote-paid require order.invoiceNumber).

Data helper src/backend/data/quote.ts: `getQuoteForEnquiry(enquiryId)` and `getQuoteForOrder(orderId)` — check getAdminSession() first, then read with overrideAccess (the salt is server-only) and return { order summary, state, payUrl, lastEmail: { status, createdAt } | null, sendCount } (email facts from email-log where order = id and type = payment-request).

4. CUSTOMER ACTIONS — new file src/backend/actions/pay.ts ("use server")
Shared loader `findOrderByPayToken(payload, token)`: isPayTokenShape else null; find orders where payTokenHash equals hashPayToken(token) and source equals "admin-quote", overrideAccess true, depth 0, limit 1. The browser sends ONLY the token; there is no amount, order id or email parameter anywhere.

`startQuotePayment(token: string): Promise<{ ok: true; clientSecret: string } | { ok: false; code: "INVALID" | "EXPIRED" | "CANCELLED" | "PAID" | "PROCESSING" | "RATE_LIMITED" | "PAYMENT_UNAVAILABLE" | "FAILED"; message: string }>`
 1. throttle(LIMITS.payStart, clientAddress()) → RATE_LIMITED with withWait().
 2. Order by token → INVALID. payRequestState → EXPIRED / CANCELLED / PAID.
 3. `ensureOrderPaymentIntent(payload, stripe, order)` (new src/backend/payments/intent.ts): if order.stripePaymentIntentId → retrieve it; status succeeded or processing → PROCESSING; status canceled → create a fresh one with idempotencyKey `order-${id}-r-${old id}`; otherwise reuse. If none stored → stripe.paymentIntents.create({ amount: order.totalFils, currency: "aed", automatic_payment_methods: { enabled: true }, receipt_email: order.customerEmail, description: `Calanthe order ${orderNumber}`, metadata: { kind: "order", orderId, orderNumber, source: "admin-quote" } }, { idempotencyKey: `order-${order.id}` }) and store the id on the order (overrideAccess true). Assert intent.amount === order.totalFils and currency aed before returning; a mismatch is logged and returned as FAILED.
 4. Return client_secret.
`getQuotePaymentState(token: string): Promise<{ state: PayRequestState | "invalid" }>` — throttled by LIMITS.payView; used by the page to poll after the browser confirms. Returns the state only.

New LIMITS in src/backend/security/throttle.ts: payView { name: "pay-view", limit: 60, windowSeconds: minutes(10) }, payStart { name: "pay-start", limit: 10, windowSeconds: minutes(10) }, payResend { name: "pay-resend", limit: 5, windowSeconds: hours(1) }.

5. PAID PATH — src/backend/payments/paid.ts (same function, same webhook route; route.ts unchanged; paymentVerdict unchanged)
 a. OrderDoc gains source, enquiry, locale, invoiceNumber, fulfilmentStatus, discountFils, customerNote, payTokenSalt.
 b. `already-paid` now returns early ONLY if order.invoiceNumber is set; if it is PAID without an invoice (a crash between the two writes) fall through to step d so Stripe's retry heals it.
 c. mark-paid: the existing payload.update with PAYMENT_PROVIDER_CONTEXT, data { paymentStatus: "PAID", stripePaymentIntentId: intent.id, ...(admin-quote and fulfilmentStatus NEW ? { fulfilmentStatus: "CONFIRMED" } : {}) }. If the order was CANCELLED, also append to internalNotes "PAID AFTER CANCELLATION — refund in Stripe or reinstate".
 d. `claimInvoice(payload, { orderId, year: invoiceYear(now), vatRateBps, vatIncludedFils, paidAtIso })`. A throw propagates → webhook answers 500 → Stripe retries. claimedNow false → return "already-paid" and send NOTHING (this is the duplicate-email guard).
 e. Winner only, after the writes: if source is admin-quote → sendAfterCommit(buildQuotePaidEmails(...)) and payload.update enquiries { status: "CONVERTED" } (overrideAccess true, try/catch, non-fatal). Else the existing buildOrderEmails, unchanged.

6. SECURITY CHECKLIST
- Amount: entered by authenticated staff, parsed on the server, frozen by immutableAfterCreate; the intent is created from order.totalFils; the webhook verdict re-checks amount, currency and order id.
- Token: 256-bit, unguessable, only salt + hash at rest, single purpose (pay or view this one order). It grants no session and no access to other orders.
- /pay GET has no side effects (mail scanners prefetch links): no intent, no write.
- `referrer: "no-referrer"` on the page metadata so the token never travels in a Referer header to Stripe or fonts; robots noindex,nofollow; add `/pay/` to the robots disallow list; strip the path from any Sentry breadcrumb for this route.
- Only the signed webhook changes paymentStatus; guardPaymentStatus is untouched. Nothing in the admin marks paid.
- No secrets in code: PAYLOAD_SECRET and the Stripe keys come from env (already in src/lib/env.ts); no new env vars.

## adminUx

Pattern: Shopify's draft order flow ("Send invoice → awaiting payment → paid"), built only from src/admin/ui primitives (Card, CardHeader, Badge, Dialog, ConfirmDialog, ActionButton, Field/Input/PrefixInput/Select/Textarea, Notice, DescriptionList, useAction, Toast). Logical CSS only (rtl-guard.test.ts). Every string through t()/label(). Works at 390px: the dialog uses Dialog variant "sheet" on phones, primary button full width at the bottom, 44px targets.

SCREEN 1 — /admin/enquiries/[id] (src/app/(admin)/admin/(panel)/enquiries/[id]/page.tsx)
New client component src/admin/components/QuotePayment.tsx, rendered as a "Payment" card at the TOP of the right-hand column, above EnquiryWorkflow, only for types BUILD_YOUR_OWN, EVENT, CUSTOM_REQUEST. The page loads `getQuoteForEnquiry(id)` and passes plain props. The page header also shows a second Badge with the payment state when a quote exists.

State A — no quote yet (or last one cancelled)
 Card text: "Confirm the arrangement and email the customer a payment link." Primary button "Confirm & request payment".
 Click path:
 1. Press "Confirm & request payment" → Dialog "Confirm and request payment".
 2. Fields, in order (prefilled, all editable):
    - Final amount (PrefixInput "AED", inputMode decimal) — prefilled from suggestedQuoteFils; hint "Indicative total was AED X" when known.
    - Shown to the customer as (text) — default "Bespoke arrangement" / "تنسيق خاص" by email language; for EVENT "Event flowers".
    - Delivery date (type=date, min today in Dubai) — prefilled from buildYourOwn.deliveryDate.
    - Time window (Select from timeSlots in src/lib/data.ts).
    - Delivery address (Textarea) — prefilled from buildYourOwn.deliveryLocation. Emirate is fixed to Abu Dhabi (the only zone) and shown as read-only text.
    - Customer phone — prefilled; shown only as a field if missing or not E.164.
    - Gift details (collapsed section): Recipient name, Recipient phone, Card message — prefilled from parseBespokeMessage and buildYourOwn.cardMessage.
    - Note to the customer (Textarea, optional, 600) — hint "Included in the email."
    - Email language (Select English / العربية) — preselected from enquiry.locale, default English.
 3. A summary line above the footer updates live: "{name} ({email}) will be emailed a link to pay AED 650. The link is valid for 7 days."
 4. Footer: "Cancel" and primary "Confirm and send — AED 650". One press; the dialog is not dismissible while saving (Dialog dismissible={false}).
 5. Success: dialog closes, toast "Confirmed. Payment link sent to {email}.", the card re-renders in State B (router.refresh via useAction). Failure keeps everything typed and shows the reason inline.

State B — awaiting payment
 Badge warning "Awaiting payment". DescriptionList: Amount · Order (link to /admin/orders/{orderNumber}) · Sent to · Last sent (datetime, "sent N times") · Link expires.
 If the last payment-request email row is not "sent": Notice warning "The email was not sent ({status}). Copy the link and send it on WhatsApp, or resend."
 Buttons: "Resend email" (ActionButton → resendPaymentRequest) · "Copy payment link" (clipboard, toast "Link copied") · "Cancel request" (danger, ConfirmDialog: title "Cancel this payment request?", body "The link will stop working. Nothing has been charged.", confirm "Cancel request").

State C — link expired
 Badge neutral "Link expired" + same facts. Buttons: "Send a new link" (resendPaymentRequest; extends 7 days) · "Cancel request".

State D — cancelled
 Badge neutral "Cancelled" + date, link to the cancelled order. Button "Confirm again" opens the dialog prefilled from the cancelled order.

State E — paid
 Badge success "Paid". DescriptionList: Amount · Paid on · Invoice no. · Order (link). Buttons: "Open order" · "View invoice" (opens the customer page in a new tab).

SCREEN 2 — /admin/enquiries list: next to the status badge, a small payment badge (Awaiting payment / Paid / Link expired) for rows that have a quote; one batched orders query for the page's ids.

SCREEN 3 — /admin/orders/[orderNumber]
 - Source label: orderSourceKey gains "quote" (regex /quote/) → "Confirmed enquiry".
 - For an unpaid quote order: Notice (info) "Awaiting payment. The customer was emailed a link on {date}. This order cannot be prepared until it is paid." plus the same Resend / Copy link / Cancel request buttons, and a link "Open the enquiry".
 - OrderOps gets prop `awaitingPayment: boolean`: when true it offers only "Cancel", wired to cancelPaymentRequest (the server enforces the same rule).
 - Payment card: when paid show "Invoice {number} · paid {datetime}" and "View invoice". The customer note is shown read-only under Delivery.
 - The item row already hides the "Product" link when there is no product; no change.

SCREEN 4 — /admin/orders list: the source column/filter shows "Confirmed enquiry"; the existing payment filter "Awaiting payment" already finds these.

SCREEN 5 — /admin/emails: three new type labels; Resend works for them (see serverLogic).

SCREEN 6 — /admin/activity (owner only): entries "Payment request CAL-000123 — AED 650 sent to x@y (enquiry CAL-E-000045)", "Email resent for CAL-000123", "CAL-000123 payment request cancelled", each with the staff member's name.

Roles: owner and staff can confirm, resend and cancel (the user asked for the florist to be able to confirm). The activity log is the owner's control.

## storefrontUx

Route: src/app/(frontend)/(storefront)/pay/[token]/page.tsx — Server Component, `export const dynamic = "force-dynamic"`, generateMetadata → { title: t.meta.pay, robots: { index: false, follow: false }, referrer: "no-referrer" }. Inside the storefront layout so header, footer, grain and fonts are the brand's. Load the calanthe-design skill before building.

Server render: throttle(LIMITS.payView) → if refused render the "wait" state. findOrderByPayToken → state. If searchParams.payment_intent is present and equals order.stripePaymentIntentId, retrieve it read-only (as checkout/complete does) and render "confirming" when it is succeeded or processing. Pass the client only: token, totalFils, locale, and the display strings. Never internal notes, never the salt.

Language: page copy follows getDictionary() like every page. The email link carries ?lang=en|ar; a tiny client component (reuse the setter the header language switch uses in src/lib/locale.tsx) adopts that language only when the visitor has no locale cookie yet, then router.refresh(). Arabic renders dir=rtl; time ranges and AED amounts stay dir="ltr" (same rule as CheckoutForm).

Shared Stripe pieces: move APPEARANCE, the lazy loader (getStripePromise, HAS_STRIPE) and the Express Checkout options out of CheckoutForm.tsx into src/components/commerce/stripe-shared.ts and import them in both. No visual change to checkout.

STATE "awaiting" — component src/components/commerce/PayRequestForm.tsx ("use client"), 390px first, single column, max-w-xl centred on desktop:
 1. Eyebrow (Cinzel, uppercase, 0.18em) "Your arrangement" + reference "Reference CAL-000123".
 2. h1 (Cormorant Garamond, light, olive) "Your arrangement is confirmed." — this is the LCP, rendered on the server, never animated from opacity 0.
 3. Summary card (cream #E4DCC5 surface, hairline #CBC4A9 border, 2px corners): Arrangement · Delivery "{weekday date}, {window}" · Deliver to · Delivery "Complimentary" · florist's note in a quiet bordered block if present · hairline · "Total to pay" with the amount in display type.
 4. Express Checkout Element first (Apple Pay on Safari/iPhone, Google Pay on Chrome/Android; it renders nothing where neither exists, so the label "Express checkout" is shown only after its onReady reports available methods). onClick calls event.resolve() immediately with nothing awaited before it (known constraint, docs/PAYMENTS.md §1).
 5. Separator "Or pay by card", then the Payment Element (wallets: never, since they have their own buttons).
 6. Primary button "Pay now — AED 650" (olive ground, cream text; Burnt Orange is not used as a fill). On phones a fixed bottom bar: total on the start side, "Pay now" button on the end side, padding-bottom max(env(safe-area-inset-bottom), 0.75rem), and the form has pb-28 so nothing hides under it (same pattern as CheckoutForm).
 7. Small print: "This link is valid until {date}." + the existing t.checkout.cardBody line + WhatsApp link.
 Elements options: { mode: "payment", currency: "aed", amount: totalFils, locale, appearance: APPEARANCE, fonts }. The amount prop configures the wallet sheet only; the charge is whatever the server-created intent says.
 Pay sequence (identical order to CheckoutForm.pay): elements.submit() → startQuotePayment(token) → stripe.confirmPayment({ elements, clientSecret, confirmParams: { return_url: `${origin}/pay/${token}` }, redirect: "if_required" }). Errors render in a role="alert" line; PROCESSING/PAID codes switch to the confirming state; EXPIRED/CANCELLED trigger router.refresh().

STATE "confirming" (browser says done, webhook not yet): Monogram, h1 "Thank you. We are confirming your payment.", body "This takes a few seconds. Your invoice will arrive by email." Polls getQuotePaymentState every 2s for up to 30s, then router.refresh() on "paid". The word "Paid" never appears before the webhook has written it (docs/ORDERS.md §6).

STATE "paid": h1 "Thank you. Your payment is received." + what happens next, then the INVOICE block rendered from buildInvoice: title Invoice / Tax invoice, Invoice no., Date, Order, Billed to (name and email only), a real table (Description, Qty, Amount) that becomes stacked rows under 480px, Subtotal, Delivery Complimentary, optional "Includes VAT (5%)", Total, "Paid by card on {date}", seller block from BUSINESS (null fields omitted). Button "Print or save as PDF" → window.print(); add `print:hidden` to the header, footer, WhatsApp button and the button itself so the printout is the invoice alone. This state does not expire.

STATE "expired": h1 "This payment link has expired." body "Nothing has been charged. Message us and we will send you a new link." + WhatsApp button (CONTACT.whatsappHref).
STATE "cancelled": h1 "This payment request was cancelled." body "Nothing has been charged. If this is unexpected, message us and a florist will help." + WhatsApp button.
STATE "invalid" (bad shape, unknown token, wrong source): h1 "We could not find this payment link." body "Please open the link from your most recent email, or message us." Rendered with HTTP 200 and no detail about why (no oracle).
STATE "unavailable" (Stripe keys missing): existing t.server.checkout.paymentUnavailable.

Motion: one fade/translate reveal on the summary card using the existing Reveal primitive; nothing on the h1; prefers-reduced-motion → fade only. No pinned scene. Stripe.js loads after first paint via the shared lazy loader, so Lighthouse mobile stays >= 90. Body text >= 16px, tap targets >= 44px. Done only when checked at 390px in English and Arabic.

Other storefront touch points: src/app/(frontend)/(storefront)/account/orders/[orderNumber]/page.tsx and AccountClient must not link a line whose productSlug is "bespoke-arrangement" to /product/…; submitBespokeEnquiry, submitEventEnquiry and the membership enquiry action store `locale` (and BYO stores buildYourOwn.indicativeTotalFils = Math.round(totalAed * 100)).

## emails

Infrastructure (src/backend/email/templates.ts): export `escape`, `para`, `button`, `formatMoney`; give `shell(title, body, locale: "en" | "ar" = "en")` a third parameter that sets `<html lang dir>`, `dir="rtl"` and right alignment on the tables, an Arabic-capable font stack (Tahoma, Arial, sans-serif) and the Arabic footer "كالانثي · أتيليه الزهور، الإمارات العربية المتحدة". Existing callers are untouched (default "en"). Amounts stay "AED 650" with Western digits in both languages (site convention), wrapped in a dir="ltr" span in Arabic. Dates via formatDeliveryDate / formatDate from src/lib/i18n/date.ts. New file src/backend/email/quote-emails.ts holds the copy as `const COPY = { en: {...}, ar: {...} } satisfies Record<Locale, QuoteCopy>` (a missing Arabic key is a compile error) and the builders. All sends go through sendEmail / sendAfterCommit (logged to email_log with orderId and orderNumber, allowlisted outside production, never thrown). The Arabic word for "florist" must match the term already used in dictionary.ts.

EMAIL 1 — type `payment-request`
 Trigger: confirmEnquiryQuote; resendPaymentRequest. Recipient: order.customerEmail (the payer; never a gift recipient). Language: order.locale.
 Subject EN: "Your arrangement is confirmed — AED 650 to pay"
 Subject AR: "تم تأكيد تنسيقكم — المبلغ المطلوب AED 650"
 Heading EN "Your arrangement is confirmed" / AR "تم تأكيد تنسيقكم"
 Body EN: "Hello {name}," · "Your florist has confirmed your arrangement. Please complete the payment to reserve your flowers." · facts table: Reference {orderNumber} · Arrangement {description} · Delivery {weekday date}, {window} · Deliver to {address} · Delivery Complimentary · [A note from your florist: {customerNote}] · Total AED 650 · BUTTON "Pay now — AED 650" → payUrl · "Pay with Apple Pay, Google Pay or card. The link is valid until {date}." · "If the button does not work, paste this into your browser: {url}" · "Questions? Reply to this email or message us on WhatsApp {number}."
 Body AR: "مرحبًا {name}،" · "أكّد منسّق الزهور تنسيقكم. يُرجى إتمام الدفع لحجز زهوركم." · المرجع / التنسيق / التوصيل / عنوان التوصيل / التوصيل: مجاني / ملاحظة من منسّق الزهور / الإجمالي · الزر "ادفعوا الآن — AED 650" · "ادفعوا عبر Apple Pay أو Google Pay أو البطاقة. الرابط صالح حتى {date}." · "إن لم يعمل الزر، انسخوا هذا الرابط في المتصفح: {url}" · "لأي استفسار، ردّوا على هذه الرسالة أو تواصلوا معنا عبر واتساب {number}."
 Plain-text part mirrors it with the URL on its own line. No delivery-speed claims ("same day" must not appear).

EMAIL 2 — type `payment-received` (thank you + INVOICE)
 Trigger: applySucceededIntent, winner of claimInvoice only. Recipient: order.customerEmail. Language: order.locale.
 Subject EN: "Thank you — your invoice CAL-INV-2026-00001"
 Subject AR: "شكرًا لكم — فاتورتكم CAL-INV-2026-00001"
 Heading EN "Thank you. Your payment is received." / AR "شكرًا لكم. استلمنا دفعتكم."
 Body EN: "Thank you, {name}." · "Your florist composes the arrangement by hand and sends a photograph for your approval on WhatsApp before it leaves the atelier." · delivery facts (date, window, address, recipient if any) · INVOICE section (bordered table): Invoice no. · Date · Order · Billed to {name} · line rows (Description, Qty, Amount) · Subtotal · Delivery Complimentary · [Includes VAT (5%) AED Y] · Total · "Paid by card on {date}" · seller block from BUSINESS (trading name, legal name, address, TRN — each only if set) · BUTTON "View invoice" → payUrl.
 Body AR: "شكرًا لكم، {name}." · "ينسّق منسّق الزهور باقتكم يدويًا ويرسل لكم صورة عبر واتساب لموافقتكم قبل خروجها من الأتيليه." · قسم الفاتورة: رقم الفاتورة / التاريخ / الطلب / الفاتورة إلى / الوصف / الكمية / المبلغ / المجموع الفرعي / التوصيل: مجاني / يشمل ضريبة القيمة المضافة (5%) / الإجمالي / "مدفوعة بالبطاقة بتاريخ {date}" · الزر "عرض الفاتورة".
 The HTML invoice section and the /pay page invoice are both rendered from the same InvoiceView.

EMAIL 3 — type `owner-quote-paid` (internal, English like the existing owner email)
 Trigger: same as Email 2. Recipient: internal.owner (env.EMAIL_REPLY_TO today, same as paid.ts does now).
 Subject: "Paid: CAL-000123 — AED 650 (bespoke, CAL-E-000045)"
 Content: customer name, email, phone · facts table · the line · "Total AED 650 — paid by card (Stripe). Invoice CAL-INV-2026-00001." · link to /admin/orders/CAL-000123. If the order had been cancelled: a first line "This request was cancelled before the payment arrived — refund in Stripe or reinstate the order."

EMAIL 4 — existing type `florist-job-sheet`, existing template floristJobSheet (RecipientFacing: no money by type)
 Trigger: same as Email 2. Recipient: internal.florist. Lines: the bespoke description; the enquiry brief (budget excluded) is NOT added — the florist opens the enquiry from the admin. This is the florist's "paid, go" signal.

Builder signatures (src/backend/email/quote-emails.ts):
 `buildPaymentRequestEmail(input: { order: QuoteOrderFacts; payUrl: string; expiresAt: Date; locale: Locale }): SendRequest`
 `buildQuotePaidEmails(input: { order: QuoteOrderFacts; invoice: InvoiceView; payUrl: string; enquiryNumber?: string; locale: Locale }, internal: InternalAddresses): SendRequest[]`

Not sent in v1: an email on cancel, a reminder before expiry, an owner notice at confirm time. Stripe's own receipt (receipt_email) continues to be sent if enabled in the Stripe dashboard.

## i18n

A. STOREFRONT — src/lib/i18n/dictionary.ts (add to `en` and `ar`; `ar: typeof en` makes a missing key a build error). Reuse existing keys: checkout.complimentary, checkout.expressTitle, checkout.orPayByCard, checkout.cardBody, checkout.paymentFailed, checkout.paymentLoading, server.checkout.paymentUnavailable, server.checkout.rateLimited + server.wait.
meta.pay: "Payment" | "الدفع"
pay.eyebrow: "Your arrangement" | "تنسيقكم"
pay.reference: "Reference {number}" | "المرجع {number}"
pay.title: "Your arrangement is confirmed." | "تم تأكيد تنسيقكم."
pay.intro: "Your florist has confirmed the details below. Pay securely to reserve your flowers." | "أكّد منسّق الزهور التفاصيل أدناه. ادفعوا بأمان لحجز زهوركم."
pay.arrangement: "Arrangement" | "التنسيق"
pay.delivery: "Delivery" | "التوصيل"
pay.deliverTo: "Deliver to" | "عنوان التوصيل"
pay.noteTitle: "A note from your florist" | "ملاحظة من منسّق الزهور"
pay.total: "Total to pay" | "المبلغ المطلوب"
pay.payNow: "Pay now — {amount}" | "ادفعوا الآن — {amount}"
pay.payShort: "Pay now" | "ادفعوا الآن"
pay.paying: "Processing…" | "جارٍ الدفع…"
pay.validUntil: "This link is valid until {date}." | "هذا الرابط صالح حتى {date}."
pay.confirmingTitle: "Thank you. We are confirming your payment." | "شكرًا لكم. نؤكّد دفعتكم الآن."
pay.confirmingBody: "This takes a few seconds. Your invoice will arrive by email." | "يستغرق ذلك بضع ثوانٍ، وستصلكم الفاتورة عبر البريد الإلكتروني."
pay.paidTitle: "Thank you. Your payment is received." | "شكرًا لكم. استلمنا دفعتكم."
pay.paidBody: "Your florist will compose your arrangement by hand and send a photograph on WhatsApp for your approval before it leaves the atelier." | "سينسّق منسّق الزهور باقتكم يدويًا، ويرسل لكم صورة عبر واتساب لموافقتكم قبل خروجها من الأتيليه."
pay.expiredTitle: "This payment link has expired." | "انتهت صلاحية رابط الدفع."
pay.expiredBody: "Nothing has been charged. Message us and we will send you a new link." | "لم يُخصم أي مبلغ. تواصلوا معنا وسنرسل لكم رابطًا جديدًا."
pay.cancelledTitle: "This payment request was cancelled." | "أُلغي طلب الدفع هذا."
pay.cancelledBody: "Nothing has been charged. If this is unexpected, message us and a florist will help." | "لم يُخصم أي مبلغ. إن لم تتوقعوا ذلك، تواصلوا معنا وسيساعدكم أحد منسّقي الزهور."
pay.invalidTitle: "We could not find this payment link." | "لم نعثر على رابط الدفع هذا."
pay.invalidBody: "Please open the link from your most recent email, or message us." | "يُرجى فتح الرابط من أحدث رسالة وصلتكم، أو تواصلوا معنا."
pay.whatsapp: "Message us on WhatsApp" | "تواصلوا معنا عبر واتساب"
pay.invoice.title: "Invoice" | "فاتورة"
pay.invoice.taxTitle: "Tax invoice" | "فاتورة ضريبية"
pay.invoice.number: "Invoice no." | "رقم الفاتورة"
pay.invoice.date: "Date" | "التاريخ"
pay.invoice.order: "Order" | "الطلب"
pay.invoice.billedTo: "Billed to" | "الفاتورة إلى"
pay.invoice.description: "Description" | "الوصف"
pay.invoice.qty: "Qty" | "الكمية"
pay.invoice.amount: "Amount" | "المبلغ"
pay.invoice.subtotal: "Subtotal" | "المجموع الفرعي"
pay.invoice.total: "Total" | "الإجمالي"
pay.invoice.vatIncluded: "Includes VAT ({rate}%)" | "يشمل ضريبة القيمة المضافة ({rate}%)"
pay.invoice.paidByCard: "Paid by card on {date}" | "مدفوعة بالبطاقة بتاريخ {date}"
pay.invoice.trn: "TRN {trn}" | "الرقم الضريبي {trn}"
pay.invoice.print: "Print or save as PDF" | "طباعة أو حفظ بصيغة PDF"
pay.bespokeDefault: "Bespoke arrangement" | "تنسيق خاص"
server.pay.linkInvalid: "This payment link is not valid. Please open the link from your most recent email." | "رابط الدفع غير صالح. يُرجى فتح الرابط من أحدث رسالة وصلتكم."
server.pay.linkExpired: "This payment link has expired. Message us for a new one." | "انتهت صلاحية رابط الدفع. تواصلوا معنا للحصول على رابط جديد."
server.pay.cancelled: "This payment request was cancelled. Nothing has been charged." | "أُلغي طلب الدفع هذا، ولم يُخصم أي مبلغ."
server.pay.alreadyPaid: "This has already been paid. Thank you." | "تم الدفع مسبقًا. شكرًا لكم."
server.pay.processing: "Your payment is being confirmed. Please do not pay again." | "دفعتكم قيد التأكيد. يُرجى عدم الدفع مرة أخرى."
server.pay.failed: "We could not start the payment. Nothing has been charged — please try again." | "تعذّر بدء عملية الدفع، ولم يُخصم أي مبلغ. يُرجى المحاولة مرة أخرى."

B. ADMIN — src/admin/i18n/en.ts and ar.ts (Messages is derived from en.ts; ar must match)
enquiries.quote.title: "Payment" | "الدفع"
enquiries.quote.intro: "Confirm the arrangement and email the customer a payment link." | "أكّدوا التنسيق وأرسلوا للعميل رابط الدفع بالبريد الإلكتروني."
enquiries.quote.open: "Confirm & request payment" | "تأكيد وطلب الدفع"
enquiries.quote.dialogTitle: "Confirm and request payment" | "تأكيد وطلب الدفع"
enquiries.quote.amount: "Final amount" | "المبلغ النهائي"
enquiries.quote.amountHint: "Indicative total was {amount}." | "كان الإجمالي التقريبي {amount}."
enquiries.quote.description: "Shown to the customer as" | "يظهر للعميل باسم"
enquiries.quote.deliveryDate: "Delivery date" | "تاريخ التوصيل"
enquiries.quote.timeSlot: "Time window" | "فترة التوصيل"
enquiries.quote.address: "Delivery address" | "عنوان التوصيل"
enquiries.quote.emirate: "Abu Dhabi only" | "أبوظبي فقط"
enquiries.quote.phone: "Customer phone" | "هاتف العميل"
enquiries.quote.gift: "Gift details" | "تفاصيل الهدية"
enquiries.quote.recipientName: "Recipient name" | "اسم المستلم"
enquiries.quote.recipientPhone: "Recipient phone" | "هاتف المستلم"
enquiries.quote.cardMessage: "Card message" | "رسالة البطاقة"
enquiries.quote.note: "Note to the customer" | "ملاحظة للعميل"
enquiries.quote.noteHint: "Included in the email. Optional." | "تُضاف إلى الرسالة. اختياري."
enquiries.quote.language: "Email language" | "لغة الرسالة"
enquiries.quote.summary: "{name} ({email}) will be emailed a link to pay {amount}. The link is valid for {days} days." | "سيصل إلى {name} ({email}) رابط لدفع {amount}. الرابط صالح لمدة {days} أيام."
enquiries.quote.submit: "Confirm and send — {amount}" | "تأكيد وإرسال — {amount}"
enquiries.quote.amountRow: "Amount" | "المبلغ"
enquiries.quote.order: "Order" | "الطلب"
enquiries.quote.sentTo: "Sent to" | "أُرسل إلى"
enquiries.quote.lastSent: "Last sent" | "آخر إرسال"
enquiries.quote.sentCount: { one: "sent {count} time", other: "sent {count} times" } | Arabic plural forms (zero/one/two/few/many/other) of "أُرسل {count} مرة"
enquiries.quote.expires: "Link expires" | "تنتهي صلاحية الرابط"
enquiries.quote.paidOn: "Paid on" | "تاريخ الدفع"
enquiries.quote.invoice: "Invoice no." | "رقم الفاتورة"
enquiries.quote.resend: "Resend email" | "إعادة إرسال الرسالة"
enquiries.quote.newLink: "Send a new link" | "إرسال رابط جديد"
enquiries.quote.copy: "Copy payment link" | "نسخ رابط الدفع"
enquiries.quote.copied: "Link copied." | "تم نسخ الرابط."
enquiries.quote.cancel: "Cancel request" | "إلغاء طلب الدفع"
enquiries.quote.cancelTitle: "Cancel this payment request?" | "إلغاء طلب الدفع هذا؟"
enquiries.quote.cancelBody: "The link will stop working. Nothing has been charged." | "سيتوقف الرابط عن العمل. لم يُخصم أي مبلغ."
enquiries.quote.again: "Confirm again" | "تأكيد من جديد"
enquiries.quote.openOrder: "Open order" | "فتح الطلب"
enquiries.quote.viewInvoice: "View invoice" | "عرض الفاتورة"
enquiries.quote.emailNotSent: "The email was not sent ({status}). Copy the link and send it on WhatsApp, or resend." | "لم تُرسل الرسالة ({status}). انسخوا الرابط وأرسلوه عبر واتساب، أو أعيدوا الإرسال."
orders.detail.awaitingQuote: "Awaiting payment. The customer was emailed a link on {date}. This order cannot be prepared until it is paid." | "بانتظار الدفع. أُرسل الرابط إلى العميل بتاريخ {date}. لا يمكن تحضير الطلب قبل الدفع."
orders.detail.openEnquiry: "Open the enquiry" | "فتح الاستفسار"
orders.detail.invoiceLine: "Invoice {number} · paid {date}" | "الفاتورة {number} · دُفعت {date}"
orders.detail.customerNote: "Note sent to the customer" | "الملاحظة المرسلة للعميل"
actions.quote.confirmed: "Confirmed. Payment link sent to {email}." | "تم التأكيد وأُرسل رابط الدفع إلى {email}."
actions.quote.confirmedEmailNotSent: "Confirmed, but the email was not sent. Copy the payment link and send it yourself." | "تم التأكيد، لكن الرسالة لم تُرسل. انسخوا رابط الدفع وأرسلوه بأنفسكم."
actions.quote.resent: "Payment link sent again." | "أُعيد إرسال رابط الدفع."
actions.quote.cancelled: "Payment request cancelled." | "أُلغي طلب الدفع."
actions.quote.alreadyConfirmed: "This enquiry already has a payment request. Cancel it first to send a new amount." | "لهذا الاستفسار طلب دفع قائم. ألغوه أولًا لإرسال مبلغ جديد."
actions.quote.notQuotable: "This kind of enquiry cannot be sent a payment request." | "لا يمكن إرسال طلب دفع لهذا النوع من الاستفسارات."
actions.quote.notAwaiting: "This request is already paid or cancelled." | "هذا الطلب مدفوع أو ملغى بالفعل."
actions.quote.paymentInProgress: "A payment is in progress or has just been received, so this cannot be cancelled." | "هناك دفعة قيد التنفيذ أو استُلمت للتو، لذا لا يمكن الإلغاء."
actions.quote.paymentsOff: "Card payments are not set up on this site yet." | "الدفع بالبطاقة غير مفعّل على الموقع بعد."
actions.quote.tooOften: "That was sent a moment ago. Please wait before sending again." | "أُرسلت قبل لحظات. يُرجى الانتظار قبل الإرسال مجددًا."
actions.quote.failed: "The payment request could not be created." | "تعذّر إنشاء طلب الدفع."
actions.order.awaitingPayment: "This order is waiting for payment and cannot be moved yet." | "هذا الطلب بانتظار الدفع ولا يمكن تغيير حالته بعد."
actions.validation.amountRequired: "Enter the final amount in dirhams." | "أدخلوا المبلغ النهائي بالدرهم."
actions.validation.amountTooLow: "The amount must be at least AED 2." | "يجب ألا يقل المبلغ عن AED 2."
actions.validation.deliveryDateRequired: "Choose the delivery date." | "اختاروا تاريخ التوصيل."
actions.validation.deliveryDatePast: "The delivery date is in the past." | "تاريخ التوصيل في الماضي."
actions.validation.slotRequired: "Choose a time window." | "اختاروا فترة التوصيل."
actions.validation.addressRequired: "Enter the delivery address." | "أدخلوا عنوان التوصيل."
actions.validation.phoneFormat: "Enter the phone in international format, e.g. +971501234567." | "أدخلوا الهاتف بالصيغة الدولية، مثل ‎+971501234567."
actions.fieldLabels["Final amount"]: "Final amount" | "المبلغ النهائي"
labels.payRequest: awaiting "Awaiting payment" | "بانتظار الدفع"; expired "Link expired" | "انتهت صلاحية الرابط"; cancelled "Cancelled" | "ملغى"; paid "Paid" | "مدفوع"
labels.source.quote: "Confirmed enquiry" | "استفسار مؤكَّد"
labels.emailType (new group; use it on /admin/emails): payment-request "Payment request" | "طلب دفع"; payment-received "Thank you and invoice" | "شكر وفاتورة"; owner-quote-paid "Owner — bespoke paid" | "المالك — تم دفع طلب خاص" (plus the seven existing types).
Add `payRequest` to TONES in src/admin/lib/status.ts: awaiting warning, expired neutral, cancelled neutral, paid success.

C. EMAIL COPY lives in src/backend/email/quote-emails.ts (EN + AR, see the emails section). Have a native speaker read every Arabic string before launch; all use the plural address and none uses طازج.

## tests

All vitest, colocated like the existing *.test.ts files. Every money rule below is a required test.

src/backend/payments/pay-link.test.ts
- payToken is deterministic for the same secret + salt, 43 chars, URL-safe; differs when the salt or the secret differs.
- newPayTokenSalt returns 32 bytes of entropy (decoded length 32) and two calls differ.
- hashPayToken is 64 hex chars and is not the token.
- isPayTokenShape rejects short, long, and non-base64url input.
- payLinkExpiry adds exactly 7 days.
- payRequestState: paid beats cancelled beats expired; REFUNDED counts as paid; missing expiry is expired; expiry equal to now is expired; a future expiry is awaiting.

src/backend/domain/quote.test.ts
- suggestedQuoteFils precedence: indicativeTotalFils, then the message regex ("Indicative total: AED 650" → 65000; "AED 650.50" → 65050), then budgetFils, then null.
- parseBespokeMessage extracts recipient name and phone; returns empty for "For: themselves".
- parseQuoteForm: "650" → 65000; "650.5" → 65050; "0.29" → 29 is rejected as below minimum; "1.99" rejected (amountTooLow); empty rejected (amountRequired); "12,50" and "abc" rejected (amountFormat); above MAX_PRICE_AED rejected; yesterday's date rejected; unknown slot rejected; non-E.164 phones rejected; a note over 600 characters rejected.
- quoteOrderData: exactly one item with product undefined, productSlug "bespoke-arrangement", quantity 1, unit = line = subtotal = total = amount, deliveryFeeFils 0, discountFils 0, paymentStatus PENDING, source "admin-quote", customerType matches whether a customer id was passed. Feed the result to validateOrderTotals and assert it passes.

src/backend/payload/hooks/orderIntegrity.test.ts (new)
- validateBespokeLines: admin-quote without enquiry throws; admin-quote with a product id on a line throws; admin-quote under 200 fils throws; a web-checkout order with a product-less line throws; a web-checkout order using the bespoke slug throws; a normal web-checkout order passes unchanged.
- guardInvoiceNumber: changing a set invoice number throws; setting it the first time passes.
- guardPaymentStatus regression: PENDING → PAID without the provider context still throws.

src/backend/domain/invoice.test.ts
- formatInvoiceNumber(2026, 1) = "CAL-INV-2026-00001"; (2026, 99999) = "CAL-INV-2026-99999"; (2026, 100000) = "CAL-INV-2026-100000".
- invoiceYear: 2026-12-31T21:00:00Z is 2027 in Dubai.
- vatIncludedFils(10500, 500) = 500; (65000, 500) = 3095; (x, 0) = 0; result is always an integer.
- buildInvoice: throws without an invoice number; lines + delivery − discount = total; vat is null when rate is 0; seller fields that are null are absent.
- Snapshot rule: build the invoice, then mutate a fake product record → invoice unchanged (it never reads the relation).

src/lib/business.test.ts
- If BUSINESS.vatRegistered is true, trn matches /^\d{15}$/ and legalName is set (the build fails before a tax invoice can go out without them).

src/backend/payments/paid.test.ts (new; fake Payload + injected claimInvoice + recording email provider via setEmailProvider)
- mark-paid on an admin-quote order: updates with the provider context, calls claimInvoice once, sends exactly payment-received + owner-quote-paid + florist-job-sheet, sets the enquiry to CONVERTED, moves fulfilment NEW → CONFIRMED.
- claimedNow false → no emails, returns "already-paid" (duplicate delivery).
- already PAID but invoiceNumber empty → claims and sends (crash recovery).
- already PAID with an invoice → nothing happens.
- amount mismatch (intent 64900 vs order 65000) → flagged, no claim, no emails (existing verdict test extended with an admin-quote fixture).
- claimInvoice throwing → the function rejects (so the route returns 500 and Stripe retries).
- a web-checkout order still sends the original three emails.
- paid after cancellation → still PAID, internal note added, owner email carries the warning line.

src/backend/payments/intent.test.ts (fake Stripe client)
- no stored id → create called with amount === order.totalFils, currency "aed", metadata.kind "order", idempotencyKey `order-${id}`; the id is stored.
- stored id, status requires_payment_method → retrieve only, no create.
- stored id, status succeeded or processing → reported as processing, no create.
- stored id, status canceled → a new intent with a different idempotency key.
- intent amount different from the order total → error, no client secret returned.

src/backend/email/email.test.ts (extend)
- payment-request EN and AR: subject and body contain "AED 650", the pay URL, the order number, the expiry date; AR html has dir="rtl" and lang="ar"; the text part contains the URL; neither language contains "same-day"/"same day" and the Arabic contains no "طازج".
- payment-received: contains the invoice number, the total, "Paid by card"; VAT line present only when vat is non-null; TRN absent when null.
- floristJobSheet for a bespoke order still passes the existing mentionsMoney === false check.
- COPY.en and COPY.ar have identical key sets.

i18n tests: src/lib/i18n/dictionary.test.ts and src/admin/i18n/i18n.test.ts already assert en/ar parity — run them; add an assertion that pay.payNow in Arabic starts with "ادفعوا".

src/backend/security: LIMITS.payView / payStart / payResend exist and a caller over payStart is refused (extend the throttle test with resetThrottleMemory).

src/admin/rtl-guard.test.ts must stay green with QuotePayment.tsx.

Manual / integration checklist (Stripe test mode + `stripe listen --forward-to localhost:3000/api/webhooks/stripe`), not automated:
1. Confirm an enquiry for AED 650 → order PENDING, email logged, link opens at 390px in EN and AR.
2. Pay with 4242… → page shows "confirming" then the invoice; order PAID with CAL-INV-YYYY-00001; three emails logged once each.
3. `stripe events resend` the same event → nothing new in email_log, no second invoice number.
4. Two orders paid back to back → 00001 and 00002, no gap. Run claimInvoice concurrently for the same order (two parallel calls) → one claimedNow true, counter advanced by exactly 1.
5. 3-D Secure card (4000 0027 6000 3184) → returns to /pay/[token]?payment_intent=… and shows "confirming".
6. Apple Pay on iPhone Safari and Google Pay on Android Chrome show and complete (the domain must be registered for Apple Pay in Stripe).
7. Open the link 25 hours after first pressing pay → the same PaymentIntent is reused (check the Stripe dashboard shows one intent).
8. Cancel in admin → link shows cancelled; a tab left open can no longer pay (intent cancelled).
9. Set pay_link_expires_at in the past in a dev database → expired page; Resend → works again with the same URL.
10. Tampered token, another order's token, /pay/x → the "not found" state, no data.
11. Lighthouse mobile on /pay/[token] >= 90.

## edgeCases

Money and payment
- Idempotency key lifetime: Stripe forgets keys after about 24h; the stored stripePaymentIntentId is what prevents a second intent on a 7-day link. Two tabs pressing pay in the same second both send key order-{id} and get the same intent.
- Customer pays twice in two tabs: one intent → the second confirm fails at Stripe ("already succeeded"); startQuotePayment returns PROCESSING once the intent is processing/succeeded.
- Webhook arrives twice or concurrently: claimInvoice has exactly one winner; only the winner emails.
- Crash after PAID but before the invoice: Stripe's retry finds PAID + no invoice and completes it.
- Amount or currency mismatch: existing paymentVerdict flags it, nothing is fulfilled, no invoice is issued.
- Paid after the link expired (a tab was already open with a client secret): accepted and marked PAID — money captured always produces an order (docs/ORDERS.md §7).
- Paid after cancellation (cancel raced the payment): cancelPaymentRequest cancels the intent first and refuses if Stripe says it is processing/succeeded; if it still slips through, the order becomes PAID with a loud internal note and owner email, and a human refunds in Stripe or reinstates.
- Staff typed the wrong amount: totals are immutable. Fix = Cancel request, then Confirm again (new order, new link; the old link shows "cancelled"). If already paid: refund in Stripe.
- Amount below AED 2 or absurdly high: rejected at parse time and again by the collection hook.
- Refunds: not part of this feature; the invoice stays. A credit note series is a later step.
- VAT switched on later: old orders keep vatRateBps 0 because it is snapshotted at payment.
- Invoice year boundary: the year is Dubai time; the counter restarts at 00001 per year by design (one row per year).

Link and token
- Mail scanners and link previews fetch the URL: GET has no side effects.
- Token leaked through Referer: prevented by referrer no-referrer. Forwarded email: whoever holds the link can pay or see the invoice (name, email, items, total — no phone, no address on the invoice block); it grants nothing else.
- PAYLOAD_SECRET rotated: old links stop resolving for resend; resendPaymentRequest detects the hash mismatch, stores the new hash and sends a working link.
- Unknown, malformed, wrong-source or other-environment token: one generic "not found" state.
- Rate limit hit on the page or on pay: a visible "please wait" message in the visitor's language, never a blank page.

Admin
- Double click / two staff confirming: the partial unique index lets one through; the other gets "already has a payment request".
- Email not sent (no Resend key, suppressed on preview, provider down): the order still exists, the action says so, the card shows a warning and "Copy payment link" for WhatsApp.
- Customer email on the enquiry is wrong: contact fields are immutable; cancel, then create the corrected enquiry by hand (or send the copied link by WhatsApp — Stripe's receipt and our invoice email would still go to the stored address). Flagged in open questions.
- Enquiry without a valid phone (older or hand-made rows): the dialog requires one because Orders.customerPhone is required E.164.
- Stripe keys missing: confirm is refused before anything is created.
- Florist tries to advance an unpaid quote order: refused server-side (actions.order.awaitingPayment), so no "your order is confirmed" email can go out before payment.
- Staff changes the enquiry status by hand to something else while a request is live: allowed; the Payment card still shows the truth from the order.
- EVENT enquiries: one line, one amount, one delivery date/window. Deposits and part-payments are out of scope.
- Customer account link: only when the enquiry already has a customer or a VERIFIED account has the same email; otherwise guest. The order then appears in that account's order history; the bespoke line must not link to a product page.
- Dashboard and alerts: verify src/backend/data/admin-pulse.ts and dashboard.ts — an unpaid quote order must not raise a "New order" alert or count as paid revenue; exclude source "admin-quote" while paymentStatus is not PAID from the new-order pulse.
- Delivery date already passed by the time the customer pays: the payment is still accepted; the florist sees the date on the job sheet and reschedules by phone.
- Language unknown on old enquiries: the dialog's Email language select defaults to English.
- Preview deployments: emails are allowlisted (existing rule) and links point at the preview host.
- Existing docs describe tables that do not exist (payments, webhook_events, counters, email_events). This spec follows the code, and docs/PAYMENTS.md, ORDERS.md, EMAILS.md, ADMIN.md should get a short section for this feature when it is built.

## buildOrder

1. 1. Pure domain + tests (no schema): src/backend/payments/pay-link.ts, src/backend/domain/quote.ts, src/backend/domain/invoice.ts, src/lib/business.ts with their test files. Verify: `pnpm test` green, `pnpm typecheck` clean.
2. 2. Schema: add the fields to src/collections/Orders.ts and Enquiries.ts, the three email types to EmailLog.ts and email/types.ts, the hooks validateBespokeLines and guardInvoiceNumber; run `pnpm migrate:create quote_pay_link`, hand-add the enum values, invoice_counters table and the partial unique index, write `down`, register in src/migrations/index.ts, run `pnpm generate:types`. Verify: migration applies and rolls back on a scratch database; existing web checkout still creates an order; hook tests green.
3. 3. Record language and indicative total on new enquiries: actions/enquiry.ts and membership-enquiry.ts write `locale`; BYO writes buildYourOwn.indicativeTotalFils. Verify: submit a BYO enquiry in Arabic and see locale 'ar' and the fils value on the row.
4. 4. Invoice claim + paid path: src/backend/payments/invoice-number.ts (claimInvoice) and the changes to src/backend/payments/paid.ts (crash-recovery branch, claim gate, admin-quote branch with a temporary plain email). Verify: paid.test.ts green; with Stripe CLI a normal web-checkout payment gets CAL-INV-YYYY-00001 and resending the event sends no second email.
5. 5. Emails: export helpers and add the locale parameter to `shell` in templates.ts; build src/backend/email/quote-emails.ts (payment-request, payment-received, owner-quote-paid) in EN and AR; extend resendLoggedEmail for the new types. Verify: email tests green; render both languages to HTML files in the scratchpad and read them in a mail client at phone width.
6. 6. PaymentIntent helper: src/backend/payments/intent.ts (ensureOrderPaymentIntent) with tests; add LIMITS.payView / payStart / payResend. Verify: intent.test.ts green.
7. 7. Admin actions: src/backend/actions/quotes.ts (confirmEnquiryQuote, resendPaymentRequest, cancelPaymentRequest), src/backend/data/quote.ts, the guard in updateOrderFulfilment. Verify with a signed-in staff user: confirm creates one PENDING order and one email_log row and one activity row; a second confirm is refused; cancel sets CANCELLED and returns the enquiry to IN_REVIEW.
8. 8. Admin UI: src/admin/components/QuotePayment.tsx, wire into the enquiry detail page, enquiry list badge, order detail notice / OrderOps awaitingPayment prop / invoice line, source label, email type labels, all en.ts + ar.ts keys. Verify: each of the five states at 390px in English and Arabic, light and dark; rtl-guard and admin i18n tests green.
9. 9. Customer page: extract src/components/commerce/stripe-shared.ts from CheckoutForm (verify checkout still pays), src/backend/actions/pay.ts, src/app/(frontend)/(storefront)/pay/[token]/page.tsx, src/components/commerce/PayRequestForm.tsx, dictionary keys, print styles, robots disallow, bespoke-line guard on the account order pages. Verify: the full manual checklist in the tests section, including Apple Pay, Google Pay, 3-D Secure, expired, cancelled, invalid, and Lighthouse mobile >= 90.
10. 10. Hardening and docs: dashboard/pulse exclusion for unpaid quote orders, Sentry path scrubbing for /pay, add the owner placeholders to docs/OWNER_TODO.md, add a short section to docs/PAYMENTS.md, ORDERS.md, EMAILS.md and ADMIN.md. Verify: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass; one conventional commit per step (feat(quotes): ...).

## openQuestionsForOwner

- Invoice details: what is the legal company name (English and Arabic), registered address and trade licence number to print on invoices? Until provided, invoices show only "Calanthe, Abu Dhabi, United Arab Emirates".
- VAT: is the business VAT-registered? If yes, what is the 15-digit TRN, and are your prices VAT-inclusive (the spec assumes yes: the total stays the same and the invoice shows "Includes VAT 5%")? Please confirm with your accountant before we switch the invoice to "Tax invoice".
- Who may set the final amount: both the owner and florists (as specified, with every confirmation named in the activity log), or the owner only (as event quotes are today)?
- Where should the "paid" notifications go? Today owner and florist emails both go to the single reply-to address. Please give one owner address and one florist address.
- Link validity: is 7 days right, or should it be shorter (for example 48 hours) so flowers are not held for unpaid requests?
- When staff cancel an unpaid request, should the customer get an email saying so, or is it enough that the link shows "cancelled" (as specified)?
- Should we send one automatic reminder (for example 24 hours before the link expires) if the customer has not paid? Not included in this version.
- Events: is one total paid in full enough for now, or do you need a deposit followed by a balance, and several lines on the invoice (flowers, setup, vases)?
- After payment the order is set to "Confirmed" automatically. Is that right, or do you want it to stay "New" until a florist picks it up?
- Should every paid website order (normal checkout) also show its invoice number in its confirmation email? The number is allocated for all paid orders in this design; only the bespoke email shows the full invoice for now.
- Apple Pay needs the domain www.calanthe.ae registered in the Stripe dashboard (Payment method domains). Has that been done for the live account?
- If a customer's email on an enquiry is wrong, do you want staff to be able to correct it at confirmation time? Today the contact details of an enquiry are locked.