import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Costs, release 1: step 1's model reshaped to the concept (CONCEPT.md), and
 * the owner's suppliers and invoices.
 *
 *   · the `cost-settings` global and its table are gone: no target margin,
 *     no hourly rate, no allowance for lost flowers, no VAT setting. Every
 *     default lives in backend/domain/costs.ts, and VAT follows the shop's
 *     own registration (src/lib/business.ts).
 *   · product_costs loses `waste_percent` and `making_minutes`: what goes in
 *     is items and how many, nothing guessed.
 *   · cost_items ("What you buy"): `group` (flowers | greenery | packaging |
 *     extra) replaces `kind` — flower → flowers, greenery → greenery, every
 *     container, wrapping, card and other → packaging; `one` (stem | piece |
 *     metre) replaces `use_unit` — a sheet or a bunch becomes a piece;
 *     `cost_source` is now invoice | typed; `last_paid_at` and
 *     `last_supplier_id` say where the price came from; the colour swatch
 *     goes; and a price for one is NULL when there is none, never 0.
 *   · new: suppliers, invoices and their lines.
 *
 * The new tables, enums, indexes and lock-table columns are exactly what
 * `payload migrate:create` generates for these configs in Payload 3.88
 * (copied from a generated probe). Three things differ, on purpose:
 *
 *   · invoices.supplier_id and invoices_lines.item_id are ON DELETE
 *     RESTRICT, not Payload's SET NULL. Both are NOT NULL, so SET NULL would
 *     fail anyway, with a less honest error; and an invoice is her record of
 *     what she paid — deleting a supplier or a thing she bought must not be
 *     able to take invoices with it.
 *   · the same supplier's invoice number may not be saved twice: a partial
 *     unique index on (supplier, the number ignoring case and outer spaces),
 *     for invoices that have a number. The save action checks first and
 *     answers in a sentence (backend/actions/costs.ts); this is the floor
 *     under it.
 *   · every new table gets ROW LEVEL SECURITY with no policies, and the
 *     Supabase API roles lose all access to it, like the rest of the
 *     database (the Supabase lockdown). Guarded, so it also runs on a local
 *     Postgres that has no `anon` role.
 *
 * NOT ADDITIVE. Step 1 was never live, so production has none of these
 * tables: it gets the final shape in one file instead
 * (scratchpad/costs-build/prod-costs-release1.sql), which records this
 * migration and 20261031_000000_costs_items as run. This migration is for a
 * database that already ran step 1 (a developer's). Run it BEFORE deploying
 * the code that uses it; the step-1 code does not run against it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  DROP TABLE IF EXISTS "cost_settings" CASCADE;

  ALTER TABLE "product_costs" DROP COLUMN IF EXISTS "waste_percent";
  ALTER TABLE "product_costs" DROP COLUMN IF EXISTS "making_minutes";

  CREATE TYPE "public"."enum_cost_items_group" AS ENUM('flowers', 'greenery', 'packaging', 'extra');
  CREATE TYPE "public"."enum_cost_items_one" AS ENUM('stem', 'piece', 'metre');
  CREATE TYPE "public"."enum_invoices_source" AS ENUM('typed', 'photo');

  CREATE TABLE "suppliers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "cost_items" ADD COLUMN "group" "enum_cost_items_group" DEFAULT 'flowers' NOT NULL;
  UPDATE "cost_items" SET "group" = (CASE "kind"::text
    WHEN 'flower' THEN 'flowers'
    WHEN 'greenery' THEN 'greenery'
    ELSE 'packaging' END)::"enum_cost_items_group";
  DROP INDEX IF EXISTS "cost_items_kind_idx";
  ALTER TABLE "cost_items" DROP COLUMN "kind";
  DROP TYPE "public"."enum_cost_items_kind";

  ALTER TABLE "cost_items" ADD COLUMN "one" "enum_cost_items_one" DEFAULT 'stem' NOT NULL;
  UPDATE "cost_items" SET "one" = (CASE "use_unit"::text
    WHEN 'stem' THEN 'stem'
    WHEN 'metre' THEN 'metre'
    ELSE 'piece' END)::"enum_cost_items_one";
  ALTER TABLE "cost_items" DROP COLUMN "use_unit";
  DROP TYPE "public"."enum_cost_items_use_unit";

  /* Step 1 had no invoices, so no price came from one: every price so far
     was typed by her. */
  ALTER TABLE "cost_items" ALTER COLUMN "cost_source" DROP DEFAULT;
  ALTER TYPE "public"."enum_cost_items_cost_source" RENAME TO "enum_cost_items_cost_source_step1";
  CREATE TYPE "public"."enum_cost_items_cost_source" AS ENUM('invoice', 'typed');
  ALTER TABLE "cost_items" ALTER COLUMN "cost_source" TYPE "enum_cost_items_cost_source" USING 'typed'::"enum_cost_items_cost_source";
  ALTER TABLE "cost_items" ALTER COLUMN "cost_source" SET DEFAULT 'typed';
  ALTER TABLE "cost_items" ALTER COLUMN "cost_source" SET NOT NULL;
  DROP TYPE "public"."enum_cost_items_cost_source_step1";

  /* Step 1 started an item with no price at 0. No price is now NULL, so an
     arrangement that uses it says "at least" instead of counting it free. */
  ALTER TABLE "cost_items" ALTER COLUMN "current_unit_cost_fils" DROP DEFAULT;
  UPDATE "cost_items" SET "current_unit_cost_fils" = NULL WHERE "current_unit_cost_fils" = 0;

  ALTER TABLE "cost_items" DROP COLUMN IF EXISTS "swatch";
  ALTER TABLE "cost_items" ADD COLUMN "last_paid_at" timestamp(3) with time zone;
  ALTER TABLE "cost_items" ADD COLUMN "last_supplier_id" integer;

  CREATE TABLE "invoices_lines" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item_id" integer NOT NULL,
  	"printed_name" varchar,
  	"packs" numeric NOT NULL,
  	"units_per_pack" numeric NOT NULL,
  	"units" numeric NOT NULL,
  	"line_total_fils" numeric NOT NULL,
  	"price_for_one_fils" numeric
  );

  CREATE TABLE "invoices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"supplier_id" integer NOT NULL,
  	"invoice_number" varchar,
  	"invoice_date" timestamp(3) with time zone NOT NULL,
  	"delivery_fils" numeric DEFAULT 0,
  	"vat_fils" numeric DEFAULT 0,
  	"total_fils" numeric,
  	"source" "enum_invoices_source" DEFAULT 'typed' NOT NULL,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "suppliers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invoices_id" integer;
  ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_last_supplier_id_suppliers_id_fk" FOREIGN KEY ("last_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices_lines" ADD CONSTRAINT "invoices_lines_item_id_cost_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."cost_items"("id") ON DELETE restrict ON UPDATE no action;
  ALTER TABLE "invoices_lines" ADD CONSTRAINT "invoices_lines_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;
  CREATE UNIQUE INDEX "suppliers_name_idx" ON "suppliers" USING btree ("name");
  CREATE INDEX "suppliers_updated_at_idx" ON "suppliers" USING btree ("updated_at");
  CREATE INDEX "suppliers_created_at_idx" ON "suppliers" USING btree ("created_at");
  CREATE INDEX "cost_items_group_idx" ON "cost_items" USING btree ("group");
  CREATE INDEX "cost_items_last_supplier_idx" ON "cost_items" USING btree ("last_supplier_id");
  CREATE INDEX "invoices_lines_order_idx" ON "invoices_lines" USING btree ("_order");
  CREATE INDEX "invoices_lines_parent_id_idx" ON "invoices_lines" USING btree ("_parent_id");
  CREATE INDEX "invoices_lines_item_idx" ON "invoices_lines" USING btree ("item_id");
  CREATE INDEX "invoices_supplier_idx" ON "invoices" USING btree ("supplier_id");
  CREATE INDEX "invoices_invoice_date_idx" ON "invoices" USING btree ("invoice_date");
  CREATE INDEX "invoices_updated_at_idx" ON "invoices" USING btree ("updated_at");
  CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");
  CREATE UNIQUE INDEX "invoices_supplier_number_idx" ON "invoices" USING btree ("supplier_id", lower(btrim("invoice_number"))) WHERE "invoice_number" IS NOT NULL AND btrim("invoice_number") <> '';
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_suppliers_fk" FOREIGN KEY ("suppliers_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoices_fk" FOREIGN KEY ("invoices_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_suppliers_id_idx" ON "payload_locked_documents_rels" USING btree ("suppliers_id");
  CREATE INDEX "payload_locked_documents_rels_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("invoices_id");

  ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
  ALTER TABLE "invoices_lines" ENABLE ROW LEVEL SECURITY;
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON "suppliers", "invoices", "invoices_lines" FROM anon, authenticated;
      REVOKE ALL ON SEQUENCE "suppliers_id_seq", "invoices_id_seq" FROM anon, authenticated;
    END IF;
  END $$;`)
}

/**
 * Back to step 1's shape. Suppliers and invoices are dropped with
 * everything on them; the cost settings come back empty (the step-1 code
 * fills in its defaults); a group goes back to the closest step-1 kind.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_suppliers_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_invoices_fk";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_suppliers_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_invoices_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "suppliers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "invoices_id";
  DROP TABLE IF EXISTS "invoices_lines" CASCADE;
  DROP TABLE IF EXISTS "invoices" CASCADE;
  DROP TYPE IF EXISTS "public"."enum_invoices_source";

  ALTER TABLE "cost_items" DROP CONSTRAINT IF EXISTS "cost_items_last_supplier_id_suppliers_id_fk";
  DROP INDEX IF EXISTS "cost_items_last_supplier_idx";
  ALTER TABLE "cost_items" DROP COLUMN IF EXISTS "last_supplier_id";
  ALTER TABLE "cost_items" DROP COLUMN IF EXISTS "last_paid_at";
  DROP TABLE IF EXISTS "suppliers" CASCADE;

  ALTER TABLE "cost_items" ADD COLUMN "swatch" varchar;
  UPDATE "cost_items" SET "current_unit_cost_fils" = 0 WHERE "current_unit_cost_fils" IS NULL;
  ALTER TABLE "cost_items" ALTER COLUMN "current_unit_cost_fils" SET DEFAULT 0;

  ALTER TABLE "cost_items" ALTER COLUMN "cost_source" DROP NOT NULL;
  ALTER TABLE "cost_items" ALTER COLUMN "cost_source" DROP DEFAULT;
  ALTER TYPE "public"."enum_cost_items_cost_source" RENAME TO "enum_cost_items_cost_source_r1";
  CREATE TYPE "public"."enum_cost_items_cost_source" AS ENUM('purchase', 'manual');
  ALTER TABLE "cost_items" ALTER COLUMN "cost_source" TYPE "enum_cost_items_cost_source" USING (CASE "cost_source"::text WHEN 'invoice' THEN 'purchase' ELSE 'manual' END)::"enum_cost_items_cost_source";
  ALTER TABLE "cost_items" ALTER COLUMN "cost_source" SET DEFAULT 'manual';
  DROP TYPE "public"."enum_cost_items_cost_source_r1";

  CREATE TYPE "public"."enum_cost_items_use_unit" AS ENUM('stem', 'piece', 'metre', 'sheet', 'bunch');
  ALTER TABLE "cost_items" ADD COLUMN "use_unit" "enum_cost_items_use_unit" DEFAULT 'stem' NOT NULL;
  UPDATE "cost_items" SET "use_unit" = "one"::text::"enum_cost_items_use_unit";
  ALTER TABLE "cost_items" DROP COLUMN "one";
  DROP TYPE "public"."enum_cost_items_one";

  CREATE TYPE "public"."enum_cost_items_kind" AS ENUM('flower', 'greenery', 'container', 'wrapping', 'card', 'other');
  ALTER TABLE "cost_items" ADD COLUMN "kind" "enum_cost_items_kind" DEFAULT 'flower' NOT NULL;
  UPDATE "cost_items" SET "kind" = (CASE "group"::text
    WHEN 'flowers' THEN 'flower'
    WHEN 'greenery' THEN 'greenery'
    WHEN 'packaging' THEN 'container'
    ELSE 'other' END)::"enum_cost_items_kind";
  DROP INDEX IF EXISTS "cost_items_group_idx";
  ALTER TABLE "cost_items" DROP COLUMN "group";
  DROP TYPE "public"."enum_cost_items_group";
  CREATE INDEX "cost_items_kind_idx" ON "cost_items" USING btree ("kind");

  ALTER TABLE "product_costs" ADD COLUMN "waste_percent" numeric DEFAULT 10;
  ALTER TABLE "product_costs" ADD COLUMN "making_minutes" numeric DEFAULT 0;

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
  ALTER TABLE "cost_settings" ENABLE ROW LEVEL SECURITY;
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      REVOKE ALL ON "cost_settings" FROM anon, authenticated;
      REVOKE ALL ON SEQUENCE "cost_settings_id_seq" FROM anon, authenticated;
    END IF;
  END $$;`)
}
