# FRONTEND AUDIT — 2026-08-28 (read-only)

Method: production build served locally (`next start`), walked headless
in Chrome at 390×844 (plus 360/430 sweeps and desktop spot-checks),
plus code-level greps. **No visual or code changes were made in this
pass.** (Only `.env.local` gained local-verification placeholders for
the B0 fail-closed env guard — untracked, non-visual.)

---

## 1. Route & link map

| Route | Status | Notes |
| --- | --- | --- |
| `/` | ✅ 200 | All 11 sections render; every card/tile/CTA links correctly |
| `/shop` (+ `?q=`, `?flower=`, `?price=`) | ✅ 200 | Filters work; cards → `/product/[slug]` |
| `/occasions`, `/occasions/[slug]` ×5 | ✅ 200 | Tiles → occasion pages → product cards |
| `/product/[slug]` ×10 | ✅ 200 | Full config flow |
| `/shop/[slug]` ×10 | ✅ | Legacy path; static meta-refresh redirect → `/product/[slug]` |
| `/build-your-own` | ✅ 200 | See dead-end D-1 below |
| `/membership` | ✅ 200 | See dead-end D-2 below |
| `/checkout` | ✅ 200 | Mock place-order works |
| `/cart` | ✅ | Static redirect → `/checkout` |
| `/login`, `/account`, `/wishlist` | ✅ 200 | Mock OTP/session |
| `/delivery`, `/faqs`, `/terms`, `/privacy`, `/refund-policy` | ✅ 200 | Legal = placeholder copy |
| `/style-check` | ✅ 200 | Internal QA page, noindexed — decide keep/remove before launch |
| Unknown URL (e.g. `/xyz`) | ⚠️ 404 **DEFAULT Next page** | Brand 404 ("This page has wilted") is NOT reached — side effect of the Payload two-root-layout restructure (B0). Fix: root-level global-not-found. **Punch A-1** |

**Dead ends found (buttons/links that go nowhere):**
- **A-2 Membership tier buttons** — "Begin Essential/Signature/Grand" have no action. A caption discloses "preview-only", but the primary CTA of the page is inert. (Mock boundary; needs at least an interim action — e.g. WhatsApp enquiry or waitlist.)
- **A-3 BYO confirmation is terminal** — after "Create My Arrangement" the confirmation screen offers NO onward path (no add-to-cart, no continue-shopping link). The requested journey "BYO → add to cart → checkout" does not exist; BYO never enters the cart (spec Phase B6 wires it; until then add a continue CTA).
- **A-4 Hero scroll-cue** is decorative only (does not scroll on tap) — minor.
- **A-5 Account: "+ Add address" and "Save Changes"** → toast-only mocks (disclosed in the toast text). Mock boundary, listed for completeness.
- No `href="#"`, no empty onClick handlers found in the codebase.

## 2. End-to-end journeys (headless, 390px; desktop spot-checked)

| Journey | Result |
| --- | --- |
| Home → Birthday tile → occasion page → product card → PDP → Add to Cart → drawer → Checkout → validation (empty submit correctly blocked w/ toast) → fill → Place Order → confirmation `CAL-1629` w/ video-approval line → View Your Orders → sign-in gate | ✅ **end-to-end, no breaks**. Mock boundary: order isn't persisted; payment fields are visual. |
| BYO: budget 500 → colour → vase (+60) → occasion → message → sticky CTA shows live "AED 560" → submit → confirmation | ✅ through submission, then **dead-ends (A-3)** |
| Membership: day picker (works), tier select (**A-2 inert**), FAQ accordion (works, item 1 open by default) | 🔶 |
| Auth: /login → phone → Continue on WhatsApp → 6-cell OTP (auto-advance works) → /account → mock orders visible (CAL-1042…) → tabs Addresses/Reminders/Profile all render → wishlist page reachable | ✅ mock end-to-end |
| Search: overlay opens → "rose" → instant results → click → PDP | ✅ |
| Footer links ×5 help/legal + 4 shop | ✅ all resolve (legal = placeholder copy) |

## 3. State coverage (✅ present · ❌ missing · N/A)

| Page | Empty | Loading | Error | Validation |
| --- | --- | --- | --- | --- |
| Home | N/A | ✅ (group loading.tsx) | ❌ | N/A |
| Shop/Occasion | ✅ (monogram empty state) | ✅ | ❌ | N/A |
| Product | N/A | ✅ | ❌ | 🔶 (selections have defaults; no invalid states possible) |
| Cart drawer | ✅ ("waiting to bloom") | N/A | ❌ | N/A |
| Checkout | ✅ (empty-cart state) | ✅ | ❌ | ✅ (required fields, gift recipient, stale delivery day re-check) |
| BYO | N/A | ✅ | ❌ | ✅ (budget/occasion enforced via toasts) |
| Login/OTP | N/A | ✅ | ❌ | 🔶 (phone length only; resend cooldown works) |
| Account | ✅ (signed-out gate) | ✅ | ❌ | ✅ (reminders form) |
| Wishlist | ✅ ("never wilt") | ✅ | ❌ | N/A |
| Search | ✅ (view-all fallback) | N/A | ❌ | N/A |

**Systemic gap (B-1): there is NO `error.tsx` anywhere** — a thrown
render/runtime error shows Next's default. One `loading.tsx` covers the
storefront group. Recommend: one root error boundary in the brand voice
+ per-heavy-page as needed.

## 4. Content inventory (awaiting client — request list)

| Where | Placeholder |
| --- | --- |
| All imagery site-wide | Curated 3D Unsplash stand-ins (`PHOTOS` map, `data.ts`) — real photography |
| Trust band + utility strip | "14,000+ happy customers", "Rated 5 stars" — real count/rating |
| Trust band press strip | "Press One…Four" — real press logos or remove |
| Add-on tiles (PDP + cart upsell) | Generated art — real product photos of vase/chocolates/balloon/cake/teddy/card |
| BYO form | Budget note, 8 colour options, 8 occasions, seasonal disclaimer (all FLAGGED in data.ts) |
| `/terms`, `/privacy`, `/refund-policy` | Full legal copy (structures ready) |
| Contact | WhatsApp +971 50 000 0000, instagram.com/calanthe, hello@calanthe.ae — real handles |
| Catalog | 10 mock products/prices/names; delivery fees; 17:00 cutoff; exact-hour slot pricing — client decisions |
| Membership tiers | Prices AED 260/420/680 are invented — client pricing |
| `/faqs`, `/delivery` | Drafted copy — client sign-off |

## 5. Mobile & accessibility quick pass

- **Overflow**: 0px horizontal overflow at 360/390/430 on home, shop, PDP, checkout, membership (and prior full-route sweep). ✅
- **Tap targets**: interactive elements consistently `min-h-11` (44px) — steppers, chips, pills, filters, icons. ✅ Exception: none found under 44px in sweeps.
- **Text < 16px**: body copy is 16px+. Intentional smaller text exists (Cinzel eyebrows/filters 10–11px, card meta 12–14px) — accepted brand style for labels, flag only the **filter row** (primary controls at 11px) for review.
- **Alt text**: all `FloralImage` photos carry alt from data; decorative SVGs `aria-hidden`. ✅
- **Contrast risks** (locked palette tradeoffs, not fixed):
  - Cream (#E4DCC5) on burnt-orange (#B55B29) primary CTAs ≈ 3.3:1 — fails AA for 13px text (known, documented in PROJECT-BRAIN).
  - Sage (#868764) on cream (#E4DCC5) ≈ 2.6:1 — used for *secondary* meta text (prices on cards use sage on canvas ≈ 3.0:1). Essential info in sage should move to olive; flag for design pass.
  - Footer fixed earlier (cream/75 on olive). ✅

## 6. Feature parity vs flowers.ae (honest)

**We match or beat:** layered nav (Occasion/Flower/Price) + search · forced date+slot with honest cutoff countdown (they defer to checkout) · gift-message live monogram preview (better) · recipient captured at PDP · cart upsell · video-approval promise surfaced at 3 points (UI) · trust band structure · delivery/FAQ content pages · gifting price-privacy rule stated in UI.

**They have, we still don't:** real reviews on Trustpilot/Google (ours is a placeholder line) · real press · 60-minute express delivery · paid exact-time slot (+AED 50) · same-day until 22:00 (ours 17:00 — client call) · phone number in header · blog/editorial SEO layer · collection-page FAQ/SEO copy blocks · annual reminder subscription upsell · functioning payments/orders (our mock boundary) · per-emirate landing pages · wallet payments.

---

## PUNCH LIST (top 10)

**(A) Dead ends / bugs**
1. Unknown-URL 404 renders Next default, not the brand page (global-not-found needed).
2. Membership "Begin <tier>" buttons inert — give interim action (enquiry) until backend B6.
3. BYO confirmation screen is terminal — add continue/onward CTA; wire to cart in B6.

**(B) Missing states**
4. No error boundaries anywhere (`error.tsx`) — add root + storefront group, brand voice.
5. Login phone validation is length-only — proper E.164/UAE validation (also needed for B5 anyway).

**(C) Awaiting client content**
6. Real photography (single biggest perceived-quality lever).
7. Trust numbers + press logos (or remove strip at launch).
8. Legal copy (T&C/Privacy/Refund) + FAQ/delivery sign-off.
9. Real contact handles (WhatsApp number, Instagram, email) + catalog/pricing decisions (incl. cutoff hour, exact-hour slot).

**(D) Design (deferred — owner handling separately)**
10. Contrast tradeoffs (CTA cream-on-orange; essential sage text), 11px filter labels, hero (in progress separately).
