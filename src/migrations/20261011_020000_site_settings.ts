import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Website switches the owner controls from the admin (backend/data/
 * site-flags.ts). Both start OFF, which is how the site is today: Events
 * and guest favours hidden.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE IF NOT EXISTS site_settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    updated_by integer REFERENCES users(id) ON DELETE SET NULL
  );
  INSERT INTO site_settings (key, value) VALUES ('eventsLive', 'false'::jsonb), ('guestFavorsLive', 'false'::jsonb)
  ON CONFLICT (key) DO NOTHING;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS site_settings;`)
}
