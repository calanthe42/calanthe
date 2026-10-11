import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** users.must_change_password — see the field in collections/Users.ts. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE users DROP COLUMN IF EXISTS must_change_password;`)
}
