import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_legacy_images_placeholder_palette" AS ENUM('warm', 'olive', 'burgundy');
  CREATE TABLE "products_legacy_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"src" varchar,
  	"placeholder_seed" varchar,
  	"placeholder_palette" "enum_products_legacy_images_placeholder_palette"
  );
  
  ALTER TABLE "products" ADD COLUMN "new_arrival" boolean DEFAULT false;
  ALTER TABLE "products_legacy_images" ADD CONSTRAINT "products_legacy_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_legacy_images_order_idx" ON "products_legacy_images" USING btree ("_order");
  CREATE INDEX "products_legacy_images_parent_id_idx" ON "products_legacy_images" USING btree ("_parent_id");
  CREATE INDEX "products_new_arrival_idx" ON "products" USING btree ("new_arrival");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products_legacy_images" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "products_legacy_images" CASCADE;
  DROP INDEX "products_new_arrival_idx";
  ALTER TABLE "products" DROP COLUMN "new_arrival";
  DROP TYPE "public"."enum_products_legacy_images_placeholder_palette";`)
}
