import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Regular output: server.js (custom Socket.IO + Next.js) serves everything.
  // Standalone output is NOT used because our custom server.js provides
  // Socket.IO, game-engine, and legacy auth routes that must be bundled.
  typescript: {
    // Ignore node_modules type errors in all builds; catch app-level errors in CI.
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
