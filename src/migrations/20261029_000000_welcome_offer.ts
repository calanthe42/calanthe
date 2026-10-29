import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The welcome gift (backend/data/welcome.ts): one code-kind discount the site
 * applies to a confirmed customer's first order, once per person. Nobody can
 * type it — backend/data/discounts.ts `findCoupon` never returns it.
 *
 * At most ONE row may be the gift (the partial unique index), and it is
 * seeded OFF: the code that knows to hide it must be live before it is
 * switched on, in /admin → Discounts. Skipped if a code called WELCOME
 * already exists, rather than taking over the owner's own code.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "discounts" ADD COLUMN IF NOT EXISTS "welcome" boolean DEFAULT false;
  CREATE UNIQUE INDEX IF NOT EXISTS "discounts_one_welcome_idx" ON "discounts" USING btree ("welcome") WHERE "welcome";
  INSERT INTO "discounts" ("title", "kind", "code", "value_type", "percent_off", "applies_to", "active", "min_subtotal_fils", "once_per_customer", "times_used", "welcome")
  SELECT 'Welcome gift (first order)', 'code', 'WELCOME', 'percentage', 10, 'all', false, 0, true, 0, true
  WHERE NOT EXISTS (SELECT 1 FROM "discounts" WHERE "welcome" OR "code" = 'WELCOME');`)
}

/**
 * A gift no order used is deleted. One that orders used stays, for their
 * history — but without the "welcome" column that hid it, it would be an
 * ordinary live code called WELCOME, with no usage limit, that anyone could
 * type. So it is switched off and ended first: an ended discount is
 * "expired", which no switch in /admin turns back on.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DELETE FROM "discounts" WHERE "welcome" AND NOT EXISTS (SELECT 1 FROM "orders" WHERE "orders"."coupon_discount_id" = "discounts"."id");
  UPDATE "discounts" SET "active" = false, "ends_at" = LEAST("ends_at", now()) WHERE "welcome";
  DROP INDEX IF EXISTS "discounts_one_welcome_idx";
  ALTER TABLE "discounts" DROP COLUMN IF EXISTS "welcome";`)
}
