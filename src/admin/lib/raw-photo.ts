/**
 * A camera RAW file, read just far enough to find the photograph inside it.
 *
 * PURE. A Canon RAW (.CR3, or the older .CR2) is 20–35 MB of sensor data: no
 * browser can show it, sharp cannot resize it and Vercel refuses any request
 * over 4.5 MB. But every one also carries the picture the camera made of it —
 * a full-size JPEG in the camera's own colour, beside a smaller preview and a
 * thumbnail. The admin's upload forms take that JPEG out in the browser
 * (prepare-photo.ts), so the server only ever receives an ordinary photograph
 * and its allow-list (lib/uploads.ts) stays exactly as it is.
 *
 * WHICH WAY IS UP. The camera stores a portrait shot the way the sensor saw
 * it, on its side, and writes the turn it needs into the RAW's own metadata,
 * not into the JPEG. A browser decoding the JPEG alone would show it sideways,
 * so the turn is read here and applied on a canvas. The JPEG's own EXIF
 * orientation, when it has one, is reset to upright first: browsers disagree
 * about applying it, and a turn applied twice is as wrong as none.
 */

/** EXIF orientation: 1 is upright; 2–8 are the mirrored and quarter-turned cases. */
export type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** A JPEG ready to decode the same way in every browser, and the turn it still needs. */
export type EmbeddedPhoto = {
  bytes: Uint8Array;
  width: number;
  height: number;
  orientation: Orientation;
};

type JpegSpan = { start: number; end: number; width: number; height: number };

/* Start-of-frame markers a browser can draw: baseline, extended, progressive.
   Lossless (C3, and CR2's own sensor data is one), hierarchical and
   arithmetic-coded frames are real JPEGs that no browser decodes. */
const DRAWABLE_FRAMES = new Set([0xc0, 0xc1, 0xc2]);
const isFrameMarker = (marker: number) =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

const ORIENTATION_TAG = 0x0112;

/* moov → uuid 85c0b687-820f-11e0-8111-f4ce462b6a48 holds Canon's metadata;
   its CMT1 box is IFD0, the one with the orientation. */
const CANON_METADATA_UUID = [
  0x85, 0xc0, 0xb6, 0x87, 0x82, 0x0f, 0x11, 0xe0, 0x81, 0x11, 0xf4, 0xce, 0x46, 0x2b, 0x6a, 0x48,
];

function viewOf(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function asciiAt(bytes: Uint8Array, at: number, text: string): boolean {
  if (at + text.length > bytes.length) return false;
  for (let k = 0; k < text.length; k++) if (bytes[at + k] !== text.charCodeAt(k)) return false;
  return true;
}

/**
 * Where the JPEG that starts at `start` ends, and its size — or null if it is
 * not a whole JPEG a browser can draw. Segments are skipped by their declared
 * length, so a thumbnail tucked inside the EXIF block is passed over rather
 * than mistaken for the end of the photograph.
 */
function readJpeg(bytes: Uint8Array, start: number): JpegSpan | null {
  let at = start + 2;
  let width = 0;
  let height = 0;
  let scanned = false;
  while (at < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    while (at < bytes.length && bytes[at] === 0xff) at++;
    if (at >= bytes.length) return null;
    const marker = bytes[at++];
    if (marker === 0xd9) return scanned && width > 0 && height > 0 ? { start, end: at, width, height } : null;
    if (marker === 0x00 || marker === 0xd8) return null;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) continue;
    if (at + 2 > bytes.length) return null;
    const length = (bytes[at] << 8) | bytes[at + 1];
    if (length < 2 || at + length > bytes.length) return null;
    if (isFrameMarker(marker)) {
      if (!DRAWABLE_FRAMES.has(marker) || length < 8) return null;
      height = (bytes[at + 3] << 8) | bytes[at + 4];
      width = (bytes[at + 5] << 8) | bytes[at + 6];
    }
    at += length;
    if (marker === 0xda) {
      if (!width) return null;
      scanned = true;
      /* The compressed picture runs to the next marker: an 0xFF that is not a
         stuffed zero, a restart marker or padding before a marker. */
      for (;;) {
        at = bytes.indexOf(0xff, at);
        if (at < 0 || at + 1 >= bytes.length) return null;
        const next = bytes[at + 1];
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) at += 2;
        else if (next === 0xff) at += 1;
        else break;
      }
    }
  }
  return null;
}

/** Every whole, drawable JPEG in the file, the most pixels first. */
function jpegSpans(bytes: Uint8Array): JpegSpan[] {
  const found: JpegSpan[] = [];
  let at = 0;
  while ((at = bytes.indexOf(0xff, at)) >= 0 && at + 3 < bytes.length) {
    if (bytes[at + 1] === 0xd8 && bytes[at + 2] === 0xff) {
      const span = readJpeg(bytes, at);
      if (span) {
        found.push(span);
        at = span.end;
        continue;
      }
    }
    at += 1;
  }
  return found.sort((a, b) => b.width * b.height - a.width * a.height || b.end - b.start - (a.end - a.start));
}

type TiffEntry = { at: number; little: boolean; value: number };

/** IFD0's orientation entry in the TIFF block that starts at `base`. */
function tiffOrientationEntry(bytes: Uint8Array, base: number, limit: number): TiffEntry | null {
  if (base < 0 || base + 8 > limit || limit > bytes.length) return null;
  const little = bytes[base] === 0x49 && bytes[base + 1] === 0x49;
  if (!little && !(bytes[base] === 0x4d && bytes[base + 1] === 0x4d)) return null;
  const view = viewOf(bytes);
  if (view.getUint16(base + 2, little) !== 42) return null;
  const ifd = base + view.getUint32(base + 4, little);
  if (ifd + 2 > limit) return null;
  const count = view.getUint16(ifd, little);
  for (let k = 0; k < count; k++) {
    const entry = ifd + 2 + k * 12;
    if (entry + 12 > limit) return null;
    if (view.getUint16(entry, little) === ORIENTATION_TAG) {
      return { at: entry + 8, little, value: view.getUint16(entry + 8, little) };
    }
  }
  return null;
}

function asOrientation(value: number | undefined): Orientation | null {
  return value !== undefined && value >= 1 && value <= 8 ? (value as Orientation) : null;
}

/** The EXIF block inside a JPEG's header, if it has one. */
function jpegExif(bytes: Uint8Array, span: JpegSpan): { base: number; limit: number } | null {
  let at = span.start + 2;
  while (at + 4 <= span.end && bytes[at] === 0xff) {
    const marker = bytes[at + 1];
    if (marker === 0xda || marker === 0xd9) return null;
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    if (marker === 0xe1 && length >= 16 && asciiAt(bytes, at + 4, "Exif\0\0")) {
      return { base: at + 10, limit: Math.min(at + 2 + length, span.end) };
    }
    at += 2 + length;
  }
  return null;
}

type Box = { type: string; start: number; body: number; end: number };

/** The first child box of `type` between `from` and `to` (ISO base media, as CR3 is). */
function findBox(bytes: Uint8Array, from: number, to: number, type: string, uuid?: number[]): Box | null {
  const view = viewOf(bytes);
  let at = from;
  while (at + 8 <= to) {
    let size = view.getUint32(at);
    let header = 8;
    if (size === 1) {
      if (at + 16 > to) return null;
      size = Number(view.getBigUint64(at + 8));
      header = 16;
    } else if (size === 0) {
      size = to - at;
    }
    if (size < header || at + size > to) return null;
    if (asciiAt(bytes, at + 4, type)) {
      const usertype = at + header;
      if (!uuid) return { type, start: at, body: usertype, end: at + size };
      if (uuid.every((byte, k) => bytes[usertype + k] === byte)) {
        return { type, start: at, body: usertype + 16, end: at + size };
      }
    }
    at += size;
  }
  return null;
}

/** The turn the RAW file itself records for its photograph, if it records one. */
export function rawOrientation(bytes: Uint8Array): Orientation | null {
  /* CR3: an ISO base media file — ftyp, then moov → Canon uuid → CMT1. */
  if (asciiAt(bytes, 4, "ftyp")) {
    const moov = findBox(bytes, 0, bytes.length, "moov");
    const canon = moov && findBox(bytes, moov.body, moov.end, "uuid", CANON_METADATA_UUID);
    const cmt1 = canon && findBox(bytes, canon.body, canon.end, "CMT1");
    return cmt1 ? asOrientation(tiffOrientationEntry(bytes, cmt1.body, cmt1.end)?.value) : null;
  }
  /* CR2 (and any TIFF-based RAW): IFD0 of the file itself. */
  return asOrientation(tiffOrientationEntry(bytes, 0, bytes.length)?.value);
}

/**
 * A JPEG lifted out of a larger file, with its own orientation tag set to
 * upright so every browser decodes it as stored; the turn it needs is
 * returned beside it. `fallback` is the turn recorded outside the JPEG (the
 * RAW's); without one, the JPEG's own tag decides.
 */
function upright(bytes: Uint8Array, span: JpegSpan, fallback: Orientation | null): EmbeddedPhoto {
  const copy = bytes.slice(span.start, span.end);
  const local: JpegSpan = { ...span, start: 0, end: copy.length };
  const exif = jpegExif(copy, local);
  const entry = exif ? tiffOrientationEntry(copy, exif.base, exif.limit) : null;
  if (entry) viewOf(copy).setUint16(entry.at, 1, entry.little);
  return {
    bytes: copy,
    width: span.width,
    height: span.height,
    orientation: fallback ?? asOrientation(entry?.value) ?? 1,
  };
}

/** Every photograph inside a RAW file, the largest first, each ready to decode. */
export function embeddedPhotos(raw: Uint8Array): EmbeddedPhoto[] {
  const orientation = rawOrientation(raw);
  return jpegSpans(raw).map((span) => upright(raw, span, orientation));
}

/** An ordinary JPEG, ready to decode the same way in every browser — or null if it is not one. */
export function uprightJpeg(jpeg: Uint8Array): EmbeddedPhoto | null {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return null;
  const span = readJpeg(jpeg, 0);
  return span ? upright(jpeg, span, null) : null;
}

/**
 * The canvas transform that turns a `width` × `height` picture, drawn at the
 * origin, upright. Quarter turns (5–8) swap the canvas's sides.
 */
export function orientationTransform(
  orientation: Orientation,
  width: number,
  height: number,
): [number, number, number, number, number, number] {
  switch (orientation) {
    case 2:
      return [-1, 0, 0, 1, width, 0];
    case 3:
      return [-1, 0, 0, -1, width, height];
    case 4:
      return [1, 0, 0, -1, 0, height];
    case 5:
      return [0, 1, 1, 0, 0, 0];
    case 6:
      return [0, 1, -1, 0, height, 0];
    case 7:
      return [0, -1, -1, 0, height, width];
    case 8:
      return [0, -1, 1, 0, 0, width];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}
