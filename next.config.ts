import path from "path";
import type { NextConfig } from "next";
import { withPayload } from "@payloadcms/next/withPayload";

const nextConfig: NextConfig = {
  // Stray lockfiles exist higher up the tree; pin the workspace root here.
  turbopack: {
    root: path.join(__dirname),
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
    ],
  },
};

export default withPayload(nextConfig);
