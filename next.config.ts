import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  // Stray lockfiles exist higher up the tree; pin the workspace root here.
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  experimental: {
    // Two root layouts ((frontend) + (payload)) mean genuinely unmatched
    // routes bypass both — global-not-found.tsx is the only way to give
    // them the brand 404 instead of Next's bare default.
    globalNotFound: true,

    /* THE MEDIA UPLOAD 413.
       Photographs reach the server through a Server Action (the admin's
       upload form and Payload's own `/cms` upload both post the file in the
       request body). Next.js caps a Server Action body at 1 MB by default and
       answers 413 "Body exceeded 1mb limit" *inside the framework*, before any
       route code runs — so the admin's own 4 MB rule and its readable error
       message were unreachable, and every real photograph failed.
       4.5 MB is Vercel's own hard cap on a serverless request body; anything
       larger is refused by the platform no matter what is configured here.
       Sitting just under it makes MAX_UPLOAD_BYTES (4 MB, enforced in
       backend/payload/storage.ts and Media.upload.limits) the limit a person
       actually meets, with a sentence explaining it.
       Raising the ceiling ABOVE 4.5 MB needs browser-to-Blob uploads, which
       is a different piece of work — see docs/DEPLOYMENT.md §4. */
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  images: {
    // Curated placeholder photography until the client's own arrives.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      /* Vercel Blob. Payload currently serves media through its own
         same-origin route, so this is not strictly needed today — it is here
         so that enabling `disablePayloadAccessControl` later (which switches
         to direct CDN URLs) does not silently break every image on the site. */
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default withPayload(nextConfig);
