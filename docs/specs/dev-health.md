# Spec: dev-health

## summary

FEATURE C: a developer-only Health page at /admin/health plus a monitor endpoint at GET /api/health. Spec only; nothing in the tree was changed. All paths are relative to C:\dev\calanthe.

DECISIONS
1. Access with no migration: env allow-list DEVELOPER_EMAILS (comma-separated) checked on the server against the signed-in admin user's email. The data layer takes a branded HealthGrant that only the guard can mint, so no health query can compile without the check.
2. Invisible, not just forbidden. Four leaks found in the tree, each closed:
   - The whole admin dictionary (src/admin/i18n/en.ts / ar.ts) is serialised to the browser for every /admin visitor, including the anonymous login page (src/app/(admin)/admin/layout.tsx -> messagesFor). Health strings therefore live in a separate server-only dictionary and are NOT added to en.ts/ar.ts.
   - NAV_GROUPS (src/admin/shell/nav.ts) ships in the client bundle. The Health link is not added there; the server layout passes one pre-translated item as a prop, to the developer only.
   - Today an unknown /admin/zzz renders src/app/global-not-found.tsx (storefront 404), while notFound() inside the panel renders (panel)/not-found.tsx, and an anonymous visitor gets a login redirect only for routes that exist. A guarded page would be distinguishable in both cases. Fix: add a panel catch-all (panel)/[...missing]/page.tsx that calls notFound(), so /admin/health and /admin/anything behave identically for anonymous, staff and owner.
   - The owner can reset any team member's password (src/backend/actions/team.ts) and edit users in /cms, so she could sign in as the developer. Developer accounts become immutable to everyone but themselves (Users hook + team actions).
3. JSON for uptime monitors: GET /api/health, authorised by Authorization: Bearer HEALTH_CHECK_TOKEN (works with the database down) OR a developer session. Everyone else is handed to Payload's own REST handler, so the reply is byte-identical to any unknown /api route. 200 for ok/warning, 503 for failing. Token callers get no order numbers, emails or facts.
4. Webhook heartbeat without a migration: a small JSON value in Upstash (already a dependency), written by the webhook route, never able to delay or fail the acknowledgement. When Upstash is off the page falls back to Stripe's own view (webhookEndpoints.list, events.list pending_webhooks) and database evidence (latest paidAt). No migration is needed anywhere in this feature.
5. Two checks beyond the brief, both aimed at the incidents this project has had: a schema probe (reads one row from every collection, which catches "database one migration behind" even when the migration list looks right; note the tree currently registers Discounts in payload.config.ts with no discounts migration in src/migrations, which this probe will report until the other team lands theirs) and "paid at Stripe but pending here" reconciliation (retrieves the PaymentIntent of the newest pending card orders).
6. Fast: every check is individually time-boxed (3-3.5 s), all run in parallel, a crashed check becomes "unknown" rather than an error page, secrets are redacted from every error string.

KEY NEW FILES
src/lib/developer.ts, src/backend/health/{types,rules,redact,timeout,grant,heartbeat,checks,report}.ts, src/backend/actions/health.ts, src/admin/i18n/health.en.ts, health.ar.ts, health.ts, src/app/(admin)/admin/(panel)/health/page.tsx, src/app/(admin)/admin/(panel)/[...missing]/page.tsx, src/app/(payload)/api/health/route.ts, docs/HEALTH.md.
KEY EDITS
src/lib/env.ts, .env.example, next.config.ts (BUILD_TIME), src/app/(admin)/admin/(panel)/layout.tsx, src/admin/shell/AdminNav.tsx, src/app/(payload)/api/webhooks/stripe/route.ts (3 heartbeat calls), src/collections/Users.ts, src/backend/actions/team.ts, src/admin/i18n/en.ts + ar.ts (one key: team.errors.protected).

NOT VERIFIED (I could not run the app; the implementer must confirm): exact props of @admin/ui/ActionButton; the status filter parameter of /admin/emails; column names of payload_migrations and email_log (check migrations 20260906_222240 and 20260925_142230); that notFound() from the catch-all and from the health page give the same status code under (panel)/loading.tsx streaming; Stripe SDK v23 signatures for webhookEndpoints.list / events.list.

## dataModel

NO MIGRATION. No collection, column or enum is added.

1. ENVIRONMENT (src/lib/env.ts, add to the zod schema; both optional, neither may ever stop the app booting -- see the comment in env.ts about Sentry taking production down)
   DEVELOPER_EMAILS: z.string().optional()
     Comma-separated. Parsed leniently by parseDeveloperEmails; malformed entries are dropped, not fatal.
   HEALTH_CHECK_TOKEN: z.string().min(32).optional().catch(undefined)
     A too-short value disables the monitor endpoint instead of throwing; the page reports it (compare process.env.HEALTH_CHECK_TOKEN presence with env.HEALTH_CHECK_TOKEN).
   .env.example: add both under a "Developer health page" heading with: generate the token with node -e "console.log(crypto.randomBytes(32).toString('hex'))"; never NEXT_PUBLIC_.
   next.config.ts: add to nextConfig  env: { BUILD_TIME: new Date().toISOString() }  (inlined at build; read only on the server as process.env.BUILD_TIME).

2. src/lib/developer.ts (pure, no imports, safe for the Payload CLI)
   export function parseDeveloperEmails(raw: string | undefined): readonly string[]
     split on comma, trim, lowercase, keep entries matching /^[^\s@]+@[^\s@]+\.[^\s@]+$/, de-duplicate.
   export function isDeveloperEmail(email: string | null | undefined, list: readonly string[]): boolean
     false for empty list, empty email; compares trimmed lowercase.

3. src/backend/health/types.ts
   export type HealthStatus = "ok" | "warning" | "failing" | "unknown";
   export type HealthGroup = "database" | "payments" | "email" | "storage" | "security" | "monitoring" | "environment" | "orders";
   export type HealthCheckId = "db" | "migrations" | "schema" | "stripeKeys" | "stripeWebhookSecret" | "stripeEndpoint" | "stripeLastWebhook" | "stripeUnreconciled" | "emailConfig" | "emailDelivery" | "storage" | "rateLimit" | "sentry" | "environment" | "orderFlags" | "paidNoInvoice" | "invoiceSeries" | "stalePending" | "payLinks" | "activity";
   export type HealthCode = keyof typeof healthEn.outcomes;   // import type from @admin/i18n/health.en -- a rule cannot return a code with no wording
   export type HealthFact = { key: keyof typeof healthEn.facts; value: string };   // technical value, rendered LTR mono
   export type HealthItem = { title: string; detail?: string; href?: string; at?: string };
   export type HealthOutcome = { status: HealthStatus; code: HealthCode; vars?: Record<string, string | number>; facts?: HealthFact[]; items?: HealthItem[] };
   export type HealthCheck = HealthOutcome & { id: HealthCheckId; group: HealthGroup; ms: number };
   export type HealthEnvironment = { vercelEnv: string; region: string | null; commit: string | null; branch: string | null; deploymentId: string | null; builtAt: string | null; node: string; siteOrigin: string };
   export type HealthReport = { status: HealthStatus; generatedAt: string; durationMs: number; deep: boolean; environment: HealthEnvironment; checks: HealthCheck[] };
   export type PublicHealthReport = { status: HealthStatus; generatedAt: string; durationMs: number; deep: boolean; environment: Pick<HealthEnvironment, "vercelEnv" | "region" | "commit">; checks: { id: HealthCheckId; group: HealthGroup; status: HealthStatus; code: HealthCode; ms: number; message: string }[] };

4. HEARTBEAT STORAGE (Upstash Redis, existing client src/lib/redis.ts, keys through keyPrefix so preview and production never share)
   keyPrefix("health:stripe:last")        JSON WebhookBeat, EX 90 days   -- last event that passed signature verification
   keyPrefix("health:stripe:last-error")  JSON WebhookBeat, EX 90 days   -- last event whose handler threw (we answered 500)
   keyPrefix("health:stripe:badsig")      JSON { count: number; lastAt: string }, EX 7 days -- signature header present but invalid
   export type WebhookBeat = { at: string; eventId: string; type: string; outcome: "handled" | "error"; detail?: string; livemode: boolean };
   detail is the outcome word already logged by the route (e.g. "marked-paid", "already-paid"); max 120 chars; never a customer name, amount or token.
   When redis is null nothing is stored and the check says so (code webhookNotRecorded) and relies on Stripe's API and the database.

5. EXISTING DATA READ (read-only, reusing the other team's order fields exactly as they are in src/collections/Orders.ts)
   orders: paymentStatus, fulfilmentStatus, source ("web-checkout-card", QUOTE_SOURCE "admin-quote"), stripePaymentIntentId, paidAt, invoiceNumber, payLinkExpiresAt, internalNotes, orderNumber, createdAt.
   invoice_counters(year, last_value) from migration 20261004_193027_quote_pay_link.
   email-log: status (sent|failed|skipped|suppressed), type, to, error, environment, createdAt.
   activity-log: createdAt only (it has no error rows; see edge cases).
   payload_migrations: name, batch.
   media: latest url.

6. CONSTANTS (src/backend/health/rules.ts)
   DB_SLOW_MS = 400; DB_TIMEOUT_MS = 3000; CHECK_TIMEOUT_MS = 3500; STALE_PENDING_HOURS = 24; PAY_LINK_SOON_HOURS = 48; RECONCILE_MIN_AGE_MINUTES = 10; RECONCILE_LIMIT = 5; WEBHOOK_PENDING_MINUTES = 5; FLAG_MARK = "⚠" (the marker paid.ts and the webhook route already write); RESOLVED_MARK = "✓"; REQUIRED_EVENTS = ["payment_intent.succeeded"]; RECOMMENDED_EVENTS = ["payment_intent.payment_failed", "payment_intent.canceled", "charge.refunded", "charge.dispute.created"].

## serverLogic

A. THE GUARD -- src/backend/health/grant.ts (import "server-only")
   declare const granted: unique symbol;
   export type HealthGrant = { readonly [granted]: true; readonly via: "developer" | "monitor"; readonly email?: string };
   export const developerEmails = (): readonly string[] => parseDeveloperEmails(env.DEVELOPER_EMAILS);
   export const isDeveloper = (session: AdminSession | null): boolean => Boolean(session && isDeveloperEmail(session.user.email, developerEmails()));
   export const grantForSession = cache(async (): Promise<HealthGrant | null>)   // React cache; getAdminSession() then isDeveloper; role must be admin or staff because getAdminSession already refuses customers
   export function grantForToken(authorization: string | null): HealthGrant | null
     null when env.HEALTH_CHECK_TOKEN is undefined or the header is not "Bearer <x>"; compare sha256(x) with sha256(token) using crypto.timingSafeEqual. No database access.
   export async function requireDeveloper(): Promise<HealthGrant>   // grantForSession() ?? notFound()
   The symbol is not exported, so a HealthGrant cannot be forged outside this file. Every function in checks.ts and report.ts takes a HealthGrant as its first parameter; every server action calls grantForSession() itself. This is "every data fetch re-checks the guard", enforced by the compiler.

B. src/backend/health/timeout.ts
   export async function withTimeout<T>(work: Promise<T>, ms: number, onTimeout: () => T): Promise<T>   // Promise.race, clears its timer, swallows the late rejection
   export async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }>

C. src/backend/health/redact.ts (pure)
   export function redact(text: string): string   // replaces sk_(live|test)_\w+, pk_(live|test)_\w+, whsec_\w+, re_\w+, Bearer \S+, and the user:password part of any postgres:// URL with "[hidden]"; truncates to 240 chars
   export function keyHint(value: string | undefined): string | null   // "sk_test_…AbCd": text up to and including the second underscore, an ellipsis, the last 4 characters; null when unset; for values shorter than 12 chars return prefix only
   export function stripeMode(key: string | undefined): "test" | "live" | "unknown" | null
   export function maskEmail(address: string): string   // "n•••@gmail.com"
   export function safeError(error: unknown): string     // redact(message)
   RULE: nothing else in the feature may put an env value into a HealthOutcome. Only keyHint, stripeMode, hostnames, and booleans.

D. src/backend/health/rules.ts (pure, no I/O, fully unit-tested). Signatures:
   worstStatus(statuses: readonly HealthStatus[]): HealthStatus   // failing > warning > unknown > ok
   dbOutcome(result: { ok: true; ms: number } | { ok: false; error: string }, region: string | null): HealthOutcome
   migrationsOutcome(inRepo: readonly string[], applied: readonly { name: string; batch: number }[]): HealthOutcome
     pending = inRepo names not applied -> failing migrationsPending {count, names}; applied names not in repo (excluding name "dev") -> warning migrationsAhead; any batch -1 -> warning migrationsDevPush; else ok migrationsOk {count, name: last}
   schemaOutcome(results: readonly { slug: string; error?: string }[]): HealthOutcome
   stripeKeysOutcome(input: { secret?: string; publishable?: string; vercelEnv: string; apiError?: string | null }): HealthOutcome
     neither key -> warning stripeOff; modes differ -> failing stripeModeMismatch; live outside production -> failing stripeLiveOutsideProd; test in production -> warning stripeTestInProd; apiError -> failing stripeKeyRejected; else ok stripeKeysOk
   webhookSecretOutcome(input: { stripeConfigured: boolean; secret?: string }): HealthOutcome
   endpointOutcome(endpoints: readonly { url: string; status: string; enabled_events: readonly string[] }[] | null, siteOrigin: string, vercelEnv: string): HealthOutcome
     match = url host equals siteOrigin host AND path ends "/api/webhooks/stripe"; "*" in enabled_events satisfies everything; no match is failing in production, warning elsewhere
   lastWebhookOutcome(input: { beats: { last: WebhookBeat | null; lastError: WebhookBeat | null; badSig: { count: number; lastAt: string } | null } | null; pendingAtStripe: { count: number; oldest: string } | null; livemode: boolean; latestPaidAt: string | null; now: Date }): HealthOutcome
     precedence: badSig newer than last good beat (or no good beat) -> failing webhookBadSignature; lastError newer than last -> failing webhookHandlerError; pendingAtStripe older than WEBHOOK_PENDING_MINUTES -> failing in live mode, warning in test mode (preview and production share one test account) webhookPendingAtStripe; beats null -> ok webhookNotRecorded {paidAgo}; last null -> unknown webhookNone; else ok webhookOk
   reconcileOutcome(rows: readonly { orderNumber: string; intentStatus: string | null; error?: string }[]): HealthOutcome   // any intentStatus "succeeded" -> failing
   emailConfigOutcome(input: { hasKey: boolean; keyHint: string | null; from?: string; vercelEnv: string; allowlistCount: number; domain?: { state: string } | "restricted" | "rejected" | null }): HealthOutcome
   emailDeliveryOutcome(counts: { sent24: number; failed24: number; skipped24: number; suppressed24: number; sent7: number; failed7: number; skipped7: number; suppressed7: number }, vercelEnv: string, latest: readonly HealthItem[]): HealthOutcome
     failed24 > 0 -> failing; failed7 > 0, or skipped7 > 0 in production -> warning; suppressed is always normal outside production
   storageOutcome(input: { provider: "vercel-blob" | "local-disk"; auth: string | null; vercelEnv: string; probe: { status: number } | "none" | "skipped" | null }): HealthOutcome
   rateLimitOutcome(input: { hasUrl: boolean; hasToken: boolean; keyEnv: string; ping: { ms: number } | { error: string } | null }): HealthOutcome   // one of two set -> failing rateLimitHalf; none and keyEnv "local" -> ok rateLimitLocal; none otherwise -> warning rateLimitMemory
   sentryOutcome(input: { serverDsn?: string; browserDsn?: string }): HealthOutcome   // exposes only DSN host and project id (the DSN is public by design; the key part is still not printed)
   environmentOutcome(input: { vercelEnv: string; serverUrl: string; tokenRaw: boolean; tokenValid: boolean; developerCount: number }): HealthOutcome
   openFlags(notes: string | null | undefined): string[]
     lines starting with FLAG_MARK that have no later line starting with RESOLVED_MARK; each truncated to 160 chars
   orderFlagsOutcome(orders: readonly { orderNumber: string; internalNotes?: string | null; updatedAt: string }[]): HealthOutcome
   paidNoInvoiceOutcome(total: number, sample: readonly HealthItem[]): HealthOutcome
   invoiceSeriesOutcome(year: number, counterLast: number | null, ordersWithNumber: number): HealthOutcome   // equal -> ok; counter null and 0 orders -> ok invoiceSeriesEmpty; otherwise failing
   stalePendingOutcome(total: number, sample: readonly HealthItem[], hours: number): HealthOutcome
   payLinksOutcome(input: { awaiting: number; expiringSoon: readonly HealthItem[]; expired: number; hours: number }): HealthOutcome
   activityOutcome(input: { count24: number; latestAt: string | null }): HealthOutcome
   toPublicReport(report: HealthReport, render: (c: HealthCheck) => string): PublicHealthReport   // drops facts and items
   httpStatusFor(status: HealthStatus): 200 | 503   // 503 only for failing

E. src/backend/health/heartbeat.ts (must NOT import "server-only" is fine here -- it is only imported by the webhook route and checks.ts; keep it free of Payload imports)
   export async function recordWebhookBeat(beat: WebhookBeat): Promise<void>
   export async function recordWebhookSignatureFailure(now?: Date): Promise<void>
   export async function readWebhookBeats(): Promise<{ last: WebhookBeat | null; lastError: WebhookBeat | null; badSig: { count: number; lastAt: string } | null } | null>
   Rules: return immediately when redis is null; wrap in try/catch that only console.warns; race against a 400 ms timeout so a slow Redis can never delay Stripe's acknowledgement; recordWebhookBeat writes "last" always and "last-error" additionally when outcome is "error".
   EDIT src/app/(payload)/api/webhooks/stripe/route.ts (three insertions, no behaviour change):
     in the constructEvent catch, before returning 400:  await recordWebhookSignatureFailure();   (only reached when a stripe-signature header was present; header-less noise is not counted)
     before  return new Response("ok", { status: 200 })  :  await recordWebhookBeat({ at: new Date().toISOString(), eventId: event.id, type: event.type, outcome: "handled", detail: <the outcome string already computed in that branch, or "acknowledged">, livemode: event.livemode });
     in the handler catch, before returning 500: same with outcome "error" and detail safeError(error).
   This file is being edited by the payments team; rebase onto their version and add only these lines.

F. src/backend/health/checks.ts (import "server-only"). One async function per check, each (grant: HealthGrant, ctx: Ctx) => Promise<HealthOutcome>, where Ctx = { payload: Payload | null; now: Date; deep: boolean; vercelEnv: string; siteOrigin: string }.
   Raw SQL goes through (payload.db as unknown as { drizzle: { execute(q: unknown): Promise<unknown> } }).drizzle with sql from @payloadcms/db-postgres and bound parameters, exactly as src/backend/payments/invoice-number.ts does; reuse its firstRow shape helper (export it or copy into a rows() helper). All statements are SELECTs.
   db: SELECT 1, timed.
   migrations: SELECT name, batch FROM payload_migrations; inRepo = migrations.map(m => m.name) imported from @/migrations (src/migrations/index.ts).
   schema: for every collection slug in payload.config.collections run payload.find({ collection, limit: 1, depth: 0, pagination: false, overrideAccess: true }) inside withTimeout, plus SELECT 1 FROM invoice_counters LIMIT 1; collect { slug, error: safeError(e) }.
   stripeKeys: deep -> getStripe()?.balance.retrieve({}, { timeout: 3000, maxNetworkRetries: 0 }) to prove the key works; shallow -> prefixes only.
   stripeEndpoint (deep only; shallow returns unknown skippedShallow): stripe.webhookEndpoints.list({ limit: 20 }, same options). A permission error -> unknown stripeAskFailed.
   stripeLastWebhook: readWebhookBeats(); deep also stripe.events.list({ limit: 10, type: "payment_intent.succeeded" }) -> those with pending_webhooks > 0; latestPaidAt from payload.find orders sort -paidAt limit 1.
   stripeUnreconciled (deep only): payload.find orders where paymentStatus equals PENDING, stripePaymentIntentId exists, createdAt between now-7d and now-10min, sort -createdAt, limit RECONCILE_LIMIT; stripe.paymentIntents.retrieve for each in parallel. READ ONLY: this check never changes an order. Only the signed webhook marks a card order PAID; the fix text tells the developer to resend the event from Stripe.
   emailConfig: env presence; deep -> fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(3000) }); 200 -> find the domain of bareAddress(env.EMAIL_FROM) (src/backend/email/allowlist.ts) and take its status; 401/403 with name "restricted_api_key" -> "restricted" (a sending-only key is fine); other 401/403 -> "rejected".
   emailDelivery: one SQL: SELECT status, count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS d1, count(*) AS d7 FROM email_log WHERE created_at > now() - interval '7 days' AND environment = $1 GROUP BY status, with $1 = emailEnvironment() from src/backend/email/send.ts; plus payload.find email-log where status equals failed, sort -createdAt, limit 5 -> HealthItem { title: type, detail: `${maskEmail(to)} -- ${redact(error)}`, at: createdAt, href: "/admin/emails" }.
   storage: storageDiagnostics from src/backend/payload/storage.ts; deep and production only -> newest media doc, HEAD `${siteOrigin}${url}` with AbortSignal.timeout(3000) (previews are skipped: deployment protection answers 401).
   rateLimit: redis?.ping() timed, 1500 ms box; KEY_ENV from src/lib/redis.ts.
   sentry, environment: env only.
   orderFlags: payload.find orders where internalNotes contains FLAG_MARK, sort -updatedAt, limit 50, select orderNumber/internalNotes/updatedAt; filter with openFlags.
   paidNoInvoice: where paymentStatus equals PAID AND invoiceNumber exists false; limit 10; totalDocs.
   invoiceSeries: year = invoiceYear(now) from src/backend/domain/invoice.ts; SELECT last_value FROM invoice_counters WHERE year = $1; SELECT count(*) FROM orders WHERE invoice_number LIKE $2 with `CAL-INV-${year}-%`.
   stalePending: where source equals "web-checkout-card", paymentStatus PENDING, fulfilmentStatus not_equals CANCELLED, createdAt less_than now - 24h; limit 10.
   payLinks: where source equals QUOTE_SOURCE, paymentStatus PENDING, fulfilmentStatus not_equals CANCELLED; split with payRequestState from src/backend/payments/pay-link.ts into awaiting / expired; expiringSoon = awaiting with payLinkExpiresAt within 48h. Item href: /admin/orders/<orderNumber>. Never the pay URL or token.
   activity: payload.count activity-log createdAt > now-24h; latest createdAt.
   All order reads use overrideAccess: true; that is acceptable only because the grant was required first (same pattern as src/backend/data/admin-pulse.ts).

G. src/backend/health/report.ts (import "server-only")
   export async function getHealthReport(grant: HealthGrant, options: { deep: boolean }): Promise<HealthReport>
     1. payload = await withTimeout(getPayload({ config }), DB_TIMEOUT_MS, () => null) inside try/catch.
     2. Build the list of 20 checks with their group. A check that needs the database when payload is null returns { status: "unknown", code: "skippedNoDatabase" } without running.
     3. Promise.all(checks.map(run)) where run = timed + withTimeout(CHECK_TIMEOUT_MS -> { status: "unknown", code: "checkTimedOut" }) + catch -> { status: "unknown", code: "checkCrashed", vars: { error: safeError(e) } }.
     4. status = worstStatus; environment from process.env.VERCEL_ENV ?? "local", VERCEL_REGION, VERCEL_GIT_COMMIT_SHA (first 7), VERCEL_GIT_COMMIT_REF, VERCEL_DEPLOYMENT_ID, process.env.BUILD_TIME, process.version, SITE_ORIGIN.
   Worst case wall time about 3.5 s; typical under 1 s. Shallow mode makes no outbound HTTP call except the Redis ping.
   Monitor cache: a module-level { at, report } per deep flag reused for 20 s for via "monitor" only, so a 1-minute monitor on several regions cannot stampede the database. The page never uses the cache.

H. src/backend/actions/health.ts ("use server")
   export async function sendSentryTestEvent(): Promise<{ ok: boolean; message: string }>
     grantForSession() null -> return { ok: false, message: "Not found." } (same words as any missing thing). No DSN -> ok false with the translated sentryOff sentence. Else Sentry.captureMessage(`Health test from ${grant.email} at ${iso}`, "warning"), await Sentry.flush(2000), return the translated success with the event id. Message is translated on the server with the health dictionary; no code is returned, so nothing is needed in en.ts.

I. src/app/(payload)/api/health/route.ts
   export const runtime = "nodejs"; export const dynamic = "force-dynamic";
   const passThrough = { params: Promise.resolve({ slug: ["health"] }) };
   export async function GET(request: Request): Promise<Response>
     grant = grantForToken(request.headers.get("authorization")) ?? (request.headers.get("cookie")?.includes("payload-token") ? await grantForSession().catch(() => null) : null)
     if (!grant) return REST_GET(config)(request, passThrough)   // Payload's own 'Route not found "/api/health"' -- identical to any unknown API route by construction
     deep = url.searchParams.get("deep") === "1"
     report = await getHealthReport(grant, { deep })
     body = grant.via === "developer" ? report : toPublicReport(report, renderEnglish)
     return Response.json(body, { status: httpStatusFor(report.status), headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } })
   export const POST = (r: Request) => REST_POST(config)(r, passThrough); likewise PUT, PATCH, DELETE, OPTIONS -- otherwise Next would answer 405 for this one path and reveal it.
   Token auth happens before any database call, so the endpoint answers (503, db failing) when Postgres is down. That is the one case the page itself cannot cover, because signing in needs the database.

J. HARDENING OF THE DEVELOPER ACCOUNT
   src/collections/Users.ts: add beforeChange and beforeDelete hooks: if originalDoc/doc email is a developer email AND req.user exists AND req.user.email (lowercased) differs -> throw new Forbidden(). Server-internal calls with no req.user (password reset by emailed link, login bookkeeping) are untouched. Also in beforeChange: refuse setting any OTHER user's email to a developer email.
   src/backend/actions/team.ts: in update-role, reset-password, unlock, deactivate/delete: if the target is a developer account and the actor is not that developer -> return { ok: false, message: "This account is looked after by the developer and can't be changed here.", code: "team.errors.protected" }. The account stays visible in the Team list; the owner should be able to see who has access.

K. NAV (no dictionary or NAV_GROUPS change)
   (panel)/layout.tsx: const developer = isDeveloper(session); const extra = developer ? { heading: h.nav.heading, items: [{ href: "/admin/health", label: h.nav.item, icon: "monitor" as const }] } : undefined; pass extra to AdminSidebar and AdminMobileBar only when defined (an undefined prop is not serialised into the RSC payload).
   src/admin/shell/AdminNav.tsx: ShellProps gains  extra?: { heading: string; items: readonly { href: string; label: string; icon: IconName }[] }  and NavLinks renders it after the last group with the same markup, using the strings as given (no t()).

## adminUx

ROUTE: /admin/health -- src/app/(admin)/admin/(panel)/health/page.tsx. Server Component, export const dynamic = "force-dynamic". No client component of its own (reuses @admin/ui/ActionButton for the one button), so no new browser chunk exists.

WHO SEES WHAT
- Developer (email in DEVELOPER_EMAILS, role admin or staff): a "Developer" heading with one item "Health" at the bottom of the sidebar and of the phone drawer (monitor icon). Click path: Admin -> menu -> Health.
- Owner, staff: no nav item; /admin/health renders (panel)/not-found.tsx ("This page doesn't exist"), exactly as /admin/zzz now does through the new catch-all.
- Signed out: redirect to /admin/login, exactly as /admin/zzz now does.
- generateMetadata: const grant = await grantForSession(); return grant ? { title: h.page.title } : {};  The page body starts with await requireDeveloper().

NEW CATCH-ALL: src/app/(admin)/admin/(panel)/[...missing]/page.tsx
  import { notFound } from "next/navigation"; export default function AdminMissing(): never { notFound(); }
  Static routes (/admin/login, /admin/pulse, every real screen) still win. Side benefit: a mistyped admin URL now keeps the admin navigation instead of dropping the owner on the storefront 404, which is what not-found.tsx's own comment says it is for.

PAGE LAYOUT (designed at 390px first; one column; admin semantic tokens only -- surface, sunken, ink, ink-2, ink-3, line, success, warning, danger; 4px corners via Card; logical CSS only so src/admin/rtl-guard.test.ts passes; no chart, no animation beyond the browser's own details toggle)
1. PageHeader: title "Health"; description "Checked {time} in {ms} ms"; action: ButtonLink href="/admin/health" icon clock, label "Check again" (a plain reload; min height 44px).
2. Verdict card (Card as="section"): one word in 28px Cormorant -- "All good" / "Needs a look" / "Something is broken" -- with a Badge (success / warning / danger, text plus dot, never colour alone), and one line "{failing} failing · {warnings} warnings · {ok} OK". Below it a two-column definition list on >=640px, one column on a phone: Environment, Commit, Branch, Region, Built, Node, Site address. Values in <bdi dir="ltr" class="font-mono text-sm">.
3. "Fix first" section, only when something is failing or warning: every failing check, then every warning check, fully expanded. Silence means healthy -- the same rule as the dashboard's Needs attention panel.
4. One Card per group, in this order: Database, Payments, Orders, Email, Photos and files, Protection, Error tracking, Environment. CardHeader title = group name, action = a Badge with the group's worst status.
   Each check is a row separated by a hairline (border-line):
   - line 1: check title (15px semibold) and status Badge at the inline end;
   - line 2: the "what" sentence (text-sm text-ink-2, body at least 16px on phone for the sentence: use text-base sm:text-sm);
   - when not ok: a block on bg-sunken, rounded-md, p-3: label "How to fix" (Cinzel eyebrow, uppercase, 0.18em; plain Plex under :lang(ar)) and the fix sentence; commands inside <code dir="ltr"> that wraps (break-words), never a horizontal scroll;
   - items (orders, emails): a list; each item is a Link with min-h-11, title in medium weight, detail in ink-3, time via i18n date "datetime"; order numbers in <bdi>;
   - facts: inside a native <details> with summary "Details" (min-h-11), a definition list of label/value in mono LTR;
   - ms shown as a quiet suffix "{ms} ms" in ink-3.
   OK rows show lines 1-2 only, so a healthy page is short enough to read in one scroll on a phone.
5. "Monitor" card: whether the endpoint is on; the address <bdi dir="ltr">{origin}/api/health</bdi>; a copyable example in <code>: curl -H "Authorization: Bearer $HEALTH_CHECK_TOKEN" {origin}/api/health  (the literal variable name, never the value); "200 = fine, 503 = something is failing"; "Add ?deep=1 to also ask Stripe and Resend (slower; use at most every 15 minutes)".
6. "Tools" card: ActionButton "Send a test error to Sentry" -> sendSentryTestEvent; toast shows the returned sentence. Disabled with an explanation when Sentry is off.

STATES
- Loading: the panel's existing loading.tsx skeleton while checks run.
- A check that crashed or timed out is a neutral "Couldn't check" row with the (redacted) error; the page never fails as a whole because of one dependency.
- Database down: sign-in itself needs the database, so the page cannot render (panel error.tsx appears). The Monitor endpoint with the token is the tool for that case; docs/HEALTH.md says so in its first paragraph.

STATUS TO TONE: ok -> success "OK"; warning -> warning "Warning"; failing -> danger "Failing"; unknown -> neutral "Couldn't check".

THE 20 ROWS (group / title / what it proves)
Database: Database (reachable, latency) · Migrations (repo list vs payload_migrations) · Tables match the code (schema probe).
Payments: Stripe keys (configured, test or live, key hints) · Webhook secret (present) · Webhook endpoint at Stripe (exists for this site, enabled, subscribed) · Last webhook (heartbeat, bad signatures, undelivered events) · Paid at Stripe, pending here (reconciliation).
Orders: Payment warnings on orders (open lines starting with the warning mark in internal notes: PAYMENT CHECK, PAID AFTER CANCELLATION, STRIPE refund/dispute) · Paid without an invoice number · Invoice numbering (gap-free counter) · Card orders waiting for payment (over 24 h) · Payment links (expiring within 48 h, expired).
Email: Email setup (key, from address, domain verified, allow-list outside production) · Email delivery (failed/skipped 24 h and 7 d, latest five errors).
Photos and files: Media storage (Blob configured, auth method, newest photo answers).
Protection: Rate limiting (Upstash answering, or memory fallback).
Error tracking: Sentry (server and browser DSN) · Admin activity (count in 24 h, latest; note that errors are in Sentry).
Environment: Environment (site URL sanity, monitor token validity, developer count).

## i18n

WHERE: NOT in src/admin/i18n/en.ts / ar.ts (that dictionary is sent to every browser, including the anonymous login page). New server-only files:
  src/admin/i18n/health.en.ts   export const healthEn = { ... } as const
  src/admin/i18n/health.ar.ts   export const healthAr: HealthMessages = { ... }   (type HealthMessages = Widen<typeof healthEn>, reuse the Widen idea from translate.ts so a missing key is a compile error)
  src/admin/i18n/health.ts      import "server-only"; export async function getHealthI18n(): Promise<{ h: HealthMessages; say: (text: string, vars?: Vars) => string; base: Translator }>  -- picks by getAdminPreferences().locale, uses interpolate from translate.ts; base = getAdminI18n() for dates and numbers.
Convention kept from ar.ts: Western digits, env names and commands stay in Latin inside <bdi>/<code>, {placeholders} identical in both languages. Arabic uses the plural address (per the project's Arabic scope note).
ONE key added to the main dictionary (reveals nothing about the page):
  team.errors.protected  EN "This account is looked after by the developer and can’t be changed here."  AR "هذا الحساب يديره المطوّر ولا يمكن تعديله من هنا."

nav.heading: "Developer" | "المطوّر"
nav.item: "Health" | "حالة النظام"
page.title: "Health" | "حالة النظام"
page.checked: "Checked {time} in {ms} ms" | "آخر فحص {time} خلال {ms} ملّي ثانية"
page.again: "Check again" | "إعادة الفحص"
page.allGood: "All good" | "كل شيء سليم"
page.needsLook: "Needs a look" | "يحتاج إلى مراجعة"
page.broken: "Something is broken" | "يوجد عطل"
page.counts: "{failing} failing · {warnings} warnings · {ok} OK" | "{failing} أعطال · {warnings} تحذيرات · {ok} سليم"
page.fixFirst: "Fix first" | "أصلِحوا هذا أولاً"
page.howToFix: "How to fix" | "طريقة الإصلاح"
page.details: "Details" | "التفاصيل"
page.monitorTitle: "Monitor" | "المراقبة الآلية"
page.monitorOn: "The monitor address is on. 200 means fine, 503 means something is failing." | "عنوان المراقبة يعمل. 200 تعني سليم و503 تعني وجود عطل."
page.monitorOff: "The monitor address is off. Set HEALTH_CHECK_TOKEN (32 characters or more) to turn it on." | "عنوان المراقبة متوقف. اضبطوا HEALTH_CHECK_TOKEN (32 حرفاً أو أكثر) لتشغيله."
page.monitorDeep: "Add ?deep=1 to also ask Stripe and Resend. Slower: use it every 15 minutes at most." | "أضيفوا ?deep=1 لسؤال Stripe و Resend أيضاً. أبطأ: مرة كل 15 دقيقة على الأكثر."
page.toolsTitle: "Tools" | "أدوات"
page.sentryTest: "Send a test error to Sentry" | "إرسال خطأ تجريبي إلى Sentry"
page.sentrySent: "Sent. Look for event {id} in Sentry." | "تم الإرسال. ابحثوا عن الحدث {id} في Sentry."
status.ok: "OK" | "سليم" ; status.warning: "Warning" | "تحذير" ; status.failing: "Failing" | "عطل" ; status.unknown: "Couldn’t check" | "تعذّر الفحص"
groups.database "Database"|"قاعدة البيانات" ; payments "Payments"|"المدفوعات" ; orders "Orders"|"الطلبات" ; email "Email"|"البريد" ; storage "Photos and files"|"الصور والملفات" ; security "Protection"|"الحماية" ; monitoring "Error tracking"|"تتبّع الأخطاء" ; environment "Environment"|"البيئة"
checks.db "Database"|"قاعدة البيانات" ; migrations "Migrations"|"ترحيلات قاعدة البيانات" ; schema "Tables match the code"|"الجداول مطابقة للكود" ; stripeKeys "Stripe keys"|"مفاتيح Stripe" ; stripeWebhookSecret "Webhook secret"|"سرّ الـ Webhook" ; stripeEndpoint "Webhook endpoint at Stripe"|"عنوان الـ Webhook لدى Stripe" ; stripeLastWebhook "Last webhook"|"آخر Webhook" ; stripeUnreconciled "Paid at Stripe, pending here"|"مدفوع لدى Stripe ومعلّق هنا" ; emailConfig "Email setup"|"إعداد البريد" ; emailDelivery "Email delivery"|"إرسال البريد" ; storage "Media storage"|"تخزين الصور" ; rateLimit "Rate limiting"|"تحديد المعدّل" ; sentry "Sentry"|"Sentry" ; environment "Environment"|"البيئة" ; orderFlags "Payment warnings on orders"|"تحذيرات الدفع على الطلبات" ; paidNoInvoice "Paid without an invoice number"|"مدفوع بلا رقم فاتورة" ; invoiceSeries "Invoice numbering"|"تسلسل الفواتير" ; stalePending "Card orders waiting for payment"|"طلبات بطاقة بانتظار الدفع" ; payLinks "Payment links"|"روابط الدفع" ; activity "Admin activity"|"نشاط الإدارة"
facts.mode "Mode"|"الوضع" ; secretKey "Secret key"|"المفتاح السرّي" ; publishableKey "Publishable key"|"المفتاح العام" ; webhookSecret "Webhook secret"|"سرّ الـ Webhook" ; endpointUrl "Endpoint"|"العنوان" ; from "From address"|"عنوان المُرسِل" ; replyTo "Reply-to"|"الرد إلى" ; allowlist "Allow-list entries"|"عناوين القائمة المسموحة" ; auth "Authentication"|"طريقة التوثيق" ; prefix "Key prefix"|"بادئة المفاتيح" ; project "Project"|"المشروع" ; latency "Latency"|"زمن الاستجابة" ; applied "Applied"|"المطبَّق" ; inBuild "In this build"|"في هذا الإصدار" ; env "Environment"|"البيئة" ; commit "Commit"|"الإيداع" ; branch "Branch"|"الفرع" ; region "Region"|"المنطقة" ; built "Built"|"وقت البناء" ; node "Node"|"Node" ; siteUrl "Site address"|"عنوان الموقع" ; developers "Developers allowed"|"المطوّرون المسموح لهم" ; expired "Expired links"|"روابط منتهية"

outcomes (code: what EN | what AR // fix EN | fix AR; ok codes have no fix)
dbOk: "Connected. Answered in {ms} ms." | "متصلة. استجابت خلال {ms} ملّي ثانية."
dbSlow: "Connected, but slow: {ms} ms." | "متصلة لكنها بطيئة: {ms} ملّي ثانية." // "Usually a Neon cold start: check again once. If it stays slow, look at the Neon dashboard and confirm the database region is close to Vercel’s ({region})." | "غالباً بداية باردة في Neon: أعيدوا الفحص مرة. إن استمر البطء فراجعوا لوحة Neon وتأكدوا أن منطقة القاعدة قريبة من منطقة Vercel ({region})."
dbDown: "The database did not answer: {error}" | "قاعدة البيانات لم تستجب: {error}" // "Check DATABASE_URL in Vercel, then the Neon dashboard: project suspended, connection limit reached, or branch deleted." | "تحقّقوا من DATABASE_URL في Vercel ثم من لوحة Neon: مشروع موقوف أو حدّ الاتصالات أو فرع محذوف."
migrationsOk: "All {count} migrations are applied. Latest: {name}." | "كل الترحيلات ({count}) مطبَّقة. آخرها: {name}."
migrationsPending: "{count} migration(s) in this build are not applied to this database: {names}." | "{count} من ترحيلات هذا الإصدار غير مطبَّقة على هذه القاعدة: {names}." // "Run pnpm migrate against this database, then check again. The Vercel build command should be: pnpm migrate && next build." | "شغّلوا pnpm migrate على هذه القاعدة ثم أعيدوا الفحص. أمر البناء في Vercel يجب أن يكون: pnpm migrate && next build."
migrationsAhead: "The database has {count} migration(s) this build does not know: {names}." | "في القاعدة {count} ترحيلات لا يعرفها هذا الإصدار: {names}." // "This deployment is older than the database. Deploy the latest commit; do not roll the database back." | "هذا الإصدار أقدم من القاعدة. انشروا آخر إيداع ولا تُرجعوا القاعدة."
migrationsDevPush: "The database was changed by dev push (a batch -1 row exists)." | "عُدّلت القاعدة عبر dev push (يوجد صف بدفعة -1)." // "Push is disabled in this project. Find how it ran, and recreate the change as a migration." | "الـ push معطّل في هذا المشروع. اعرفوا كيف جرى وأعيدوا التغيير كترحيل."
schemaOk: "Every table reads cleanly ({count} checked)." | "كل الجداول تُقرأ بلا أخطاء (فُحص {count})."
schemaBroken: "Reading failed for: {names}. {error}" | "فشلت القراءة من: {names}. {error}" // "The code expects a table or column the database does not have. Write the missing migration (pnpm migrate:create) or apply it (pnpm migrate)." | "الكود يتوقع جدولاً أو عموداً غير موجود. اكتبوا الترحيل الناقص (pnpm migrate:create) أو طبّقوه (pnpm migrate)."
stripeKeysOk: "{mode} mode. Keys accepted by Stripe." | "وضع {mode}. المفاتيح مقبولة لدى Stripe."
stripeOff: "Stripe is not configured. Card payment and payment links are off." | "Stripe غير مضبوط. الدفع بالبطاقة وروابط الدفع متوقفة." // "Set STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY and STRIPE_WEBHOOK_SECRET in Vercel, then redeploy." | "اضبطوا STRIPE_SECRET_KEY و NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY و STRIPE_WEBHOOK_SECRET في Vercel ثم أعيدوا النشر."
stripeModeMismatch: "The secret key is {secretMode} but the publishable key is {publishableMode}." | "المفتاح السرّي بوضع {secretMode} والمفتاح العام بوضع {publishableMode}." // "Both keys must come from the same Stripe mode. Fix them in Vercel and redeploy." | "يجب أن يكون المفتاحان من الوضع نفسه. صحّحوهما في Vercel وأعيدوا النشر."
stripeLiveOutsideProd: "A {env} deployment is using LIVE Stripe keys." | "نشر {env} يستخدم مفاتيح Stripe الحقيقية." // "Replace them with test keys for this environment now. Real cards can be charged from a test site." | "استبدلوها بمفاتيح الاختبار لهذه البيئة فوراً. قد تُخصم بطاقات حقيقية من موقع تجريبي."
stripeTestInProd: "Production is using TEST keys. No real money can be taken." | "الإنتاج يستخدم مفاتيح الاختبار. لا يمكن تحصيل أموال حقيقية." // "When the shop is ready to take cards, switch all three Stripe values to live and add a live webhook endpoint." | "عند الجاهزية لقبول البطاقات، حوّلوا قيم Stripe الثلاث إلى الوضع الحقيقي وأضيفوا Webhook حقيقياً."
stripeKeyRejected: "Stripe rejected the secret key: {error}" | "Stripe رفض المفتاح السرّي: {error}" // "The key was rolled or deleted. Create a new one in Stripe, set STRIPE_SECRET_KEY, redeploy." | "المفتاح مُلغى أو مُبدَّل. أنشئوا مفتاحاً جديداً في Stripe واضبطوا STRIPE_SECRET_KEY ثم أعيدوا النشر."
webhookSecretOk: "Present." | "موجود."
webhookSecretMissing: "STRIPE_WEBHOOK_SECRET is missing. Paid orders will never be marked paid." | "STRIPE_WEBHOOK_SECRET غير موجود. لن تُسجَّل الطلبات المدفوعة كمدفوعة." // "Copy the signing secret from Stripe, Developers, Webhooks, this endpoint, set it in Vercel, redeploy." | "انسخوا سرّ التوقيع من Stripe ← Developers ← Webhooks ← هذا العنوان، واضبطوه في Vercel ثم أعيدوا النشر."
webhookSecretNotNeeded: "Not needed while Stripe is off." | "غير مطلوب ما دام Stripe متوقفاً."
endpointOk: "Stripe sends to {url}. Enabled and subscribed." | "Stripe يرسل إلى {url}. مفعّل ومشترك في الأحداث."
endpointNone: "No webhook endpoint in Stripe points at this site ({origin})." | "لا يوجد عنوان Webhook في Stripe يشير إلى هذا الموقع ({origin})." // "In Stripe, Developers, Webhooks, add {origin}/api/webhooks/stripe with payment_intent.succeeded, payment_intent.payment_failed, payment_intent.canceled, charge.refunded, charge.dispute.created." | "في Stripe ← Developers ← Webhooks أضيفوا {origin}/api/webhooks/stripe مع الأحداث payment_intent.succeeded و payment_intent.payment_failed و payment_intent.canceled و charge.refunded و charge.dispute.created."
endpointDisabled: "The endpoint {url} is disabled in Stripe." | "العنوان {url} معطّل في Stripe." // "Stripe disables an endpoint after days of failures. Fix the cause shown under Last webhook, then enable it again in Stripe." | "Stripe يعطّل العنوان بعد أيام من الفشل. أصلحوا السبب الظاهر في «آخر Webhook» ثم فعّلوه مجدداً."
endpointMissingEvents: "The endpoint is not subscribed to: {events}." | "العنوان غير مشترك في: {events}." // "Add these events to the endpoint in Stripe." | "أضيفوا هذه الأحداث إلى العنوان في Stripe."
stripeAskFailed: "Could not ask Stripe: {error}" | "تعذّر سؤال Stripe: {error}" // "Check again. If it repeats, look at status.stripe.com." | "أعيدوا الفحص. إن تكرّر فراجعوا status.stripe.com."
webhookOk: "Last webhook {ago}: {type}, {detail}." | "آخر Webhook {ago}: {type}، {detail}."
webhookNone: "No webhook has been received yet." | "لم يصل أي Webhook بعد." // "Normal before the first card payment. Otherwise send a test event from Stripe and check again." | "طبيعي قبل أول دفعة بالبطاقة. وإلا أرسلوا حدثاً تجريبياً من Stripe وأعيدوا الفحص."
webhookNotRecorded: "Not recorded here because Upstash is off. Last payment confirmed {paidAgo}." | "لا يُسجَّل هنا لأن Upstash متوقف. آخر دفعة مؤكَّدة {paidAgo}."
webhookBadSignature: "{count} webhook(s) were rejected for a bad signature, the latest {ago}." | "رُفض {count} Webhook بسبب توقيع غير صحيح، آخرها {ago}." // "STRIPE_WEBHOOK_SECRET does not match this endpoint’s signing secret (test and live have different secrets). Copy the right one, redeploy, then resend the events from Stripe." | "STRIPE_WEBHOOK_SECRET لا يطابق سرّ توقيع هذا العنوان (للاختبار والحقيقي سرّان مختلفان). انسخوا الصحيح وأعيدوا النشر ثم أعيدوا إرسال الأحداث من Stripe."
webhookHandlerError: "The last webhook failed in our code {ago}: {type}. {detail}" | "فشل آخر Webhook في كودنا {ago}: {type}. {detail}" // "Stripe will retry. Find the error in Sentry or Vercel logs by the event id, fix it, then resend the event from Stripe." | "Stripe سيعيد المحاولة. ابحثوا عن الخطأ في Sentry أو سجلات Vercel برقم الحدث، أصلحوه ثم أعيدوا إرسال الحدث من Stripe."
webhookPendingAtStripe: "Stripe has {count} payment event(s) it has not delivered, the oldest {ago}." | "لدى Stripe {count} أحداث دفع لم تُسلَّم، أقدمها {ago}." // "Open the event in Stripe to see the response it got from us, fix it, and press Resend." | "افتحوا الحدث في Stripe لرؤية ردّنا عليه، أصلحوا السبب واضغطوا Resend."
reconcileOk: "No pending order has a completed payment at Stripe ({count} checked)." | "لا يوجد طلب معلّق له دفعة مكتملة لدى Stripe (فُحص {count})."
reconcileBroken: "{count} order(s) are paid at Stripe but still pending here." | "{count} طلبات مدفوعة لدى Stripe لكنها معلّقة هنا." // "The webhook did not land. In Stripe, Developers, Events, find payment_intent.succeeded for each and press Resend. Never mark an order paid by hand." | "الـ Webhook لم يصل. في Stripe ← Developers ← Events ابحثوا عن payment_intent.succeeded لكل طلب واضغطوا Resend. لا تسجّلوا طلباً كمدفوع يدوياً."
emailOk: "Resend is set up. Sending from {from}." | "Resend مضبوط. الإرسال من {from}."
emailNoKey: "No RESEND_API_KEY. Every email is logged as skipped and nobody is emailed." | "لا يوجد RESEND_API_KEY. كل رسالة تُسجَّل «متخطّاة» ولا يُرسَل شيء." // "Create an API key in Resend, set RESEND_API_KEY in Vercel, redeploy." | "أنشئوا مفتاحاً في Resend واضبطوا RESEND_API_KEY في Vercel ثم أعيدوا النشر."
emailNoFrom: "EMAIL_FROM is missing. Nothing can be sent without a verified sender." | "EMAIL_FROM غير موجود. لا يمكن الإرسال بلا مُرسِل موثَّق." // "Set EMAIL_FROM to an address on the domain verified in Resend." | "اضبطوا EMAIL_FROM على عنوان من النطاق الموثَّق في Resend."
emailDomainUnverified: "Resend reports the domain {domain} as {state}." | "Resend يفيد أن النطاق {domain} بحالة {state}." // "Open Resend, Domains, and add the DNS records it lists. Until then mail is rejected or lands in spam." | "افتحوا Resend ← Domains وأضيفوا سجلات DNS المطلوبة. حتى ذلك تُرفض الرسائل أو تذهب إلى البريد المزعج."
emailKeyRejected: "Resend rejected the API key." | "Resend رفض المفتاح." // "Create a new key in Resend, set RESEND_API_KEY, redeploy." | "أنشئوا مفتاحاً جديداً في Resend واضبطوا RESEND_API_KEY ثم أعيدوا النشر."
emailRestrictedKey: "Resend is set up with a sending-only key, so the domain could not be checked. Sending from {from}." | "Resend مضبوط بمفتاح للإرسال فقط، لذا تعذّر فحص النطاق. الإرسال من {from}."
deliveryOk: "No failed emails. Sent: {sent24} in 24 hours, {sent7} in 7 days." | "لا رسائل فاشلة. أُرسل {sent24} خلال 24 ساعة و{sent7} خلال 7 أيام."
deliveryFailing: "{failed24} failed and {skipped24} skipped in 24 hours ({failed7} and {skipped7} in 7 days)." | "{failed24} فشلت و{skipped24} تُخطّيت خلال 24 ساعة ({failed7} و{skipped7} خلال 7 أيام)." // "Read the errors below, fix the cause, then open Emails and press Resend on each row." | "اقرؤوا الأخطاء أدناه وأصلحوا السبب، ثم افتحوا «الرسائل» واضغطوا إعادة الإرسال لكل صف."
storageOk: "Vercel Blob is connected ({auth})." | "Vercel Blob متصل ({auth})."
storageLocal: "Uploads go to the local disk. Fine on a laptop, lost on Vercel." | "الملفات تُحفظ على القرص المحلي. مقبول محلياً وتُفقد على Vercel." // "Connect a Blob store to the project in Vercel (Storage, Blob, Connect Project)." | "اربطوا مخزن Blob بالمشروع في Vercel (Storage ← Blob ← Connect Project)."
storageUnreachable: "Blob is configured but the newest photo answered {status}." | "Blob مضبوط لكن أحدث صورة ردّت بـ {status}." // "Check the Blob store is still connected to this project and not deleted or over quota." | "تأكدوا أن مخزن Blob ما زال مربوطاً بالمشروع وغير محذوف ولم يتجاوز الحصة."
rateLimitOk: "Upstash answers in {ms} ms." | "Upstash يستجيب خلال {ms} ملّي ثانية."
rateLimitLocal: "Counting in memory, which is expected on a laptop." | "العدّ في الذاكرة، وهذا متوقع محلياً."
rateLimitMemory: "Upstash is not configured. Limits are counted separately in each server instance, so they are far weaker than they look." | "Upstash غير مضبوط. الحدود تُعدّ في كل خادم على حدة، فهي أضعف كثيراً مما تبدو." // "Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel and redeploy." | "اضبطوا UPSTASH_REDIS_REST_URL و UPSTASH_REDIS_REST_TOKEN في Vercel وأعيدوا النشر."
rateLimitHalf: "Only one of the two Upstash values is set, so it is treated as off." | "قيمة واحدة فقط من قيمتي Upstash مضبوطة، فيُعامَل كأنه متوقف." // "Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN." | "اضبطوا القيمتين معاً: UPSTASH_REDIS_REST_URL و UPSTASH_REDIS_REST_TOKEN."
rateLimitDown: "Upstash is configured but did not answer: {error}" | "Upstash مضبوط لكنه لم يستجب: {error}" // "The site falls back to memory counting meanwhile. Check the Upstash console and the token." | "الموقع يعدّ في الذاكرة مؤقتاً. راجعوا لوحة Upstash والرمز."
sentryOk: "Server and browser errors are reported." | "أخطاء الخادم والمتصفح تُرسَل."
sentryServerOnly: "Browser errors are not reported: NEXT_PUBLIC_SENTRY_DSN is missing." | "أخطاء المتصفح لا تُرسَل: NEXT_PUBLIC_SENTRY_DSN غير موجود." // "Set NEXT_PUBLIC_SENTRY_DSN to the same value as SENTRY_DSN and redeploy." | "اضبطوا NEXT_PUBLIC_SENTRY_DSN بقيمة SENTRY_DSN نفسها وأعيدوا النشر."
sentryMismatch: "The server and browser DSNs point at different projects." | "عنوانا DSN للخادم والمتصفح يشيران إلى مشروعين مختلفين." // "Use the same DSN for both." | "استخدموا العنوان نفسه للاثنين."
sentryOff: "Sentry is off. Errors only reach the Vercel logs." | "Sentry متوقف. الأخطاء تظهر في سجلات Vercel فقط." // "Set SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN in Vercel and redeploy." | "اضبطوا SENTRY_DSN و NEXT_PUBLIC_SENTRY_DSN في Vercel وأعيدوا النشر."
environmentOk: "{env}, built from {commit}." | "{env}، مبني من {commit}."
environmentLocalhost: "NEXT_PUBLIC_SERVER_URL is {url} on production. Payment links and emails would point there." | "NEXT_PUBLIC_SERVER_URL هو {url} في الإنتاج. روابط الدفع والرسائل ستشير إليه." // "Set NEXT_PUBLIC_SERVER_URL to https://www.calanthe.ae in Vercel and redeploy." | "اضبطوا NEXT_PUBLIC_SERVER_URL على https://www.calanthe.ae في Vercel وأعيدوا النشر."
environmentTokenInvalid: "HEALTH_CHECK_TOKEN is set but shorter than 32 characters, so the monitor address is off." | "HEALTH_CHECK_TOKEN مضبوط لكنه أقصر من 32 حرفاً، لذا عنوان المراقبة متوقف." // "Generate a longer token and set it again." | "أنشئوا رمزاً أطول واضبطوه من جديد."
flagsOk: "No order carries an open payment warning." | "لا يوجد طلب عليه تحذير دفع مفتوح."
flagsOpen: "{count} order(s) carry an open payment warning in their internal notes." | "{count} طلبات عليها تحذير دفع مفتوح في الملاحظات الداخلية." // "Open each order and settle it in Stripe (refund, answer the dispute, or check the amount). Then add a line starting with ✓ to the internal notes to clear it from this list." | "افتحوا كل طلب وعالجوه في Stripe (استرداد أو ردّ على النزاع أو تحقّق من المبلغ). ثم أضيفوا سطراً يبدأ بـ ✓ في الملاحظات الداخلية ليختفي من هذه القائمة."
paidNoInvoiceOk: "Every paid order has an invoice number." | "لكل طلب مدفوع رقم فاتورة."
paidNoInvoiceBroken: "{count} paid order(s) have no invoice number." | "{count} طلبات مدفوعة بلا رقم فاتورة." // "Resend the payment_intent.succeeded event from Stripe for each: the replay issues the invoice and sends no second email." | "أعيدوا إرسال حدث payment_intent.succeeded من Stripe لكل طلب: الإعادة تُصدر الفاتورة ولا ترسل بريداً ثانياً."
invoiceSeriesOk: "{year}: {count} invoices issued, counter at {last}. No gaps." | "{year}: صدرت {count} فاتورة والعدّاد عند {last}. بلا فجوات."
invoiceSeriesEmpty: "No invoice has been issued in {year} yet." | "لم تصدر أي فاتورة في {year} بعد."
invoiceSeriesBroken: "{year}: the counter is at {last} but {count} orders carry an invoice number." | "{year}: العدّاد عند {last} لكن {count} طلبات تحمل رقم فاتورة." // "Do not edit the counter. Find the missing or duplicated number with a query on orders.invoice_number and record what happened for the accountant." | "لا تعدّلوا العدّاد. اعثروا على الرقم الناقص أو المكرّر باستعلام على orders.invoice_number ودوّنوا ما حدث للمحاسب."
stalePendingOk: "No card order has waited more than {hours} hours." | "لا يوجد طلب بطاقة ينتظر منذ أكثر من {hours} ساعة."
stalePendingSome: "{count} card order(s) have waited for payment for more than {hours} hours." | "{count} طلبات بطاقة تنتظر الدفع منذ أكثر من {hours} ساعة." // "Usually an abandoned checkout. If “Paid at Stripe, pending here” is OK, cancel them from the order page." | "غالباً سلة متروكة. إن كان «مدفوع لدى Stripe ومعلّق هنا» سليماً فألغوها من صفحة الطلب."
payLinksOk: "{awaiting} payment link(s) open. None expires in the next {hours} hours." | "{awaiting} روابط دفع مفتوحة. لا ينتهي أي منها خلال {hours} ساعة."
payLinksSoon: "{count} payment link(s) expire within {hours} hours." | "{count} روابط دفع تنتهي خلال {hours} ساعة." // "Tell the florist: resend the link or call the customer from the order page." | "أبلغوا منسّقة الزهور: إعادة إرسال الرابط أو الاتصال بالعميل من صفحة الطلب."
activityOk: "{count} admin actions in 24 hours, the latest {ago}. This log records what people did, not errors; errors are in Sentry." | "{count} إجراءات إدارية خلال 24 ساعة، آخرها {ago}. هذا السجل يدوّن ما فعله الناس لا الأخطاء؛ الأخطاء في Sentry."
skippedShallow: "Skipped in the quick check. Add ?deep=1." | "تُخطّي في الفحص السريع. أضيفوا ?deep=1."
skippedNoDatabase: "Skipped because the database is not answering." | "تُخطّي لأن قاعدة البيانات لا تستجيب."
checkTimedOut: "This check took too long and was stopped." | "استغرق هذا الفحص وقتاً طويلاً فأُوقف." // "Check again. If it repeats, the service behind it is slow or down." | "أعيدوا الفحص. إن تكرّر فالخدمة خلفه بطيئة أو متوقفة."
checkCrashed: "This check failed to run: {error}" | "تعذّر تشغيل هذا الفحص: {error}" // "This is a bug in the health page itself. The error is also in Sentry." | "هذا خلل في صفحة الحالة نفسها. الخطأ موجود في Sentry أيضاً."

"{ago}" values are produced with Intl.RelativeTimeFormat(locale, { numeric: "auto" }) through a helper ago(iso, now, locale) in health.ts. {mode} is "Test"/"Live" (AR "اختبار"/"حقيقي") from h.modes.test / h.modes.live.
The JSON endpoint renders `message` in English only (machine consumers).

## tests

All Vitest, colocated, pure unless noted. No test touches a real database or network.

src/lib/developer.test.ts
- parseDeveloperEmails: undefined and "" -> []; trims, lowercases, de-duplicates; drops "not-an-email" and keeps the valid neighbours; trailing comma tolerated.
- isDeveloperEmail: case-insensitive match; false for empty list, null email, a prefix or suffix lookalike (dev@x.com vs dev@x.com.evil.com, xdev@x.com).

src/lib/env.test.ts (extend)
- DEVELOPER_EMAILS absent parses; HEALTH_CHECK_TOKEN of 10 chars does NOT throw and yields undefined; 32+ chars is kept.

src/backend/health/redact.test.ts
- redact removes sk_live_/sk_test_/pk_/whsec_/re_ values, "Bearer xyz", and postgres://user:pass@ credentials, and keeps the surrounding sentence; truncates at 240.
- keyHint("sk_test_51Abc...WxYz") -> "sk_test_…WxYz"; undefined -> null; never returns more than prefix + 4 characters (property check over random strings: output never contains characters 9..len-5 of the input).
- stripeMode: test, live, unknown, null. maskEmail keeps the domain and first character only.

src/backend/health/rules.test.ts
- worstStatus ordering; httpStatusFor: only failing -> 503.
- dbOutcome: 399 ms ok, 400 ms warning, error failing.
- migrationsOutcome: equal lists ok with the last name; one repo name missing from the database -> failing naming it (the incident this page exists for); a database-only name -> warning; batch -1 "dev" row -> warning and not counted as "ahead".
- schemaOutcome: one erroring slug -> failing naming it.
- stripeKeysOutcome: none -> warning; sk_test + pk_live -> failing; live keys on preview -> failing; test keys on production -> warning; apiError -> failing; matching live on production -> ok.
- endpointOutcome: exact host match with path ok; other host only -> failing in production, warning in preview; "*" satisfies events; missing recommended event -> warning; status "disabled" -> failing; null -> unknown.
- lastWebhookOutcome: bad signature newer than the last good beat -> failing; older than it -> ok; handler error newer -> failing; pending at Stripe -> failing in live mode and warning in test mode; beats null -> webhookNotRecorded; nothing at all -> unknown.
- reconcileOutcome (money rule): one "succeeded" among pending -> failing listing only that order; "requires_payment_method" and "canceled" -> ok; a retrieve error -> unknown, never ok.
- emailDeliveryOutcome: failed24 > 0 failing; failed only in 7d warning; skipped in production warning; suppressed on preview ok.
- rateLimitOutcome: both unset local ok; both unset production warning; one set failing; ping error failing.
- openFlags: returns "⚠ PAYMENT CHECK: ..." and PAID_AFTER_CANCEL_NOTE (import the constant from src/backend/payments/paid.ts so the two cannot drift) and "⚠ STRIPE: ..." lines; a later "✓ checked" line clears earlier flags; a new flag after a ✓ line is open again; null notes -> [].
- invoiceSeriesOutcome (money rule): counter 12 and 12 orders ok; counter 12 and 11 failing; counter null and 0 ok-empty; counter null and 3 failing.
- paidNoInvoiceOutcome, stalePendingOutcome, payLinksOutcome thresholds (47 h is soon, 49 h is not).
- toPublicReport: output has no "items", no "facts", and JSON.stringify of it contains none of the sample order numbers or emails.

src/backend/health/timeout.test.ts
- withTimeout resolves with the fallback after ms using fake timers; passes a fast value through; a late rejection does not surface as an unhandled rejection.

src/backend/health/grant.test.ts (vi.mock @/lib/env and @backend/data/admin-session)
- grantForToken: correct token -> grant via "monitor"; wrong token, wrong scheme, missing header, token unset -> null; a token equal in length but different -> null.
- grantForSession: owner not in list -> null; staff not in list -> null; developer -> grant; no session -> null; empty DEVELOPER_EMAILS -> null for everyone (fail closed).

src/backend/health/heartbeat.test.ts (mock @/lib/redis)
- redis null -> all three functions resolve without throwing and read returns null.
- redis.set throwing or never resolving -> recordWebhookBeat still resolves within 400 ms.
- keys are built with keyPrefix; an "error" beat writes both keys.

src/backend/health/report.test.ts (inject checks through a deps parameter, as paid.ts does with PaidDeps)
- a check that throws becomes unknown/checkCrashed with a redacted error and the others still report.
- a check that never resolves becomes unknown/checkTimedOut and the report returns within the budget (fake timers).
- payload null -> database-dependent checks are skippedNoDatabase, env-only checks still run, overall failing.
- no HealthOutcome value in a full report built from an env containing known fake secrets includes any of those secret strings (the "never print a secret" test).

src/app/(payload)/api/health/route.test.ts (mock grant + report + @payloadcms/next/routes)
- no credentials -> the Payload handler is called with slug ["health"] and its response is returned untouched; getHealthReport is not called.
- valid token -> 200 with PublicHealthReport; failing report -> 503; Cache-Control no-store.
- POST/PUT/PATCH/DELETE delegate to Payload.

src/admin/i18n/health.test.ts
- healthAr has exactly the keys of healthEn; no empty string; identical placeholder sets per key (same helper logic as i18n.test.ts).
- en.ts and ar.ts contain no key or value matching /health/i except none expected (guards against someone moving these strings into the public dictionary).

src/admin/shell/nav.test.ts (new, small)
- NAV_GROUPS contains no href "/admin/health".

src/migrations/index.test.ts
- the names in the migrations array equal the *.ts files in src/migrations (excluding index.ts and tests), in order. Catches a migration file that was never registered, which the runtime check cannot see on Vercel.

MANUAL VERIFICATION (required before done; record results in docs/HEALTH.md)
1. As owner and as staff: /admin/health and /admin/zzz give the same status code, same <title>, same visible text; view-source of any admin page and of /admin/login contains neither "health" nor "حالة النظام".
2. Signed out: both redirect to /admin/login.
3. curl /api/health with no header, and curl /api/zzz: same status, same body shape; with the token: JSON.
4. As developer at 390px, English and Arabic (RTL), light and dark: no horizontal scroll, tap targets 44px, commands wrap.
5. Stop the database URL locally: token endpoint answers 503 within 4 s.
6. Send a webhook with stripe trigger and with a wrong secret: the Last webhook row changes accordingly.

## edgeCases

ACCESS
- DEVELOPER_EMAILS empty or unset: nobody is a developer; page 404s for all; the nav item never renders. Fail closed.
- The developer account must have role admin or staff (getAdminSession refuses customers). If it does not exist yet, create it through Team as staff or owner, then add the email to the env.
- Owner takeover paths closed: password reset, role change, delete and email change on a developer account are refused for everyone but that developer (team actions and Users hooks, so /cms and REST are covered too). Remaining limit, stated honestly: anyone with Vercel or database access can read everything anyway; this page's secrecy is against people working in the admin, not against an infrastructure owner.
- Email change: if the developer changes his own email, he locks himself out of Health until the env is updated. Documented.
- A session that was valid when the page rendered but whose email is removed from the env: the next request 404s; server actions re-check on every call.
- Client bundle: the health page adds no client component, the nav item arrives as props only for the developer, and health strings are not in the shared dictionary. Server action ids are hashed and not enumerable.
- Sentry/Vercel logs will contain the path /admin/health; those are developer tools already.

404 PARITY
- The catch-all changes behaviour for unknown /admin URLs: signed-out visitors are redirected to login instead of seeing the storefront 404. That is intended and is what makes the health URL unremarkable.
- (panel)/loading.tsx streams, so notFound() may be delivered with status 200 plus the not-found UI. Whatever it is, it is the same for /admin/health and /admin/zzz because both go through the same layout and the same notFound(); verify, do not assume.
- /api/health with other verbs delegates to Payload so there is no 405 tell. /api/health/anything already falls to Payload's catch-all.

SECRETS
- Only presence, mode and prefix-plus-last-4 are ever placed in an outcome; every error string passes through redact(). The Resend key and webhook secret show presence only (no hint) -- the brief allows last-4 at most, and they add nothing to diagnosis.
- Pay tokens: items link to /admin/orders/<orderNumber>, never /pay/<token>; payTokenSalt/payTokenHash are never selected.
- Customer data: token callers receive no items; the developer sees order numbers and masked email addresses only.

DEPENDENCIES DOWN
- Database down: the page cannot authenticate (panel error page); the token endpoint still answers 503 with db failing and the rest skipped. getPayload itself is time-boxed.
- Stripe/Resend slow: 3 s SDK/fetch timeouts with no retries; the row becomes "Couldn't check".
- Upstash down: ping row failing; the heartbeat writer gives up after 400 ms and never affects the webhook's 200.
- Restricted Resend key (sending only): reported as fine with a note, not as a failure.
- Stripe restricted key without webhook-endpoint read permission: "Couldn't ask Stripe", not failing.

FALSE POSITIVES, HANDLED
- Preview and production share one Stripe test account: pending_webhooks counts every endpoint, so in test mode it is a warning, and "no endpoint for this origin" is a warning outside production.
- A bad-signature counter can be incremented by anyone posting a forged header; it is failing only while it is newer than the last good webhook, so a single good delivery clears it.
- Payment warnings in internalNotes never disappear by themselves; the ✓ line convention clears them from this list without editing history. Orders older than the last 50 flagged are not shown (sorted by updatedAt).
- PAID orders from before invoices existed have no invoice number; resending the Stripe event issues one with no second email (paid.ts late-replay path). If the owner prefers to leave history untouched, add a cutoff date constant.
- Abandoned card checkouts are normal: stale pending is a warning, never failing, and only for source "web-checkout-card". Unpaid payment requests are covered by the Payment links row instead. The discounts review proposes sweeping stale pending coded orders; when that lands this row simply shows fewer.
- Skipped emails are expected when Resend is deliberately off on preview; skipped counts only raise a warning in production. Counts are filtered to this deployment's environment because preview and production may share a database copy.
- Neon cold start makes the first database probe slow: warning, with the explanation in the fix text.
- A "dev" row (batch -1) in payload_migrations is reported once as a warning and not as an unknown migration.
- Discounts: payload.config.ts already registers the Discounts collection but src/migrations has no discounts migration yet. Until the other team adds it, "Tables match the code" will fail on any database without that table. That is the check working.

RECONCILIATION SAFETY
- The "paid at Stripe, pending here" check is read-only. It never sets PAID; the hard rule (only the signed webhook marks a card payment paid) is preserved, and the fix text says to resend the event.
- It inspects at most 5 orders per run and only in deep mode, so a monitor cannot burn Stripe rate limits.

ACTIVITY LOG
- The brief asks for "recent activity-log errors". The activity log (src/collections/ActivityLog.ts) has no error concept: actions are create/update/delete/status/email/login and recordActivity swallows its own failures into the server log. Adding an error action would need an enum migration. The row therefore shows volume and recency and says where errors live (Sentry). If error rows are wanted later, that is one additive enum migration.

MONITOR
- Shallow by default (database, migrations, schema, env, Redis ping, order queries); ?deep=1 adds Stripe, Resend and the media probe. 20 s in-process cache for token callers.
- 503 only for failing; warnings return 200 so a missing Sentry DSN does not page anyone at night.
- Token rotation: change the env and redeploy; there is no stored state.

PERFORMANCE
- Nothing here runs on storefront requests. The only code added to a hot path is the heartbeat write in the Stripe webhook (one Redis SET, 400 ms ceiling). The panel layout gains one string comparison per request.

## buildOrder

1. 1. Environment and pure access: add DEVELOPER_EMAILS and HEALTH_CHECK_TOKEN to src/lib/env.ts and .env.example; create src/lib/developer.ts with tests; extend src/lib/env.test.ts. Commit: feat(health): developer allow-list and monitor token.
2. 2. Server-only dictionary: src/admin/i18n/health.en.ts, health.ar.ts, health.ts and health.test.ts (key parity, placeholders, and the guard that en.ts/ar.ts stay free of health strings). Add the single key team.errors.protected to en.ts and ar.ts.
3. 3. Pure core: src/backend/health/types.ts, redact.ts, timeout.ts, rules.ts with their tests (rules.test.ts covers the migration, reconciliation and invoice-series rules first, test-first).
4. 4. Guard: src/backend/health/grant.ts with the unforgeable HealthGrant, plus grant.test.ts.
5. 5. Heartbeat: src/backend/health/heartbeat.ts and test; then the three one-line insertions in src/app/(payload)/api/webhooks/stripe/route.ts, rebased onto the payments team's current version of that file. Confirm the route's existing tests and behaviour are unchanged.
6. 6. Probes and orchestration: src/backend/health/checks.ts and report.ts (deps-injected, with report.test.ts for crash, timeout, no-database and secret-leak cases). Verify the table and column names payload_migrations(name, batch), email_log(status, environment, created_at), invoice_counters(year, last_value) against the migration files before writing the SQL. Add src/migrations/index.test.ts.
7. 7. 404 parity: add src/app/(admin)/admin/(panel)/[...missing]/page.tsx. Verify /admin/login, /admin/pulse and every existing screen still resolve, and that an unknown admin URL now shows the panel 404 (signed in) or the login redirect (signed out).
8. 8. The page: src/app/(admin)/admin/(panel)/health/page.tsx built from @admin/ui primitives (PageHeader, Card, CardHeader, Badge, ButtonLink, ActionButton), designed at 390px first, logical CSS only. Add env BUILD_TIME to next.config.ts.
9. 9. Navigation: extra prop on AdminSidebar/AdminMobileBar/NavLinks in src/admin/shell/AdminNav.tsx, passed from (panel)/layout.tsx only for a developer. Add src/admin/shell/nav.test.ts.
10. 10. Server action: src/backend/actions/health.ts (sendSentryTestEvent) wired to the Tools card.
11. 11. Monitor endpoint: src/app/(payload)/api/health/route.ts with all verbs delegating to Payload when unauthorised, plus route.test.ts.
12. 12. Protect the developer account: hooks in src/collections/Users.ts and refusals in src/backend/actions/team.ts; test that the owner cannot reset, re-role, delete or re-email a developer account and that the developer can still edit himself. No migration (hooks only); run pnpm generate:types to confirm no type change.
13. 13. Run pnpm typecheck, pnpm lint, pnpm test (including src/admin/rtl-guard.test.ts). Then the six manual verifications in the tests section, at 390px, in English and Arabic, light and dark, as developer, owner, staff and signed out.
14. 14. Configure Vercel (Production and Preview): DEVELOPER_EMAILS, HEALTH_CHECK_TOKEN. Create the uptime monitor on /api/health with the Authorization header, 1 to 5 minute interval, alert on non-200; optionally a second monitor on ?deep=1 every 15 minutes.
15. 15. Write docs/HEALTH.md (developer-facing: what each row means, the ✓ convention for clearing payment warnings, what to do when the database is down, how to rotate the token). Do not mention the page in docs/OWNER_TODO.md or docs/ADMIN.md's screen table. Conventional commits per step.

## openQuestionsForOwner

- Which email address(es) go in DEVELOPER_EMAILS, and does that account already exist in the admin with the owner or staff role? (It must; customers cannot enter the admin.)
- Protecting the developer account means the owner can no longer reset its password, change its role or delete it from Team or /cms. The account stays visible in the Team list. Is that acceptable to the client, or should the owner keep the ability to remove the developer (which also lets her take over the account and see Health)?
- Unknown /admin addresses will now show the admin's own 'This page doesn't exist' screen (or the sign-in page when signed out) instead of the storefront 404. This is what hides the Health address. OK to change?
- Which uptime monitor will call /api/health (Better Stack, UptimeRobot, Vercel checks, cron-job.org)? It must be able to send an Authorization header. Where should alerts go (email, WhatsApp, Telegram)?
- Upstash is optional today. Without it the 'Last webhook' row cannot record deliveries and relies on Stripe's own view. Should Upstash be made a standing part of production so the heartbeat and rate limits are real?
- Should a warning (for example Sentry off, or test Stripe keys on production before launch) alert the monitor, or only failures? The spec alerts on failures only.
- Paid orders from before invoice numbers existed: resend their Stripe events so each gets an invoice number (no second email is sent), or ignore orders paid before a cutoff date?
- Thresholds: card orders waiting more than 24 hours and payment links expiring within 48 hours are flagged. Are those the right numbers for this shop?
- Clearing a payment warning from the Health list uses a convention: add a line starting with a check mark to the order's internal notes. Is that acceptable, or is a proper 'resolved' field wanted later (that would need a migration)?
- The brief asks for activity-log errors, but the activity log only records what people did. Is Sentry enough for errors, or should failed admin actions also be written to the activity log (one small additive migration)?
- The Health page is written in English and Arabic like the rest of the admin. If only the developer will ever read it, the Arabic can be dropped to reduce upkeep. Keep both?
- MCP note for the developer: the context7 and figma connectors need authorising, and the playwright and chrome-devtools servers failed to connect in this session, so nothing here was verified in a browser.