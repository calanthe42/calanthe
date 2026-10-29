import { describe, expect, it } from "vitest";
import { embeddedPhotos, orientationTransform, rawOrientation, uprightJpeg, type Orientation } from "./raw-photo";

/**
 * A Canon RAW, read just far enough to find the photograph inside it.
 *
 * The files below are built byte by byte to the same layout a camera writes:
 * a CR3 is ftyp, moov (Canon's metadata uuid, with CMT1 = IFD0) and mdat
 * (the full-size JPEG, the preview, the thumbnail); a CR2 is a TIFF whose
 * IFD0 carries the orientation, followed by its JPEGs and its lossless
 * sensor data. Real files from five Canon bodies were also checked by hand
 * against this parser before it shipped.
 */

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};
const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => Uint8Array.from(text, (c) => c.charCodeAt(0));
const u16be = (n: number) => bytes(n >> 8, n & 0xff);
const u32be = (n: number) => bytes((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);

/** A TIFF block whose IFD0 holds one entry: the orientation. */
function tiff(orientation: number, little = true): Uint8Array {
  const u16 = (n: number) => (little ? bytes(n & 0xff, n >> 8) : u16be(n));
  const u32 = (n: number) => (little ? u32be(n).reverse() : u32be(n));
  return concat(
    little ? ascii("II") : ascii("MM"),
    u16(42),
    u32(8),
    u16(1),
    concat(u16(0x0112), u16(3), u32(1), u16(orientation), u16(0)),
    u32(0),
  );
}

const segment = (marker: number, body: Uint8Array) => concat(bytes(0xff, marker), u16be(body.length + 2), body);

/** A small but structurally whole JPEG. */
function jpeg(options: { width: number; height: number; frame?: number; exif?: Uint8Array } = { width: 8, height: 6 }) {
  const frame = segment(
    options.frame ?? 0xc0,
    concat(bytes(8), u16be(options.height), u16be(options.width), bytes(3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1)),
  );
  const scan = segment(0xda, bytes(3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 0x3f, 0));
  /* Compressed data with a stuffed 0xFF00, a restart marker and padding. */
  const entropy = bytes(0x12, 0xff, 0x00, 0x34, 0xff, 0xd0, 0x56, 0xff, 0xff);
  return concat(
    bytes(0xff, 0xd8),
    options.exif ? segment(0xe1, concat(ascii("Exif\0\0"), options.exif)) : new Uint8Array(),
    frame,
    scan,
    entropy,
    bytes(0xd9),
  );
}

const box = (type: string, ...children: Uint8Array[]) => {
  const body = concat(...children);
  return concat(u32be(body.length + 8), ascii(type), body);
};
const CANON_UUID = bytes(0x85, 0xc0, 0xb6, 0x87, 0x82, 0x0f, 0x11, 0xe0, 0x81, 0x11, 0xf4, 0xce, 0x46, 0x2b, 0x6a, 0x48);

function cr3(orientation: number | null, ...pictures: Uint8Array[]) {
  const metadata = orientation === null ? box("CNCV", ascii("CanonCR3")) : box("CMT1", tiff(orientation));
  return concat(
    box("ftyp", ascii("crx "), u32be(1), ascii("crx isom")),
    box("moov", box("uuid", CANON_UUID, box("CNCV", ascii("CanonCR3_001")), metadata), box("mvhd", new Uint8Array(20))),
    box("mdat", ...pictures),
  );
}

describe("embeddedPhotos", () => {
  it("finds every picture in a CR3, the largest first, and the turn its CMT1 records", () => {
    const full = jpeg({ width: 6000, height: 4000 });
    const raw = cr3(6, jpeg({ width: 160, height: 120 }), full, bytes(0x00, 0xff, 0xd8, 0x11), jpeg({ width: 1620, height: 1080 }));

    const photos = embeddedPhotos(raw);
    expect(photos.map((p) => `${p.width}x${p.height}`)).toEqual(["6000x4000", "1620x1080", "160x120"]);
    expect(photos.every((p) => p.orientation === 6)).toBe(true);
    expect(photos[0].bytes).toEqual(full);
    expect(rawOrientation(raw)).toBe(6);
  });

  it("reads a CR2's orientation from its own IFD0, and passes over its lossless sensor data", () => {
    const raw = concat(tiff(8), jpeg({ width: 5184, height: 3456 }), jpeg({ width: 5300, height: 3500, frame: 0xc3 }));

    const photos = embeddedPhotos(raw);
    expect(photos).toHaveLength(1);
    expect(photos[0]).toMatchObject({ width: 5184, height: 3456, orientation: 8 });
  });

  it("reads a big-endian TIFF too", () => {
    expect(rawOrientation(concat(tiff(3, false), jpeg()))).toBe(3);
  });

  it("puts the RAW's turn first, and resets the JPEG's own tag so no browser turns it again", () => {
    const inner = jpeg({ width: 4000, height: 3000, exif: tiff(3) });
    const raw = cr3(6, inner);
    const before = raw.slice();

    const [photo] = embeddedPhotos(raw);
    expect(photo.orientation).toBe(6);
    expect(uprightJpeg(photo.bytes)?.orientation).toBe(1);
    expect(raw).toEqual(before);
  });

  it("falls back to the JPEG's own turn when the RAW records none", () => {
    const [photo] = embeddedPhotos(cr3(null, jpeg({ width: 4000, height: 3000, exif: tiff(8) })));
    expect(photo.orientation).toBe(8);
    expect(uprightJpeg(photo.bytes)?.orientation).toBe(1);
  });

  it("does not take a thumbnail inside the EXIF block for the end of the photograph", () => {
    const thumbnail = jpeg({ width: 160, height: 120 });
    const outer = jpeg({ width: 6000, height: 4000, exif: concat(tiff(1), thumbnail) });

    const photos = embeddedPhotos(cr3(1, outer));
    expect(photos).toHaveLength(1);
    expect(photos[0].bytes.length).toBe(outer.length);
  });

  it("follows 64-bit and run-to-the-end box sizes", () => {
    const picture = jpeg({ width: 3000, height: 2000 });
    const moov = box("moov", box("uuid", CANON_UUID, box("CMT1", tiff(6))));
    const largeMdat = concat(u32be(1), ascii("mdat"), u32be(0), u32be(picture.length + 16), picture);
    expect(rawOrientation(concat(box("ftyp", ascii("crx ")), largeMdat, moov))).toBe(6);

    const toTheEnd = concat(box("ftyp", ascii("crx ")), moov, u32be(0), ascii("mdat"), picture);
    expect(rawOrientation(toTheEnd)).toBe(6);
    expect(embeddedPhotos(toTheEnd)).toHaveLength(1);
  });

  it("finds nothing in a truncated JPEG or in noise", () => {
    const whole = jpeg({ width: 6000, height: 4000 });
    expect(embeddedPhotos(cr3(1, whole.slice(0, whole.length - 2)))).toEqual([]);

    let seed = 7;
    const noise = Uint8Array.from({ length: 200_000 }, () => (seed = (seed * 1103515245 + 12345) >>> 0) >>> 24);
    expect(embeddedPhotos(noise)).toEqual([]);
    expect(rawOrientation(noise)).toBeNull();
  });
});

describe("uprightJpeg", () => {
  it("is null for anything that is not a JPEG", () => {
    expect(uprightJpeg(ascii("\x89PNG\r\n\x1a\n"))).toBeNull();
  });

  it("leaves a JPEG with no EXIF as it was, upright", () => {
    const plain = jpeg({ width: 10, height: 10 });
    expect(uprightJpeg(plain)).toMatchObject({ orientation: 1, bytes: plain });
  });
});

describe("orientationTransform", () => {
  /* A 3 × 2 picture, and how each EXIF orientation shows it upright. */
  const source = ["abc", "def"];
  const upright: Record<Orientation, string[]> = {
    1: ["abc", "def"],
    2: ["cba", "fed"],
    3: ["fed", "cba"],
    4: ["def", "abc"],
    5: ["ad", "be", "cf"],
    6: ["da", "eb", "fc"],
    7: ["fc", "eb", "da"],
    8: ["cf", "be", "ad"],
  };

  it.each(Object.keys(upright).map(Number) as Orientation[])("draws orientation %i upright", (orientation) => {
    const [a, b, c, d, e, f] = orientationTransform(orientation, 3, 2);
    const turned = orientation >= 5;
    const out = Array.from({ length: turned ? 3 : 2 }, () => Array<string>(turned ? 2 : 3).fill("?"));
    source.forEach((row, y) =>
      [...row].forEach((pixel, x) => {
        const px = a * (x + 0.5) + c * (y + 0.5) + e;
        const py = b * (x + 0.5) + d * (y + 0.5) + f;
        out[Math.floor(py)][Math.floor(px)] = pixel;
      }),
    );
    expect(out.map((row) => row.join(""))).toEqual(upright[orientation]);
  });
});
