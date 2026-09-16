import type { Adapter, StaticHandler } from "@payloadcms/plugin-cloud-storage/types";
import { getFileKey, getFilePrefix } from "@payloadcms/plugin-cloud-storage/utilities";
import { BlobNotFoundError, del, head, put } from "@vercel/blob";
import { getRangeRequestInfo } from "payload/internal";

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
 * Payload's own access-controlled route. Leaving it out also means nothing here
 * has to guess the `https://<hash>.public.blob.vercel-storage.com` hostname —
 * `head()` reports the real URL, and `head()`/`del()` take a pathname.
 */

type AdapterArgs = {
  /** Seconds. Matches the value the storefront's images are cached for. */
  cacheControlMaxAge: number;
};

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

        /* By pathname: the blob's public hostname is never constructed here. */
        const blob = await head(fileKey);
        const uploadedAt = blob.uploadedAt.toISOString();
        const ETag = `"${fileKey}-${uploadedAt}"`;

        const rangeResult = getRangeRequestInfo({
          fileSize: blob.size,
          rangeHeader: req.headers.get("range"),
        });
        if (rangeResult.type === "invalid") {
          return new Response(null, {
            headers: new Headers(rangeResult.headers),
            status: rangeResult.status,
          });
        }

        let headers = new Headers(incomingHeaders);
        for (const [key, value] of Object.entries(rangeResult.headers)) {
          headers.append(key, value);
        }
        headers.append("Cache-Control", `public, max-age=${cacheControlMaxAge}`);
        headers.append("Content-Disposition", blob.contentDisposition);
        headers.append("Content-Type", blob.contentType);
        headers.append("ETag", ETag);
        /* Media.upload rejects SVG, so this should be unreachable — kept
           because an upload rule is a policy that can change, and a stored SVG
           served without it is a script the browser will run. */
        if (blob.contentType === "image/svg+xml") {
          headers.append("Content-Security-Policy", "script-src 'none'");
        }
        if (
          collection.upload &&
          typeof collection.upload === "object" &&
          typeof collection.upload.modifyResponseHeaders === "function"
        ) {
          headers = collection.upload.modifyResponseHeaders({ headers }) || headers;
        }

        const etagFromHeaders =
          req.headers.get("etag") || req.headers.get("if-none-match");
        if (etagFromHeaders && etagFromHeaders === ETag) {
          return new Response(null, { headers, status: 304 });
        }

        /* `blob.url` is the canonical public URL reported by the store. The
           timestamp busts any intermediate cache holding a replaced file. */
        const response = await fetch(`${blob.url}?${uploadedAt}`, {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            Pragma: "no-cache",
            ...(rangeResult.type === "partial" && {
              Range: `bytes=${rangeResult.rangeStart}-${rangeResult.rangeEnd}`,
            }),
          },
        });
        if (!response.ok || !response.body) {
          return new Response(null, { status: 204, statusText: "No Content" });
        }

        headers.append("Last-Modified", uploadedAt);
        return new Response(response.body, { headers, status: rangeResult.status });
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
          /* Vercel Blob supports `public` only. The day private blobs exist,
             this is the line to revisit (docs/DATABASE.md §3). */
          access: "public",
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
