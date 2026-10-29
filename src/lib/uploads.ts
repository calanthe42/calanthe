/**
 * The upload limit, in one place, importable from the browser.
 *
 * It is enforced in three layers, and they must agree or a person meets a
 * failure nobody explains:
 *
 * 1. The admin's upload forms prepare a photo before sending it
 *    (admin/lib/prepare-photo.ts): a camera RAW becomes the JPEG inside it,
 *    and a photo over the limit is made smaller. What still does not fit is
 *    refused instantly with a sentence rather than a network error.
 * 2. `backend/actions/admin.ts` checks it on the server, because a browser
 *    check is a courtesy, not a control.
 * 3. `payload.config.ts` passes it to `Media.upload.limits`, which covers the
 *    `/cms` panel and the REST API too.
 *
 * WHY 4 MB. Vercel refuses any serverless request body over 4.5 MB, and a
 * Server Action body is additionally capped by `serverActions.bodySizeLimit`
 * in next.config.ts (4.5 MB there). 4 MB leaves room for the rest of the
 * multipart payload and keeps the limit a round number in the copy.
 *
 * Raising it past 4.5 MB is not a config change: it needs the browser to
 * upload straight to Blob. See docs/DEPLOYMENT.md §4.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** The photograph formats the atelier can upload. SVG is deliberately absent. */
export const UPLOAD_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

/**
 * Canon's RAW formats. Never sent to the server, so never on the allow-list
 * above: the admin's upload forms send the camera's own full-size JPEG from
 * inside the file instead (admin/lib/raw-photo.ts).
 */
export const CAMERA_RAW_EXTENSIONS = [".cr3", ".cr2"] as const;
const CAMERA_RAW_MIME_TYPES = ["image/x-canon-cr3", "image/x-canon-cr2"];

/** What the upload forms' file pickers offer. */
export const UPLOAD_ACCEPT = [...UPLOAD_MIME_TYPES, ...CAMERA_RAW_EXTENSIONS, ...CAMERA_RAW_MIME_TYPES].join(",");

/** `true` when a chosen file is too large to send. */
export function isOverUploadLimit(file: File): boolean {
  return file.size > MAX_UPLOAD_BYTES;
}

/**
 * `true` for a Canon RAW. By name first: Windows reports no type at all for a
 * .CR3 unless Canon's own software is installed.
 */
export function isCameraRaw(file: { name: string; type: string }): boolean {
  const name = file.name.toLowerCase();
  return (
    CAMERA_RAW_EXTENSIONS.some((extension) => name.endsWith(extension)) ||
    CAMERA_RAW_MIME_TYPES.includes(file.type.toLowerCase())
  );
}
