import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "payload";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import sharp from "sharp";
import { Enquiries } from "@/collections/Enquiries";
import { Events } from "@/collections/Events";
import { Media } from "@/collections/Media";
import { Memberships } from "@/collections/Memberships";
import { Occasions } from "@/collections/Occasions";
import { Orders } from "@/collections/Orders";
import { Products } from "@/collections/Products";
import { Users } from "@/collections/Users";
import { MAX_UPLOAD_BYTES, buildStoragePlugins } from "@backend/payload/storage";
import { env } from "@/lib/env";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  secret: env.PAYLOAD_SECRET,
  serverURL: env.NEXT_PUBLIC_SERVER_URL,
  /* Payload's own CMS moves to /cms so that /admin can host the business
     admin application. Nothing about Payload's backend changes: the REST and
     GraphQL endpoints, access control and Local API are untouched, and /cms
     remains the full developer CMS. */
  routes: { admin: "/cms" },
  admin: {
    user: Users.slug,
    meta: {
      titleSuffix: " · Calanthe Admin",
    },
  },
  collections: [Users, Media, Occasions, Products, Orders, Events, Enquiries, Memberships],
  /* Required for the `media` image sizes — Payload delegates resizing to
     sharp and silently skips size generation when it is absent. */
  sharp,
  /* Persistent object storage for uploads. See backend/payload/storage.ts
     for why Vercel Blob, and what happens when the token is absent. */
  plugins: buildStoragePlugins(),
  upload: {
    /* Vercel caps a serverless request body at 4.5 MB. Without an explicit
       limit the platform rejects a larger upload with an opaque 413 that
       looks like a bug; with it, Payload returns a readable validation error
       naming the real limit. Raising this requires client-side uploads —
       see the clientUploads note in backend/payload/storage.ts. */
    limits: { fileSize: MAX_UPLOAD_BYTES },
  },
  editor: lexicalEditor(),
  /* The management interface will become a separate private Calanthe Admin
     app on its own origin; Payload's own /admin stays as the internal and
     development interface. A cross-origin admin needs both of these lists,
     and an empty allow-list is the safe default until that origin exists.
     Add the admin app's origin here (and nowhere else) when it is built. */
  cors: [env.NEXT_PUBLIC_SERVER_URL],
  csrf: [env.NEXT_PUBLIC_SERVER_URL],
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
