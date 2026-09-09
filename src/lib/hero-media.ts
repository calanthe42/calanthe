/**
 * HERO MEDIA — configuration for the future hero film.
 *
 * NO VIDEO FILE LIVES IN THIS REPOSITORY, and none ever should: a hero
 * film is tens of megabytes, git stores it forever, and Vercel would
 * serve it from the deployment rather than a CDN. The asset is uploaded
 * once (Vercel Blob, the same store Payload already uses, or any CDN)
 * and its URL is set as an environment variable. Nothing else changes.
 *
 * TO TURN THE HERO FILM ON:
 *
 *   NEXT_PUBLIC_HERO_VIDEO_URL=https://<store>.public.blob.vercel-storage.com/hero.mp4
 *
 * Optionally add a smaller, tighter-cropped portrait encode for phones:
 *
 *   NEXT_PUBLIC_HERO_VIDEO_URL_MOBILE=https://.../hero-portrait.mp4
 *
 * Nothing else is required. With neither set, the hero renders exactly
 * as it does today — the poster photography IS the design, not a
 * placeholder for it, so the page is never waiting on a film that may
 * never arrive.
 *
 * ENCODING GUIDANCE for whoever produces the asset (the frontend cannot
 * enforce this, so it is written down where it will be found):
 *
 *   - 6-10 seconds, seamlessly loopable, no cuts. It is atmosphere, not
 *     a commercial: a slow push across an arrangement, petals settling.
 *   - H.264 High profile, yuv420p, faststart (moov atom at the front,
 *     or the browser downloads the whole file before the first frame).
 *   - Landscape 1920x1080 under ~4 MB. Portrait 1080x1440 under ~2.5 MB.
 *   - NO audio track at all — not a silent one. An absent track is
 *     smaller and removes any chance of an autoplay policy rejection.
 *
 *     ffmpeg -i master.mov -an -c:v libx264 -profile:v high -pix_fmt yuv420p \
 *       -crf 26 -movflags +faststart -vf scale=1920:-2 hero.mp4
 *
 * The poster below is the LCP element and is deliberately unconditional.
 */

/** The landscape encode. Empty string = no film configured. */
export const HERO_VIDEO_SRC = process.env.NEXT_PUBLIC_HERO_VIDEO_URL ?? "";

/**
 * Optional portrait encode for phones. When absent, phones simply keep
 * the poster: a landscape film letterboxed into a 9:16 hero looks worse
 * than the photograph, and costs a phone's data to do it.
 */
export const HERO_VIDEO_SRC_MOBILE =
  process.env.NEXT_PUBLIC_HERO_VIDEO_URL_MOBILE ?? "";

/**
 * The poster — art-directed, not merely resized. Landscape screens get
 * the wide crop, portrait screens the tall one, and the browser
 * downloads only the one it needs.
 */
export const HERO_POSTER = {
  desktop: "/brand/hero-desktop.jpg",
  mobile: "/brand/hero-mobile.jpg",
  width: 1600,
  height: 2000,
  alt: "A Calanthe arrangement of garden roses, daisies and coral blossom in a white vase",
} as const;

export const HAS_HERO_VIDEO = HERO_VIDEO_SRC.length > 0;
