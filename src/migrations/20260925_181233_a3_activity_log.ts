import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_activity_log_actor_role" AS ENUM('admin', 'staff');
  CREATE TYPE "public"."enum_activity_log_action" AS ENUM('create', 'update', 'delete', 'status', 'email', 'login');
  CREATE TYPE "public"."enum_activity_log_area" AS ENUM('orders', 'products', 'other');
  CREATE TABLE "activity_log_changes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"field" varchar NOT NULL,
  	"label" varchar,
  	"before" varchar,
  	"after" varchar
  );
  
  CREATE TABLE "activity_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"actor_email" varchar NOT NULL,
  	"actor_name" varchar,
  	"actor_role" "enum_activity_log_actor_role" NOT NULL,
  	"action" "enum_activity_log_action" NOT NULL,
  	"area" "enum_activity_log_area" NOT NULL,
  	"collection" varchar,
  	"item_id" varchar,
  	"item_label" varchar,
  	"summary" varchar NOT NULL,
  	"notable" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "activity_log_id" integer;
  ALTER TABLE "activity_log_changes" ADD CONSTRAINT "activity_log_changes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."activity_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "activity_log_changes_order_idx" ON "activity_log_changes" USING btree ("_order");
  CREATE INDEX "activity_log_changes_parent_id_idx" ON "activity_log_changes" USING btree ("_parent_id");
  CREATE INDEX "activity_log_actor_email_idx" ON "activity_log" USING btree ("actor_email");
  CREATE INDEX "activity_log_actor_name_idx" ON "activity_log" USING btree ("actor_name");
  CREATE INDEX "activity_log_actor_role_idx" ON "activity_log" USING btree ("actor_role");
  CREATE INDEX "activity_log_action_idx" ON "activity_log" USING btree ("action");
  CREATE INDEX "activity_log_area_idx" ON "activity_log" USING btree ("area");
  CREATE INDEX "activity_log_collection_idx" ON "activity_log" USING btree ("collection");
  CREATE INDEX "activity_log_item_id_idx" ON "activity_log" USING btree ("item_id");
  CREATE INDEX "activity_log_notable_idx" ON "activity_log" USING btree ("notable");
  CREATE INDEX "activity_log_updated_at_idx" ON "activity_log" USING btree ("updated_at");
  CREATE INDEX "activity_log_created_at_idx" ON "activity_log" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_activity_log_fk" FOREIGN KEY ("activity_log_id") REFERENCES "public"."activity_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_activity_log_id_idx" ON "payload_locked_documents_rels" USING btree ("activity_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "activity_log_changes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "activity_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "activity_log_changes" CASCADE;
  DROP TABLE "activity_log" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_activity_log_fk";
  
  DROP INDEX "payload_locked_documents_rels_activity_log_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "activity_log_id";
  DROP TYPE "public"."enum_activity_log_actor_role";
  DROP TYPE "public"."enum_activity_log_action";
  DROP TYPE "public"."enum_activity_log_area";`)
}
