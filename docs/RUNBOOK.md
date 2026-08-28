# RUNBOOK — operate Calanthe

## Local setup (from zero)

1. `git clone` → `cd calanthe` (project lives at `C:\dev\calanthe` on the
   dev machine — deliberately OUTSIDE OneDrive; sync corrupted `.next`).
2. `pnpm install`
3. `cp .env.example .env.local`, fill:
   - `DATABASE_URL` — Neon **dev** branch string (Dashboard → Connection)
   - `PAYLOAD_SECRET` — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. `pnpm migrate` — applies committed migrations to your DB.
5. `pnpm dev` → http://localhost:3000 (storefront), /admin (panel).
6. First `/admin` visit → create-first-user = the owner (admin role).

## Migrations (never push)

- Change collections in `src/collections/*` / `payload.config.ts`.
- `pnpm migrate:create` → review the generated SQL in `src/migrations/`.
- Commit the migration WITH the schema change.
- `pnpm migrate` locally; production runs the same files on deploy.
- `push` is disabled in the adapter — dev, staging and prod all execute
  identical reviewed migrations.

## Deploying

- Vercel project `calanthe` (account nateliya420-6290).
- Set env vars in Vercel (Production): DATABASE_URL (Neon prod branch),
  PAYLOAD_SECRET, SENTRY_DSN, UPSTASH_REDIS_REST_URL/TOKEN,
  NEXT_PUBLIC_SERVER_URL=https://calanthe.vercel.app
- `vercel deploy --prod --yes` (build runs `next build` — webpack;
  Payload does not support Turbopack builds on Next 15).
- Run migrations against prod BEFORE promoting a schema-changing deploy:
  `DATABASE_URL=<prod> pnpm migrate`.

## Rotating keys

- PAYLOAD_SECRET: rotate in env → invalidates sessions (users re-login).
- Neon: create a new role/password in Neon, update env, delete old role.
- Upstash/Sentry: rotate token in dashboard → update env → redeploy.

## Backups / restore

- Neon PITR: Dashboard → Branches → Restore (point-in-time). Verify in
  Phase B9; restoring creates a branch — repoint DATABASE_URL to test.

## When X breaks

| Symptom | Check |
| --- | --- |
| Server won't boot, "Invalid environment configuration" | `.env.local` vs `.env.example`; the error lists exact vars |
| `/admin` 500s | DATABASE_URL reachable? `pnpm migrate` run? Payload logs in terminal |
| Build fails on Turbopack error | Build must be `next build` (webpack) — see package.json |
| Storefront images broken | `images.remotePatterns` in next.config.ts |
| Dev server ENOENT `.next` tmp corruption | You're in a synced folder — work from `C:\dev\calanthe` |
| Money looks wrong | Everything is integer fils; only `lib/money.ts` (+ future pricing.ts) computes — check tests |
