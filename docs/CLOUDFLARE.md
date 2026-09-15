# Cloudflare + Vercel — recommended setup

**Status: nothing here has been applied.** The Cloudflare account exists;
DNS has not been touched, the domain has not been moved, and no record in
this document has been created. This is the plan to execute deliberately,
not a description of the current state.

Read `docs/DEPLOYMENT.md` first — it owns the Vercel side. This document
only covers what sits in front of it.

---

## 0. The decision that governs everything else

Vercel already provides a global CDN, image optimisation and TLS. Putting
Cloudflare in front of it can therefore *subtract* performance if done
carelessly — two CDNs in series means two cold caches, two TLS
terminations, and a much harder debugging story when a page goes stale.

So the recommendation is deliberately narrow:

**Proxy the apex and `www` through Cloudflare for WAF, bot control and
rate limiting. Do NOT let Cloudflare cache HTML, and do NOT let it touch
`/_next/image`.** Vercel keeps serving and optimising the site;
Cloudflare is the doorman, not a second warehouse.

If the only thing wanted is DNS, use Cloudflare DNS with the proxy **off**
(grey cloud) and skip sections 3–5 entirely. That is a perfectly
respectable outcome, and it is the lowest-risk one.

---

## 1. DNS records

Point the domain at Vercel and let Vercel issue the certificate.

| Type  | Name  | Value                   | Proxy  | TTL  |
| ----- | ----- | ----------------------- | ------ | ---- |
| A     | `@`   | `76.76.21.21`           | Orange | Auto |
| CNAME | `www` | `cname.vercel-dns.com.` | Orange | Auto |

Confirm both targets in the Vercel dashboard before creating them —
Vercel has changed its apex IP before, and a value copied from a blog
post is how a domain goes dark.

Keep, and do **not** proxy (grey cloud), any record used for domain
verification or email: `MX`, `TXT` (SPF/DKIM/DMARC), and Vercel's
`_vercel` TXT. Proxying those breaks them.

**Order of operations.** Add the domain in Vercel *first* and let it
verify while DNS still points at the old host. Only then flip the
records. Set TTL low (300s) a day ahead of the move, so a mistake is
reversible in minutes rather than a day.

### SSL/TLS mode

Set **Full (strict)**. Anything less — "Flexible" especially — means
Cloudflare talks to Vercel over plain HTTP, which produces redirect loops
and is a real downgrade of the customer's connection. Enable **Always Use
HTTPS** and **HSTS**, starting `max-age` short (300s) and raising it to a
year once the setup is proven. HSTS is hard to undo.

---

## 2. What must NOT be proxied or cached

Get this wrong and the site breaks in ways that look random.

- **`/cms/*` and `/admin/*`** — never cache. Both are authenticated and
  personalised. A cached `/admin` page served to the wrong person is a
  data breach, not a performance win.
- **`/api/*`, `/checkout`, `/account/*`, `/login`** — never cache.
  Checkout in particular carries per-session state.
- **`/_next/image*`** — leave to Vercel. Cloudflare Polish and Vercel's
  image optimiser will fight each other, and the result is
  double-recompressed photographs on a site whose entire product *is*
  photography.
- **`/_next/static/*`** — already immutable and fingerprinted, and Vercel
  serves it with correct headers. Caching it at Cloudflare too is
  harmless but buys little.

---

## 3. Cache strategy (only if proxying)

Default: **Cache Level = Standard**, and do **not** enable "Cache
Everything" globally. Next.js sets its own `Cache-Control` per route —
`revalidate = 300` on the catalogue pages, `force-dynamic` on account and
login — and Cloudflare's Standard level respects it.

If a cache rule is wanted, scope it tightly:

```
Rule:  Bypass cache for dynamic surfaces
When:  (http.request.uri.path contains "/admin")
    or (http.request.uri.path contains "/cms")
    or (http.request.uri.path contains "/api")
    or (http.request.uri.path in {"/checkout" "/login" "/wishlist"})
    or (http.request.uri.path contains "/account")
Then:  Cache eligibility = Bypass cache
```

Add that rule **before** enabling any broad caching, not after.

Enable **Brotli**. Leave **Auto Minify** off — Next already minifies, and
Cloudflare's minifier has historically broken inline JSON-LD, which this
site now emits on the homepage and on every product page.

**Rocket Loader must stay off.** It reorders and defers scripts, which
breaks React hydration.

---

## 4. WAF and bot control

Start with:

- **Managed Ruleset**: on
- **Bot Fight Mode**: on for the free tier — but see the caveat below
- **Security Level**: Medium

Two rules worth adding by hand:

```
Rule:  Protect the admin surfaces
When:  (http.request.uri.path contains "/admin")
    or (http.request.uri.path contains "/cms")
Then:  Managed Challenge
```

```
Rule:  Never challenge the crawlers we want
When:  (cf.client.bot) and not (http.request.uri.path contains "/admin")
Then:  Skip — all remaining custom rules
```

**The caveat that matters here:** Bot Fight Mode challenges *verified*
crawlers too on some plans. This site's whole commercial case is being
found by someone searching for flowers in Abu Dhabi. After enabling it,
check Google Search Console's Crawl Stats within 48 hours; if crawl
errors appear, turn it off. Search visibility beats bot cost.

---

## 5. Rate limiting

The application already rate-limits through Upstash (`src/lib/redis.ts`).
Cloudflare's job is to absorb volume before it reaches a serverless
function and bills for it — not to replace that logic.

| Path                 | Limit       | Action            |
| -------------------- | ----------- | ----------------- |
| `/login`             | 10 / 10 min | Managed Challenge |
| `/cms/*`, `/admin/*` | 30 / min    | Managed Challenge |
| `/api/*`             | 120 / min   | Block (1 min)     |

Key on IP. Deliberately generous: a shared office or a mall's public
Wi-Fi in the UAE can put many genuine customers behind one address, and a
limit tuned for an attacker will lock out a real order.

---

## 6. The hero film, if and when it exists

`src/lib/hero-media.ts` reads `NEXT_PUBLIC_HERO_VIDEO_URL`. The file is
never committed. Two supported hosts:

- **Vercel Blob** — already in use for Payload media, one fewer vendor,
  and already allowed in `next.config.ts`'s `remotePatterns`.
- **Cloudflare R2 behind a proxied custom domain** — cheaper egress at
  volume, and free from Cloudflare to the visitor. Set a long
  `Cache-Control` (`public, max-age=31536000, immutable`) and version the
  filename.

Either way the asset must be served with **Range request support**, or
the browser downloads the whole file before showing the first frame. Both
hosts do this by default; a naive origin behind a proxy may not.

Do **not** reach for Cloudflare Stream. It is priced per minute
delivered, and this is one short silent loop on a landing page — object
storage plus a CDN is the right shape, at a fraction of the cost.

---

## 7. Verification after any change

```sh
# Certificate chain and TLS version
curl -sSI https://calanthe.ae | head -20

# Is Cloudflare in front, and is HTML being cached when it should not be?
curl -sSI https://calanthe.ae | grep -iE "cf-cache-status|server|cache-control"
#   expect: cf-cache-status: DYNAMIC (or BYPASS) for HTML

# The admin surfaces must never report a cache HIT
curl -sSI https://calanthe.ae/admin | grep -i cf-cache-status

# Redirects resolve in one hop, with no loop
curl -sSIL http://calanthe.ae | grep -iE "^HTTP|^location"

# The catalogue still renders and is indexable
curl -sS https://calanthe.ae/robots.txt
curl -sS https://calanthe.ae/sitemap.xml | head -20
```

Then, in a browser, place a real COD order end to end. Checkout is the
surface most likely to be broken by an over-eager cache rule, and it is
the one nobody tests until a customer complains.
