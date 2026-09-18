import type { Adapter, StaticHandler } from "@payloadcms/plugin-cloud-storage/types";
import { getFileKey, getFilePrefix } from "@payloadcms/plugin-cloud-storage/utilities";
import { BlobNotFoundError, del, get, put } from "@vercel/blob";

/**
 * Vercel Blob storage for Payload, authenticated by OIDC.
 *
 * WHY THIS EXISTS INSTEAD OF @payloadcms/storage-vercel-blob.
 *
 * Vercel Blob connections default to OIDC: the store injects `BLOB_STORE_ID`
 * and the runtime issues a short-lived credential per request, so there is no
 * long-lived `vercel_blob_rw_…` token to hand anyone. `@vercel/blob` resolves
 * credentials in this order — an explicit `token`, then OIDC, then
 * `BLOB_READ_WRITE_TOKEN` — so passing NO token is what selects OIDC.
 *
 * Payload's own adapter cannot express that. It pins `@vercel/blob` 2.3.1
 * (pre-OIDC) on every published version including the 4.0 previews, it derives
 * the store id by regex from the token string, and `!options.token` disables
 * the plugin outright — at which point uploads land on Vercel's ephemeral
 * filesystem and vanish on the next deploy.
 *
 * This adapter is the same shape, minus the token: it plugs into
 * `cloudStoragePlugin`, the public extension point Payload's own adapters use,
 * and keeps their exact file layout via the shared `getFileKey` helper, so
 * nothing about the stored paths or the collection schema changes.
 *
 * NO `generateURL`. It is only consulted when `disablePayloadAccessControl` is
 * set, which this project deliberately does not set: media is served through
 * Payload's own access-controlled route — and with a private store that route
 * is the only way to read an object at all. Every call here addresses blobs by
 * pathname, so the store's hostname is never constructed.
 */

type AdapterArgs = {
  /** Seconds. Matches the value the storefront's images are cached for. */
  cacheControlMaxAge: number;
};

/**
 * THE STORE IS PRIVATE, AND THIS MUST MATCH IT.
 *
 * `calanthe.ae.a-blob` was created with `Access: Private`
 * (`…private.blob.vercel-storage.com`). A store's access mode is fixed when it
 * is created: writing `access: "public"` into a private store is refused, and
 * a private object cannot be read by an unauthenticated `fetch` of its URL.
 * The adapter did both, which is why the store held zero blobs and every
 * upload in /cms failed.
 *
 * Private is also the better fit here. Media already reaches visitors through
 * Payload's own route (`/api/media/file/…`), which applies the collection's
 * access rules, so nothing is lost — and the objects are no longer readable
 * straight from the CDN by anyone holding a URL.
 *
 * If the store is ever recreated as public, this is the line to change (and
 * `generateURL` becomes worth adding, so images can be served from the CDN).
 */
const BLOB_ACCESS = "private" as const;

export function vercelBlobOidcAdapter({ cacheControlMaxAge }: AdapterArgs): Adapter {
  return ({ collection, prefix = "" }) => {
    const staticHandler: StaticHandler = async (
      req,
      {
        headers: incomingHeaders,
        params: { clientUploadContext, filename, prefix: prefixQueryParam },
      },
    ) => {
      try {
        const docPrefix = await getFilePrefix({
          clientUploadContext,
          collection,
          filename,
          prefixQueryParam,
          req,
        });
        const { fileKey } = getFileKey({
          collectionPrefix: prefix,
          docPrefix,
          filename,
        });

        /* `get` fetches the bytes over an authenticated connection, which is
           the only way to read from a private store — an unauthenticated
           `fetch` of the object's URL is refused. It takes the pathname, so
           the store's hostname is never constructed here, and it forwards the
           caller's Range and If-None-Match, so partial content and 304s stay
           the store's answers rather than ones recomputed here. */
        const rangeHeader = req.headers.get("range");
        const etagFromHeaders =
          req.headers.get("etag") || req.headers.get("if-none-match");

        const result = await get(fileKey, {
          access: BLOB_ACCESS,
          ...(etagFromHeaders ? { ifNoneMatch: etagFromHeaders } : {}),
          ...(rangeHeader ? { headers: { Range: rangeHeader } } : {}),
        });

        if (!result) {
          return new Response(null, { status: 404, statusText: "Not Found" });
        }

        let headers = new Headers(incomingHeaders);
        headers.append("Cache-Control", `public, max-age=${cacheControlMaxAge}`);
        headers.append("ETag", result.blob.etag);
        headers.append("Content-Disposition", result.blob.contentDisposition);
        headers.append("Last-Modified", result.blob.uploadedAt.toISOString());

        /* Nothing was modified: no body to send, and no reason to read one. */
        if (result.statusCode === 304) {
          return new Response(null, { headers, status: 304 });
        }

        headers.append("Content-Type", result.blob.contentType);
        /* Media.upload rejects SVG, so this should be unreachable — kept
           because an upload rule is a policy that can change, and a stored SVG
           served without it is a script the browser will run. */
        if (result.blob.contentType === "image/svg+xml") {
          headers.append("Content-Security-Policy", "script-src 'none'");
        }

        /* A partial answer carries its own status and range headers; pass
           them through rather than describing the slice a second time. */
        const upstreamRange = result.headers.get("content-range");
        const upstreamLength = result.headers.get("content-length");
        if (upstreamRange) headers.append("Content-Range", upstreamRange);
        if (upstreamLength) headers.append("Content-Length", upstreamLength);
        headers.append("Accept-Ranges", "bytes");

        if (
          collection.upload &&
          typeof collection.upload === "object" &&
          typeof collection.upload.modifyResponseHeaders === "function"
        ) {
          headers = collection.upload.modifyResponseHeaders({ headers }) || headers;
        }

        return new Response(result.stream, {
          headers,
          status: upstreamRange ? 206 : 200,
        });
      } catch (err) {
        if (err instanceof BlobNotFoundError) {
          return new Response(null, { status: 404, statusText: "Not Found" });
        }
        req.payload.logger.error({ err, msg: "Unexpected error in staticHandler" });
        return new Response("Internal Server Error", { status: 500 });
      }
    };

    return {
      name: "vercel-blob-oidc",

      handleUpload: async ({ data, file: { buffer, filename, mimeType } }) => {
        const { fileKey } = getFileKey({
          collectionPrefix: prefix,
          docPrefix: data.prefix,
          filename,
        });

        await put(fileKey, buffer, {
          /* Must match the store's own access mode — see BLOB_ACCESS above. */
          access: BLOB_ACCESS,
          /* Payload already guarantees unique filenames, and a random suffix
             would desynchronise the stored filename from the object. */
          addRandomSuffix: false,
          /* Replacing a file keeps its document, so the same key is written
             again on purpose. */
          allowOverwrite: true,
          cacheControlMaxAge,
          contentType: mimeType,
          /* No `token`: this is what selects OIDC. */
        });

        return data;
      },

      handleDelete: async ({ doc: { prefix: docPrefix = "" }, filename }) => {
        const { fileKey } = getFileKey({
          collectionPrefix: prefix,
          docPrefix,
          filename,
        });
        await del(fileKey);
      },

      staticHandler,
    };
  };
}
