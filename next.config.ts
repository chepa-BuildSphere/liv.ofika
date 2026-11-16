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
  async rewrites() {
    return [
      { source: "/register", destination: "/inscription" },
      { source: "/login", destination: "/connexion" },
      { source: "/courier", destination: "/livreur" },
      { source: "/courier/login", destination: "/livreur/connexion" },
      { source: "/courier/first-access", destination: "/livreur/premier-acces" },
      { source: "/dashboard", destination: "/espace" },
      { source: "/dashboard/:path*", destination: "/espace/:path*" },
      { source: "/activate/:token", destination: "/activer/:token" },
    ];
  },
  async redirects() {
    return [
      { source: "/inscription", destination: "/register", permanent: true },
      { source: "/connexion", destination: "/login", permanent: true },
      { source: "/livreur", destination: "/courier", permanent: true },
      { source: "/livreur/connexion", destination: "/courier/login", permanent: true },
      { source: "/livreur/premier-acces", destination: "/courier/first-access", permanent: true },
      { source: "/espace", destination: "/dashboard", permanent: true },
      { source: "/espace/:path*", destination: "/dashboard/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
