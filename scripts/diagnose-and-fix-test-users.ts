import { existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);

async function main() {
  const { db, pool } = await import("../src/db");
  const { users, companies, userRoles } = await import("../src/db/schema");
  const { eq, inArray } = await import("drizzle-orm");
  const { hashSecret, verifySecret } = await import("../src/lib/security");
  const { loginCompanyUser } = await import("../src/lib/auth/company-user");

  console.log("=== DIAGNOSTIC DES COMPTES B2B ===");
  const testEmails = ["awa.e2e@ofika.test", "kofi.e2e@ofika.test"];
  const fixedPassword = "Ofika-Test-2026!";

  // 1. Chercher ou créer une entreprise active de test
  let [testCompany] = await db
    .select()
    .from(companies)
    .where(eq(companies.slug, "ofika-test-co"))
    .limit(1);

  if (!testCompany) {
    // Prendre la première entreprise active
    const [firstCompany] = await db
      .select()
      .from(companies)
      .where(eq(companies.status, "ACTIVE"))
      .limit(1);

    if (firstCompany) {
      testCompany = firstCompany;
      console.log(`Utilisation de l'entreprise existante : ${testCompany.name} (${testCompany.id})`);
    } else {
      const [created] = await db
        .insert(companies)
        .values({
          name: "Maison Kora Mode Abidjan",
          slug: "kora-mode",
          phone: "+2250700112233",
          status: "ACTIVE",
          billingEnabled: true,
          pricePerDelivery: 10,
        })
        .returning();
      testCompany = created;
      console.log(`Nouvelle entreprise créée : ${testCompany.name}`);
    }
  }

  // 2. Vérifier ou configurer Awa (COMPANY_ADMIN)
  const passwordHash = await hashSecret(fixedPassword);

  let [awa] = await db.select().from(users).where(eq(users.email, "awa.e2e@ofika.test")).limit(1);
  if (!awa) {
    const [newAwa] = await db
      .insert(users)
      .values({
        companyId: testCompany.id,
        name: "Awa Touré (Admin)",
        email: "awa.e2e@ofika.test",
        phone: "+2250701020304",
        passwordHash,
        isActive: true,
        activatedAt: new Date(),
      })
      .returning();
    awa = newAwa;
    await db.insert(userRoles).values({
      userId: awa.id,
      role: "COMPANY_ADMIN",
    });
    console.log("✔ Compte Awa Touré créé avec le rôle COMPANY_ADMIN");
  } else {
    // S'assurer qu'elle est bien activée, active, liée à une boîte active et a le mot de passe exact
    await db
      .update(users)
      .set({
        companyId: testCompany.id,
        passwordHash,
        isActive: true,
        activatedAt: awa.activatedAt ?? new Date(),
      })
      .where(eq(users.id, awa.id));

    // Vérifier son rôle
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, awa.id));
    if (!roles.some((r) => r.role === "COMPANY_ADMIN")) {
      await db.insert(userRoles).values({ userId: awa.id, role: "COMPANY_ADMIN" });
    }
    console.log("✔ Compte Awa Touré mis à jour (mot de passe resynchronisé)");
  }

  // 3. Vérifier ou configurer Kofi (MANAGER)
  let [kofi] = await db.select().from(users).where(eq(users.email, "kofi.e2e@ofika.test")).limit(1);
  if (!kofi) {
    const [newKofi] = await db
      .insert(users)
      .values({
        companyId: testCompany.id,
        name: "Koffi N'Goran (Gestionnaire)",
        email: "kofi.e2e@ofika.test",
        phone: "+2250705060708",
        passwordHash,
        isActive: true,
        activatedAt: new Date(),
      })
      .returning();
    kofi = newKofi;
    await db.insert(userRoles).values({
      userId: kofi.id,
      role: "MANAGER",
    });
    console.log("✔ Compte Kofi N'Goran créé avec le rôle MANAGER");
  } else {
    await db
      .update(users)
      .set({
        companyId: testCompany.id,
        passwordHash,
        isActive: true,
        activatedAt: kofi.activatedAt ?? new Date(),
      })
      .where(eq(users.id, kofi.id));

    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, kofi.id));
    if (!roles.some((r) => r.role === "MANAGER")) {
      await db.insert(userRoles).values({ userId: kofi.id, role: "MANAGER" });
    }
    console.log("✔ Compte Kofi N'Goran mis à jour (mot de passe resynchronisé)");
  }

  // 4. Tester immédiatement l'authentification avec `loginCompanyUser`
  console.log("\n=== TEST DE CONNEXION DIRECTE ===");
  const testAwa = await loginCompanyUser(db, "awa.e2e@ofika.test", fixedPassword);
  console.log("Test Login Awa Touré :", testAwa.ok ? "SUCCÈS (Token OK)" : `ÉCHEC (${testAwa.error})`);

  const testKofi = await loginCompanyUser(db, "kofi.e2e@ofika.test", fixedPassword);
  console.log("Test Login Kofi N'Goran :", testKofi.ok ? "SUCCÈS (Token OK)" : `ÉCHEC (${testKofi.error})`);

  await pool.end();
  console.log("\nDiagnostic et synchronisation terminés avec succès !");
  process.exit(0);
}

main().catch((err) => {
  console.error("ERREUR:", err);
  process.exit(1);
});
