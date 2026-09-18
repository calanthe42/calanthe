import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_addresses_emirate" AS ENUM('abu-dhabi', 'dubai', 'sharjah', 'ajman', 'umm-al-quwain', 'ras-al-khaimah', 'fujairah');
  CREATE TYPE "public"."enum_users_marketing_source" AS ENUM('account', 'footer', 'checkout', 'import');
  CREATE TABLE "users_addresses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"line1" varchar NOT NULL,
  	"line2" varchar,
  	"area" varchar,
  	"city" varchar NOT NULL,
  	"emirate" "enum_users_addresses_emirate" NOT NULL,
  	"is_default" boolean DEFAULT false
  );
  
  ALTER TABLE "users" ADD COLUMN "phone" varchar;
  ALTER TABLE "users" ADD COLUMN "marketing_subscribed" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "marketing_consent_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "marketing_source" "enum_users_marketing_source";
  ALTER TABLE "users" ADD COLUMN "marketing_unsubscribed_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar;
  ALTER TABLE "users" ADD COLUMN "notes" varchar;
  ALTER TABLE "users" ADD COLUMN "anonymised_at" timestamp(3) with time zone;
  ALTER TABLE "users_addresses" ADD CONSTRAINT "users_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_addresses_order_idx" ON "users_addresses" USING btree ("_order");
  CREATE INDEX "users_addresses_parent_id_idx" ON "users_addresses" USING btree ("_parent_id");
  CREATE INDEX "users_role_idx" ON "users" USING btree ("role");
  CREATE UNIQUE INDEX "users_phone_idx" ON "users" USING btree ("phone");
  CREATE UNIQUE INDEX "users_stripe_customer_id_idx" ON "users" USING btree ("stripe_customer_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_addresses" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_addresses" CASCADE;
  DROP INDEX "users_role_idx";
  DROP INDEX "users_phone_idx";
  DROP INDEX "users_stripe_customer_id_idx";
  ALTER TABLE "users" DROP COLUMN "phone";
  ALTER TABLE "users" DROP COLUMN "marketing_subscribed";
  ALTER TABLE "users" DROP COLUMN "marketing_consent_at";
  ALTER TABLE "users" DROP COLUMN "marketing_source";
  ALTER TABLE "users" DROP COLUMN "marketing_unsubscribed_at";
  ALTER TABLE "users" DROP COLUMN "stripe_customer_id";
  ALTER TABLE "users" DROP COLUMN "notes";
  ALTER TABLE "users" DROP COLUMN "anonymised_at";
  DROP TYPE "public"."enum_users_addresses_emirate";
  DROP TYPE "public"."enum_users_marketing_source";`)
}
