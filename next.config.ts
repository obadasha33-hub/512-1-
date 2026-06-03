import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use the default server output (not standalone) so server.js can serve the
  // .next build directly. Standalone output was caching stale route chunks on
  // Railway because the config was being overwritten after COPY in the Dockerfile.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;













