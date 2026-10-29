import "client-only";
import { MAX_UPLOAD_BYTES, UPLOAD_MIME_TYPES, isCameraRaw } from "@/lib/uploads";
import { embeddedPhotos, orientationTransform, uprightJpeg, type Orientation } from "./raw-photo";

/**
 * A chosen photo, made ready to upload — in the browser, before it is sent.
 *
 * - A Canon RAW (.CR3, .CR2) becomes the full-size JPEG the camera made of
 *   it (raw-photo.ts), the right way up and small enough to send.
 * - An ordinary photo over the 4 MB limit — a camera JPEG is often 6–12 MB —
 *   is made smaller instead of being refused.
 * - Anything else is sent exactly as chosen: a photo that already fits is
 *   never re-compressed.
 *
 * The server's rules do not change. It still accepts only the web formats in
 * lib/uploads.ts, up to 4 MB, and still checks both itself.
 */

export type PreparedPhoto =
  | { ok: true; file: File }
  | { ok: false; message: string; code: string };

/* Wider than the largest size sharp makes (hero, 1600) with room for a
   retina screen, and comfortably under 4 MB as a JPEG. */
const LONG_EDGE = 2560;
/* A RAW's thumbnail (160 × 120) is not a product photograph. Its preview
   (1620 × 1080) is acceptable when the full-size picture cannot be read. */
const SMALLEST_USABLE_EDGE = 1000;
const QUALITIES = [0.88, 0.8] as const;
const EDGE_STEPS = [1, 0.8, 0.64, 0.5] as const;

const NO_PHOTO_IN_RAW: PreparedPhoto = {
  ok: false,
  message:
    "This RAW file has no full-size photo inside that the browser can read. Export it as a JPEG from your camera app, then upload the JPEG.",
  code: "actions.media.rawNoPhoto",
};
const COULD_NOT_PREPARE: PreparedPhoto = {
  ok: false,
  message: "This photo could not be prepared for upload. Save it as a JPEG and try again.",
  code: "actions.media.prepareFailed",
};

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (isCameraRaw(file)) return fromCameraRaw(file);
  if (file.size <= MAX_UPLOAD_BYTES || !(UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: true, file };
  }
  return smaller(file);
}

async function fromCameraRaw(file: File): Promise<PreparedPhoto> {
  const raw = new Uint8Array(await file.arrayBuffer());
  const photos = embeddedPhotos(raw).filter((photo) => Math.max(photo.width, photo.height) >= SMALLEST_USABLE_EDGE);
  /* Largest first; a picture this browser cannot decode gives way to the next. */
  for (const photo of photos) {
    const jpeg = await render(new Blob([photo.bytes as BlobPart], { type: "image/jpeg" }), photo.orientation, photo);
    if (jpeg) return { ok: true, file: asJpegFile(jpeg, file) };
  }
  return NO_PHOTO_IN_RAW;
}

async function smaller(file: File): Promise<PreparedPhoto> {
  if (file.type === "image/jpeg") {
    const photo = uprightJpeg(new Uint8Array(await file.arrayBuffer()));
    if (photo) {
      const jpeg = await render(new Blob([photo.bytes as BlobPart], { type: "image/jpeg" }), photo.orientation, photo);
      return jpeg ? { ok: true, file: asJpegFile(jpeg, file) } : COULD_NOT_PREPARE;
    }
  }
  /* PNG, WebP, AVIF: the browser applies any turn they record itself. */
  const jpeg = await render(file, 1);
  return jpeg ? { ok: true, file: asJpegFile(jpeg, file) } : COULD_NOT_PREPARE;
}

function asJpegFile(jpeg: Blob, original: File): File {
  const stem = original.name.replace(/\.[^./\\]*$/, "") || "photo";
  return new File([jpeg], `${stem}.jpg`, { type: "image/jpeg", lastModified: original.lastModified });
}

/** Fit `width` × `height` inside a square of `edge`, never enlarging. */
function fit(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Decode, turn upright, shrink and encode as a JPEG under the limit — or null
 * when this browser cannot decode the picture at all.
 */
async function render(
  source: Blob,
  orientation: Orientation,
  stored?: { width: number; height: number },
): Promise<Blob | null> {
  const bitmap = await decode(source, stored && fit(stored.width, stored.height, LONG_EDGE));
  if (!bitmap) return null;
  try {
    const longest = Math.min(LONG_EDGE, Math.max(bitmap.width, bitmap.height));
    for (const step of EDGE_STEPS) {
      for (const quality of QUALITIES) {
        const jpeg = await encode(bitmap, orientation, Math.round(longest * step), quality);
        if (jpeg && jpeg.size <= MAX_UPLOAD_BYTES) return jpeg;
      }
    }
    return null;
  } finally {
    bitmap.close();
  }
}

/* Decoding straight to the target size spares a phone a 24-megapixel bitmap.
   A browser that ignores the size returns the full picture, which `encode`
   scales down anyway. */
async function decode(source: Blob, size?: { width: number; height: number }): Promise<ImageBitmap | null> {
  if (size) {
    try {
      return await createImageBitmap(source, {
        resizeWidth: size.width,
        resizeHeight: size.height,
        resizeQuality: "high",
      });
    } catch {
      /* Falls through to a plain decode. */
    }
  }
  try {
    return await createImageBitmap(source);
  } catch {
    return null;
  }
}

function encode(bitmap: ImageBitmap, orientation: Orientation, edge: number, quality: number): Promise<Blob | null> {
  const { width, height } = fit(bitmap.width, bitmap.height, edge);
  const turned = orientation >= 5;
  const canvas = document.createElement("canvas");
  canvas.width = turned ? height : width;
  canvas.height = turned ? width : height;
  const context = canvas.getContext("2d");
  if (!context) return Promise.resolve(null);
  /* A transparent PNG would otherwise turn black as a JPEG. */
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(...orientationTransform(orientation, width, height));
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve) =>
    canvas.toBlob(
      (blob) => {
        /* Safari keeps a canvas's memory until it is resized to nothing. */
        canvas.width = 0;
        canvas.height = 0;
        resolve(blob);
      },
      "image/jpeg",
      quality,
    ),
  );
}
