import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Seule l'URL Realtime est exposée au navigateur, jamais NEON_REALTIME_SECRET.
  env: {
    NEXT_PUBLIC_NEON_REALTIME_URL: process.env.NEON_REALTIME_URL ?? "",
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
