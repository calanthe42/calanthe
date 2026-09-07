import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_tags" AS ENUM('vip', 'corporate', 'wedding-client', 'event-client', 'wholesale', 'repeat', 'do-not-contact', 'payment-issue');
  CREATE TYPE "public"."enum_users_account_status" AS ENUM('active', 'suspended', 'closed');
  CREATE TABLE "users_tags" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_tags",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  ALTER TABLE "users_addresses" ALTER COLUMN "line1" DROP NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "city" DROP NOT NULL;
  ALTER TABLE "users_addresses" ADD COLUMN "recipient_name" varchar;
  ALTER TABLE "users_addresses" ADD COLUMN "recipient_phone" varchar;
  ALTER TABLE "users_addresses" ADD COLUMN "street" varchar NOT NULL;
  ALTER TABLE "users_addresses" ADD COLUMN "apartment" varchar;
  ALTER TABLE "users_addresses" ADD COLUMN "delivery_instructions" varchar;
  ALTER TABLE "users" ADD COLUMN "first_name" varchar;
  ALTER TABLE "users" ADD COLUMN "last_name" varchar;
  ALTER TABLE "users" ADD COLUMN "birthday" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "account_status" "enum_users_account_status" DEFAULT 'active' NOT NULL;
  ALTER TABLE "users" ADD COLUMN "_verified" boolean;
  ALTER TABLE "users" ADD COLUMN "_verificationtoken" varchar;
  ALTER TABLE "users_tags" ADD CONSTRAINT "users_tags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_tags_order_idx" ON "users_tags" USING btree ("order");
  CREATE INDEX "users_tags_parent_idx" ON "users_tags" USING btree ("parent_id");
  CREATE INDEX "users_rels_order_idx" ON "users_rels" USING btree ("order");
  CREATE INDEX "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
  CREATE INDEX "users_rels_path_idx" ON "users_rels" USING btree ("path");
  CREATE INDEX "users_rels_products_id_idx" ON "users_rels" USING btree ("products_id");
  CREATE INDEX "users_first_name_idx" ON "users" USING btree ("first_name");
  CREATE INDEX "users_last_name_idx" ON "users" USING btree ("last_name");
  CREATE INDEX "users_account_status_idx" ON "users" USING btree ("account_status");
  CREATE INDEX "users_marketing_marketing_subscribed_idx" ON "users" USING btree ("marketing_subscribed");

  /* HAND-ADDED — the only edit to this generated migration, and it is
     load-bearing. Enabling auth.verify adds "_verified" with NO default, so
     every EXISTING row becomes NULL, which Payload reads as "not verified"
     and refuses to authenticate. That would lock the owner out of her own
     admin panel the moment this migration ran.
     Accounts that existed before verification was introduced were created
     through the trusted first-user bootstrap, so they are verified by
     definition. Backfilling keeps the existing admin valid. */
  UPDATE "users" SET "_verified" = true WHERE "_verified" IS NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_tags" CASCADE;
  DROP TABLE "users_rels" CASCADE;
  DROP INDEX "users_first_name_idx";
  DROP INDEX "users_last_name_idx";
  DROP INDEX "users_account_status_idx";
  DROP INDEX "users_marketing_marketing_subscribed_idx";
  ALTER TABLE "users_addresses" ALTER COLUMN "line1" SET NOT NULL;
  ALTER TABLE "users_addresses" ALTER COLUMN "city" SET NOT NULL;
  ALTER TABLE "users_addresses" DROP COLUMN "recipient_name";
  ALTER TABLE "users_addresses" DROP COLUMN "recipient_phone";
  ALTER TABLE "users_addresses" DROP COLUMN "street";
  ALTER TABLE "users_addresses" DROP COLUMN "apartment";
  ALTER TABLE "users_addresses" DROP COLUMN "delivery_instructions";
  ALTER TABLE "users" DROP COLUMN "first_name";
  ALTER TABLE "users" DROP COLUMN "last_name";
  ALTER TABLE "users" DROP COLUMN "birthday";
  ALTER TABLE "users" DROP COLUMN "account_status";
  ALTER TABLE "users" DROP COLUMN "_verified";
  ALTER TABLE "users" DROP COLUMN "_verificationtoken";
  DROP TYPE "public"."enum_users_tags";
  DROP TYPE "public"."enum_users_account_status";`)
}
