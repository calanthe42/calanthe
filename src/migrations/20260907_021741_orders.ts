import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   /* HAND-ADDED (the only edit to generated SQL in this migration).
      Payload has no concept of a sequence, but the customer-facing order
      number needs one: two checkouts in the same millisecond must not mint
      the same CAL-000123. nextval() is atomic and lock-free; count()+1 is
      not. Gaps are acceptable, collisions are not.
      See src/backend/payload/hooks/orderNumber.ts. */
  CREATE SEQUENCE IF NOT EXISTS "calanthe_order_number_seq" AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;
   CREATE TYPE "public"."enum_orders_customer_type" AS ENUM('guest', 'registered');
  CREATE TYPE "public"."enum_orders_delivery_emirate" AS ENUM('abu-dhabi', 'dubai', 'sharjah', 'ajman', 'umm-al-quwain', 'ras-al-khaimah', 'fujairah');
  CREATE TYPE "public"."enum_orders_currency" AS ENUM('AED');
  CREATE TYPE "public"."enum_orders_fulfilment_status" AS ENUM('NEW', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');
  CREATE TYPE "public"."enum_orders_payment_status" AS ENUM('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
  CREATE TABLE "orders_items_selected_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "orders_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"product_id" integer,
  	"product_name" varchar NOT NULL,
  	"product_slug" varchar NOT NULL,
  	"quantity" numeric NOT NULL,
  	"unit_price_fils" numeric NOT NULL,
  	"line_total_fils" numeric NOT NULL
  );
  
  CREATE TABLE "orders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order_number" varchar,
  	"customer_type" "enum_orders_customer_type" DEFAULT 'guest' NOT NULL,
  	"customer_id" integer,
  	"customer_name" varchar NOT NULL,
  	"customer_email" varchar NOT NULL,
  	"customer_phone" varchar NOT NULL,
  	"delivery_address" varchar NOT NULL,
  	"delivery_emirate" "enum_orders_delivery_emirate" NOT NULL,
  	"delivery_date" timestamp(3) with time zone NOT NULL,
  	"delivery_time_slot" varchar NOT NULL,
  	"delivery_notes" varchar,
  	"recipient_name" varchar,
  	"recipient_phone" varchar,
  	"card_message" varchar,
  	"subtotal_fils" numeric NOT NULL,
  	"delivery_fee_fils" numeric NOT NULL,
  	"discount_fils" numeric NOT NULL,
  	"total_fils" numeric NOT NULL,
  	"currency" "enum_orders_currency" DEFAULT 'AED' NOT NULL,
  	"coupon_code" varchar,
  	"coupon_discount_fils" numeric,
  	"fulfilment_status" "enum_orders_fulfilment_status" DEFAULT 'NEW' NOT NULL,
  	"payment_status" "enum_orders_payment_status" DEFAULT 'PENDING' NOT NULL,
  	"assigned_staff_id" integer,
  	"internal_notes" varchar,
  	"source" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "orders_id" integer;
  ALTER TABLE "orders_items_selected_options" ADD CONSTRAINT "orders_items_selected_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_items" ADD CONSTRAINT "orders_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders" ADD CONSTRAINT "orders_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "orders_items_selected_options_order_idx" ON "orders_items_selected_options" USING btree ("_order");
  CREATE INDEX "orders_items_selected_options_parent_id_idx" ON "orders_items_selected_options" USING btree ("_parent_id");
  CREATE INDEX "orders_items_order_idx" ON "orders_items" USING btree ("_order");
  CREATE INDEX "orders_items_parent_id_idx" ON "orders_items" USING btree ("_parent_id");
  CREATE INDEX "orders_items_product_idx" ON "orders_items" USING btree ("product_id");
  CREATE UNIQUE INDEX "orders_order_number_idx" ON "orders" USING btree ("order_number");
  CREATE INDEX "orders_customer_type_idx" ON "orders" USING btree ("customer_type");
  CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");
  CREATE INDEX "orders_customer_email_idx" ON "orders" USING btree ("customer_email");
  CREATE INDEX "orders_customer_phone_idx" ON "orders" USING btree ("customer_phone");
  CREATE INDEX "orders_delivery_emirate_idx" ON "orders" USING btree ("delivery_emirate");
  CREATE INDEX "orders_delivery_date_idx" ON "orders" USING btree ("delivery_date");
  CREATE INDEX "orders_total_fils_idx" ON "orders" USING btree ("total_fils");
  CREATE INDEX "orders_coupon_code_idx" ON "orders" USING btree ("coupon_code");
  CREATE INDEX "orders_fulfilment_status_idx" ON "orders" USING btree ("fulfilment_status");
  CREATE INDEX "orders_payment_status_idx" ON "orders" USING btree ("payment_status");
  CREATE INDEX "orders_assigned_staff_idx" ON "orders" USING btree ("assigned_staff_id");
  CREATE INDEX "orders_updated_at_idx" ON "orders" USING btree ("updated_at");
  CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_orders_fk" FOREIGN KEY ("orders_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_orders_id_idx" ON "payload_locked_documents_rels" USING btree ("orders_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP SEQUENCE IF EXISTS "calanthe_order_number_seq";
   ALTER TABLE "orders_items_selected_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "orders_items_selected_options" CASCADE;
  DROP TABLE "orders_items" CASCADE;
  DROP TABLE "orders" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_orders_fk";
  
  DROP INDEX "payload_locked_documents_rels_orders_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "orders_id";
  DROP TYPE "public"."enum_orders_customer_type";
  DROP TYPE "public"."enum_orders_delivery_emirate";
  DROP TYPE "public"."enum_orders_currency";
  DROP TYPE "public"."enum_orders_fulfilment_status";
  DROP TYPE "public"."enum_orders_payment_status";`)
}
