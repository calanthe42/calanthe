import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stray lockfiles exist higher up the tree; pin the workspace root here.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
