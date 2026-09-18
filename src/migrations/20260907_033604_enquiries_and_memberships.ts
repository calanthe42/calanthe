import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   /* HAND-ADDED (the only edit to this generated migration).
      Payload has no concept of a sequence, but CAL-E-000001 needs one: two
      form submissions in the same millisecond must not mint the same
      reference. nextval() is atomic and lock-free; a count() query is not.
      See src/backend/payload/hooks/sequentialNumber.ts. */
  CREATE SEQUENCE IF NOT EXISTS "calanthe_enquiry_number_seq" AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;
   CREATE TYPE "public"."enum_enquiries_build_your_own_flowers" AS ENUM('roses', 'peonies', 'orchids', 'tulips', 'lilies', 'wildflowers', 'florists-choice');
  CREATE TYPE "public"."enum_enquiries_build_your_own_colours" AS ENUM('blush', 'white-cream', 'burgundy', 'terracotta', 'sage', 'bold', 'pastel');
  CREATE TYPE "public"."enum_enquiries_type" AS ENUM('BUILD_YOUR_OWN', 'EVENT', 'MEMBERSHIP', 'CONTACT', 'CUSTOM_REQUEST');
  CREATE TYPE "public"."enum_enquiries_build_your_own_style" AS ENUM('romantic', 'minimal', 'wild', 'structured', 'luxe', 'unsure');
  CREATE TYPE "public"."enum_enquiries_build_your_own_size" AS ENUM('standard', 'deluxe', 'premium', 'statement');
  CREATE TYPE "public"."enum_enquiries_membership_status" AS ENUM('interest');
  CREATE TYPE "public"."enum_enquiries_membership_preferred_plan" AS ENUM('MONTHLY', 'QUARTERLY', 'CUSTOM');
  CREATE TYPE "public"."enum_enquiries_membership_frequency" AS ENUM('WEEKLY', 'FORTNIGHTLY', 'MONTHLY');
  CREATE TYPE "public"."enum_enquiries_membership_delivery_preference" AS ENUM('home', 'office', 'gift');
  CREATE TYPE "public"."enum_enquiries_custom_request_category" AS ENUM('unusual-flowers', 'large-order', 'special-gift', 'corporate', 'last-minute', 'decoration', 'other');
  CREATE TYPE "public"."enum_enquiries_status" AS ENUM('NEW', 'IN_REVIEW', 'WAITING_FOR_CUSTOMER', 'QUOTED', 'CONVERTED', 'RESOLVED', 'SPAM', 'CANCELLED');
  CREATE TYPE "public"."enum_enquiries_priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT');
  CREATE TYPE "public"."enum_enquiries_source" AS ENUM('WEBSITE', 'INSTAGRAM', 'WHATSAPP', 'PHONE', 'ADMIN', 'OTHER');
  CREATE TYPE "public"."enum_enquiries_last_contact_method" AS ENUM('EMAIL', 'WHATSAPP', 'PHONE', 'INSTAGRAM', 'IN_PERSON');
  CREATE TYPE "public"."enum_memberships_plan" AS ENUM('MONTHLY', 'QUARTERLY', 'CUSTOM');
  CREATE TYPE "public"."enum_memberships_status" AS ENUM('PENDING', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');
  CREATE TYPE "public"."enum_memberships_delivery_frequency" AS ENUM('WEEKLY', 'FORTNIGHTLY', 'MONTHLY');
  CREATE TABLE "enquiries_build_your_own_flowers" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_enquiries_build_your_own_flowers",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "enquiries_build_your_own_colours" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_enquiries_build_your_own_colours",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "enquiries_build_your_own_inspiration_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "enquiries_custom_request_attachments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "enquiries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"enquiry_number" varchar,
  	"type" "enum_enquiries_type" DEFAULT 'CONTACT' NOT NULL,
  	"customer_id" integer,
  	"contact_name" varchar NOT NULL,
  	"contact_email" varchar NOT NULL,
  	"contact_phone" varchar,
  	"company" varchar,
  	"subject" varchar NOT NULL,
  	"message" varchar,
  	"build_your_own_style" "enum_enquiries_build_your_own_style",
  	"build_your_own_size" "enum_enquiries_build_your_own_size",
  	"build_your_own_quantity" numeric,
  	"build_your_own_budget_fils" numeric,
  	"build_your_own_delivery_date" timestamp(3) with time zone,
  	"build_your_own_delivery_location" varchar,
  	"build_your_own_card_message" varchar,
  	"build_your_own_special_instructions" varchar,
  	"related_event_id" integer,
  	"membership_status" "enum_enquiries_membership_status" DEFAULT 'interest',
  	"membership_preferred_plan" "enum_enquiries_membership_preferred_plan",
  	"membership_frequency" "enum_enquiries_membership_frequency",
  	"membership_delivery_preference" "enum_enquiries_membership_delivery_preference",
  	"membership_preferred_start_date" timestamp(3) with time zone,
  	"membership_budget_fils" numeric,
  	"membership_notes" varchar,
  	"custom_request_category" "enum_enquiries_custom_request_category",
  	"custom_request_description" varchar,
  	"custom_request_budget_fils" numeric,
  	"custom_request_requested_date" timestamp(3) with time zone,
  	"status" "enum_enquiries_status" DEFAULT 'NEW' NOT NULL,
  	"priority" "enum_enquiries_priority" DEFAULT 'NORMAL' NOT NULL,
  	"source" "enum_enquiries_source" DEFAULT 'WEBSITE' NOT NULL,
  	"assigned_staff_id" integer,
  	"follow_up_at" timestamp(3) with time zone,
  	"resolved_at" timestamp(3) with time zone,
  	"last_contacted_at" timestamp(3) with time zone,
  	"last_contact_method" "enum_enquiries_last_contact_method",
  	"communication_notes" varchar,
  	"internal_notes" varchar,
  	"converted_membership_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "memberships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"customer_id" integer NOT NULL,
  	"plan" "enum_memberships_plan" NOT NULL,
  	"status" "enum_memberships_status" DEFAULT 'PENDING' NOT NULL,
  	"delivery_frequency" "enum_memberships_delivery_frequency" NOT NULL,
  	"price_per_delivery_fils" numeric,
  	"start_date" timestamp(3) with time zone,
  	"next_billing_date" timestamp(3) with time zone,
  	"notes" varchar,
  	"provider_customer_id" varchar,
  	"provider_subscription_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "enquiries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "memberships_id" integer;
  ALTER TABLE "enquiries_build_your_own_flowers" ADD CONSTRAINT "enquiries_build_your_own_flowers_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "enquiries_build_your_own_colours" ADD CONSTRAINT "enquiries_build_your_own_colours_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "enquiries_build_your_own_inspiration_images" ADD CONSTRAINT "enquiries_build_your_own_inspiration_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enquiries_build_your_own_inspiration_images" ADD CONSTRAINT "enquiries_build_your_own_inspiration_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "enquiries_custom_request_attachments" ADD CONSTRAINT "enquiries_custom_request_attachments_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enquiries_custom_request_attachments" ADD CONSTRAINT "enquiries_custom_request_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_related_event_id_events_id_fk" FOREIGN KEY ("related_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_converted_membership_id_memberships_id_fk" FOREIGN KEY ("converted_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "enquiries_build_your_own_flowers_order_idx" ON "enquiries_build_your_own_flowers" USING btree ("order");
  CREATE INDEX "enquiries_build_your_own_flowers_parent_idx" ON "enquiries_build_your_own_flowers" USING btree ("parent_id");
  CREATE INDEX "enquiries_build_your_own_colours_order_idx" ON "enquiries_build_your_own_colours" USING btree ("order");
  CREATE INDEX "enquiries_build_your_own_colours_parent_idx" ON "enquiries_build_your_own_colours" USING btree ("parent_id");
  CREATE INDEX "enquiries_build_your_own_inspiration_images_order_idx" ON "enquiries_build_your_own_inspiration_images" USING btree ("_order");
  CREATE INDEX "enquiries_build_your_own_inspiration_images_parent_id_idx" ON "enquiries_build_your_own_inspiration_images" USING btree ("_parent_id");
  CREATE INDEX "enquiries_build_your_own_inspiration_images_image_idx" ON "enquiries_build_your_own_inspiration_images" USING btree ("image_id");
  CREATE INDEX "enquiries_custom_request_attachments_order_idx" ON "enquiries_custom_request_attachments" USING btree ("_order");
  CREATE INDEX "enquiries_custom_request_attachments_parent_id_idx" ON "enquiries_custom_request_attachments" USING btree ("_parent_id");
  CREATE INDEX "enquiries_custom_request_attachments_image_idx" ON "enquiries_custom_request_attachments" USING btree ("image_id");
  CREATE UNIQUE INDEX "enquiries_enquiry_number_idx" ON "enquiries" USING btree ("enquiry_number");
  CREATE INDEX "enquiries_type_idx" ON "enquiries" USING btree ("type");
  CREATE INDEX "enquiries_customer_idx" ON "enquiries" USING btree ("customer_id");
  CREATE INDEX "enquiries_contact_email_idx" ON "enquiries" USING btree ("contact_email");
  CREATE INDEX "enquiries_build_your_own_build_your_own_delivery_date_idx" ON "enquiries" USING btree ("build_your_own_delivery_date");
  CREATE INDEX "enquiries_related_event_idx" ON "enquiries" USING btree ("related_event_id");
  CREATE INDEX "enquiries_custom_request_custom_request_requested_date_idx" ON "enquiries" USING btree ("custom_request_requested_date");
  CREATE INDEX "enquiries_status_idx" ON "enquiries" USING btree ("status");
  CREATE INDEX "enquiries_priority_idx" ON "enquiries" USING btree ("priority");
  CREATE INDEX "enquiries_source_idx" ON "enquiries" USING btree ("source");
  CREATE INDEX "enquiries_assigned_staff_idx" ON "enquiries" USING btree ("assigned_staff_id");
  CREATE INDEX "enquiries_follow_up_at_idx" ON "enquiries" USING btree ("follow_up_at");
  CREATE INDEX "enquiries_resolved_at_idx" ON "enquiries" USING btree ("resolved_at");
  CREATE INDEX "enquiries_converted_membership_idx" ON "enquiries" USING btree ("converted_membership_id");
  CREATE INDEX "enquiries_updated_at_idx" ON "enquiries" USING btree ("updated_at");
  CREATE INDEX "enquiries_created_at_idx" ON "enquiries" USING btree ("created_at");
  CREATE INDEX "memberships_customer_idx" ON "memberships" USING btree ("customer_id");
  CREATE INDEX "memberships_plan_idx" ON "memberships" USING btree ("plan");
  CREATE INDEX "memberships_status_idx" ON "memberships" USING btree ("status");
  CREATE INDEX "memberships_start_date_idx" ON "memberships" USING btree ("start_date");
  CREATE INDEX "memberships_next_billing_date_idx" ON "memberships" USING btree ("next_billing_date");
  CREATE INDEX "memberships_provider_customer_id_idx" ON "memberships" USING btree ("provider_customer_id");
  CREATE UNIQUE INDEX "memberships_provider_subscription_id_idx" ON "memberships" USING btree ("provider_subscription_id");
  CREATE INDEX "memberships_updated_at_idx" ON "memberships" USING btree ("updated_at");
  CREATE INDEX "memberships_created_at_idx" ON "memberships" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enquiries_fk" FOREIGN KEY ("enquiries_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_memberships_fk" FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_enquiries_id_idx" ON "payload_locked_documents_rels" USING btree ("enquiries_id");
  CREATE INDEX "payload_locked_documents_rels_memberships_id_idx" ON "payload_locked_documents_rels" USING btree ("memberships_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP SEQUENCE IF EXISTS "calanthe_enquiry_number_seq";
   ALTER TABLE "enquiries_build_your_own_flowers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "enquiries_build_your_own_colours" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "enquiries_build_your_own_inspiration_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "enquiries_custom_request_attachments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "enquiries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "memberships" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "enquiries_build_your_own_flowers" CASCADE;
  DROP TABLE "enquiries_build_your_own_colours" CASCADE;
  DROP TABLE "enquiries_build_your_own_inspiration_images" CASCADE;
  DROP TABLE "enquiries_custom_request_attachments" CASCADE;
  DROP TABLE "enquiries" CASCADE;
  DROP TABLE "memberships" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_enquiries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_memberships_fk";
  
  DROP INDEX "payload_locked_documents_rels_enquiries_id_idx";
  DROP INDEX "payload_locked_documents_rels_memberships_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "enquiries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "memberships_id";
  DROP TYPE "public"."enum_enquiries_build_your_own_flowers";
  DROP TYPE "public"."enum_enquiries_build_your_own_colours";
  DROP TYPE "public"."enum_enquiries_type";
  DROP TYPE "public"."enum_enquiries_build_your_own_style";
  DROP TYPE "public"."enum_enquiries_build_your_own_size";
  DROP TYPE "public"."enum_enquiries_membership_status";
  DROP TYPE "public"."enum_enquiries_membership_preferred_plan";
  DROP TYPE "public"."enum_enquiries_membership_frequency";
  DROP TYPE "public"."enum_enquiries_membership_delivery_preference";
  DROP TYPE "public"."enum_enquiries_custom_request_category";
  DROP TYPE "public"."enum_enquiries_status";
  DROP TYPE "public"."enum_enquiries_priority";
  DROP TYPE "public"."enum_enquiries_source";
  DROP TYPE "public"."enum_enquiries_last_contact_method";
  DROP TYPE "public"."enum_memberships_plan";
  DROP TYPE "public"."enum_memberships_status";
  DROP TYPE "public"."enum_memberships_delivery_frequency";`)
}
