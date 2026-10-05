# Spec: discounts

## summary

FEATURE 2 — DISCOUNTS AND OFFERS (spec only; no project file was touched). All paths are under C:\dev\calanthe\.

What I verified in the code: priceOrder (src/backend/domain/pricing.ts) hardcodes discountFils = 0; Orders already has discountFils / couponCode / couponDiscountFils and validateOrderTotals enforces line = unit x qty, subtotal = sum(lines), total = subtotal + delivery - discount; the webhook path (src/backend/payments/paid.ts + verdict.ts) marks PAID only when intent.amount === order.totalFils; the storefront catalogue is read per request with no data cache (the storefront layout calls getDictionary -> cookies(), so every storefront page renders dynamically; `revalidate = 300` on /shop and /occasions is effectively moot); the cart (src/lib/cart.tsx) hydrates prices from the catalogue once and never re-syncs; Stripe Elements runs in deferred mode with `amount` taken from the client subtotal (CheckoutForm.tsx:272); Products has a compareAtPriceFils field that the storefront never renders; nav.discounts and nav.sections.marketing keys already exist in the admin dictionaries; emails are English-only today.

Design in one paragraph: one new Payload collection `discounts` holding two kinds. AUTOMATIC SALE lowers the unit price of matching products (all / chosen products / chosen occasions / chosen categories). DISCOUNT CODE is an order-level discount typed at cart or checkout. The sale is baked into the order line's unitPriceFils (with the original kept beside it as compareAtUnitPriceFils), so the existing order invariant, the Stripe verdict and every receipt keep working unchanged; the code is the order-level discountFils (= couponDiscountFils). All arithmetic lives in one new pure shared module (src/lib/discounts.ts) used by priceOrder on the server and by the cart in the browser, so the two cannot drift. The browser never supplies a price: it sends the code text and a `shownTotalFils` assertion that can only cause a refusal (PRICE_CHANGED), never a different charge.

Money rules decided (each has a unit test):
1. A sale applies to the ARRANGEMENT = product base price + size uplift. Add-ons (vase, chocolates, balloon...) are never reduced by a sale. Reason: a "-20%" badge must be true for every size the customer can pick, while add-ons are bought-in goods at fixed margin.
2. One automatic sale per product, never stacked: the sale that gives the lowest price at the product's base (Standard) price wins; ties go to the narrower scope (products > occasions > categories > all), then the oldest (lowest id). That one sale is used for every size of that product so card, product page, cart and server agree.
3. Sale prices are whole dirhams, rounded DOWN (customer's favour): percentage -> floor(arrangementFils x (100 - p) / 10000) x 100; fixed -> floorTo100(arrangementFils - min(amountOffFils, 90% of arrangement)).
4. A code applies to the already-discounted subtotal INCLUDING sizes and add-ons (an order-level "10% off your order" must be reproducible by the customer). Max one code per order. Percentage code discount = ceil to whole dirham, capped at the subtotal; fixed = min(amount, subtotal). Minimum spend is measured on the after-sale subtotal. Delivery is never discounted; the free-delivery threshold is measured after the code (docs/ORDERS.md section 3).
5. Percentages are whole numbers 1-90 for both kinds. Total can never go below zero, and a total under AED 2.00 (Stripe's AED minimum) is refused with a clear message; there is no zero-total/free-order path because only the webhook can mark an order paid.
6. Usage is counted only when the order becomes PAID, in a single atomic SQL statement that is exactly-once per order even under duplicate webhook delivery. A code that runs out between order creation and payment is still honoured (money is captured) and flagged on the order.

Snapshot: line items store the sale unit price, the original unit price and the EN/AR label; the order stores couponCode, couponDiscountFils, a reporting link to the discount, couponRedeemedAt and a jsonb discountSnapshot of the rule terms. Editing or deleting a discount later changes no old order.

Not verified / flagged: I could not query the database, so I do not know whether any product currently has compareAtPriceFils set (see open questions). The exact SQL of the migration must come from `payload migrate:create` so the .json snapshot stays in step; the SQL I give is the expected shape to review against. Whether Stripe rejects a deferred-mode confirm when Elements amount differs from the PaymentIntent amount is my understanding of Stripe's behaviour, not something I tested here; the spec makes the two equal regardless.

## dataModel

All paths under C:\dev\calanthe\.

A. NEW COLLECTION  src/collections/Discounts.ts  (slug "discounts", register in src/payload.config.ts collections array after Products)

admin: { group: "Shop", useAsTitle: "title", defaultColumns: ["title","kind","code","active","startsAt","endsAt","timesUsed"] }
access: read isAdmin, create isAdmin, update isAdmin, delete isAdmin (from @backend/payload/access). Codes are secrets and pricing is owner-only; the storefront and checkout read through the server data layer (Local API), never through REST.
hooks.beforeValidate: [validateDiscount] (new, src/backend/payload/hooks/validateDiscount.ts, same pattern as validateProduct.ts).
timestamps: true. defaultSort: "-createdAt".

Fields (name: type — rules):
- title: text, required, maxLength 80. Internal name; customers never see it. For kind=code the action defaults it to the code when left empty.
- kind: select, required, index, options "automatic" | "code". access.update: () => false (the method cannot change after creation, as in Shopify).
- code: text, unique: true, index: true, maxLength 24. Stored UPPERCASE, null (never "") for automatic. Pattern ^[A-Z0-9][A-Z0-9_-]{2,23}$.
- valueType: select, required, options "percentage" | "fixed".
- percentOff: number, integer 1..90, null when valueType=fixed.
- amountOffFils: filsField({ name: "amountOffFils" }) from @backend/payload/fields/money, >= 100 and a multiple of 1 fil, null when valueType=percentage. Automatic: per unit. Code: once per order.
- appliesTo: select, required, defaultValue "all", options "all" | "products" | "occasions" | "categories". Must be "all" when kind=code (v1).
- products: relationship, relationTo "products", hasMany.
- occasions: relationship, relationTo "occasions", hasMany.
- categories: select, hasMany, options bouquet | vase-arrangement | box-arrangement | basket | single-stem | plant | event-piece (same values as Products.category / PRODUCT_CATEGORIES in src/backend/domain/product-form.ts).
- labelEn: text, maxLength 28. Required when kind=automatic.
- labelAr: text, maxLength 28. Required when kind=automatic.
- startsAt: date (pickerAppearance dayAndTime), optional. Inclusive.
- endsAt: date (dayAndTime), optional. Exclusive. Must be after startsAt.
- active: checkbox, defaultValue true, index.
- minSubtotalFils: filsField, optional, code only.
- usageLimit: number, integer >= 1, optional, code only.
- oncePerCustomer: checkbox, defaultValue false, code only.
- timesUsed: number, required, defaultValue 0, access { create: () => false, update: () => false }, admin readOnly. Written only by the webhook's raw SQL.

validateDiscount (merged = create ? data : {...originalDoc, ...data}); throws APIError 400 with a sentence:
- code kind: code required, normalised with normaliseCode(), matches pattern; appliesTo forced to "all"; products/occasions/categories emptied.
- automatic kind: code = null, minSubtotalFils = null, usageLimit = null, oncePerCustomer = false; labelEn and labelAr required; appliesTo "products" needs >= 1 product, "occasions" >= 1 occasion, "categories" >= 1 category.
- percentage: percentOff integer 1..90 and amountOffFils = null. fixed: amountOffFils integer >= 100 and percentOff = null.
- endsAt, when present, strictly after startsAt (or after createdAt/now when startsAt is empty).

B. ORDERS — additive fields in src/collections/Orders.ts
Inside items[] (all access-inherited from the immutable array):
- compareAtUnitPriceFils: filsField, optional. The full unit price (arrangement + add-ons) before the sale. Null when the line had no sale.
- saleLabelEn: text, maxLength 28, optional.
- saleLabelAr: text, maxLength 28, optional.
- sale: relationship, relationTo "discounts", optional. Reporting link only; never read for display or price (same rule as items.product).
In the "Totals (snapshot)" collapsible, all with access: immutableAfterCreate unless stated:
- couponDiscount: relationship, relationTo "discounts", optional, index. Reporting link + the id the webhook increments.
- discountSnapshot: json, optional. Shape: { coupon: { id, title, code, valueType, percentOff, amountOffFils, minSubtotalFils } | null, sales: [{ id, title, labelEn, labelAr, valueType, percentOff, amountOffFils }] }. This is the "why was the discount that amount" record (docs/ORDERS.md section 4 couponSnapshot).
- couponRedeemedAt: date, optional, access { create: () => false, update: () => false }, admin readOnly. Set by the webhook SQL only.
Existing fields keep their meaning, now defined precisely: unitPriceFils = what the customer pays per unit (sale already applied); subtotalFils = sum of lines (after sale); discountFils = order-level discount = couponDiscountFils; couponCode = the code as redeemed (uppercase).

C. INTEGRITY HOOK  src/backend/payload/hooks/orderIntegrity.ts  validateOrderTotals (create only; existing checks untouched, add):
- per item: compareAtUnitPriceFils, when present, is an integer and > unitPriceFils.
- coupon = Number(data.couponDiscountFils ?? 0): integer >= 0; coupon <= discountFils; coupon <= subtotalFils.
- coupon > 0 requires a non-empty couponCode; an empty couponCode requires coupon === 0.
The total equation stays total = subtotal + delivery - discount, so paymentVerdict is unchanged.

D. MIGRATION — one new file pair, generated, never hand-written without its snapshot:
Run `npm run migrate:create -- discounts` after the collection changes -> src/migrations/<timestamp>_discounts.ts + .json, and the entry appended to src/migrations/index.ts. Then `npm run generate:types`. Review the generated `up` against this expected, purely additive content:
- CREATE TYPE enum_discounts_kind ('automatic','code'); enum_discounts_value_type ('percentage','fixed'); enum_discounts_applies_to ('all','products','occasions','categories'); enum_discounts_categories (the seven category values).
- CREATE TABLE "discounts" (id serial PK, title varchar NOT NULL, kind enum NOT NULL, code varchar, value_type enum NOT NULL, percent_off numeric, amount_off_fils numeric, applies_to enum DEFAULT 'all' NOT NULL, label_en varchar, label_ar varchar, starts_at timestamp(3) with time zone, ends_at timestamp(3) with time zone, active boolean DEFAULT true, min_subtotal_fils numeric, usage_limit numeric, once_per_customer boolean DEFAULT false, times_used numeric DEFAULT 0 NOT NULL, updated_at, created_at).
- CREATE TABLE "discounts_categories" (order integer NOT NULL, parent_id integer NOT NULL -> discounts ON DELETE cascade, value enum_discounts_categories, id serial PK).
- CREATE TABLE "discounts_rels" (id serial PK, order integer, parent_id integer NOT NULL -> discounts cascade, path varchar NOT NULL, products_id integer -> products cascade, occasions_id integer -> occasions cascade).
- CREATE UNIQUE INDEX discounts_code_idx ON discounts (code) (Postgres treats NULLs as distinct, so many automatic rows with null code are fine); plain indexes on kind, active, created_at, updated_at and the rels/categories parent + order columns.
- ALTER TABLE "orders_items" ADD COLUMN compare_at_unit_price_fils numeric, sale_label_en varchar, sale_label_ar varchar, sale_id integer (FK -> discounts ON DELETE set null, index).
- ALTER TABLE "orders" ADD COLUMN coupon_discount_id integer (FK -> discounts ON DELETE set null, index), discount_snapshot jsonb, coupon_redeemed_at timestamp(3) with time zone.
- ALTER TABLE "payload_locked_documents_rels" ADD COLUMN discounts_id integer + FK + index (Payload adds this for every collection; see 20260925_181233_a3_activity_log.ts).
Every new column is nullable or defaulted, so existing rows and the currently deployed code keep working (backward compatible). `down` drops exactly these. If the generated column names differ from the ones above, the raw SQL in section serverLogic (redeemCoupon) must be adjusted to the generated names — check before writing it.
No change to the activity_log enums: discount actions are logged with area "other".

## serverLogic

1. NEW PURE SHARED MODULE  src/lib/discounts.ts  (no imports from server code; used by browser and server)

export const MAX_DISCOUNT_PERCENT = 90;
export const MIN_CHARGE_FILS = 200;
export type DiscountValue = { valueType: "percentage" | "fixed"; percentOff: number; amountOffFils: number };
export type DiscountWindow = { active: boolean; startsAt?: string | null; endsAt?: string | null };
export type DiscountStatus = "active" | "scheduled" | "expired" | "draft";
export function discountStatus(d: DiscountWindow, now: Date): DiscountStatus
  // precedence: endsAt <= now -> "expired"; !active -> "draft"; startsAt > now -> "scheduled"; else "active". startsAt inclusive, endsAt exclusive.
export function normaliseCode(raw: string): string   // trim, remove inner whitespace, toUpperCase
export function saleUnitFils(arrangementFils: number, v: DiscountValue): number
  // percentage: Math.floor((arrangementFils * (100 - p)) / 10000) * 100, p clamped to 1..90
  // fixed: off = Math.min(v.amountOffFils, Math.floor(arrangementFils * 90 / 100)); Math.floor((arrangementFils - off) / 100) * 100
  // returns arrangementFils unchanged if the result would not be strictly lower or is not a safe integer >= 0
export function couponDiscountFils(subtotalFils: number, v: DiscountValue): number
  // percentage: Math.min(subtotalFils, Math.ceil((subtotalFils * p) / 10000) * 100); fixed: Math.min(v.amountOffFils, subtotalFils)
export type SaleRule = DiscountValue & DiscountWindow & { id: string; title: string; labelEn: string; labelAr: string; appliesTo: "all" | "products" | "occasions" | "categories"; productIds: readonly string[]; occasionIds: readonly string[]; categories: readonly string[] };
export type SaleTarget = { id: string; priceFils: number; occasionIds: readonly string[]; category: string };
export function saleMatches(rule: SaleRule, target: SaleTarget): boolean
export function bestSaleFor(target: SaleTarget, rules: readonly SaleRule[], now: Date): SaleRule | null
  // only rules with discountStatus === "active" that match and actually lower target.priceFils; lowest saleUnitFils(target.priceFils) wins; tie -> scope rank products(0) < occasions(1) < categories(2) < all(3); tie -> lowest numeric id
export type CouponRule = DiscountValue & DiscountWindow & { id: string; title: string; code: string; minSubtotalFils: number; usageLimit: number | null; timesUsed: number; oncePerCustomer: boolean };
export type CouponRefusal = "inactive" | "min_spend" | "exhausted" | "already_used";
export function checkCoupon(c: CouponRule, facts: { now: Date; subtotalFils: number; emailHasUsed: boolean }): { ok: true } | { ok: false; reason: CouponRefusal; shortfallFils?: number }
  // order of checks: status !== active -> inactive; usageLimit !== null && timesUsed >= usageLimit -> exhausted; oncePerCustomer && emailHasUsed -> already_used; subtotalFils < minSubtotalFils -> min_spend with shortfallFils

2. EXTEND  src/backend/domain/pricing.ts  (still pure; `now` is passed in)

export type OrderDiscounts = { sales: readonly SaleRule[]; coupon: CouponRule | null; emailHasUsedCoupon: boolean; now: Date };
PricedLine gains: compareAtUnitPriceFils: number | null; sale: { id: string; title: string; labelEn: string; labelAr: string; valueType; percentOff; amountOffFils } | null.
PricedOrder gains: saleSavingsFils: number; couponDiscountFils: number; coupon: CouponRule | null; couponRefusal: { reason: CouponRefusal; shortfallFils?: number } | null. discountFils stays and always equals couponDiscountFils.
export function priceLine(line: CheckoutLineRequest, product: Product, sale?: SaleRule | null): PricedLine
  arrangement = Number(product.priceFils) + aedToFils(size.priceDeltaAed); saleArrangement = sale ? saleUnitFils(arrangement, sale) : arrangement; addons = sum; unitPriceFils = saleArrangement + addons; compareAtUnitPriceFils = saleArrangement < arrangement ? arrangement + addons : null; lineTotalFils = unitPriceFils * quantity (exact; the invariant in orderIntegrity needs this). Existing guards stay (unit > 0).
export function priceOrder(lines, products, emirate, discounts?: OrderDiscounts): PricedOrder
  4th parameter optional so existing callers/tests compile and behave identically without it.
  per line: target = { id, priceFils, occasionIds (product.occasions mapped to ids whether depth 0 or 1), category }; sale = bestSaleFor(target, discounts.sales, discounts.now).
  subtotalFils = sum(lineTotalFils); saleSavingsFils = sum((compareAt - unit) * qty).
  coupon: if discounts.coupon -> checkCoupon(...subtotalFils...) ; ok -> couponDiscountFils = couponDiscountFils(subtotalFils, coupon); refused -> couponDiscountFils = 0, coupon = null, couponRefusal set (the CALLER decides whether that is an error).
  fee = deliveryFeeFils(emirate, subtotalFils - couponDiscountFils); totalFils = subtotalFils - couponDiscountFils + fee.
  throws INVALID_TOTAL if total < 0 or unsafe; throws "TOTAL_TOO_LOW: ..." if 0 <= total < MIN_CHARGE_FILS.

3. NEW SERVER DATA LAYER  src/backend/data/discounts.ts  (Local API with default access, like products.ts; explicit field mapping = allow-list; no "server-only" import for the same CLI reason noted in products.ts)
export const getLiveSaleRules = cache(async (): Promise<SaleRule[]>)  // react `cache`, one query per request: kind=automatic, active=true, (startsAt not exists or <= now), (endsAt not exists or > now), depth 0, limit 100
export async function findCoupon(code: string): Promise<CouponRule | null>   // kind=code AND code equals normaliseCode(code), depth 0
export async function emailHasRedeemed(couponId: string, email: string): Promise<boolean>   // payload.count orders where couponDiscount equals id AND customerEmail equals lowercased email AND couponRedeemedAt exists
src/backend/data/products.ts: every query also awaits getLiveSaleRules() and calls toStorefrontProduct(doc, sales = [], now = new Date()), which attaches `sale` (see storefrontUx for the ProductSale shape) via bestSaleFor. Keep the second parameter optional so products.test.ts keeps passing. Nothing else about a discount (title, usage, code) may reach the browser.

4. ONE PRICING ENTRY FOR BOTH ACTIONS  src/backend/data/checkout-pricing.ts
export async function priceCheckout(payload, input: { lines: CheckoutLineRequest[]; deliveryEmirate: string; discountCode?: string; customerEmail?: string }, now: Date): Promise<{ priced: PricedOrder; products: Map<string, Product> }>
  loads products exactly as startCardCheckout does today (available, overrideAccess: false), loads getLiveSaleRules(), findCoupon(code) when a code is given (unknown code -> priced.couponRefusal = { reason: "inactive" }), emailHasRedeemed when coupon.oncePerCustomer and an email is given, then priceOrder. Move the existing product-load block here.

5. ACTIONS  src/backend/actions/checkout.ts
a) NEW export async function quoteCheckout(request: { lines; deliveryEmirate; discountCode?: string; customerEmail?: string }): Promise<QuoteResult>
   type CheckoutQuote = { subtotalFils; saleSavingsFils; couponCode: string | null; couponDiscountFils; deliveryFeeFils; totalFils };
   type QuoteResult = { ok: true; quote: CheckoutQuote } | { ok: false; code: "CODE_INVALID" | "CODE_MIN_SPEND" | "CODE_ALREADY_USED" | "CODE_EXHAUSTED" | "RATE_LIMITED" | "TOTAL_TOO_LOW" | "PRICING_REJECTED"; message: string; quote?: CheckoutQuote };
   Throttle first with a NEW bucket in src/backend/security/throttle.ts: LIMITS.discountCode = { name: "discount-code", limit: 12, windowSeconds: minutes(10) } keyed by clientAddress() — only when a code is present (stops code guessing). Creates nothing. On a refused code it returns ok:false with the localized message AND the quote priced without the code. "inactive" covers unknown, draft, scheduled and expired with ONE message so a stranger cannot learn which codes exist.
b) startCardCheckout: CheckoutRequest gains discountCode?: string and shownTotalFils: number. After validation call priceCheckout (replacing the inline load + priceOrder). Then, in order:
   - priced.couponRefusal set while a code was sent -> return fail with the same codes/messages as the quote. Never silently drop a code the customer was shown.
   - priced.totalFils !== request.shownTotalFils -> return { ok: false, code: "PRICE_CHANGED", message: t.server.checkout.priceChanged }; nothing is created. shownTotalFils is an ASSERTION, not an input: it is compared, never used in arithmetic, never stored, so it cannot change what is charged (document this in the file header next to the trust-boundary note).
   - payload.create order with: items[].unitPriceFils/lineTotalFils as priced, plus compareAtUnitPriceFils, saleLabelEn, saleLabelAr, sale (Number(id)) when the line has a sale; subtotalFils; deliveryFeeFils; discountFils = couponDiscountFils; couponDiscountFils; couponCode and couponDiscount (Number(id)) when a coupon applied; discountSnapshot built from priced.
   - PaymentIntent amount = priced.totalFils (unchanged line); add couponCode to metadata. Idempotency key unchanged.
   The code is therefore validated server-side at quote time AND again at pay time.

6. WEBHOOK  src/backend/payments/redeem.ts (new) + paid.ts
export async function redeemCoupon(payload: Payload, orderId: number): Promise<{ redeemed: boolean; overLimit: boolean }>
  one statement through (payload.db as { drizzle }).drizzle.execute(sql`...`) — same access pattern as hooks/orderNumber.ts:
  WITH claim AS (UPDATE orders SET coupon_redeemed_at = now() WHERE id = ${orderId} AND coupon_redeemed_at IS NULL AND coupon_discount_id IS NOT NULL RETURNING coupon_discount_id)
  UPDATE discounts d SET times_used = d.times_used + 1 FROM claim WHERE d.id = claim.coupon_discount_id RETURNING d.times_used, d.usage_limit;
  redeemed = a row came back; overLimit = usage_limit is not null and times_used > usage_limit. The claim on the order row makes the increment exactly-once per order even if Stripe delivers the event twice concurrently; a discount deleted meanwhile (FK set null) simply returns no row.
In applySucceededIntent, immediately after the PAID update and before the emails: call redeemCoupon inside its own try/catch. overLimit -> append "⚠ DISCOUNT CHECK: code <CODE> was redeemed past its limit" to internalNotes (same mechanism as the PAYMENT CHECK note). A failure is logged and never undoes PAID (docs/PAYMENTS.md section 5: a problem after capture never rolls back). OrderDoc type gains discountFils, couponCode, couponDiscountFils, items[].compareAtUnitPriceFils; pass them to buildOrderEmails (see emails).
paymentVerdict (verdict.ts) is NOT changed: totalFils already is the discounted total.
The "already-paid" branch must not call redeemCoupon again (it would be a no-op anyway because of the claim).
Usage is never decremented on refund or cancellation (same as Shopify); state this in docs/PAYMENTS.md.

7. ADMIN ACTIONS  src/backend/actions/admin.ts  (no overrideAccess; user passed; owner-only enforced by the collection access)
New pure parser src/backend/domain/discount-form.ts: export function parseDiscountForm(form: FormReader, kind: "automatic" | "code"): ParsedDiscount — reuses readText, readChecked, parseAedToFils, parseWholeNumber, parseIdList, within and FormInputError from product-form.ts/form-error.ts; converts the date+time inputs with two new helpers in src/backend/domain/dates.ts: dubaiDateTimeToIso(day: "YYYY-MM-DD", time: "HH:MM"): string (appends the existing UAE offset) and dubaiTimeInputValue(iso): string. FormInputError codes to add under actions.validation: percentRange, amountMin, codeFormat, endBeforeStart, pickAtLeastOne, labelRequired.
export async function createDiscount(kind, form): Promise<ActionResult>
export async function updateDiscount(id: number, form): Promise<ActionResult>
export async function setDiscountActive(id: number, active: boolean): Promise<ActionResult>
export async function deleteDiscount(id: number): Promise<ActionResult>   // refused when any order references it (count orders where couponDiscount equals id OR items.sale equals id) -> code actions.discount.used with the count; the owner deactivates instead
Extra save rule (in createDiscount/updateDiscount, after parsing): for a fixed automatic sale, load the matching products and refuse when amountOffFils > 90% of the cheapest one, naming it (actions.discount.tooDeep, vars name + price). priceOrder still caps defensively if a product is repriced later.
Every action: recordActivity({ area: "other", collection: "discounts", itemLabel: title, changes: diffFields(before, after, ["title","code","valueType","percentOff","amountOffFils","appliesTo","startsAt","endsAt","active","minSubtotalFils","usageLimit","oncePerCustomer"]) }) — add those labels to FIELD_LABELS and mark percentOff/amountOffFils/active NOTABLE in src/backend/activity/record.ts; then revalidatePath("/admin/discounts"), revalidatePath(`/admin/discounts/${id}/edit`) and revalidateStorefront() (existing helper: revalidatePath("/", "layout")) so the change is on the site at the next request. Extend failure()'s uniqueField to "slug" | "code" and return code actions.discount.codeTaken for a duplicate code.

8. STATE MACHINE (derived, never stored): draft (active=false) <-> active/scheduled by the Active switch; scheduled -> active at startsAt; active -> expired at endsAt; expired stays expired until the owner moves or clears endsAt. Time transitions need no cron: status is computed from `now` on every storefront request and every checkout.

9. SECURITY SUMMARY: no amount from the browser is used; codes compared after normalisation with an equality query (no LIKE); code attempts throttled; one generic invalid message; discounts collection unreadable by the public and by staff; timesUsed and couponRedeemedAt unwritable through any API; payment state still moves only in the signed webhook.

10. CACHING: storefront pages are rendered per request (layout reads the locale cookie), and products.ts/discounts.ts query Postgres directly, so there is no data cache to purge; revalidateStorefront() additionally clears any statically cached route and the client router cache picks the change up on next navigation. The remaining stale surface is the browser's in-memory cart, handled by PRICE_CHANGED plus the cart re-sync in storefrontUx.

## adminUx

Built only from src/admin/ui primitives (PageHeader, FilterBar/FilterSelect, Table/Tr/Td, Badge, ButtonLink, RowMenu, Dialog, ActionForm, FormSection, Field/Input/PrefixInput/Select/Switch/Checkbox, EmptyState, Notice, useAction). Logical CSS only (rtl-guard.test.ts). Owner only: every page checks getAdminSession().isAdmin and otherwise renders the same owner-only EmptyState pattern as occasions/new/page.tsx.

NAVIGATION  src/admin/shell/nav.ts: add a group { heading: "nav.sections.marketing", items: [{ href: "/admin/discounts", label: "nav.discounts", icon: "tag", ownerOnly: true }] } between Operations and System (both keys and the icon already exist). Update the file's comment that says discounts are absent. Remove the now-false placeholders.discounts string from en.ts/ar.ts if nothing else references it.

SCREEN 1 — LIST  src/app/(admin)/admin/(panel)/discounts/page.tsx  (server component)
- Header: title "Discounts", description "Sales that apply by themselves and codes customers type at checkout.", primary button "Create discount".
- Click "Create discount" -> a Dialog titled "Select discount type" (Shopify's pattern) with two large choices, each a ButtonLink card: "Automatic sale — A price reduction customers see on the product. No code needed." -> /admin/discounts/new?kind=automatic ; "Discount code — A code customers type in the cart or at checkout." -> /admin/discounts/new?kind=code. Client island: src/admin/components/CreateDiscountButton.tsx.
- FilterBar: search (title or code), Status select (All / Active / Scheduled / Expired / Draft), Type select (All / Automatic / Code). Filtering is done in the page on the loaded rows (limit 200), as occasions/page.tsx does, because status is derived.
- Table columns: Discount | Type | Status | Dates | Used | actions.
  Discount cell: title as the link to edit; second line = generated summary ("20% off · All products", "AED 50 off · 3 products", "10% off entire order · Minimum AED 300"); for codes the code in a monospaced chip (dir="ltr").
  Type: "Automatic" / "Code". Status Badge: Active tone success with dot, Scheduled tone info, Expired tone neutral, Draft tone warning. Dates: "1 Oct, 18:00 – 10 Oct, 23:59" in Asia/Dubai, or "No end date". Used: codes "12 / 100" or "12"; automatic = count of PAID orders where items.sale equals the id (same count pattern as deleteProduct).
  Row actions: Edit button; RowMenu with Activate/Deactivate (setDiscountActive, toast via useAction) and Delete (confirm dialog; refused with a reason when used).
  Below 768px each row becomes a card (Table already does this).
- Empty state: icon "tag", title "No discounts yet", body "Create a sale or a code. Customers see it the moment it is active.", CTA "Create discount". Notices for ?created=1 and ?deleted=1.

SCREEN 2 — CREATE  src/app/(admin)/admin/(panel)/discounts/new/page.tsx  (reads ?kind, defaults to automatic)
SCREEN 3 — EDIT    src/app/(admin)/admin/(panel)/discounts/[id]/edit/page.tsx
Both render src/admin/components/DiscountForm.tsx ("use client", ActionForm with the standard save cycle, unsaved-changes guard, Cancel link, Delete as the destructive slot on edit). Options come from a new src/backend/data/discount-form.ts getDiscountFormOptions(): products { id, name, priceFils, thumbnailUrl }, occasions { id, name }, categories from PRODUCT_CATEGORIES. Breadcrumbs: Marketing / Discounts / title. The page header on edit shows the status Badge beside the title.

Layout: two columns from xl (grid xl:grid-cols-[minmax(0,1fr)_22rem]), one column on a phone with the Summary card last before the save bar.

AUTOMATIC SALE — main column cards, in order the owner fills them:
1. "Title" — Input name=title (required, 80). Hint: "For your own reference. Customers do not see this."
2. "What customers see" — Input name=labelEn (required, max 28, counter "12/28", placeholder "Eid offer"); Input name=labelAr (required, max 28, dir="rtl", placeholder "عرض العيد"). Hint: "Shown on the product photo, the product page and in the cart."
3. "Value" — two-option segmented control name=valueType (Percentage | Fixed amount); then either a number Input name=percentOff with a "%" suffix (1–90, inputMode numeric) or a PrefixInput name=amountOffAed with prefix "AED". Hint for fixed: "Taken off each arrangement. Add-ons are not reduced."
4. "Applies to" — radio group name=appliesTo: All products / Specific products / Specific occasions / Specific categories. Choosing a specific option reveals a searchable checklist (search Input + scrollable list of Checkbox rows, min row height 44px; products show thumbnail, name and price; selected count shown as "3 selected"). Hidden inputs productIds / occasionIds / categories are submitted. For Specific products the edit page shows each selected product's resulting sale price beside its price (computed with saleUnitFils) so she sees the outcome before saving.
5. "Active dates" — Start date (type=date) + Start time (type=time), both optional and pre-filled with now on create; Checkbox "Set end date" revealing End date + End time. Hint under the card: "Abu Dhabi time."
Side column:
A. "Summary" card (live, read-only, updates as she types): the customer label, then bullets — "20% off each arrangement" / "Applies to 3 products" / "Add-ons are not reduced" / "Active from 1 Oct, 18:00" / "Ends 10 Oct, 23:59" or "No end date" / "Cannot be combined with another sale; a discount code can be added on top".
B. "Status" card: Switch name=active "Active" with hint "Off keeps it as a draft: nothing changes on the store." Under it, the computed status sentence, e.g. "Scheduled — starts in 2 days".
C. On edit only: "Performance" card: "Used on 12 paid orders".

DISCOUNT CODE — main column cards:
1. "Discount code" — Input name=code (uppercase on blur, dir="ltr", monospaced, max 24) with a "Generate" button that fills a random 8-character code from A–Z and 2–9 (no 0/O/1/I). Hint: "Customers type this in the cart or at checkout." Optional Input name=title "Internal name" (defaults to the code).
2. "Value" — Percentage | Fixed amount, as above. Hint: "Taken off the whole order, after any sale prices."
3. "Minimum purchase" — radio: No minimum / Minimum purchase amount -> PrefixInput name=minSubtotalAed (AED).
4. "Usage limits" — Checkbox "Limit the total number of times this code can be used" revealing number Input name=usageLimit; Checkbox name=oncePerCustomer "Limit to one use per customer" with hint "Checked by email address."
5. "Active dates" — same card as above.
Side column: Summary (code, "10% off entire order", "Minimum purchase of AED 300", "One use per customer", "Limited to 100 uses", dates, "Works on top of sale prices"); Status switch; Performance on edit: "Used 12 of 100" and a link "View orders" -> /admin/orders?q=<CODE> (orders search must then include couponCode: add it to listSearchableFields in Orders.ts and to the orders page query).

Save: primary button "Save discount" (create) / "Save" (edit); create redirects to /admin/discounts?created=1. Errors appear inline through the existing ActionForm failure path with translated codes; a failed save keeps everything typed. After a successful save the toast reads "Discount saved. It is live on the store." when status is active, "Discount saved. It starts on {date}." when scheduled, "Discount saved as a draft." when draft.

ORDER SCREEN  src/app/(admin)/admin/(panel)/orders/[orderNumber]/page.tsx: each item with compareAtUnitPriceFils shows the original unit price struck through beside the unit price and the saleLabelEn/Ar (by admin locale) as a neutral Badge; the existing discount row ("Discount (CODE)") stays; add a muted row "Sale savings" with the summed line savings when > 0. Money through the existing money() formatter. Staff see this (it is on the order), but not the Discounts area.

DOCS: update docs/ADMIN.md section 0.3 (move Discounts from "Not built yet" to a screen row).

## storefrontUx

Design constraints applied (CLAUDE.md): tokens only; Burnt Orange is an accent, never a fill and never small body text (it is about 3.9:1 on the page background, below AA for small text) — so prices and labels are Olive/Sage and orange appears only as a 5px dot and hairline; Cinzel uppercase 0.18em for labels; Instrument Sans for prices; corners 2px; no new motion beyond a 200ms opacity fade on the code message; everything designed at 390px first; tap targets >= 44px; logical properties so Arabic mirrors. No invented urgency: the only time claim shown is the real endsAt.

TYPES  src/lib/data.ts
export type ProductSale = { id: string; label: { en: string; ar: string }; valueType: "percentage" | "fixed"; percentOff: number; amountOffFils: number; priceAed: number /* Standard-size sale price */; endsAt?: string };
Product gains `sale?: ProductSale`. `priceAed` keeps meaning the regular price (so the static sample data and cart base price stay valid). New helper in src/lib/catalogue.ts: export function effectivePriceAed(p: Pick<Product, "priceAed" | "sale">): number => p.sale?.priceAed ?? p.priceAed. productBadge() returns "sale" first when product.sale exists (still at most ONE badge per card: sale > new > featured).

NEW SHARED COMPONENT  src/components/commerce/Price.tsx  ("use client" not required; pure)
<Price nowAed wasAed? size="card" | "detail" | "line" /> renders: visually-hidden "Was" + <s> original in text-ink-muted with line-through, then visually-hidden "Now" + the price in text-olive. No colour change to orange. Used by every place below so the struck/now pattern exists once.

PRODUCT CARD  src/components/commerce/ProductCard.tsx
- Badge slot (top, inline-start — change the existing `left-3` to `start-3`): when product.sale, show the owner's label (label[locale]) in the existing badge style (Cinzel 9px, cream, over the existing olive top scrim). It replaces New/Featured.
- Price row: <Price nowAed={sale.priceAed} wasAed={product.priceAed} />; the "from" word stays when showView. For percentage sales append "−20%" in Sage Instrument Sans text-xs after the struck price (aria-label t.ui.salePercent). Layout check at 390px two-up grid: name wraps to two lines before the price row is squeezed; the price block is `shrink-0 text-end`, struck price on its own line above the sale price when the card is narrower than 180px.

PRODUCT PAGE  src/components/commerce/ProductDetail.tsx
- totalAed now = itemUnitPrice({ basePriceAed: product.priceAed, sizeId, addonIds, sale: product.sale }); regularAed = same without sale.
- Price block (line ~300): when on sale, above the 4xl price a row with the struck regular price (text-base, ink-muted) and a chip: 1px hairline border, 2px radius, Cinzel 10px Olive uppercase label preceded by a 5px Burnt Orange dot. Under the price, text-sm ink-muted: "You save AED 96" and, when sale.endsAt exists, "Offer ends 10 October" (Intl.DateTimeFormat in Asia/Dubai, locale-aware). Keep aria-live on the price so changing size announces the new sale price.
- If any add-on is selected while on sale: one ink-muted line t.product.offerExcludesAddons.
- Size options keep showing the uplift (formatAedDelta) unchanged. Sticky bar (lines 567/582) uses the sale total; the CTA text "Add to cart — AED 384" uses the sale total.
- addItem passes sale: product.sale (id, label, valueType, percentOff, amountOffFils).

SEARCH, SORT, SEO
- src/components/blocks/SearchOverlay.tsx:234 -> <Price> with effective price. src/components/commerce/ShopGrid.tsx:173/179/182 price buckets and sorting use effectivePriceAed.
- src/app/(frontend)/(storefront)/product/[slug]/page.tsx:55 meta description "from" and productJsonLd (src/lib/seo.ts:95) use the effective price; add priceValidUntil when endsAt exists.

CART  src/lib/cart.tsx
- CartItem gains sale?: Pick<ProductSale, "id" | "label" | "valueType" | "percentOff" | "amountOffFils">.
- itemUnitPrice(item) = fromFils(saleUnitFils(toFils(base + sizeDelta), item.sale)) + add-ons, using src/lib/discounts.ts — the same function the server uses. New itemRegularUnitPrice(item) without the sale.
- sanitizeStoredItems always takes sale from the live catalogue (never from storage).
- NEW reducer action { type: "sync"; catalogue } and an effect that runs whenever the `catalogue` prop changes after hydration: re-reads name, image, basePriceAed and sale for every line from the catalogue (drops lines whose product left). This is what makes router.refresh() after PRICE_CHANGED actually update the basket.
- Context gains: subtotalFils, saleSavingsFils, discount: { code: string; discountFils: number } | null, discountState: "idle" | "checking" | "error", discountMessage: string | null, totalFils, applyDiscountCode(code: string, email?: string): Promise<void>, removeDiscountCode(): void. The typed code is persisted under localStorage key "calanthe-code-v1" (text only, never an amount); on hydration and whenever items change while a code is held, the provider calls quoteCheckout (debounced 400ms) and takes couponDiscountFils from the answer. A refused re-quote keeps the code visible with its message and discount 0. totalFils = subtotalFils − (discount?.discountFils ?? 0) + delivery (0 today). clear() also clears the code.

CODE FIELD  src/components/commerce/DiscountCodeField.tsx ("use client"), used in both places
- Collapsed: a 44px text button "Add a discount code". Expanded: label + input (16px text to stop iOS zoom, dir="ltr", autoCapitalize="characters", autoComplete="off", enterKeyHint="done") and an "Apply" secondary button on the same row; Enter applies. While checking: button shows "Checking…" and is disabled.
- Applied: a row with a chip "EID10" (hairline border, Olive) + a 44px remove button (aria-label t.discount.remove) and, on the right, "−AED 56". Success sentence in Olive with role="status". Error sentence with role="alert" in Olive with the existing `border-s border-burnt-orange ps-4` treatment used by formError in CheckoutForm (reuse, not a new style).

CART DRAWER  src/components/commerce/CartDrawer.tsx
- CartLine (line 83): <Price> with struck regular line total when the item has a sale; under the options line, the sale label in Sage text-sm.
- Footer (line ~318): Subtotal (formatFils(subtotalFils)); if a code is applied a row "Code EID10 … −AED 56"; if total savings > 0 one Sage line "You save AED 152 on this order"; <DiscountCodeField/> collapsed by default above the Checkout button so the CTA stays in the thumb zone; footer keeps its safe-area padding. The list above scrolls, the footer does not grow past 45% of the drawer at 390x667 (verify with the field expanded and an error showing).

CHECKOUT  src/components/commerce/CheckoutForm.tsx
- <Elements options.amount> = Math.max(MIN_CHARGE_FILS, totalFils) from the cart context (line 272), so the card form, Apple Pay and Google Pay sheets show exactly the discounted total the server will charge.
- OrderSummary: line prices via <Price>; rows Subtotal / "Code EID10 −AED 56" (only when applied) / Delivery / Total (formatFils(totalFils)); under Total the "You save AED 152 on this order" line; <DiscountCodeField email={email}/> between the items and the totals. Lines 961, 996, 1028 (mobile summary toggle, desktop button, sticky bar) all read totalFils.
- buildRequest adds discountCode: discount?.code and shownTotalFils: totalFils. When the email field loses focus and a code is held, re-quote with the email so a once-per-customer refusal appears before Pay rather than after.
- pay(): result.code === "PRICE_CHANGED" -> setFormError(message), intentRef.current = null, router.refresh() (cart re-syncs, code re-quotes); the customer reviews and presses Pay again. A code refusal -> show the message in the code field and scroll the summary into view. While discountState === "checking", the Pay buttons are disabled and onExpressClick returns without resolve() (no awaits before resolve — the documented Express rule is preserved).
- The intent cache key already is JSON.stringify(request), so a changed code or total creates a new order and intent; an unchanged retry reuses it.

ACCOUNT  src/app/(frontend)/(storefront)/account/orders/[orderNumber]/page.tsx: item rows show the struck original line total when compareAtUnitPriceFils exists and the saleLabel in the reader's language; add a "Discount (CODE) −AED 56" row between Subtotal and Delivery when couponDiscountFils > 0. account/page.tsx:141 already shows totalFils. All from the snapshot, never from the live discount.

EVERY PLACE THAT DISPLAYS OR COMPUTES A PRICE (from grep formatAed / priceAed / basePriceAed / formatFils) — change unless marked no change:
- src/components/commerce/ProductCard.tsx:108
- src/components/commerce/ProductDetail.tsx:101-103, 154, 300, 567, 582 (352 size delta and 410 add-on delta: no change)
- src/components/commerce/CartDrawer.tsx:83, 322 (131/137 add-on upsell prices and 278 free-delivery nudge: no change, but 278 must measure the post-code subtotal if a fee ever returns)
- src/components/commerce/CheckoutForm.tsx:102, 122, 142, 272, 339, 961, 996, 1028 (134, 734, 749 delivery fee copy: no change)
- src/lib/cart.tsx itemUnitPrice, subtotal, sanitizeStoredItems
- src/components/blocks/SearchOverlay.tsx:234
- src/components/commerce/ShopGrid.tsx:173, 179, 182
- src/app/(frontend)/(storefront)/product/[slug]/page.tsx:55 and src/lib/seo.ts:95
- src/app/(frontend)/(storefront)/account/orders/[orderNumber]/page.tsx:127-148; account/page.tsx:141 (no change)
- src/backend/email/templates.ts:157-193 and order-emails.ts (see emails)
- src/app/(admin)/admin/(panel)/orders/[orderNumber]/page.tsx:97-135; src/app/(admin)/admin/(panel)/products/page.tsx:245 (no change)
- No change, not catalogue prices: src/components/commerce/BuildYourOwnForm.tsx, src/lib/bespoke.ts, src/components/commerce/MembershipTiers.tsx, src/app/(frontend)/(storefront)/delivery/page.tsx, src/components/commerce/AccountClient.tsx (sample data).
- Check while implementing: the wishlist page and homepage rows render ProductCard, so they inherit the change; src/app/(frontend)/(storefront)/checkout/complete shows no amount today (grep found none) — keep it that way.

Done means verified at 390px in English and Arabic: card with a long Arabic label, product page with sale + add-on, drawer with code error, checkout with code applied, Apple Pay sheet amount equal to the summary total. Lighthouse mobile must stay >= 90 (no new client bundle beyond the small code field; Price is server-renderable).

## emails

No new email is introduced by this feature. Two existing emails change content; triggers, recipients and subjects stay exactly as they are (both are sent by applySucceededIntent in src/backend/payments/paid.ts after the signed webhook marks the order PAID, through sendAfterCommit, logged to email_log).

Type changes
- src/backend/email/types.ts PricedOrder gains: discount?: { fils: number; code: string } and savings?: { fils: number } (total saved = sale savings + code discount). RecipientFacing / floristJobSheet are untouched: the gift rule (no price to the recipient or florist sheet) still holds by type.
- src/backend/email/order-emails.ts OrderEmailInput gains couponCode?: string, couponDiscountFils?: number, saleSavingsFils?: number; buildOrderEmails maps them. paid.ts computes saleSavingsFils from the order SNAPSHOT: sum over items of (compareAtUnitPriceFils − unitPriceFils) × quantity where compareAtUnitPriceFils is present. Never from the live discount.

1. order-confirmation (customer) — templates.ts orderConfirmation
Trigger: payment_intent.succeeded verified. Recipient: order.customerEmail. Subject unchanged: EN "Order {orderNumber} — Calanthe" (AR, when templates become bilingual: "الطلب {orderNumber} — كالانثي").
Totals table, rows in this order (HTML and text versions both):
  Subtotal ............ {subtotal}            (after sale prices — equals the sum of the lines)
  Discount ({CODE}) ... −{couponDiscount}     only when couponDiscountFils > 0
  Delivery ............ Complimentary | {fee}
  Total ............... {total}
  then one small Sage line, only when savings > 0: EN "You saved {savings} on this order." AR "وفّرتم {savings} في هذا الطلب."
Row label EN "Discount ({code})" / AR "خصم ({code})". Amounts via the existing formatMoney(fils); the minus sign is a real "−" placed before the amount inside a left-to-right isolate so it stays in front of the number in Arabic.
The closing sentence "Your payment has been received with thanks." is unchanged.

2. owner-new-order (owner / florist address from env.EMAIL_REPLY_TO) — templates.ts ownerNewOrder
Subject unchanged: "New order {orderNumber} — {total}" (total is the discounted total actually paid).
Body: after the total line add, only when a code was used: "Discount code {CODE}: −{couponDiscount}." and, only when sale savings > 0: "Sale savings included: {saleSavings}." So the owner can see at a glance why the total is lower than list price.

Language note (verified): templates.ts is English-only today. The spec above gives EN and AR copy; if the Feature 1 work makes templates bilingual before this ships, use both; if not, ship EN in the template and keep the AR strings in the same copy map so the bilingual switch needs no new translation.

Unchanged: orderStatus emails (money-free), floristJobSheet (money-free), Stripe's own receipt (receipt_email) which will show the discounted amount because the PaymentIntent amount is the discounted total.

Tests to extend in src/backend/email/email.test.ts: confirmation with a code shows the Discount row and the saved line; without a code neither appears; florist job sheet still contains no amount.

## i18n

A. STOREFRONT  src/lib/i18n/dictionary.ts  (add to both `en` and `ar`; Arabic addresses the customer in the plural)

ui.salePercent:        EN "{n}% off"                         AR "خصم {n}%"
ui.priceWas:           EN "Was {price}"                      AR "السعر السابق {price}"
ui.priceNow:           EN "Now {price}"                      AR "السعر الآن {price}"
product.youSave:       EN "You save {amount}"                AR "توفّرون {amount}"
product.offerEnds:     EN "Offer ends {date}"                AR "ينتهي العرض في {date}"
product.offerExcludesAddons: EN "The offer applies to the arrangement. Add-ons are priced as shown."   AR "العرض يشمل الباقة فقط، والإضافات بسعرها المعروض."

New top-level section `discount`:
discount.toggle:       EN "Add a discount code"              AR "أضيفوا رمز الخصم"
discount.label:        EN "Discount code"                    AR "رمز الخصم"
discount.placeholder:  EN "Enter code"                       AR "اكتبوا الرمز"
discount.apply:        EN "Apply"                            AR "تطبيق"
discount.checking:     EN "Checking…"                        AR "جارٍ التحقق…"
discount.remove:       EN "Remove code {code}"               AR "إزالة الرمز {code}"
discount.applied:      EN "Code {code} applied. You save {amount}."      AR "تم تطبيق الرمز {code}. توفّرون {amount}."
discount.rowCode:      EN "Code {code}"                      AR "الرمز {code}"
discount.totalSavings: EN "You save {amount} on this order"  AR "توفّرون {amount} في هذا الطلب"

server.checkout (refusals, read by startCardCheckout / quoteCheckout through the existing `fail` helper):
codeInvalid:      EN "That code is not valid or is no longer active. Check the spelling and try again."   AR "هذا الرمز غير صالح أو لم يعد ساريًا. تحقّقوا من كتابته وحاولوا مرة أخرى."
codeMinSpend:     EN "Add {amount} more to use this code. It needs a minimum order of {min}."            AR "أضيفوا {amount} لاستخدام هذا الرمز. الحد الأدنى للطلب {min}."
codeAlreadyUsed:  EN "This code has already been used with this email address."                          AR "سبق استخدام هذا الرمز مع هذا البريد الإلكتروني."
codeExhausted:    EN "This code has reached its limit and is no longer available."                       AR "بلغ هذا الرمز حدّ الاستخدام ولم يعد متاحًا."
codeRateLimited:  EN "Too many attempts. {wait}"                                                         AR "محاولات كثيرة. {wait}"
priceChanged:     EN "Prices have just been updated. Please review the new total, then pay."             AR "تم تحديث الأسعار للتو. راجعوا الإجمالي الجديد ثم ادفعوا."
totalTooLow:      EN "This total is too low to pay by card. Add an arrangement or remove the code."      AR "الإجمالي أقل من الحد الأدنى للدفع بالبطاقة. أضيفوا باقة أو أزيلوا الرمز."

account.discountRow:   EN "Discount ({code})"                AR "خصم ({code})"

B. ADMIN  src/admin/i18n/en.ts + ar.ts  (en.ts is the schema; ar.ts must compile against it). nav.discounts and nav.sections.marketing already exist.

discounts.title                     "Discounts" / "الخصومات"
discounts.description               "Sales that apply by themselves and codes customers type at checkout." / "عروض تُطبَّق تلقائيًا ورموز يكتبها العملاء عند الدفع."
discounts.create                    "Create discount" / "إنشاء خصم"
discounts.created                   "Discount created." / "تم إنشاء الخصم."
discounts.deleted                   "Discount deleted." / "تم حذف الخصم."
discounts.ownerOnlyTitle            "Only the owner manages discounts" / "إدارة الخصومات للمالك فقط"
discounts.ownerOnlyBody             "Ask the owner if a sale or a code needs changing." / "تواصلوا مع المالك إذا احتاج عرض أو رمز إلى تعديل."
discounts.typeDialog.title          "Select discount type" / "اختيار نوع الخصم"
discounts.typeDialog.automatic      "Automatic sale" / "عرض تلقائي"
discounts.typeDialog.automaticBody  "A price reduction customers see on the product. No code needed." / "تخفيض في السعر يظهر للعملاء على المنتج، دون رمز."
discounts.typeDialog.code           "Discount code" / "رمز خصم"
discounts.typeDialog.codeBody       "A code customers type in the cart or at checkout." / "رمز يكتبه العملاء في السلة أو عند الدفع."
discounts.columns.discount          "Discount" / "الخصم"
discounts.columns.type              "Type" / "النوع"
discounts.columns.status            "Status" / "الحالة"
discounts.columns.dates             "Dates" / "التواريخ"
discounts.columns.used              "Used" / "الاستخدام"
discounts.kind.automatic            "Automatic" / "تلقائي"
discounts.kind.code                 "Code" / "رمز"
discounts.status.active             "Active" / "نشط"
discounts.status.scheduled          "Scheduled" / "مجدول"
discounts.status.expired            "Expired" / "منتهٍ"
discounts.status.draft              "Draft" / "مسودة"
discounts.filters.searchPlaceholder "Search by name or code" / "ابحث بالاسم أو الرمز"
discounts.filters.status            "Status" / "الحالة"
discounts.filters.type              "Type" / "النوع"
discounts.filters.all               "All" / "الكل"
discounts.empty.title               "No discounts yet" / "لا توجد خصومات بعد"
discounts.empty.body                "Create a sale or a code. Customers see it the moment it is active." / "أنشئ عرضًا أو رمزًا، وسيظهر للعملاء فور تفعيله."
discounts.empty.noMatch             "No discounts match" / "لا توجد خصومات مطابقة"
discounts.empty.noMatchBody         "Try a different search or clear the filters." / "جرّب بحثًا آخر أو امسح عوامل التصفية."
discounts.noEndDate                 "No end date" / "بلا تاريخ انتهاء"
discounts.usedOf                    "{used} / {limit}" / "{used} / {limit}"
discounts.activate                  "Activate" / "تفعيل"
discounts.deactivate                "Deactivate" / "إيقاف"
discounts.editLabel                 "Edit {name}" / "تعديل {name}"
discounts.summary.percentAll        "{n}% off · All products" / "خصم {n}% · كل المنتجات"
discounts.summary.percent           "{n}% off" / "خصم {n}%"
discounts.summary.fixed             "{amount} off" / "خصم {amount}"
discounts.summary.eachArrangement   "off each arrangement" / "على كل باقة"
discounts.summary.entireOrder       "off the entire order" / "على كامل الطلب"
discounts.summary.allProducts       "All products" / "كل المنتجات"
discounts.summary.products          { one: "{count} product", other: "{count} products" } / { zero, one "منتج واحد", two "منتجان", few "{count} منتجات", many "{count} منتجًا", other "{count} منتج" }
discounts.summary.occasions         { one: "{count} occasion", other: "{count} occasions" } / Arabic plural forms likewise with "مناسبة / مناسبتان / مناسبات"
discounts.summary.categories        { one: "{count} category", other: "{count} categories" } / "فئة / فئتان / فئات"
discounts.summary.minimum           "Minimum purchase of {amount}" / "حد أدنى للشراء {amount}"
discounts.summary.oncePerCustomer   "One use per customer" / "استخدام واحد لكل عميل"
discounts.summary.limit             "Limited to {count} uses" / "محدود بـ {count} استخدام"
discounts.summary.addonsExcluded    "Add-ons are not reduced" / "الإضافات غير مشمولة بالتخفيض"
discounts.summary.noStack           "Cannot be combined with another sale. A discount code can be added on top." / "لا يُجمع مع عرض آخر، ويمكن إضافة رمز خصم فوقه."
discounts.summary.stacksOnSale      "Works on top of sale prices" / "يُطبَّق فوق أسعار العروض"
discounts.summary.activeFrom        "Active from {date}" / "يبدأ في {date}"
discounts.summary.ends              "Ends {date}" / "ينتهي في {date}"
discounts.new.titleAutomatic        "Create automatic sale" / "إنشاء عرض تلقائي"
discounts.new.titleCode             "Create discount code" / "إنشاء رمز خصم"
discounts.form.sections.title       "Title" / "العنوان"
discounts.form.sections.customer    "What customers see" / "ما يراه العملاء"
discounts.form.sections.code        "Discount code" / "رمز الخصم"
discounts.form.sections.value       "Value" / "القيمة"
discounts.form.sections.appliesTo   "Applies to" / "يُطبَّق على"
discounts.form.sections.minimum     "Minimum purchase" / "الحد الأدنى للشراء"
discounts.form.sections.usage       "Usage limits" / "حدود الاستخدام"
discounts.form.sections.dates       "Active dates" / "تواريخ التفعيل"
discounts.form.sections.summary     "Summary" / "الملخص"
discounts.form.sections.status      "Status" / "الحالة"
discounts.form.sections.performance "Performance" / "الأداء"
discounts.form.title                "Title" / "العنوان"
discounts.form.titleHint            "For your own reference. Customers do not see this." / "للاستخدام الداخلي فقط، ولا يظهر للعملاء."
discounts.form.internalName         "Internal name" / "الاسم الداخلي"
discounts.form.labelEn              "Label in English" / "التسمية بالإنجليزية"
discounts.form.labelAr              "Label in Arabic" / "التسمية بالعربية"
discounts.form.labelHint            "Shown on the product photo, the product page and in the cart." / "تظهر على صورة المنتج وصفحته وفي السلة."
discounts.form.code                 "Code" / "الرمز"
discounts.form.codeHint             "Customers type this in the cart or at checkout." / "يكتبه العملاء في السلة أو عند الدفع."
discounts.form.generate             "Generate" / "توليد"
discounts.form.percentage           "Percentage" / "نسبة مئوية"
discounts.form.fixed                "Fixed amount" / "مبلغ ثابت"
discounts.form.percentOff           "Percentage off" / "نسبة الخصم"
discounts.form.amountOff            "Amount off" / "مبلغ الخصم"
discounts.form.valueHintSale        "Taken off each arrangement. Add-ons are not reduced." / "يُخصم من كل باقة، والإضافات غير مشمولة."
discounts.form.valueHintCode        "Taken off the whole order, after any sale prices." / "يُخصم من كامل الطلب بعد أسعار العروض."
discounts.form.allProducts          "All products" / "كل المنتجات"
discounts.form.specificProducts     "Specific products" / "منتجات محددة"
discounts.form.specificOccasions    "Specific occasions" / "مناسبات محددة"
discounts.form.specificCategories   "Specific categories" / "فئات محددة"
discounts.form.searchProducts       "Search products" / "ابحث في المنتجات"
discounts.form.selected             "{count} selected" / "تم اختيار {count}"
discounts.form.salePrice            "Sale price {price}" / "سعر العرض {price}"
discounts.form.noMinimum            "No minimum" / "بلا حد أدنى"
discounts.form.minimumAmount        "Minimum purchase amount" / "حد أدنى لمبلغ الشراء"
discounts.form.limitTotal           "Limit the total number of times this code can be used" / "تحديد إجمالي مرات استخدام هذا الرمز"
discounts.form.limitTotalValue      "Total uses" / "إجمالي مرات الاستخدام"
discounts.form.oncePerCustomer      "Limit to one use per customer" / "استخدام واحد لكل عميل"
discounts.form.oncePerCustomerHint  "Checked by email address." / "يُتحقق منه بالبريد الإلكتروني."
discounts.form.startDate            "Start date" / "تاريخ البدء"
discounts.form.startTime            "Start time" / "وقت البدء"
discounts.form.setEndDate           "Set end date" / "تحديد تاريخ الانتهاء"
discounts.form.endDate              "End date" / "تاريخ الانتهاء"
discounts.form.endTime              "End time" / "وقت الانتهاء"
discounts.form.timezoneHint         "Abu Dhabi time." / "بتوقيت أبوظبي."
discounts.form.active               "Active" / "نشط"
discounts.form.activeHint           "Off keeps it as a draft: nothing changes on the store." / "عند الإيقاف يبقى مسودة ولا يتغير شيء في المتجر."
discounts.form.save                 "Save discount" / "حفظ الخصم"
discounts.form.usedOrders           { one: "Used on {count} paid order", other: "Used on {count} paid orders" } / Arabic forms: "استُخدم في طلب مدفوع واحد" / "في طلبين مدفوعين" / "في {count} طلبات مدفوعة" / "في {count} طلبًا مدفوعًا" / "في {count} طلب مدفوع"
discounts.form.viewOrders           "View orders" / "عرض الطلبات"
discounts.form.deleteTitle          "Delete “{name}”?" / "حذف «{name}»؟"
discounts.form.deleteBody           "It stops applying at once. Past orders keep their discount." / "يتوقف تطبيقه فورًا، وتحتفظ الطلبات السابقة بخصمها."
discounts.form.deleteConfirm        "Delete discount" / "حذف الخصم"
orders.detail.saleSavings           "Sale savings" / "توفير العروض"
orders.detail.was                   "Was {price}" / "كان {price}"

actions.discount.created            "“{name}” created." / "تم إنشاء «{name}»."
actions.discount.savedLive          "Discount saved. It is live on the store." / "تم حفظ الخصم وهو فعّال الآن في المتجر."
actions.discount.savedScheduled     "Discount saved. It starts on {date}." / "تم حفظ الخصم وسيبدأ في {date}."
actions.discount.savedDraft         "Discount saved as a draft." / "تم حفظ الخصم كمسودة."
actions.discount.activated          "Discount activated." / "تم تفعيل الخصم."
actions.discount.deactivated        "Discount deactivated." / "تم إيقاف الخصم."
actions.discount.deleted            "“{name}” deleted." / "تم حذف «{name}»."
actions.discount.saveFailed         "The discount could not be saved." / "تعذّر حفظ الخصم."
actions.discount.deleteFailed       "The discount could not be deleted." / "تعذّر حذف الخصم."
actions.discount.codeTaken          "That code is already in use. Choose a different one." / "هذا الرمز مستخدم بالفعل. اختر رمزًا آخر."
actions.discount.used               { one: "This discount was used on {count} order, so it is kept for your records. Deactivate it instead.", other: "This discount was used on {count} orders, so it is kept for your records. Deactivate it instead." } / Arabic plural forms of "استُخدم هذا الخصم في {count} طلب، لذا يُحتفظ به في السجلات. أوقفه بدلًا من حذفه."
actions.discount.tooDeep            "“{name}” costs {price}. A sale can take at most 90% off a product." / "سعر «{name}» هو {price}. أقصى تخفيض ممكن 90% من سعر المنتج."
actions.validation.percentRange     "{label} must be a whole number from 1 to 90." / "{label} يجب أن يكون رقمًا صحيحًا من 1 إلى 90."
actions.validation.amountMin        "{label} must be at least AED 1." / "{label} يجب ألا يقل عن 1 درهم."
actions.validation.codeFormat       "Use 3 to 24 letters and numbers for the code, with no spaces." / "استخدم من 3 إلى 24 حرفًا ورقمًا للرمز، دون مسافات."
actions.validation.endBeforeStart   "The end must be after the start." / "يجب أن يكون الانتهاء بعد البدء."
actions.validation.pickAtLeastOne   "Choose at least one item for “{label}”." / "اختر عنصرًا واحدًا على الأقل في «{label}»."
actions.validation.labelRequired    "Add the customer label in both English and Arabic." / "أضف التسمية الظاهرة للعملاء بالإنجليزية والعربية."
labels (activity field names): percentOff "percentage" / "النسبة", amountOffFils "amount off" / "مبلغ الخصم", startsAt "start" / "البدء", endsAt "end" / "الانتهاء", usageLimit "usage limit" / "حد الاستخدام", minSubtotalFils "minimum purchase" / "الحد الأدنى للشراء".

src/admin/i18n/i18n.test.ts already fails the build when ar.ts misses a key; the storefront `ar: typeof en` typing does the same for the dictionary.

## tests

All vitest unit tests (npm test), no database. Every money rule below is one named test.

1. NEW src/lib/discounts.test.ts
saleUnitFils
- 20% of 48000 -> 38400; 15% of 65000 -> 55200 (552.50 floored to whole dirham); 33% of 39000 -> 26100
- percentage above 90 is clamped to 90; 0 or negative returns the price unchanged
- fixed 10000 off 48000 -> 38000; fixed 5050 off 48000 -> 42900 (floored to whole dirham)
- fixed larger than the price is capped at 90% (50000 off 35000 -> 3500), never zero or negative
- result is always a multiple of 100 and never above the input; non-integer input throws/returns unchanged
couponDiscountFils
- 10% of 55200 -> 5600 (55.20 rounded up to whole dirham); 10% of 50000 -> 5000
- fixed 5000 on 4000 -> 4000 (capped at subtotal); percentage result never exceeds subtotal
discountStatus
- draft when inactive; scheduled before startsAt; active exactly at startsAt; active one millisecond before endsAt; expired exactly at endsAt; expired wins over inactive; no dates + active -> active
- instants are compared as UTC timestamps, so "18:00 Asia/Dubai" stored as 14:00Z flips at the right moment
saleMatches / bestSaleFor
- all / products / occasions / categories each match and miss correctly
- two matching sales: the lower resulting price wins (fixed 100 vs 20% on 480 -> fixed; on 800 -> percentage)
- equal result: products scope beats occasions beats categories beats all; then lowest id
- scheduled, expired and draft rules are ignored; a rule that does not lower the price is ignored; no rules -> null
checkCoupon
- inactive / scheduled / expired -> "inactive"; timesUsed >= usageLimit -> "exhausted"; oncePerCustomer + emailHasUsed -> "already_used"; below minimum -> "min_spend" with exact shortfallFils; exactly at minimum passes; null limit never exhausts
normaliseCode: " eid 10 " -> "EID10"

2. EXTEND src/backend/domain/pricing.test.ts
- priceOrder without the 4th argument returns exactly what it returns today (regression lock on existing cases)
- sale applies to base + size uplift, not to add-ons: 480 base, deluxe +140, vase +60, 20% -> unit (620 x 0.8 = 496) + 60 = 55600, compareAt 68000
- lineTotalFils === unitPriceFils x quantity for every sale case (the orderIntegrity invariant)
- the sale is chosen on the base price and reused for every size of the product
- saleSavingsFils = sum((compareAt − unit) x qty)
- coupon applies to the already-discounted subtotal including add-ons; discountFils === couponDiscountFils
- min spend is measured after sale prices: basket 500 with 20% sale (400) fails a 450 minimum
- a refused coupon prices WITHOUT it and reports couponRefusal; it never throws
- total = subtotal − coupon + delivery; never negative; 0 <= total < 200 throws TOTAL_TOO_LOW
- free-delivery threshold is measured on subtotal − coupon (use a temporary zone fixture / inject so the rule is pinned even while delivery is free)
- an unavailable product, bad quantity, unknown size/add-on still throw as before with discounts present

3. NEW src/backend/payload/hooks/orderIntegrity.test.ts (or extend if one exists)
- an order with compareAtUnitPriceFils > unitPriceFils passes; <= fails
- couponDiscountFils > discountFils fails; couponDiscountFils > 0 without couponCode fails; couponCode with zero discount passes only when couponDiscountFils is 0
- an order written by today's checkout shape (no new fields) still passes
- updates are not re-validated (operation !== create)

4. NEW src/backend/domain/discount-form.test.ts
- parses an automatic percentage sale; parses a fixed code with minimum and limits
- "480.50" AED -> 48050 fils through parseAedToFils; percentage "20.5", "0", "91" refused with percentRange
- code is uppercased and trimmed; "ab", "has space", 25 characters refused with codeFormat
- end before start refused; end without start allowed
- appliesTo "products" with no ids refused; kind code forces appliesTo "all" and drops minimum-only fields for automatic
- 18:00 on 2026-10-10 in the form becomes 2026-10-10T14:00:00.000Z (dates.test.ts gains dubaiDateTimeToIso and dubaiTimeInputValue round-trip cases)

5. src/backend/payments/verdict.test.ts
- add one case documenting that a discounted order is paid when intent.amount equals the discounted totalFils and flagged when it equals the undiscounted amount (no code change expected; this pins the behaviour)

6. NEW src/backend/payments/redeem.test.ts
- with a fake drizzle `execute`: a returned row -> redeemed true; times_used > usage_limit -> overLimit true; no row -> redeemed false; assert the statement contains the claim on coupon_redeemed_at IS NULL (guards exactly-once)

7. src/backend/data/products.test.ts
- toStorefrontProduct(doc) with no sales is unchanged; with a matching live rule it attaches sale with the right priceAed, both labels and endsAt, and exposes no title, code or usage field

8. src/lib (cart and catalogue)
- itemUnitPrice with and without sale equals the server's priceLine for the same inputs (table-driven parity test importing both)
- productBadge returns "sale" before "new" and "featured"; effectivePriceAed

9. src/backend/email/email.test.ts — the three cases listed under emails.

10. Existing guards that must stay green: src/admin/rtl-guard.test.ts (no left/right classes in the new admin files), src/admin/i18n/i18n.test.ts (ar matches en), money.test.ts.

Manual verification checklist (after unit tests, in Stripe test mode with `stripe listen`):
- 390px, EN and AR: card, product page, drawer, checkout with a sale and a code.
- Pay a discounted order with a test card and with Apple Pay / Google Pay: wallet sheet amount = summary total = PaymentIntent amount = order.totalFils; order becomes PAID only after the webhook; timesUsed goes up by exactly one; `stripe events resend` of the same event leaves it unchanged.
- End a sale in /admin while a checkout tab is open -> Pay returns the "prices updated" message, the summary updates, the second Pay succeeds for the new total.
- Create, schedule, deactivate and delete in /admin and confirm the storefront reflects each on the next page load.

## edgeCases

Pricing and display
- Two sales match one product: only the best one applies (rule 2 in summary); sales never stack with each other.
- A sale and the manual compareAtPriceFils on the same product: the storefront strike-through is driven ONLY by Discounts in this spec; compareAtPriceFils stays undisplayed as it is today (see open question).
- Base prices that are not whole dirhams: sale prices are still floored to whole dirhams; totals with a fixed coupon may carry fils, so every NEW total/row is formatted with formatFils (src/lib/money.ts), not formatAed(number), which would print "AED 496.8".
- Percentage sale on a very cheap arrangement where flooring removes the whole saving or leaves the price unchanged: treated as no sale (no badge, no strike-through).
- Product repriced after a fixed sale was saved so the amount now exceeds 90% of it: pricing caps at 90% defensively; the admin save rule catches it the next time the discount is edited.
- Add-ons in a sale line are full price; a code does reduce them (order-level). Both statements appear in the admin Summary card so the owner is not surprised.
- Code makes the total fall under AED 2.00: refused with totalTooLow at quote and at pay; there is no free-order path.
- Delivery fee returns in future: code never discounts the fee; threshold measured on subtotal after the code (already implemented and tested).

Timing
- Sale starts or ends while a customer has the page open: the server prices with `now` at pay time; a difference from the shown total returns PRICE_CHANGED, nothing is created, the cart re-syncs and the customer confirms the new total. The customer is never charged an amount they did not see.
- Sale ends between order creation and payment confirmation (3-D Secure in flight): the order keeps its snapshot price; the intent amount equals order.totalFils; honoured.
- Code expires / is deactivated / runs out between quote and pay: refused at pay with the code message; cart keeps the code text and shows why.
- Code runs out between order creation and the webhook (two customers, last use): both are honoured because money is captured; the second increments past the limit and is flagged in internalNotes ("DISCOUNT CHECK"). Usage is counted only on PAID as required, so a hard cap at creation time is deliberately not attempted.
- Once-per-customer race (same email, two tabs, both pay): both honoured, second visible in the usage count; accepted and documented.
- Once-per-customer is by email only; a guest using another address is a second customer. Stated in the admin hint.
- Clock: everything is stored as UTC instants; the admin form reads and writes Asia/Dubai wall time (UTC+4, no DST).

Webhook and state
- Duplicate or concurrent payment_intent.succeeded: the claim on orders.coupon_redeemed_at makes the increment exactly-once.
- Discount deleted between creation and payment: FK is set null, redeemCoupon returns no row, order still PAID with its snapshot; deletion is refused anyway once any order references the discount.
- redeemCoupon throws (database blip): logged, order stays PAID, emails still sent; the count can be reconciled later from orders where couponDiscount is set and couponRedeemedAt is null.
- Refund or cancellation: timesUsed is not decremented.
- Abandoned PENDING orders carrying a code: never counted; they do not block the customer from using the code again.
- Retried payment on the same unchanged request reuses the same order and intent (existing intentRef); changing or removing the code creates a new order, leaving the earlier one PENDING like any abandoned checkout.

Security and abuse
- Code guessing: throttled per network (12 per 10 minutes), single generic "not valid" message for unknown/draft/scheduled/expired.
- Tampered browser: sending another product's sale, a made-up code, or a lower shownTotalFils changes nothing that is charged; the worst outcome is PRICE_CHANGED.
- Code input is normalised and matched by equality; maximum length 24 enforced before any query.
- Staff cannot read or change discounts (collection access), and /cms edits go through the same validateDiscount hook.
- A change made in /cms does not call revalidateStorefront; because storefront rendering is per request the change still appears on the next request. Note this in docs/ADMIN.md.

Cart and UX
- Stored cart from before the release (no sale field): sanitizeStoredItems rebuilds every line from the catalogue, so it gains the sale automatically.
- Product leaves the catalogue while a code is applied: line is dropped (existing droppedCount notice) and the code is re-quoted.
- Code applied in the drawer before the email is known: once-per-customer is checked when the email is entered and again at pay.
- Long Arabic label on a 2-up card at 390px: label is capped at 28 characters and truncates with ellipsis in the badge; full label is shown on the product page.
- Wishlist, search overlay, related products, occasion pages and homepage rows all read through src/backend/data/products.ts, so they receive `sale` without their own query.
- Elements amount updates when the code is applied or removed; while a quote is in flight both pay paths are disabled so a wallet sheet can never open with a stale amount.

Data
- Many automatic rows have code = null: allowed by the unique index. Empty string must never be stored (hook converts to null).
- Existing orders have none of the new columns set: every reader treats them as "no sale, no code" (null checks), and the existing admin discount row logic (discount > 0) is unchanged.
- Deploy order: the migration is additive, so run it before the new code is live; the old code ignores the new columns.

## buildOrder

1. 1. Pure discount maths: create src/lib/discounts.ts and src/lib/discounts.test.ts exactly as specified. Verify: `npm test` green, `npm run typecheck` clean. Nothing else imports it yet. Commit: feat(discounts): pure discount rules.
2. 2. Extend src/backend/domain/pricing.ts (priceLine sale parameter, priceOrder optional OrderDiscounts, new PricedLine/PricedOrder fields, TOTAL_TOO_LOW) plus pricing.test.ts cases. Verify: all existing pricing tests pass untouched and the new ones pass; startCardCheckout still compiles without passing discounts.
3. 3. Schema: add src/collections/Discounts.ts, src/backend/payload/hooks/validateDiscount.ts, register in src/payload.config.ts, add the Orders fields, extend validateOrderTotals with its test. Run `npm run migrate:create -- discounts`, review the generated SQL against the expected shape in dataModel (additive only), run `npm run generate:types`. Verify: typecheck clean; migration applied on a development database only; /cms shows the Discounts collection for the owner and refuses staff.
4. 4. Server data layer: src/backend/data/discounts.ts (getLiveSaleRules, findCoupon, emailHasRedeemed), src/backend/data/checkout-pricing.ts (priceCheckout), and src/backend/data/products.ts attaching `sale` (ProductSale type in src/lib/data.ts, effectivePriceAed and productBadge in src/lib/catalogue.ts) with products.test.ts cases. Verify: with one discount row created in /cms, a product page server render carries product.sale; with none, output is byte-identical to before.
5. 5. Checkout server: quoteCheckout, startCardCheckout changes (discountCode, shownTotalFils, PRICE_CHANGED, snapshot fields, intent metadata), LIMITS.discountCode, server.checkout dictionary keys EN+AR. Verify with a temporary script or test calling the action: discounted order row passes validateOrderTotals and PaymentIntent.amount === order.totalFils in Stripe test mode.
6. 6. Webhook: src/backend/payments/redeem.ts + test, call it in paid.ts, extend OrderDoc and the email input; add the verdict test case. Verify with `stripe listen`: paying a coded order sets PAID, coupon_redeemed_at and times_used + 1; resending the same event changes nothing.
7. 7. Emails: PricedOrder discount/savings, templates.ts rows, email.test.ts cases. Verify: confirmation for a coded order shows the Discount row and saved line; florist job sheet still has no amount.
8. 8. Storefront display of sales (no code yet): Price component, ProductCard, ProductDetail, SearchOverlay, ShopGrid, product page metadata + productJsonLd, cart itemUnitPrice/sale/sync action, CartDrawer and CheckoutForm line prices, Elements amount from totalFils, dictionary keys. Add the client/server parity test. Verify at 390px in EN and AR: struck price, sale price, single badge; cart and checkout totals equal the server total (pay once in test mode).
9. 9. Discount code UI: cart context code state and quoting, DiscountCodeField in drawer and checkout summary, PRICE_CHANGED and code-refusal handling in pay(), Express Checkout guard. Verify at 390px EN and AR: apply, error states (invalid, minimum, already used, exhausted), remove; Apple Pay / Google Pay sheet shows the discounted total; ending a sale mid-checkout produces the price-updated message and a successful second attempt.
10. 10. Admin: domain parser src/backend/domain/discount-form.ts + test and dates helpers; actions createDiscount / updateDiscount / setDiscountActive / deleteDiscount in src/backend/actions/admin.ts with activity logging and revalidateStorefront; src/backend/data/discount-form.ts; pages discounts/page.tsx, discounts/new/page.tsx, discounts/[id]/edit/page.tsx; components DiscountForm.tsx and CreateDiscountButton.tsx; nav entry; admin i18n EN+AR; order detail additions and couponCode in order search. Verify: rtl-guard and i18n tests green; as owner create an automatic sale and a code, schedule one, deactivate, try to delete a used one (refused with the count); as staff the nav item is absent and the URL shows the owner-only state; light, dark and Arabic checked at 390px and desktop.
11. 11. Account pages: order detail rows from the snapshot (struck line, label, Discount row). Verify with a paid discounted order in EN and AR, then edit and delete-attempt the discount and confirm the order page is unchanged.
12. 12. Documentation and release check: update docs/PAYMENTS.md (redeem step as implemented, no decrement on refund), docs/ORDERS.md (snapshot fields, shownTotalFils assertion, rounding rules), docs/ADMIN.md section 0.3. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and a Lighthouse mobile run on /shop and one product page (must stay >= 90). Deploy order: run the migration first, then the code. Conventional commits per step.

## openQuestionsForOwner

- Should a discount code work on top of an item that is already on sale? The spec says yes (code applies to the already-reduced subtotal, one code per order). The alternative is a per-code switch 'cannot be combined with sale items'.
- A sale reduces the arrangement and its size upgrade (Deluxe / Premium) but not add-ons such as vase, chocolates or balloon. A code reduces the whole order including add-ons. Is that what you want, or should add-ons be excluded from codes too?
- Sale prices are rounded down to whole dirhams (AED 552.50 becomes AED 552) and a percentage code is rounded up to the whole dirham in the customer's favour, so prices stay clean. Confirm you accept giving away those few fils, or ask for exact fils instead.
- The largest discount allowed is 90%. A 100% (free order) code is not possible because an order is only confirmed by a real card payment, and Stripe's minimum charge is AED 2. Do you need free-order or gift codes? That would be a separate, small follow-up.
- Products already have a 'Compare-at price' field in the product editor that the website does not show today. Keep it hidden and use Discounts as the only way to show a crossed-out price (recommended), or also show it on the site when no sale is active?
- 'One use per customer' is checked by email address, so the same person with a second email could use the code again. Is that acceptable, or should it be limited to signed-in customers only?
- When an order with a code is refunded or cancelled, the code's use count is not given back (same as Shopify). OK?
- Discounts are owner-only in this spec: staff cannot see or change them. Should staff be able to view (not edit) the list?
- Should codes also be limitable to specific products or occasions? The spec keeps codes order-wide for now; automatic sales already support products, occasions and categories.
- On the product page, when a sale has an end date we show 'Offer ends 10 October'. Do you want that shown, or prefer no date on the site?
- The order confirmation email is English-only today. Should the discount lines wait for bilingual emails, or ship in English now with Arabic added when the emails become bilingual?