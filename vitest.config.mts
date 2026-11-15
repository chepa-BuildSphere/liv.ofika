import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// npm test        → tests unitaires (aucun accès réseau)
// npm run test:db → tests *.db.test.ts sur la branche Neon liée (dev)
export default defineConfig(({ mode }) => {
  const withDb = mode === "db";
  return {
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
      environment: "node",
      setupFiles: ["./vitest.setup.ts"],
      include: withDb ? ["src/**/*.db.test.ts"] : ["src/**/*.test.ts"],
      exclude: withDb ? ["node_modules/**"] : ["src/**/*.db.test.ts", "node_modules/**"],
      testTimeout: 30_000,
      fileParallelism: !withDb,
    },
  };
});
