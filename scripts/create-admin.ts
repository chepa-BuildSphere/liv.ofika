// Crée un admin plateforme sur la branche Neon liée.
// Usage : npm run admin:create -- --email toi@exemple.com --name "Ton nom"
// Le mot de passe est généré et affiché UNE seule fois (ou fourni via ADMIN_PASSWORD).
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

async function main() {
  const { values } = parseArgs({ options: { email: { type: "string" }, name: { type: "string" } } });
  if (!values.email || !values.name) {
    throw new Error('Usage : npm run admin:create -- --email toi@exemple.com --name "Ton nom"');
  }

  const { db, pool } = await import("../src/db");
  const { createPlatformAdmin } = await import("../src/lib/auth/platform-admin");
  const { randomToken } = await import("../src/lib/security");

  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD ?? randomToken(18);

  const admin = await createPlatformAdmin(db, { email: values.email, name: values.name, password });
  await pool.end();

  console.log(`\n✔ Admin plateforme créé sur la branche ${process.env.NEON_BRANCH}`);
  console.log(`  E-mail       : ${admin.email}`);
  if (generated) {
    console.log(`  Mot de passe : ${password}`);
    console.log("\n  ⚠ Notez-le maintenant (gestionnaire de mots de passe) : il ne sera plus affiché.");
  }
  console.log(`  Connexion    : ${process.env.APP_URL ?? "http://localhost:5000"}/admin/login\n`);
}

main().catch((e) => {
  const msg = (e as Error).message;
  console.error("✘", msg.includes("platform_admins_email_unique") ? "Cet e-mail a déjà un compte admin." : msg);
  process.exit(1);
});
