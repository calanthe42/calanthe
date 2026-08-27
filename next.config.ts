import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stray lockfiles exist higher up the tree; pin the workspace root here.
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    // Curated placeholder photography until the client's own arrives.
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
    ],
  },
};

export default nextConfig;
