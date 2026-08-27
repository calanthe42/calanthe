# Competitor UX Study — flowers.ae

Studied 2026-08-28 from live pages (homepage, /collections/birthday-flowers,
/products/50-red-roses, /collections/extras, delivery page, /pages/how-to-order).
This documents their WORKFLOWS — the steps a customer moves through — and how
Calanthe rebuilds each one in our own brand. Their code, photos and copy are
theirs; the UX logic is what we're learning from.

---

## a) Browse → collection → product

**What they do.** Layered nav: Shop by Occasion (Birthday, Anniversary, New
Born, Get Well Soon, Congratulations, Welcome Back, Condolence) · Shop by
Flower (Rose, Sunflower, Hydrangea, Lily, Orchid) · Shop by Price (Under/Over
AED 500) · Add-ons · Events. Collection pages: sort dropdown (featured,
price, A-Z, new), ~20 products, simple cards (image, name, from-price).
Trust banner repeats on every collection page ("14,000+ 5-star reviews · Free
Delivery to all Emirates · Video Approval on all orders") plus an FAQ block
and editorial links at the bottom (SEO + reassurance).

**Why it converts.** Three redundant entry paths (occasion/flower/price) match
three shopper mindsets: "it's her birthday" / "she loves roses" / "I have AED
400". Trust banner answers objections before they form.

**Calanthe.** We have occasion nav + price filters. GAP: no Shop-by-Flower
dimension, no layered mega-menu (mobile accordion), no trust band on
collections, no FAQ/editorial tail on collection pages. Build: layered nav
overlay (our occasions + flower types + two price tiers), quiet trust band in
Cinzel, collection-page FAQ block. Ours stays editorial — hairlines and
eyebrows, not badge clutter.

## b) Product configuration

**What they do (order matters).** 1) Design/size variant with price (Grand
AED 625 / Classic AED 525) → 2) wrapper colour → 3) card selection (plain
complimentary, themed +AED 10) → 4) gift add-ons inline WITH IMAGES + prices
(balloons 35–165, chocolates 65–135, cakes 195, candles 195, diffusers 295,
teddy 95, dates 115) → 5) an annual-reminder subscription upsell (AED 99).
Video-approval promise sits right next to add-to-cart.

**Why it converts.** The PDP is the whole gift desk — you assemble the entire
present in one column, seeing pictures of every add-on. Average order value
climbs without a separate "extras" detour.

**Calanthe.** We have size → add-ons → gift message (live preview — BETTER
than theirs) → date/slot → price recompute. GAPS: add-ons are text chips
(need imagery tiles), no wrapper choice (skip — florist's craft, our voice),
no card-style choice (our monogram card IS the brand — keep one card, keep
the live preview), video-approval line missing at add-to-cart. Build: add-on
tiles with placeholder images + prices, video-approval promise line, richer
add-on catalogue (add Cake, Candle, Teddy to data.ts).

## c) Delivery date / time-slot flow

**What they do.** Same-day until 10pm cutoff; 60-minute express in Dubai;
exact-time slot for +AED 50; date is confirmed in checkout ("Arrange
delivery" is its own step); recipient is contacted to verify location.

**Why it converts.** Same-day-until-10pm is the killer promise, repeated
everywhere. The paid exact-time slot monetises urgency.

**Calanthe.** We already force date+slot on the PDP (carried into checkout)
with an honest cutoff countdown — structurally we're ahead of them here.
GAPS: no express/exact-time premium option, cutoff (17:00) far more
conservative than theirs (client decision — flag), promise not repeated as
a drumbeat. Build: optional "Exact hour — +AED 50" slot tier (flagged for
client), repeat the same-day promise on PDP + cart + checkout.

## d) Video/photo approval promise

**What they do.** "Your florist will send a video via WhatsApp or email for
your approval before delivery" — in the site-wide header banner, on the PDP
next to add-to-cart, and on the delivery page. Post-delivery notification to
the sender.

**Why it converts.** It kills the #1 fear of gifting flowers remotely: "will
it actually look like the photo?" It is their single strongest trust device.

**Calanthe.** Absent — biggest gap. Build (UI now, wired later): 1) homepage
trust section ("Approved by you, before it leaves the atelier"), 2) PDP line
near add-to-cart with WhatsApp glyph, 3) order-confirmation screen step
("We'll send you a video of your arrangement on WhatsApp for approval").
Fits our voice perfectly — the atelier showing its work.

## e) Cart → checkout field order

**What they do.** Their documented flow: bouquet → extras → recipient
details → personalised message → delivery timeframe → date+address confirm →
billing → payment (Visa/MC/PayPal/Tabby/Tamara + wallets) → confirmation
email.

**Calanthe.** Same skeleton exists. GAPS: no Tamara mention (add badge beside
Tabby), no express-checkout wallets row (placeholder), our gift toggle +
surprise checkbox is BETTER (they bury recipient handling). Keep ours,
add payment badges.

## f) Trust layer across the journey

**What they do.** The same three promises (14k reviews · free delivery ·
video approval) as a header drumbeat on EVERY page; press strip (Vogue,
Harper's Bazaar, Forbes, Grazia…); Trustpilot/Google ratings section; FAQ
accordions on content AND collection pages; 7-day freshness guarantee with
farm-origin story (South America, Holland, Ethiopia).

**Why it converts.** Repetition. No page is more than one viewport from a
trust signal.

**Calanthe.** Almost none of this exists yet. Build (quiet, editorial):
- Homepage trust band after Calanthe Touch: rating placeholder ("Rated ★★★★★
  by our clients" — count TBD by client), guarantees row, "As featured in"
  hairline strip (logo placeholders, flagged).
- Compact guarantee row on PDP (exists partially as trust row in checkout).
- Freshness/origin line in The Calanthe Touch (client to confirm sourcing).
All placeholders clearly flagged — NEVER fabricate counts as real.

## g) Upsell / cross-sell points

**What they do.** Add-ons at PDP (images+prices), a whole /extras collection,
and add-ons again at checkout. Bento cakes AED 95, premium cakes AED 195,
spa boxes AED 147 — gifts beyond flowers widen the basket.

**Calanthe.** PDP add-ons exist (text only). GAP: no cart-drawer upsell.
Build: "Complete the gift" row in the cart drawer — 2–3 add-on tiles that
attach to the last-added line, in our editorial style, never loud.

---

## Rebuild checklist (Step 2, in order)

1. **PDP configuration flow** — add-on image tiles, extended catalogue
   (cake/candle/teddy), video-approval line, same-day promise line.
2. **Delivery step polish** — exact-hour premium slot (flagged), promise
   drumbeat on PDP/cart/checkout.
3. **Cart upsell** — "Complete the gift" tiles in drawer.
4. **Video-approval surfaces** — homepage section, PDP line, confirmation step.
5. **Trust layer** — homepage trust band + press strip (placeholders),
   PDP guarantee row; Tamara/wallet badges at checkout.
6. **Layered nav** — occasion/flower/price mega-menu, mobile accordion in
   the olive overlay.
7. **Help content** — real /delivery (per-emirate + cutoff from the
   constant), /faqs accordion (delivery, freshness, substitution per our
   seasonal disclaimer, video approval, payment), structured T&C/privacy/
   refund pages awaiting client copy.

## Guardrails

Only Calanthe palette/type/voice; gifting rule sacred (recipient never sees
price); client-locked homepage order and copy unchanged — the trust band and
video-approval section are ADDITIONS between locked sections, which needs a
nod from the client before we treat their order as final.
All review counts, press logos, ratings = placeholders flagged for the
client. If anything drifts toward bright Shopify retail, redo it editorial.
