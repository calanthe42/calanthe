import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_addresses" DROP COLUMN "line1";
  ALTER TABLE "users_addresses" DROP COLUMN "line2";
  ALTER TABLE "users_addresses" DROP COLUMN "city";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_addresses" ADD COLUMN "line1" varchar;
  ALTER TABLE "users_addresses" ADD COLUMN "line2" varchar;
  ALTER TABLE "users_addresses" ADD COLUMN "city" varchar;`)
}
