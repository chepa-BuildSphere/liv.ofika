import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Charge .env, .env.local… comme le fait Next.js.
loadEnvConfig(process.cwd());

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    // Migrations : connexion directe (non poolée) recommandée par Neon.
    url: (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)!,
  },
});
