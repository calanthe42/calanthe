import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The store settings global (`settings`, globals/Settings.ts), registered for
 * the first time, holding the owner's add-ons: the "Something extra" list on
 * every product (lib/store-settings.ts `StoreAddon`).
 *
 * The two tables and their indexes are exactly what `payload migrate:create`
 * generates for this global in Payload 3.88 (copied from a generated probe,
 * with the statements that belong to OTHER migrations left out — the
 * snapshot it diffs against is older than the hand-written migrations since
 * 20261006). A global needs nothing on Payload's lock tables: a locked
 * global is a `global_slug` on payload_locked_documents, which exists.
 *
 * Both tables get ROW LEVEL SECURITY with no policies, and the Supabase API
 * roles lose all access to them, like the rest of the database (the Supabase
 * lockdown). The site reads the global through Payload as the table owner,
 * which RLS does not restrict, so its public read is unaffected. Guarded, so
 * it also runs on a local Postgres that has no `anon` role.
 *
 * PURELY ADDITIVE: two new tables, empty. An empty list means the shop offers
 * its default add-ons, exactly as before. Code deployed before this migration
 * keeps working against the new schema — run this first, THEN deploy.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "settings_addons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"name_en" varchar NOT NULL,
  	"name_ar" varchar NOT NULL,
  	"price_fils" numeric NOT NULL,
  	"active" boolean DEFAULT true
  );

  CREATE TABLE "settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  ALTER TABLE "settings_addons" ADD CONSTRAINT "settings_addons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "settings_addons_order_idx" ON "settings_addons" USING btree ("_order");
  CREATE INDEX "settings_addons_parent_id_idx" ON "settings_addons" USING btree ("_parent_id");

  ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "settings_addons" ENABLE ROW LEVEL SECURITY;
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON "settings", "settings_addons" FROM anon, authenticated;
      REVOKE ALL ON SEQUENCE "settings_id_seq" FROM anon, authenticated;
    END IF;
  END $$;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "settings_addons" CASCADE;
  DROP TABLE IF EXISTS "settings" CASCADE;`)
}
