import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_email_log_type" AS ENUM('verify-address', 'password-reset', 'order-confirmation', 'order-status', 'owner-new-order', 'florist-job-sheet', 'enquiry-received');
  CREATE TYPE "public"."enum_email_log_status" AS ENUM('sent', 'failed', 'skipped', 'suppressed');
  CREATE TABLE "email_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"to" varchar NOT NULL,
  	"type" "enum_email_log_type" NOT NULL,
  	"status" "enum_email_log_status" NOT NULL,
  	"subject" varchar NOT NULL,
  	"provider_id" varchar,
  	"error" varchar,
  	"environment" varchar,
  	"order_number" varchar,
  	"order_id" integer,
  	"resent_from_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "email_log_id" integer;
  ALTER TABLE "email_log" ADD CONSTRAINT "email_log_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_log" ADD CONSTRAINT "email_log_resent_from_id_email_log_id_fk" FOREIGN KEY ("resent_from_id") REFERENCES "public"."email_log"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "email_log_to_idx" ON "email_log" USING btree ("to");
  CREATE INDEX "email_log_type_idx" ON "email_log" USING btree ("type");
  CREATE INDEX "email_log_status_idx" ON "email_log" USING btree ("status");
  CREATE INDEX "email_log_provider_id_idx" ON "email_log" USING btree ("provider_id");
  CREATE INDEX "email_log_environment_idx" ON "email_log" USING btree ("environment");
  CREATE INDEX "email_log_order_number_idx" ON "email_log" USING btree ("order_number");
  CREATE INDEX "email_log_order_idx" ON "email_log" USING btree ("order_id");
  CREATE INDEX "email_log_resent_from_idx" ON "email_log" USING btree ("resent_from_id");
  CREATE INDEX "email_log_updated_at_idx" ON "email_log" USING btree ("updated_at");
  CREATE INDEX "email_log_created_at_idx" ON "email_log" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_log_fk" FOREIGN KEY ("email_log_id") REFERENCES "public"."email_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_email_log_id_idx" ON "payload_locked_documents_rels" USING btree ("email_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "email_log" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_email_log_fk";
  
  DROP INDEX "payload_locked_documents_rels_email_log_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "email_log_id";
  DROP TYPE "public"."enum_email_log_type";
  DROP TYPE "public"."enum_email_log_status";`)
}
