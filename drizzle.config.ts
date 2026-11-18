import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Charge .env, .env.local… comme le fait Next.js.
loadEnvConfig(process.cwd());

const rawUrl = (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)!;
const url = rawUrl.replace(/([?&]sslmode=)(?:require|prefer|verify-ca)\b/g, "$1verify-full");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    // Migrations : connexion directe (non poolée) recommandée par Neon.
    url,
  },
});
