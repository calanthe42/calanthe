import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Accounts that work at once (backend/actions/account.ts customerRegister).
 *
 * `email_confirmed_at` now carries what `_verified` used to: the customer
 * followed the link we emailed. The welcome gift reads it. `_verified` stays
 * true for every customer so Payload lets her sign in straight away.
 *
 * Everyone who had already confirmed keeps that, dated by the best date we
 * have; customers who never clicked can now sign in, and still have the link
 * to unlock the gift. `terms_accepted_at` starts empty: those accounts were
 * made before the box existed.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_confirmed_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp(3) with time zone;
  UPDATE "users" SET "email_confirmed_at" = COALESCE("updated_at", now())
    WHERE "_verified" = true AND "email_confirmed_at" IS NULL;
  UPDATE "users" SET "_verified" = true WHERE "role" = 'customer' AND "_verified" = false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "users" SET "_verified" = false WHERE "role" = 'customer' AND "email_confirmed_at" IS NULL;
  ALTER TABLE "users" DROP COLUMN IF EXISTS "terms_accepted_at";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "email_confirmed_at";`)
}
