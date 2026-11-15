import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  // Declare your Neon services here
  preview: {
    realtime: true,
  },
  auth: false,
  functions: {
    hello: { name: "Hello World", source: "./functions/hello.ts" },
  },
  // Branch policy: per-branch tuning
  branch: (branch) => {
    if (branch.isDefault) {
      // Default branch: no overrides, uses project defaults
      return {};
    }
    if (branch.name === "dev") {
      // Branche de développement permanente : pas d'expiration
      return {};
    }
    if (!branch.exists) {
      // New non-default branches (branches de test) : auto-expire
      // Run `neon checkout <name>` to create a new branch with these settings
      return { ttl: "7d" };
    }
    // Existing branch: no changes
    return {};
  },
});
