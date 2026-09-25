# UI audit and delivery UX — 2026-09-25

Commissioned as: *"test for all device sizes including new iPhone… I'd like
a ready UI/UX including the checkout, the cart… also the delivery — check how
other florists do delivery and do something."*

Three pieces of work: a real device audit, the defects it found, and the
delivery experience measured against what UAE florists actually do.

---

## 1. The audit

`scripts/ui-audit.mts` — **18 device sizes × 6 pages, Chromium and WebKit**,
162 page loads, a screenshot of every one.

### Why a new harness

`device-check.mts` asked one question — is anything wider than the screen —
on three pages. It passes a checkout whose order button is 32px tall, whose
prices are set in 13px type, and whose sticky bar sits under the home
indicator. Those are the faults that cost an order, and none of them are
overflow. The new harness checks overflow **and** tap targets, type size,
safe-area handling, broken images and console errors, and saves an image of
every combination so a human can disagree with it.

### The devices

Real hardware, in CSS pixels, current to 2026:

| | Widths |
| --- | --- |
| Phones | 320 (SE 1), 344 (Z Fold **folded**), 360 (S24), 375 (SE 2022, 13 mini), 390 (14), 393 (16), 402 (17 Pro), 412 (Pixel 8), 420 (Air), 430 (16 Plus), 440 (**17 Pro Max**) |
| Tablets | 744 (iPad mini), 834 (iPad 11"), 1366 (iPad Pro landscape) |
| Desktop | 1280, 1440, 1920 |

The folded Z Fold at 344px is the honest floor for a phone-first site —
narrower than any iPhone. 320px is kept because an SE 1 still exists.

WebKit runs on every iPhone width, because iOS is where this shop's
customers are and it is not Chromium.

### What it found

**Nothing overflowed. No image broke. Nothing crashed.** Across 162 loads at
18 widths in two engines. The mobile-first discipline in this codebase has
held, and that is worth saying plainly before the list of faults.

Three real defects, and a large number of findings that turned out to be
either my harness's fault or a decision that belongs to the owner.

---

## 2. Defects found and fixed

### The checkout had no order button in the thumb zone

On a phone, the only way to place an order was to scroll to the bottom of a
three-step form — past recipient, emirate, address, day, window and contact
details — with no running total visible on the way. CLAUDE.md requires
primary CTAs in the thumb zone, and the **product page already does this
correctly**. Checkout, the page that actually takes the money, did not.

Fixed with the same pattern, the same tokens and the same
`pb-[max(env(safe-area-inset-bottom),0.75rem)]`, so it clears the home
indicator on every iPhone since the X. It shows the live total, the item
count and the chosen emirate. The inline button is hidden on mobile — two
identical Place Order buttons a thumb apart is a choice nobody should have
to make.

### A customer could book a delivery window in the past

The worst of the three. `buildDays` refused *today* after the 17:00 cutoff,
and **nothing ever looked at the windows**. So at 14:00 a customer could
choose "Today" and "10:00 – 13:00" — a window that closed an hour earlier —
and the order went through. The shop then owns a delivery it cannot make,
which is worse than a lost sale, because someone is waiting for flowers.

`buildSlots(now, day)` now decides each window against the clock:

- a window that has **started** → `Passed`, disabled
- a window opening within the lead time → `Too soon`, disabled
- today is disabled once **every** window has gone, not only after 17:00 —
  otherwise the picker offers a day on which nothing can be chosen

`WINDOW_LEAD_MINUTES = 90`, chosen so an arrangement can actually be
composed and photographed for approval before it leaves. **That number is a
business rule and needs the owner's confirmation** (`OWNER_TODO` #27).

Verified live at 12:30 UAE: `10:00 – 13:00 Passed`, `13:00 – 17:00 Too soon`,
`17:00 – 21:00` selectable. 14 unit tests in `src/lib/delivery.test.ts`
covering the boundary to the minute.

### The free-delivery line appeared only once it no longer mattered

```
{zone && freeDelivery && <p>Delivery is complimentary on orders over AED 350.</p>}
```

It announced the threshold **only after it had already been met** — telling
her about it at the one moment she could do nothing with it. It now says how
far away it is while she can still act: *"AED 60 more for complimentary
delivery."*

### A checkbox deformed on narrow screens

`h-4 w-4` with no shrink guard, measured at **13×16px** on every width from
320 to 430 — a squashed rectangle, not a square. `shrink-0` added on
checkout and Build Your Own.

---

## 3. Findings that were my harness's fault

Recorded because a device audit that cries wolf is worse than none.

| Reported | Reality |
| --- | --- |
| `safe-area`: four sticky bars "sit on the home indicator", 32 findings | **The CSS was always correct.** Playwright does not emulate `env(safe-area-inset-*)`, so a correct `max(env(...), 0.75rem)` always computes to its 12px fallback. Now detects the declaration instead of the computed value. **0 after.** |
| `tap-target`: header brand mark 64×**43** on 7 pages | The author extends the hit area with an absolutely positioned `::after` of `h-11`. A finger hits 64×44. Now measures pseudo-elements too. |
| `tap-target`: checkboxes 16×16 | Wrapped in a `<label>` with `min-h-11` — the label is the target. Now excluded when the wrapping label clears 44×44. |
| `error`: ChunkLoadError on checkout | **Proven, not assumed.** Loading `/checkout` cold with a genuine cart injected before first paint — no navigation from another page — gives **0 errors on 320/375/390/393/430 in both Chromium and WebKit, 10/10, with the form and the new sticky bar rendered**. The error appears only when the harness navigates away from the product page mid-prefetch and aborts the chunk request. It is the harness, not the checkout. |

### Before and after

| | Before | After |
| --- | --- | --- |
| overflow | 0 | 0 |
| broken images | 0 | 0 |
| crashes | 0 | 0 |
| safe-area | 4 (all false) | **0** |
| tap-target | 62 | **53** |
| type-too-small | 72 | 73 |
| error | 1 (harness) | 3 (harness, same cause — see above) |

`type-too-small` rose by one because the new sticky bar's second line
("1 arrangement · choose an emirate") is `text-sm`, exactly like the product
page's sticky bar it copies. Making only mine 16px would break that
consistency for no reason; it belongs with the site-wide type decision in
`OWNER_TODO` #31–32, not as a special case.

### The cart drawer

Audited separately — it is an overlay, so page loads never reach it. Opened
on 6 widths × 2 engines: **fits the viewport, list scrolls, footer carries
`safe-area-inset-bottom`, the Checkout CTA is always on screen, no overflow,
no errors.** One finding: the product-name link in a cart line is 91×**28**.
The header's `::after` trick cannot fix it — the link is `truncate`, so
`overflow: hidden` clips the pseudo-element — and the alternatives shift the
baseline-aligned price beside it. Recorded rather than risked.

An earlier reading that the drawer overflowed on WebKit at 744px and 1440px
was my probe measuring mid-animation; settled, it lands exactly on the edge
(`right = 1440 = viewport`).

Desktop-only tap-target findings (1280px and wider) are left in the report
for comparability, but a mouse is not a thumb — the 44px rule is about touch,
and these appear on no touch device.

---

## 4. Delivery, against the market

Researched: Flowers.ae, FNP, Floward, Bliss Flower Boutique — the UAE
florists a Calanthe customer is choosing between.

| | Calanthe | Them |
| --- | --- | --- |
| Same-day cutoff | **17:00** | 22:00; 23:00 for 1-hour service |
| Delivery windows | 3 fixed (10–13, 13–17, 17–21) | 3 wide windows, plus paid precision |
| Exact-time delivery | — | +AED 50 |
| 60-minute delivery | — | +AED 75 |
| Free delivery over | AED 350 | AED 275 |
| Recipient not in | **nothing defined** | call recipient → redirect or leave with someone known → else call sender |
| Redelivery | — | AED 30–65 |
| Address | one free-text box | area, building, landmark |

**The gap that matters most is not a feature, it is an answer.** Every
competitor publishes what happens when the recipient is not home. Calanthe
says nothing, captures nothing at checkout, and has no policy to fall back
on. For a gift-led florist that is the most common failure there is.

It is also not mine to invent — it is a business rule about what the couriers
will actually do. It is `OWNER_TODO` #22, with the market's answer beside it
so the owner has something to react to rather than a blank question.

The same goes for the cutoff (five hours earlier than the market, costing the
whole evening), the threshold, and whether a luxury atelier wants to sell
certainty as a paid tier. All recorded, none guessed.

### What I did not build, and why

A structured UAE address — area, building or villa, landmark — instead of one
textarea. UAE addresses have no postcodes and couriers navigate by landmark;
a single free-text box is where failed deliveries begin. **It needs new order
columns**, and A1 is specified as one reviewed migration. Building it tonight
would either fork that migration or write a column A1 then has to reconcile.
Deferred to A1/A7 as `OWNER_TODO` #28–30.

---

## 5. Left alone deliberately

**Form labels are 10px** uppercase Cinzel, site-wide, including checkout —
where a customer is entering a delivery address and misreading has a cost.
It is the one place the brand's label style meets a task that punishes
getting it wrong. Raising it to 12px is one line in `form-classes.ts`, and it
would touch every form on the site, so it is the owner's call, not mine
(`OWNER_TODO` #31). Header and footer links at 12–14px are the same
judgement (#32).

The ~70 remaining `type-too-small` findings are almost entirely this brand
system: Cinzel eyebrows at 10–12px and chips at 14px. They are listed in
`ui-audit.md` rather than silently changed.

---

## 6. Evidence

| | |
| --- | --- |
| Before | `docs/reports/ui-audit-before.md`, screenshots in `ui-audit-before-shots/` |
| After | `docs/reports/ui-audit.md`, screenshots in `ui-audit/` |
| Harness | `scripts/ui-audit.mts` |
| Tests | `src/lib/delivery.test.ts` — 14 passing |

Both runs were made against a **production build** (`next build` + `next
start`), not the dev server, and against a disposable `ui-audit` Neon branch
seeded with the ten demo products — never production, never the Ohio project.

---

## 7. Post-cutover live checks — 2026-09-25

Run after `main` was pushed and Vercel deployed.

| Check | Result |
| --- | --- |
| `/` · `/shop` · `/admin/login` · `/checkout` | **200** |
| Function region | **`X-Vercel-Id: bom1::sin1::…`** — Mumbai edge, Singapore function |
| Deployment functions | all `[sin1]` |
| Live site reads the new database | **yes** — `/shop` lists `quiet-devotion`, published by the owner in the live admin after cutover |
| Ohio took writes before cutover? | **No.** Ohio is byte-identical to the copy. The only differences are in the *new* database and are the owner's own admin edits. Nothing to copy back. |
| Staff sign-in on live | **not run** — I do not have the staff password, and `PAYLOAD_SECRET` was never touched so sessions and hashes carry over. Owner to confirm. |
| Media loads from blob | **FAILS — see below** |

### `/product/quiet-devotion` returns 500

Deterministic, 3 of 3. The single media record's URL is
`http://localhost:3000/api/media/file/…`: it was uploaded from a local dev
session with no Blob credentials, so the file went to a laptop's `./uploads`
and the row kept a `localhost` URL. The live server is being asked to render
an image it cannot fetch.

**It is not the move.** The identical row was in Ohio and the checksums
matched. Publishing the product is what exposed it.

Not fixed here: it is production data, and the image file exists only on a
local disk, so there is no valid Blob URL to write. Owner actions are
`OWNER_TODO` #0a–0c. The code should also degrade an unreachable image to a
placeholder rather than 500 the page — logged for A7/A8.
