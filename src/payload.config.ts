import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { Users } from "@/collections/Users";
import { env } from "@/lib/env";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  secret: env.PAYLOAD_SECRET,
  serverURL: env.NEXT_PUBLIC_SERVER_URL,
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: " · Calanthe Admin",
    },
  },
  collections: [Users],
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: {
      connectionString: env.DATABASE_URL,
    },
    /* Migrations only — push is disabled everywhere so dev, staging and
       prod all run the exact same reviewed migration files. */
    push: false,
    migrationDir: path.resolve(dirname, "migrations"),
  }),
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  telemetry: false,
});
