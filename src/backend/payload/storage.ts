import { cloudStoragePlugin } from "@payloadcms/plugin-cloud-storage";
import type { Plugin } from "payload";
import { isStaff } from "./access";
import { vercelBlobOidcAdapter } from "./vercel-blob-oidc";

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
  /**
   * `BLOB_STORE_ID`, which Vercel injects whenever a Blob store is connected.
   * On an OIDC connection it is the only durable credential there is: the
   * runtime supplies the short-lived token itself, per request.
   */
  storeId?: string | undefined;
};

/**
 * EITHER CREDENTIAL IS REAL STORAGE; NEITHER IS NOT.
 *
 * `@vercel/blob` resolves credentials in a fixed order — an explicit `token`,
 * then OIDC (`VERCEL_OIDC_TOKEN` paired with `BLOB_STORE_ID`), then
 * `BLOB_READ_WRITE_TOKEN`. Connections made today are OIDC and issue no
 * long-lived token at all, so requiring one would reject a perfectly good
 * store; `backend/payload/vercel-blob-oidc.ts` passes no token precisely so
 * that OIDC is chosen.
 *
 * What must never change is the guarantee underneath: production has to be
 * writing to the store. With no credential of either kind, Payload falls back
 * to `Media.upload.staticDir` on Vercel's ephemeral filesystem, where a
 * season's photography survives until the next deployment and then vanishes,
 * silently. So production refuses to start instead. Failing to boot is loud,
 * immediate and fixable; losing the client's photographs is none of those.
 */
export function resolveStorageMode(environment: StorageEnvironment): StorageMode {
  if (environment.token || environment.storeId) return "vercel-blob";

  const isProductionRuntime =
    environment.vercelEnv === "production" && !environment.isBuildPhase;

  if (isProductionRuntime) {
    throw new Error(
      "No Vercel Blob credentials in production. Refusing to start: uploads " +
        "would be written to Vercel's ephemeral filesystem and lost on the next " +
        "deployment. Connect a Blob store to this project — which sets " +
        "BLOB_STORE_ID and authenticates by OIDC — or, for a host outside " +
        "Vercel, set BLOB_READ_WRITE_TOKEN.",
    );
  }

  return "local-disk";
}

/** Legacy long-lived credential. Never `NEXT_PUBLIC_`. */
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

/** Set by Vercel whenever a Blob store is connected, OIDC included. */
const BLOB_STORE_ID = process.env.BLOB_STORE_ID;

/** `next build` makes no network calls, so it must not require runtime secrets. */
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

/**
 * Images are immutable once uploaded — a new photograph gets a new filename —
 * so they can be cached hard.
 */
const CACHE_CONTROL_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Storage plugins for the Payload config.
 *
 * With no credentials the plugin is left disabled and Payload falls back to
 * `Media.upload.staticDir`. That fallback is deliberate and local-only —
 * `resolveStorageMode` above guarantees production can never reach it.
 *
 * `cloudStoragePlugin` is the same plugin Payload's own storage packages wrap,
 * so the collection schema is identical to what the vendor adapter produced:
 * the `url` and `prefix` fields, and no migration.
 *
 * CLIENT UPLOADS ARE DELIBERATELY OFF. They exist to bypass Vercel's 4.5 MB
 * request-body limit by uploading straight from the browser, and they are the
 * right answer eventually — but they need an explicit access rule (a signed-in
 * CUSTOMER must never be able to mint an upload) plus real testing against a
 * live store. Until then the 4.5 MB limit stands and is enforced as a readable
 * validation error by `upload.limits` in payload.config.ts.
 */
export function buildStoragePlugins(): Plugin[] {
  const mode = resolveStorageMode({
    token: BLOB_TOKEN,
    vercelEnv: process.env.VERCEL_ENV,
    isBuildPhase,
    storeId: BLOB_STORE_ID,
  });

  if (mode === "local-disk" && !isBuildPhase) {
    console.warn(
      "[media] No Vercel Blob credentials (neither BLOB_STORE_ID for OIDC nor " +
        "BLOB_READ_WRITE_TOKEN) — uploads will be written to ./uploads on the " +
        "local disk. This is fine for development and is NOT production " +
        "storage. See docs/DEPLOYMENT.md §4.",
    );
  }

  return [
    cloudStoragePlugin({
      enabled: mode === "vercel-blob",
      collections: {
        media: {
          adapter: vercelBlobOidcAdapter({ cacheControlMaxAge: CACHE_CONTROL_MAX_AGE }),
          /* An empty collection prefix, stated rather than left undefined.
             `alwaysInsertFields` is only consulted on the DISABLED path; when
             the plugin is enabled the `prefix` field is inserted only if this
             option is defined. Without it the media schema would gain the
             field with no credentials and lose it with them — and the column
             `20260907_071945_media_storage` created would look droppable to the
             next generated migration. "" keeps both states identical and file
             keys exactly where they are. */
          prefix: "",
        },
      },

      /* SCHEMA CONSISTENCY, and the reason this flag is not left at its
         default. The plugin injects its own fields (a `prefix`) only when it
         is enabled. Without this, a developer with no credentials would
         generate migrations from a different schema than production runs — the
         exact drift that makes a deploy fail at 2am. Fields are now always
         present, enabled or not. */
      alwaysInsertFields: true,
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
export const clientUploadAccess = ({
  req,
}: {
  req: Parameters<typeof isStaff>[0]["req"];
}) => req.user?.role === "admin" || req.user?.role === "staff";

/** Exposed for tests and diagnostics; never logs the credential itself. */
export const storageDiagnostics = {
  provider:
    BLOB_TOKEN || BLOB_STORE_ID ? ("vercel-blob" as const) : ("local-disk" as const),
  /** How the store authenticates, so a log line can say which path is live. */
  auth: BLOB_TOKEN
    ? ("read-write-token" as const)
    : BLOB_STORE_ID
      ? ("oidc" as const)
      : null,
  isConfigured: Boolean(BLOB_TOKEN || BLOB_STORE_ID),
};
