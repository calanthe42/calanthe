# Admin UI rebuild — design

| | |
| --- | --- |
| **Date** | 2026-09-11 |
| **Status** | Approved in brainstorming, section by section; awaiting review of this written spec |
| **Part of** | Calanthe Admin 3.0 — sub-project 1 of 2 (this: admin UI rebuild · next: promotions) |
| **Owner of decisions** | The client (via the brainstorming session) |

---

## 1. Goal and success criteria

Turn `/admin` into software the florist recognises as hers: calm, fast, clear on a phone and on a desktop, with consistent interaction patterns and nothing that looks or behaves like Payload.

This sub-project is done when:

1. Every admin screen is built from one design system in `src/admin/ui/`; no screen carries its own copy of a button, dialog, table, toast or form field.
2. Products, occasions and media are fully managed from `/admin` — list, create, edit, duplicate, publish/hide, delete, photos — with no step that needs `/cms`.
3. The dashboard answers "how is the business doing, what needs attention, what happened today" from real data only.
4. Every mutation shows idle → saving → saved or failed, and says "saved" only after the server confirms.
5. Every screen passes the browser checks in §13 at 320, 375, 390, 414, 768, 1024 and 1440 px, left-to-right and right-to-left.
6. `tsc`, `eslint` and `vitest` pass; `next build` passes, or its failure is reported with the reason (see §15).

---

## 2. Context — what exists and is reused

Nothing below is rebuilt as a second system.

| Area | Today | This sub-project |
| --- | --- | --- |
| Authentication | `/admin/login` → Payload `login`, `payload-token` cookie; `(panel)/layout.tsx` gates admin/staff | Unchanged |
| Permissions | Payload collection and field access (`backend/payload/access`) | Unchanged; no `overrideAccess` in any admin read or write |
| Data layer | `backend/data/*` queries as the signed-in user; `backend/actions/admin.ts` writes | Extended, not duplicated |
| Product parsing | `backend/domain/product-form.ts` (pure, tested) | Reused by create, update, duplicate |
| Rich text | `backend/domain/richtext.ts` (paragraphs ⇄ Lexical) | Reused |
| Media | `Media` collection, local disk in dev / Vercel Blob in production, `servedMediaPath`, `collectMediaUsage` | Reused; no new storage |
| Dashboard | `backend/data/dashboard.ts`, `admin-metrics.ts`, inline-SVG `Charts.tsx` | Extended; arithmetic moves to a pure domain module |
| UI kit | `src/admin/components/ui.tsx` (622 lines), `Form.tsx` (504 lines), `MediaPicker`, `AdminNav` | Replaced by `src/admin/ui/`; old files deleted when their last importer migrates |
| Tokens | `styles/tokens.css` (brand palette, radii, easing) + `(admin)/admin.css` (admin surfaces, `white`) | Reused |

---

## 3. Decisions

### From the Admin 3.0 brief

- Roles stay `admin` · `staff` · `customer`. No Owner role. "Owner" remains the display label for `admin`.
- Normal business operations happen in `/admin`. `/cms` stays, as a clearly secondary developer link.
- Product rows: **Edit**, **View**, **More** (Edit, Duplicate, View on website, Hide/Publish, Delete).
- New product actions: **Save product**, **Save & publish**, **Cancel**.
- No fabricated data anywhere.
- Commits are logical and local; nothing is pushed.

### From the brainstorming session

| Question | Decision |
| --- | --- |
| Build order | Whole admin UI first (this spec), then promotions end to end |
| Main users | Mixed: owner on a phone, staff on a desktop — both first-class |
| Arabic / RTL | **RTL-ready, English interface text.** Start/end layout everywhere, mirrored icons, a direction switch for QA. Arabic wording is a later translation task in the client's own words. |
| Interactive primitives | **Native-first, no new dependencies.** `<dialog>` for modal/confirm/drawer; hand-built WAI-ARIA menu and tabs, verified with keyboard tests |
| Dashboard money | **Sales = placed orders, cancelled excluded.** "Paid" shown beneath. Rankings use placed orders. Labelled "Sales", never "Revenue". |

---

## 4. Scope

**In scope:** the admin design system; the admin shell (navigation, top bar, search, not-found, loading shapes); migration of every existing admin screen to the design system; products (list, editor, new, duplicate, publish/hide, delete); occasions (list, editor, SEO fields); the media library; Dashboard 2.0 with the action center; new list filters needed by alert links; tests and browser QA for all of it.

**Out of scope:** promotions (next sub-project — including the Promotions nav item and dashboard promotion panel); building the Memberships, Marketing, Delivery, Staff and Settings screens (they stay as honest "coming soon" screens); an audit log (documented future work; none exists today); Arabic interface text; drag-and-drop photo ordering; media cropping and focal-point editing; bulk upload; any storefront change other than the occasion page's metadata (§9.1).

---

## 5. Design-system architecture

### 5.1 Location

One focused file per primitive in `src/admin/ui/`, re-exported from `src/admin/ui/index.ts` and imported as `@admin/ui`. Screens import nothing styling-related from anywhere else.

### 5.2 Server by default

| Rendered on the server (no client JavaScript) | Client islands, only where there is interaction |
| --- | --- |
| PageHeader, Breadcrumb, SectionHeader, Card, Badge, StatusBadge, EmptyState, Skeleton, DataTable / row cards, Pagination, FilterBar (plain GET form), FormSection, FormField wrapper | Dialog (Modal, ConfirmDialog, Drawer), RowMenu, Tabs, Tooltip, Toast provider, forms that hold state (`useAction`, unsaved-changes guard), media picker |

### 5.3 Dialogs

Modal, ConfirmDialog and Drawer are the native `<dialog>` element opened with `showModal()`: top layer (no ancestor can clip or re-anchor it — the class of bug where the delete confirmation rendered off-screen inside a `backdrop-filter` save bar cannot recur), inert page behind, Escape to close, focus returned to the trigger on close. Backdrop click is handled explicitly (the `closedby` attribute is not supported everywhere).

### 5.4 Menus and tooltips

RowMenu and Tooltip use the Popover API (`popover` attribute) for top-layer rendering and light dismiss, positioned with a small in-house function (below the trigger, aligned to the inline end, flipped above when there is no room). **Fallback:** where `HTMLElement.prototype.togglePopover` is missing (iOS/Safari before 17), the same component renders as an absolutely positioned element with its own click-outside and Escape handling.

### 5.5 One toast system

A single `ToastProvider` in `(panel)/layout.tsx`, rendered in a fixed live region at the root of the admin body. Screens call `useToast()`. It replaces the per-component toast copies.

### 5.6 One mutation pattern

`useAction(action)` returns `{ state, run }`, where `state` is `idle | saving | saved | failed`. It sets `saved` and shows a success toast only after the server action resolves `ok: true`. On `ok: false` it shows the message as a toast, and field errors (§11.1) inline.

### 5.7 RTL-ready

- Only logical utilities: `ms-* me-* ps-* pe-* start-* end-* inset-s-* inset-e-* text-start text-end border-s border-e rounded-s rounded-e`; spacing between inline items uses `gap-*`, not `space-x-*`. (Confirmed present in the installed Tailwind 4.3.3; its `rtl:` variant matches `:dir(rtl)` and `[dir="rtl"]`.)
- Directional icons carry `rtl:-scale-x-100`.
- A guard test fails the build if a physical-direction class appears (§13.1).
- **Direction switch:** in the owner-only Developer footer. It sets cookie `calanthe-admin-dir` (`ltr` | `rtl`, one year, `SameSite=Lax`); `(admin)/admin/layout.tsx` reads it and renders `<html dir>` on the server, so there is no flash. The storefront's own direction handling is untouched.

### 5.8 Tokens and type

- Colour: the brand palette from `tokens.css` plus the admin surface tokens in `admin.css` (`admin-bg`, `admin-surface`, `admin-sunken`, `white`).
- Type: Cormorant Garamond for page titles only; Cinzel only for small uppercase eyebrows; Instrument Sans for all interface text at 14px (`text-sm`) from 640px up.
- **Form controls are 16px (`text-base`) below 640px** so iOS does not zoom the page when a field is focused.
- Shape: 4px radius on controls, hairline borders, shadows only on overlays (dialogs, menus, toasts).
- Icons: one inline SVG set in `src/admin/ui/icons.tsx`; no icon library.
- Motion: opacity transitions of 150ms or less; none under `prefers-reduced-motion: reduce`.

---

## 6. Components and behaviour

| Component | Behaviour |
| --- | --- |
| **Button** | Variants: primary (burnt orange — at most one per screen), secondary, ghost, danger. Height 44px. `pending` shows a spinner and a pending label ("Saving…") and disables the button. Renders `<button>` or a link. |
| **IconButton** | 44×44px target. `label` is required; it is the accessible name and the tooltip text. |
| **Input · TextArea · Select · SearchInput · DateInput** | Always inside **FormField** (label, optional hint, optional error; error linked with `aria-describedby`, field marked `aria-invalid`). SearchInput has a clear button and submits as GET. DateInput is `<input type="date">`, interpreted in Asia/Dubai. |
| **Checkbox · Toggle** | The full label row is the target (≥44px). Toggle uses `role="switch"` and `aria-checked`. |
| **Badge · StatusBadge** | Text plus colour, never colour alone. One mapping for order, payment, enquiry, event, product and occasion statuses. |
| **Card · SectionHeader · FormSection** | Titled panels; full width and stacked on phones. |
| **DataTable** | A `<table>` from 1024px (`lg`) up, sortable headers are links that set `?sort=`; below 1024px each row renders as a stacked card. Row actions are always visible. A table wider than its container scrolls inside the container, never the page. |
| **Pagination** | Previous · "Page X of Y" · Next, as links preserving every other query parameter. |
| **FilterBar** | GET form. Below 640px, filters collapse behind a "Filters (N active)" button that opens a Drawer; search stays visible. |
| **EmptyState** | Two forms: nothing exists yet (action: "Add …") and nothing matches (action: "Clear filters"). |
| **Skeleton** | Matches the final layout's shape. |
| **Modal** | Title required (`aria-labelledby`). Escape and backdrop click close it unless an action is in progress. Focus moves to the first field; returns to the trigger on close. |
| **ConfirmDialog** | Title, plain-language consequence, safe and destructive buttons. Initial focus on the safe button. Cannot be dismissed while the action is running. |
| **Drawer** | Side sheet from the inline-start edge (mirrors in RTL). Used for navigation on phones and for mobile filters. |
| **RowMenu** | WAI-ARIA menu button: `aria-haspopup="menu"`, `aria-expanded`. ↓/↑ move, Home/End jump, typing a letter moves to the next matching item, Enter/Space activates, Escape closes and returns focus to the button. Destructive items follow a separator. Items are links or actions. |
| **Tabs** | WAI-ARIA tabs with arrow-key movement; the active tab is `?tab=` in the URL. On phones the tab list scrolls horizontally. |
| **Tooltip** | Shows on hover and on keyboard focus after 300ms; Escape hides it. Never the only place information is available. |
| **Toast** | Success: `role="status"`, dismisses after 5 seconds, hovering or focusing pauses the timer. Error: `role="alert"`, stays until dismissed. Top-centre below 640px, top-end from 640px; never over the save bar. |
| **FormActions** | Sticky bottom bar: primary action, secondary actions, destructive action at the inline end, and a status ("Unsaved changes", "Saving…", "Saved ✓", "Couldn't save"). Bottom padding respects `env(safe-area-inset-bottom)`; the page reserves space so the bar never covers content. |

---

## 7. Shared screen patterns

### 7.1 Page anatomy

Breadcrumb → page title → one-line description → primary action at the inline end of the title row (below the title, full width, under 640px). Secondary page actions sit in a RowMenu beside the primary action.

### 7.2 List screens

Applies to products, occasions, orders, customers, enquiries, events.

Header → FilterBar (search, the filters that matter, sort) → result summary ("12 of 40 · Clear filters") → DataTable → Pagination. **25 rows per page.**

Paging runs in the database (Payload `page` and `limit`, with the filters as `where` clauses) for orders, customers, enquiries and events. Products are paged in memory as described in §8.1.

Each row: thumbnail where one exists, the name as a link, key facts, a StatusBadge, then the primary row action (**Edit** for things the viewer may change, **Open** otherwise) and the RowMenu. The rest of the row is not a link.

Filters, sort, page and tab are URL state.

### 7.3 Edit screens

From 1024px: main column (form sections) and a side panel (status, visibility, key facts, "View on shop"). Below 1024px: one column; the side panel becomes a compact status strip at the top of the page. FormActions is sticky at every width.

### 7.4 Unsaved changes

- Dirty when the form's serialised values differ from the snapshot taken when it loaded, or when non-input state (photos, image selection) differs.
- FormActions shows "Unsaved changes".
- Clicking any link inside the admin shell, or Cancel, while dirty opens a ConfirmDialog: **Keep editing** / **Discard changes**.
- Reload and tab close use the `beforeunload` prompt.
- **Limitation:** the browser Back button cannot be intercepted reliably in the App Router; it gets only the browser's own prompt where the browser shows one.

### 7.5 Mutations

Every save, delete, duplicate, publish and hide uses `useAction` (§5.6). Validation errors appear next to their fields and focus moves to the first one. A failed save keeps everything the person entered.

### 7.6 Confirmation required

Deleting anything; publishing or hiding a product; showing or hiding an occasion from its row menu; cancelling an order. The consequence is stated in plain words.

### 7.7 Loading and errors

- `loading.tsx` in three shapes: dashboard (`(panel)/loading.tsx`), list (each list route), form (each `new` and `[id]/edit` route).
- `(panel)/error.tsx` keeps the admin chrome (exists).
- **New `(panel)/not-found.tsx`**: "This doesn't exist or was deleted", with a link back to the relevant list; detail routes call `notFound()` for missing records.

### 7.8 Global search

The top-bar search submits to `/admin/search?q=`. Queries shorter than 2 characters show a prompt instead of results. Results are grouped — Products, Orders, Enquiries, Events, and Customers for the owner only — showing the first 5 of each group with "See all" linking to that list with `?q=`. Server-rendered; every query runs as the signed-in user.

---

## 8. Products

### 8.1 List — `/admin/products`

- **Filters:** search (name, web address, short description), availability (`live` · `hidden` · `no-photos`), category, occasion, highlight (featured · bestseller · new arrival · seasonal), sort (`shop` · `name` · `price-high` · `price-low` · `recent`).
- **Query strategy:** one query as the signed-in user, filtered and sorted on the server in memory, paginated at 25. Switch to database-side filtering and paging if the catalogue passes 500 products.
- **Row:** thumbnail; name (link) and short description (or web address); price with compare-at struck through; category; status **Live** · **Hidden** · **Hidden — no photo**; highlights.
- **Row actions (owner):** **Edit** · **View** (only when live) · **More** → Edit, Duplicate, View on website (disabled with "Hidden products aren't on the website" when hidden), Hide or Publish, separator, Delete.
- **Row actions (staff):** **Open** · More → View on website.
- **Publish / Hide from the menu:** ConfirmDialog. Publishing a product with no photos is refused with "Add a product photo before publishing" and a button that opens the editor at the Photography section.
- **Delete:** ConfirmDialog. Refused for a product that appears in any order (existing rule); the refusal offers **Hide instead**.

### 8.2 Duplicate

Server action `duplicateProduct(id)`:

- **Name:** `<name> (copy)`, with the source name truncated so the result fits the 140-character limit.
- **Web address:** the first free of `<slug>-copy`, `<slug>-copy-2`, `<slug>-copy-3`, … (the slug hook does not resolve collisions; the database unique index rejects them). If creation still fails on a unique-slug conflict (a concurrent duplicate), the action picks the next free slug and retries **once**.
- **Copied:** short and full description, price, compare-at price, category, flowers, occasions, images and their order, featured, bestseller, new arrival, seasonal, track stock, stock, sort order, SEO title, SEO description, share image, hide-from-search.
- **Not copied:** `legacyImages` (a migration artefact), `available` (always **false** on the copy).
- On success, navigates to the copy's editor with the banner "Duplicated from <name>. It's hidden until you publish it."

### 8.3 Editor — `/admin/products/[id]/edit`

**Main column**

1. **Product information** — name; short description (counter, 200); full description (paragraphs).
2. **Pricing** — price (AED); compare-at price (AED). Never fils.
3. **Photography** — thumbnail grid; "Add photos" opens the media picker (upload or choose); per photo: move earlier, move later, **Set as primary** (moves it to position 1), Remove; position 1 is labelled "Primary". Up to 8 photos.
4. **Categories & occasions** — category; occasions; flowers.
5. **Inventory** — track stock; stock quantity (shown when tracking).
6. **SEO** — search title (counter, recommended 60, maximum 70); search description (counter, recommended 155, maximum 180); a preview showing the title (falling back to the product name), `calanthe.ae/product/<slug>` and the description (falling back to the short description); **share image** (`seo.image`, via the media picker); hide from search engines.

**Side panel**

- **Store visibility** — status; Publish/Hide (subject to the photo rule); View on shop (when live).
- **Featured settings** — featured; bestseller; new arrival; seasonal.
- **Organisation** — web address (with "Changing this breaks links you've already shared"); shop order.
- **Record** — created and last edited, as dates in Asia/Dubai. No identifiers.

**FormActions:** Save changes · Cancel · View on shop · Delete (inline end). Unsaved-changes guard (§7.4).

### 8.4 New product — `/admin/products/new`

Same sections in this order: product information, pricing, photography, categories & occasions, store visibility, featured settings, SEO (SEO starts collapsed). The side panel reads "Hidden until you publish".

**Actions:** **Save product** (creates the product hidden) · **Save & publish** (creates it available; disabled while there are no photos, with "Add a product photo before publishing" beside it) · Cancel.

Both call the existing `createProduct` with a form field `intent` of `save` or `publish`; `publish` sets availability to true before the existing parsing and validation run. On success, navigates to the new product's editor with a confirmation banner.

### 8.5 Staff

Products stay owner-only for writes in the permission model. Staff see the editor read-only (fields disabled, no save bar actions except Back), and New Product shows "Only the owner can add products".

---

## 9. Occasions, media and navigation

### 9.1 Occasions

- **List — `/admin/occasions`:** thumbnail, name, description, status (Visible · Hidden), product count, web address, order. Row actions: **Edit** · **View** (when visible) · More → Show or Hide, separator, Delete.
- **Editor — `/admin/occasions/new` and `/[id]/edit`:** main column: Occasion information (name, description), Image (media picker), SEO (search title, search description, share image, hide from search engines, same counters and preview pattern as products with `calanthe.ae/occasions/<slug>`). Side panel: visibility, web address, order. FormActions and unsaved-changes guard.
- **Schema — additive migration:** a `seo` group on `occasions` with `title` (text, max 70), `description` (textarea, max 180), `image` (upload → media), `noIndex` (checkbox, default false; create/update access admin-only, matching products). All nullable; no backfill; the generated migration is reviewed to contain only additions and a matching rollback before it is applied.
- **Storefront (the only storefront change):** `occasions/[slug]` metadata uses `seo.title` → name; `seo.description` → occasion description → today's generated sentence; Open Graph image `seo.image` → occasion image; `robots: noindex` when `seo.noIndex`. The storefront occasion data mapper adds these fields to its allow-list. The sitemap is unchanged.
- **Rules unchanged:** create and delete owner-only; staff may edit; deletion refused while any product uses the occasion.

### 9.2 Media library — `/admin/media`

- **Grid** of thumbnails, **48 per page**.
- **Search** runs on the server: description or file name (`like`).
- **Filters:** type (JPEG · PNG · WebP · AVIF) and usage (in use · not used). Usage is resolved on the server by computing the set of used media ids with `collectMediaUsage` and querying `id in` / `id not in` that set.
- **Upload:** file and description (required, max 200); pending state; the new photo appears first on success.
- **Details drawer** (opened from a thumbnail): large preview; dimensions, file size, type, uploaded date; **where it's used**, each a link to that product or occasion editor; **editable description** (required, max 200) and **credit** (optional, max 140), saved with `useAction`; **Copy link** (absolute URL built from the current origin and the served path); Delete (owner only), refused while in use with the names of what uses it.
- **Picker** in the product and occasion editors: search, upload, select. Loaded with `next/dynamic` only when opened.

### 9.3 Navigation

| Group | Items |
| --- | --- |
| — | Dashboard |
| Shop | Products · Occasions · Media |
| Orders | Orders · Customers · Enquiries · Events |
| Marketing | Memberships · Marketing *(Promotions is added by the promotions sub-project)* |
| Operations | Delivery |
| System | Staff · Settings |

- Memberships, Marketing, Delivery, Staff and Settings remain "coming soon" screens.
- **Footer:** signed-in name and role; Sign out. Under a quiet *Developer* label, owner only: **Developer CMS ↗** and the direction switch (§5.7). No Help link — there is no help content to link to.
- **Phones:** a compact top bar (menu button, search, avatar). The menu button opens the Drawer containing the same groups.
- The current page is marked with `aria-current="page"`; each group is a labelled list.

---

## 10. Dashboard 2.0

### 10.1 Data flow

- The arithmetic lives in a pure module, `backend/domain/dashboard.ts`, with no Payload import: window calculation, UAE day and hour bucketing, sales and order totals, average order value, slot parsing, late and overdue classification, top-product ranking.
- `backend/data/dashboard.ts` performs the queries (as the signed-in user) and passes plain arrays to the domain functions. Each query is wrapped in React `cache()` so no request fetches the same data twice.
- **Queries:** orders created in the current and previous window (one query); open orders; today's deliveries; the 6 most recent orders; the 5 most recent enquiries; customer counts; enquiry counts; products with no photos.
- **Rendering:** the period selector, KPI cards and action center render first. Charts, status breakdown, top products, today's deliveries and the recent lists are each inside a `Suspense` boundary with a matching skeleton.

### 10.2 Period

`?period=today|7|30|90`, default `7`. All boundaries are Asia/Dubai (UTC+4, no DST).

- **Window:** `today` = today 00:00 to now; `7|30|90` = the last N UAE days including today.
- **Previous window:** `today` = yesterday 00:00 to the same time of day yesterday; `7|30|90` = the N days immediately before the window.
- **Chart buckets:** `today` = 24 hourly buckets; otherwise one bucket per UAE day. Empty buckets are zero.

### 10.3 KPI cards

Each card links to the relevant filtered list.

| Card | Definition |
| --- | --- |
| **Sales** | Σ `totalFils` of orders created in the window with `fulfilmentStatus ≠ CANCELLED`. Beneath: "Paid: AED X" = Σ `totalFils` of orders created in the window with `paymentStatus ∈ {PAID, PARTIALLY_REFUNDED}`. Comparison with the previous window. |
| **Orders** | Count of orders created in the window with `fulfilmentStatus ≠ CANCELLED`. Comparison with the previous window. |
| **Average order value** | Sales ÷ Orders, rounded to the nearest fils; "—" when Orders is 0. |
| **Customers** | Owner: new accounts (`role = customer`, created in the window) and the all-time total. Staff: "Owner only". |
| **Open orders** | Count with `fulfilmentStatus ∈ {NEW, CONFIRMED, PREPARING, READY, OUT_FOR_DELIVERY}` (all time). Beneath: "N to confirm" (`NEW`). |
| **Enquiries waiting** | Count with `status ∈ {NEW, IN_REVIEW, WAITING_FOR_CUSTOMER}`. Beneath: "N follow-ups due" (those with `followUpAt ≤ now`). |

Money is always shown in AED.

### 10.4 Action center

Shown above the charts. Each line appears only when its count is greater than zero and links to the filtered list:

| Line | Rule | Link |
| --- | --- | --- |
| N deliveries overdue | open order whose delivery date (UAE day) is before today | `/admin/orders?attention=overdue` |
| N of today's deliveries are late | delivery date is today (UAE), the slot's end time has passed, `fulfilmentStatus ∈ {NEW, CONFIRMED, PREPARING, READY}` | `/admin/orders?attention=late` |
| N new orders to confirm | `fulfilmentStatus = NEW` | `/admin/orders?status=NEW` |
| N enquiries waiting | as the KPI | `/admin/enquiries?status=waiting` |
| N follow-ups due | waiting enquiries with `followUpAt ≤ now` | `/admin/enquiries?followUp=due` |
| N products hidden — no photo | products with no images | `/admin/products?availability=no-photos` |

When every count is zero: **✓ Nothing needs attention**. **✓ Today's deliveries on track** is shown only when at least one non-cancelled delivery is due today and none is late. There is no payment-issues line: no payment integration exists, so any such alert would be invented.

### 10.5 Slot parsing

A slot is parsed with `^\s*(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})\s*$` (en dash, em dash or hyphen). The end time is interpreted on the delivery's UAE day. A slot that does not match is **never** classified as late and sorts after parsed slots.

### 10.6 Panels

- **Sales chart** and **orders chart** — inline SVG (existing `Charts.tsx`, extended for hourly buckets). `<title>` elements receive a single string child.
- **Open orders by status** — the existing proportional bar.
- **Top products** — top 5 from order item snapshots in the window where `fulfilmentStatus ≠ CANCELLED`, grouped by product id when present, otherwise by snapshot name, displayed with the most recent snapshot name. `?rank=units|sales` (default `units`) switches the ordering; server-rendered links, no client JavaScript.
- **Today's deliveries** — non-cancelled orders due today, grouped by slot in start-time order, with late ones marked.
- **Recent orders** (6) and **recent enquiries** (5).

### 10.7 New list filters

- Orders: `attention=overdue|late` (rules as §10.4).
- Enquiries: `status=waiting` (the three waiting statuses) and `followUp=due`.

---

## 11. Server changes summary

### 11.1 Actions (`backend/actions/admin.ts`, all as the signed-in user, no `overrideAccess`)

- `duplicateProduct(id)` — §8.2.
- `setProductAvailability(id, available)` — publish or hide; publish refused without photos.
- `createProduct` — accepts `intent` (`save` | `publish`), §8.4.
- `updateOccasion` / `createOccasion` — accept the SEO group.
- `updateMedia(id, { alt, credit })` — media details drawer.
- `setOccasionActive(id, active)` — show or hide from the occasions list menu.
- Validation failures return `{ ok: false, message, fieldErrors?: Record<string, string> }` so forms can show errors beside fields.

### 11.2 Pure domain modules

- `backend/domain/dashboard.ts` — §10.
- `backend/domain/product-duplicate.ts` — `nextFreeSlug(base, taken)` and `duplicateName(name)`.

### 11.3 Data

- `backend/data/dashboard.ts` rewritten around §10.1.
- Search queries for §7.8.
- Media paging, search and usage filtering for §9.2.

### 11.4 Schema

- One additive migration: `occasions.seo` (§9.1). No other schema change.

---

## 12. Security and permissions

- `(panel)/layout.tsx` remains the gate; customers cannot reach any admin screen.
- Every admin read and write passes the signed-in user to Payload with `overrideAccess: false`; the existing permission model decides.
- Owner-only in the interface **and** in access rules: product writes, occasion create and delete, media delete, customer data, `noIndex` fields.
- Global search shows the Customers group to the owner only, and every group's query runs under access control regardless.
- The direction cookie carries no authority.
- Server components pass only the fields a screen renders to client components; no Payload documents, secrets or configuration reach the browser.

---

## 13. Testing and verification

### 13.1 Unit tests (Vitest)

Existing 111 tests remain; none are removed or weakened.

- **Dashboard domain:** cancelled orders excluded from sales and orders; average order value is "—" with zero orders and rounds to fils; UAE hour and day bucketing across midnight UTC; previous-window arithmetic for `today` and `7`; slot parsing with en dash, em dash, hyphen and unparseable text; overdue and late classification; top-product grouping by id with name fallback.
- **Product duplicate:** `nextFreeSlug` picks `-copy`, then `-copy-2`, skipping taken values; `duplicateName` stays within 140 characters.
- **Product intent:** `publish` without images is refused with the publish-needs-photo message.
- **RTL guard:** `src/admin/rtl-guard.test.ts` scans `.tsx` files under `src/admin` and `src/app/(admin)` for class tokens `ml-` `mr-` `pl-` `pr-` `left-` `right-` `text-left` `text-right` `border-l` `border-r` `rounded-l` `rounded-r` `rounded-tl` `rounded-tr` `rounded-bl` `rounded-br` `space-x-`, matched only as whole class tokens (preceded by start of string, whitespace, quote, backtick or `:`), and fails listing `file:line` for each. Screens not yet migrated are named in an explicit allow-list inside the test; the test also fails when an allow-listed file no longer contains a violation, so the list can only shrink. The allow-list is empty from commit 4 (§14) onward.

### 13.2 Permission test (script)

`scripts/admin-products-permission-test.mts`, following the existing permission-test pattern (temporary fixtures via the Local API, real access path, full cleanup):

- owner can duplicate, publish and hide a product;
- staff and customer are refused duplicate, publish and hide;
- publish without photos is refused for the owner;
- a duplicate is hidden and has a free web address;
- staff can edit occasion SEO title and description but not `noIndex`;
- `backend/actions/admin.ts` contains no `overrideAccess`.

### 13.3 Browser verification (Playwright, Chromium)

Against a running dev server with temporary QA fixtures, removed afterwards.

- **Widths:** 320, 375, 390, 414, 768, 1024, 1440 — each in `ltr` and `rtl`.
- **Screens:** dashboard (all four periods), products list, new product, edit product, occasions list and editor, media library and details drawer, media picker, orders list and detail, customers list and detail, enquiries list and detail, events list and detail, global search, sign-in, admin not-found.
- **Checks on every screen:** no horizontal body overflow; row actions, dialogs, menus and the save bar fully within the viewport; zero console errors and zero failed requests; interactive targets ≥44px (a control inside a ≥40px-tall label, and text links inside running copy, are exempt); visible focus indicator.
- **Flows:** keyboard-only sign-in; RowMenu with ↓/↑, Home/End, Escape and focus return; ConfirmDialog initial focus and Escape; mobile Drawer open and close; unsaved-changes guard via Cancel and via an in-admin link; saving → saved and saving → failed on a product; duplicate; publish refused without photos; publish and hide with a photo; delete a new product; upload, select and set a primary photo; edit media description; each action-center link lands on a list showing the expected records; `prefers-reduced-motion` emulation removes transitions.
- **Screenshots:** major screens at 390px and 1440px in `ltr`, and at 390px in `rtl`, saved to the scratchpad and reviewed by eye.
- **Browsers:** Chromium only. WebKit is not installed and is not claimed.

### 13.4 Gates

`tsc --noEmit`, `eslint` and `vitest run` before every commit. `next build` at the end of the sub-project.

---

## 14. Commit plan

Local commits, not pushed. Each passes the §13.4 gates available at that point.

| # | Commit | Contents |
| --- | --- | --- |
| 1 | `feat(admin): add native-first design system` | `src/admin/ui/*`, icons, ToastProvider, `useAction`, RowMenu, dialogs, RTL guard test (with an allow-list of the not-yet-migrated screens) |
| 2 | `feat(admin): move shell and shared screens to the design system` | Navigation, top bar, global search, not-found, loading shapes, direction switch; orders, customers, enquiries, events. |
| 3 | `feat(admin): product management` | Products list and RowMenu, duplicate, publish/hide, editor, new product with intents, unsaved-changes guard, permission test |
| 4 | `feat(admin): occasion SEO and media library` | Migration, occasion list and editor, storefront occasion metadata, media library, details drawer, lazy picker. The last old screens migrate here: `ui.tsx`, `Form.tsx` and the old `MediaPicker` are deleted and the RTL guard allow-list is emptied. |
| 5 | `feat(admin): dashboard 2.0 and action center` | Dashboard domain module and tests, data layer, KPIs, action center, panels, new list filters |
| 6 | `fix(admin): responsive, RTL and accessibility QA` | Fixes found in the §13.3 sweep |

---

## 15. Risks, limits and blockers

| Item | Effect | Handling |
| --- | --- | --- |
| **Disk space** — C: has ~525 MB free | Dev server cache, Playwright runs and `next build` cannot complete | Implementation verification waits until several GB are free. A build failure caused by disk space is reported as such and never described as passing. |
| WebKit not installed | Safari rendering is not verified | Chromium only; stated in the report. Installing WebKit needs ~250 MB more. |
| Browser Back button | Cannot be intercepted by the unsaved-changes guard | Documented; `beforeunload` covers reload and tab close. |
| Popover API on older iOS | Menus and tooltips need a non-top-layer fallback | Feature-detected fallback (§5.4). |
| Products filtered in memory | Fine for tens of products | Revisit above 500 products. |
| Cash on delivery never becomes paid | "Paid" stays at AED 0 | Sales counts placed orders, labelled accordingly (§10.3). |

---

## 16. Handoff to the promotions sub-project

The promotions design starts from:

- `backend/domain/pricing.ts` — `priceOrder` already returns `discountFils` (currently 0).
- `orders` — `discountFils`, `couponCode`, `couponDiscountFils` exist and are immutable; there is no field recording the discount's type or value.
- The order integrity hook enforces `total = subtotal + delivery − discount`, discount ≤ subtotal + delivery, total ≥ 0.
- `docs/DATABASE.md §6` designs a `coupons` collection with an atomic redemption counter; `docs/ORDERS.md` fixes the order of operations (discount before delivery; the free-delivery threshold measured on the discounted subtotal).
- Checkout currently computes display totals in the browser and clears the cart even when an order fails.
- Decided in the brief: status derived from enabled + dates; per-customer limits only where identity is enforceable; promotion screens, the Promotions nav item and the dashboard promotion panel are built on this design system.
