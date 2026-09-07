import { vercelBlobStorage } from "@payloadcms/storage-vercel-blob";
import type { Plugin } from "payload";
import { isStaff } from "./access";

/**
 * Where uploaded photographs physically live.
 *
 * THE PROBLEM THIS SOLVES. Payload's default adapter writes to the local
 * filesystem. On Vercel that filesystem is ephemeral: files survive until the
 * next deployment and then vanish, with no error and no way back. The client
 * would upload a season's photography, we would ship a fix, and it would all
 * be gone (docs/DEPLOYMENT.md §4).
 *
 * WHY VERCEL BLOB. It is the only option that adds no second vendor, no
 * second bill and no second set of credentials to rotate — one env var that
 * Vercel injects itself. Cloudflare R2 is cheaper at high bandwidth and
 * remains the sensible migration if image traffic ever justifies it; the
 * adapter is a config swap, not a schema change, so that door stays open.
 *
 * NOTHING PRIVATE MAY BE STORED HERE. Vercel Blob supports only `public`
 * access today. That is correct for product photography and wrong for
 * anything else — receipts and documents stream through an authenticated
 * route instead (docs/DATABASE.md §3).
 */

/**
 * Vercel caps a serverless request body at 4.5 MB. Staying under it keeps a
 * too-large upload a readable validation error instead of an opaque platform
 * 413 that looks like a bug.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type StorageMode = "vercel-blob" | "local-disk";

export type StorageEnvironment = {
  token: string | undefined;
  vercelEnv: string | undefined;
  isBuildPhase: boolean;
};

/**
 * Decides where uploads go — pure, so the rule can be tested without a
 * database, a network or a real token.
 *
 * Production without a token THROWS rather than falling back. A silent
 * fallback there would write the client's photography to an ephemeral disk
 * and lose it on the next deploy, which is the precise failure this whole
 * module exists to prevent. Failing to boot is loud, immediate and fixable;
 * losing a season of photographs is none of those.
 */
export function resolveStorageMode(environment: StorageEnvironment): StorageMode {
  if (environment.token) return "vercel-blob";

  const isProductionRuntime =
    environment.vercelEnv === "production" && !environment.isBuildPhase;

  if (isProductionRuntime) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is missing in production. Refusing to start: " +
        "uploads would be written to Vercel's ephemeral filesystem and lost on " +
        "the next deployment. Connect a Vercel Blob store to this project.",
    );
  }

  return "local-disk";
}

/** The one server-side secret this module needs. Never `NEXT_PUBLIC_`. */
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

/** `next build` makes no network calls, so it must not require runtime secrets. */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Storage plugins for the Payload config.
 *
 * The adapter disables itself when the token is absent and Payload falls back
 * to `Media.upload.staticDir`. That fallback is deliberate and local-only —
 * `assertStorageIsSafe` guarantees production can never reach it.
 */
export function buildStoragePlugins(): Plugin[] {
  const mode = resolveStorageMode({
    token: BLOB_TOKEN,
    vercelEnv: process.env.VERCEL_ENV,
    isBuildPhase,
  });

  if (mode === "local-disk" && !isBuildPhase) {
    console.warn(
      "[media] BLOB_READ_WRITE_TOKEN is not set — uploads will be written to " +
        "./uploads on the local disk. This is fine for development and is NOT " +
        "production storage. See docs/DEPLOYMENT.md §4.",
    );
  }

  return [
    vercelBlobStorage({
      enabled: Boolean(BLOB_TOKEN),
      token: BLOB_TOKEN,
      collections: { media: true },

      /* SCHEMA CONSISTENCY, and the reason this flag is not left at its
         default. The plugin injects its own fields (a `prefix`) only when it
         is enabled. Without this, a developer with no token would generate
         migrations from a different schema than production runs — the exact
         drift that makes a deploy fail at 2am. Fields are now always present,
         enabled or not. */
      alwaysInsertFields: true,

      /* Vercel Blob supports `public` only. Stated explicitly so that the day
         private blobs exist, this line is the one to revisit. */
      access: "public",

      /* Images are immutable once uploaded — a new photograph gets a new
         filename — so they can be cached hard. */
      cacheControlMaxAge: 365 * 24 * 60 * 60,

      /* clientUploads is DELIBERATELY OFF. It exists to bypass Vercel's
         4.5 MB request-body limit by uploading straight from the browser, and
         it is the right answer eventually — but as shipped it defaults to
         `access: ({ req }) => !!req.user`, which would let any signed-in
         CUSTOMER mint an upload token, and it hardcodes `allowOverwrite: true`
         on a caller-chosen pathname. Turning it on safely needs the explicit
         access rule below plus real testing against a live Blob store, which
         cannot be done without production credentials.
         Until then the 4.5 MB limit stands and is enforced as a readable
         validation error by `upload.limits` in payload.config.ts. */
      // clientUploads: { access: clientUploadAccess },
    }),
  ];
}

/**
 * The access rule `clientUploads` must use when it is eventually enabled.
 *
 * Exported now, unused now, so that the correct rule is written down beside
 * the reason rather than reinvented under time pressure later. It mirrors
 * `Media.create` — internal staff only, never a customer.
 */
export const clientUploadAccess = ({ req }: { req: Parameters<typeof isStaff>[0]["req"] }) =>
  req.user?.role === "admin" || req.user?.role === "staff";

/** Exposed for tests and diagnostics; never logs the token itself. */
export const storageDiagnostics = {
  provider: BLOB_TOKEN ? ("vercel-blob" as const) : ("local-disk" as const),
  isConfigured: Boolean(BLOB_TOKEN),
};
