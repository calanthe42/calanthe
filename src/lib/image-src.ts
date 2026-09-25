/**
 * Is this image source one `next/image` will actually accept?
 *
 * WHY THIS EXISTS. `next/image` does not degrade. Handed a remote URL whose
 * host is not in `images.remotePatterns`, it **throws during render**, and in
 * a Server Component that means the whole page returns 500 — a product page
 * lost to one bad row in the media table. This project has already produced
 * exactly such a row: a media record written by a local session carried a
 * `http://localhost:3000/...` URL, which no deployment can fetch and which is
 * in no remote pattern.
 *
 * So the check happens before the URL reaches `next/image`, and anything it
 * would reject becomes the botanical placeholder instead. A missing
 * photograph is a quiet gap in a page; a thrown one is no page at all.
 *
 * MUST STAY IN STEP with `images.remotePatterns` in next.config.ts.
 */

/** Hosts `next/image` is configured to optimise. */
const REMOTE_PATTERNS: readonly { protocol: "https"; hostname: string }[] = [
  { protocol: "https", hostname: "images.unsplash.com" },
  { protocol: "https", hostname: "images.pexels.com" },
  { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
];

export type ImageSrcVerdict =
  | { kind: "ok"; src: string }
  /** No photograph was ever set. Normal, and not worth reporting. */
  | { kind: "absent" }
  /** A photograph was set that cannot be rendered. Worth reporting. */
  | { kind: "unusable"; src: string; reason: string };

function hostMatches(pattern: string, hostname: string): boolean {
  if (pattern === hostname) return true;
  if (!pattern.startsWith("*.")) return false;
  /* `*.example.com` matches one or more leading labels, never the bare
     apex — the same rule Next applies. */
  const suffix = pattern.slice(1); // ".example.com"
  return hostname.endsWith(suffix) && hostname.length > suffix.length;
}

export function checkImageSrc(src: string | null | undefined): ImageSrcVerdict {
  if (src === null || src === undefined) return { kind: "absent" };

  const trimmed = src.trim();
  if (trimmed === "") return { kind: "absent" };

  /* Same-origin paths are always optimisable, and are what Payload's media
     route produces. A protocol-relative URL is not a path. */
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) {
      return { kind: "unusable", src: trimmed, reason: "protocol-relative URL" };
    }
    return { kind: "ok", src: trimmed };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { kind: "unusable", src: trimmed, reason: "not a URL and not a path" };
  }

  if (url.protocol !== "https:") {
    return {
      kind: "unusable",
      src: trimmed,
      /* The localhost case: a media row written by a local dev session. */
      reason: `protocol ${url.protocol.replace(":", "")} is not https`,
    };
  }

  const allowed = REMOTE_PATTERNS.some((p) => hostMatches(p.hostname, url.hostname));
  if (!allowed) {
    return {
      kind: "unusable",
      src: trimmed,
      reason: `host ${url.hostname} is not in images.remotePatterns`,
    };
  }

  return { kind: "ok", src: trimmed };
}

/**
 * Say so, once per distinct source, without taking the page down.
 *
 * Sentry is used when it is configured; otherwise a warning. Deduplicated
 * because a broken image on a shop grid would otherwise report twenty times
 * per render and drown the signal it is meant to raise.
 */
const reported = new Set<string>();

export function reportUnusableImage(src: string, reason: string, where?: string): void {
  const key = `${src}|${reason}`;
  if (reported.has(key)) return;
  reported.add(key);
  /* Bounded: a page cannot be made to leak memory by varying its image URLs. */
  if (reported.size > 500) reported.clear();

  const message = `[image] unusable source, showing placeholder instead: ${reason}${
    where ? ` (${where})` : ""
  } — ${src.slice(0, 200)}`;

  console.warn(message);

  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureMessage(message, "warning");
    })
    .catch(() => {
      /* Sentry not installed or not configured — the warning above stands. */
    });
}
