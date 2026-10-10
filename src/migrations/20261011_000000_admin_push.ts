import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The devices that receive the shop's order notifications (backend/notify/
 * push.ts). Written by hand: it is not a Payload collection, only a list of
 * push endpoints, each tied to the admin or staff account that turned it on.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
    id serial PRIMARY KEY,
    endpoint text NOT NULL UNIQUE,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS admin_push_subscriptions;`)
}
