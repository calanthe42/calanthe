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
