// Garde statique du cloisonnement : lit tout le code serveur et refuse toute
// requête sur une table d'entreprise qui ne passe pas par tenantScope.
//
// Une requête est acceptée si :
//   - elle passe par `tenantScope(...)` (filtre company_id imposé), ou
//   - une des 3 lignes au-dessus contient `tenant-guard:` + la raison, ou
//   - son fichier est dans ALLOWED ci-dessous, avec la raison écrite.
// Ajouter une exception = l'écrire ici, visible en revue de code.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { TENANT_TABLES } from "./scope";

const ROOT = join(__dirname, "..", "..");

const ALLOWED: Record<string, string> = {
  "lib/tenant/scope.ts": "le point d'accès cloisonné lui-même",
  "lib/audit/index.ts": "la chaîne d'audit est unique pour toute la plateforme (vérification d'intégrité)",
  "lib/auth/company-user.ts": "connexion : l'e-mail est cherché dans toutes les entreprises, puis la session par identifiant",
  "lib/auth/activation.ts": "lien d'activation : l'utilisateur est retrouvé par son jeton, avant toute connexion",
  "lib/companies/create-company.ts": "l'admin plateforme crée l'entreprise et son premier admin",
  "lib/companies/register-company.ts": "auto-inscription publique : création autonome d'une entreprise et de son premier admin",
  "app/admin/": "back-office plateforme : lecture support, journalisée (tâche 1.7)",
};

const QUERY_RE = new RegExp(
  String.raw`\.(from|update|insert|delete|innerJoin|leftJoin|rightJoin|fullJoin)\(\s*(${Object.keys(TENANT_TABLES).join("|")})\b`,
  "g",
);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "schema" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

function isAllowed(file: string) {
  return Object.keys(ALLOWED).some((allowed) => (allowed.endsWith("/") ? file.startsWith(allowed) : file === allowed));
}

type Violation = { file: string; line: number; code: string };

/** Requêtes non cloisonnées d'un fichier (et nombre de requêtes examinées). */
function violationsIn(file: string, text: string): { violations: Violation[]; checked: number } {
  const violations: Violation[] = [];
  let checked = 0;
  for (const m of text.matchAll(QUERY_RE)) {
    checked++;
    if (isAllowed(file)) continue;
    const index = m.index ?? 0;
    // L'instruction : du début de la chaîne de requête jusqu'au « ; »
    const start = Math.max(0, text.lastIndexOf("\n", Math.max(0, index - 200)));
    const end = text.indexOf(";", index);
    const statement = text.slice(start, end === -1 ? undefined : end);
    const lineNo = text.slice(0, index).split("\n").length;
    const above = text.split("\n").slice(Math.max(0, lineNo - 4), lineNo - 1).join("\n");
    if (statement.includes("tenantScope(") || above.includes("tenant-guard:")) continue;
    violations.push({ file, line: lineNo, code: m[0] });
  }
  return { violations, checked };
}

function findViolations() {
  const all = sourceFiles(ROOT).map((path) =>
    violationsIn(relative(ROOT, path).split(sep).join("/"), readFileSync(path, "utf8")),
  );
  return { violations: all.flatMap((r) => r.violations), checked: all.reduce((n, r) => n + r.checked, 0) };
}

describe("la garde sait reconnaître une faute", () => {
  it("signale une requête sans filtre", () => {
    const code = `const rows = await db.select().from(deliveries).where(eq(deliveries.id, id));`;
    expect(violationsIn("lib/x.ts", code).violations).toHaveLength(1);
  });

  it("signale une jointure, une mise à jour et une insertion directes", () => {
    const code = [
      `await db.select().from(x).innerJoin(users, eq(users.id, x.userId));`,
      `await db.update(apiKeys).set({ revokedAt: now });`,
      `await db.insert(webhookEndpoints).values(v);`,
    ].join("\n");
    expect(violationsIn("lib/x.ts", code).violations).toHaveLength(3);
  });

  it("accepte tenantScope et une exception justifiée", () => {
    const scoped = `await db.select().from(deliveries).where(tenantScope(db, c).filter(deliveries));`;
    const justified = `// tenant-guard: global — raison\nawait db.select().from(users).where(eq(users.email, e));`;
    expect(violationsIn("lib/x.ts", scoped).violations).toHaveLength(0);
    expect(violationsIn("lib/x.ts", justified).violations).toHaveLength(0);
  });
});

describe("cloisonnement : aucune requête directe sur une table d'entreprise", () => {
  it("toutes les requêtes passent par tenantScope ou une exception justifiée", () => {
    const { violations, checked } = findViolations();
    expect(checked, "le test doit trouver des requêtes à contrôler").toBeGreaterThan(0);
    expect(
      violations,
      `Requêtes sans filtre company_id :\n${violations.map((v) => `  src/${v.file}:${v.line}  ${v.code}`).join("\n")}\n` +
        "→ passer par tenantScope(db, companyId), ou justifier avec un commentaire « tenant-guard: <raison> ».",
    ).toEqual([]);
  });

  it("chaque exception est encore utile (pas de fichier fantôme dans ALLOWED)", () => {
    const files = sourceFiles(ROOT).map((p) => relative(ROOT, p).split(sep).join("/"));
    for (const allowed of Object.keys(ALLOWED)) {
      expect(files.some((f) => (allowed.endsWith("/") ? f.startsWith(allowed) : f === allowed)), allowed).toBe(true);
    }
  });
});
