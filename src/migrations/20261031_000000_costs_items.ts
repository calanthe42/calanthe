import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Costs, step 1: the owner's flowers and materials library (`cost-items`),
 * each product's cost recipe (`product-costs`) and her costing settings (the
 * `cost-settings` global). See backend/domain/costs.ts.
 *
 * The tables, enums, indexes and the two new columns on Payload's lock table
 * are exactly what `payload migrate:create` generates for these three configs
 * in Payload 3.88 (copied from a generated probe, with the statements that
 * belong to OTHER migrations left out — the snapshot it diffs against is
 * older than the hand-written migrations since 20261006). Two things differ,
 * on purpose:
 *
 *   · product_costs.product_id is ON DELETE CASCADE, not Payload's SET NULL.
 *     The column is NOT NULL, so SET NULL would make deleting a product that
 *     has a cost recipe fail; and a recipe for a deleted product means
 *     nothing. Deleting the product deletes its recipe.
 *   · every new table gets ROW LEVEL SECURITY with no policies, and the
 *     Supabase API roles lose all access to it, like the rest of the
 *     database (the Supabase lockdown). The site's own role owns the tables,
 *     and an owner is not subject to RLS, so the site is unaffected. Guarded,
 *     so it also runs on a local Postgres that has no `anon` role.
 *
 * PURELY ADDITIVE: new tables, and two nullable columns on
 * payload_locked_documents_rels. Code deployed before this migration keeps
 * working against the new schema — run this first, THEN deploy.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_cost_items_kind" AS ENUM('flower', 'greenery', 'container', 'wrapping', 'card', 'other');
  CREATE TYPE "public"."enum_cost_items_use_unit" AS ENUM('stem', 'piece', 'metre', 'sheet', 'bunch');
  CREATE TYPE "public"."enum_cost_items_cost_source" AS ENUM('purchase', 'manual');
  CREATE TABLE "cost_items_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );

  CREATE TABLE "cost_items" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"kind" "enum_cost_items_kind" DEFAULT 'flower' NOT NULL,
  	"use_unit" "enum_cost_items_use_unit" DEFAULT 'stem' NOT NULL,
  	"pack_name" varchar,
  	"units_per_pack" numeric DEFAULT 1 NOT NULL,
  	"current_unit_cost_fils" numeric DEFAULT 0,
  	"cost_source" "enum_cost_items_cost_source" DEFAULT 'manual',
  	"swatch" varchar,
  	"archived" boolean DEFAULT false,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "product_costs_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_id" integer NOT NULL,
  	"quantity" numeric NOT NULL
  );

  CREATE TABLE "product_costs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"waste_percent" numeric DEFAULT 10,
  	"making_minutes" numeric DEFAULT 0,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "cost_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"target_margin_percent" numeric DEFAULT 60,
  	"labour_rate_per_hour_fils" numeric DEFAULT 6000,
  	"default_waste_percent" numeric DEFAULT 10,
  	"vat_reclaimable" boolean DEFAULT true,
  	"vat_rate_percent" numeric DEFAULT 5,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "cost_items_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "product_costs_id" integer;
  ALTER TABLE "cost_items_aliases" ADD CONSTRAINT "cost_items_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "product_costs_lines" ADD CONSTRAINT "product_costs_lines_item_id_cost_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."cost_items"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_costs_lines" ADD CONSTRAINT "product_costs_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."product_costs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "product_costs" ADD CONSTRAINT "product_costs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "cost_items_aliases_order_idx" ON "cost_items_aliases" USING btree ("_order");
  CREATE INDEX "cost_items_aliases_parent_id_idx" ON "cost_items_aliases" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cost_items_name_idx" ON "cost_items" USING btree ("name");
  CREATE INDEX "cost_items_kind_idx" ON "cost_items" USING btree ("kind");
  CREATE INDEX "cost_items_archived_idx" ON "cost_items" USING btree ("archived");
  CREATE INDEX "cost_items_updated_at_idx" ON "cost_items" USING btree ("updated_at");
  CREATE INDEX "cost_items_created_at_idx" ON "cost_items" USING btree ("created_at");
  CREATE INDEX "product_costs_lines_order_idx" ON "product_costs_lines" USING btree ("_order");
  CREATE INDEX "product_costs_lines_parent_id_idx" ON "product_costs_lines" USING btree ("_parent_id");
  CREATE INDEX "product_costs_lines_item_idx" ON "product_costs_lines" USING btree ("item_id");
  CREATE UNIQUE INDEX "product_costs_product_idx" ON "product_costs" USING btree ("product_id");
  CREATE INDEX "product_costs_updated_at_idx" ON "product_costs" USING btree ("updated_at");
  CREATE INDEX "product_costs_created_at_idx" ON "product_costs" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cost_items_fk" FOREIGN KEY ("cost_items_id") REFERENCES "public"."cost_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_costs_fk" FOREIGN KEY ("product_costs_id") REFERENCES "public"."product_costs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_cost_items_id_idx" ON "payload_locked_documents_rels" USING btree ("cost_items_id");
  CREATE INDEX "payload_locked_documents_rels_product_costs_id_idx" ON "payload_locked_documents_rels" USING btree ("product_costs_id");

  ALTER TABLE "cost_items" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "cost_items_aliases" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "product_costs" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "product_costs_lines" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "cost_settings" ENABLE ROW LEVEL SECURITY;
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON "cost_items", "cost_items_aliases", "product_costs", "product_costs_lines", "cost_settings" FROM anon, authenticated;
      REVOKE ALL ON SEQUENCE "cost_items_id_seq", "product_costs_id_seq", "cost_settings_id_seq" FROM anon, authenticated;
    END IF;
  END $$;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_cost_items_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_product_costs_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_cost_items_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_product_costs_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "cost_items_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "product_costs_id";
  DROP TABLE IF EXISTS "product_costs_lines" CASCADE;
  DROP TABLE IF EXISTS "product_costs" CASCADE;
  DROP TABLE IF EXISTS "cost_items_aliases" CASCADE;
  DROP TABLE IF EXISTS "cost_items" CASCADE;
  DROP TABLE IF EXISTS "cost_settings" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_cost_items_kind";
  DROP TYPE IF EXISTS "public"."enum_cost_items_use_unit";
  DROP TYPE IF EXISTS "public"."enum_cost_items_cost_source";`)
}
