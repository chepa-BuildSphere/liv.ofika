import { and, eq, like, or } from "drizzle-orm";
import { companies, userRoles, users } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import { issueActivationToken } from "@/lib/auth/activation";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { EMAIL_RE, PHONE_RE } from "@/lib/validation";

// Création d'une entreprise et de son premier admin, par l'admin plateforme
// (mvp.md §4.2, note ¹ : l'admin plateforme crée seulement le premier admin).

export type CreateCompanyInput = {
  companyName: string;
  companyPhone?: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
};

export type FieldErrors = Partial<Record<keyof CreateCompanyInput, string>>;

export function validateCreateCompany(input: CreateCompanyInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = input.companyName.trim();
  if (name.length < 2 || name.length > 100) errors.companyName = "Entre 2 et 100 caractères.";
  if (input.companyPhone?.trim() && !PHONE_RE.test(input.companyPhone.trim()))
    errors.companyPhone = "Numéro invalide (ex. +225 07 00 00 00 00).";
  const adminName = input.adminName.trim();
  if (adminName.length < 2 || adminName.length > 100) errors.adminName = "Entre 2 et 100 caractères.";
  if (!EMAIL_RE.test(normalizeEmail(input.adminEmail))) errors.adminEmail = "E-mail invalide.";
  if (input.adminPhone?.trim() && !PHONE_RE.test(input.adminPhone.trim()))
    errors.adminPhone = "Numéro invalide (ex. +225 07 00 00 00 00).";
  return errors;
}

/** "Boutique Chez Awa & Fils" → "boutique-chez-awa-fils" */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return slug || "entreprise";
}

async function uniqueSlug(db: Executor, base: string) {
  const taken = new Set(
    (
      await db
        .select({ slug: companies.slug })
        .from(companies)
        .where(or(eq(companies.slug, base), like(companies.slug, `${base}-%`)))
    ).map((r) => r.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export type CreateCompanyResult =
  | {
      ok: true;
      company: { id: string; name: string; slug: string };
      admin: { id: string; name: string; email: string };
      activationToken: string;
      activationExpiresAt: Date;
    }
  | { ok: false; errors: FieldErrors };

export async function createCompanyWithAdmin(
  db: Executor,
  input: CreateCompanyInput,
  platformAdminId: string,
): Promise<CreateCompanyResult> {
  const errors = validateCreateCompany(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const email = normalizeEmail(input.adminEmail);

  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) return { ok: false, errors: { adminEmail: "Cet e-mail est déjà utilisé par un autre compte." } };

    const name = input.companyName.trim();
    const [company] = await tx
      .insert(companies)
      .values({ name, slug: await uniqueSlug(tx, slugify(name)), phone: input.companyPhone?.trim() || null })
      .returning({ id: companies.id, name: companies.name, slug: companies.slug });

    const [admin] = await tx
      .insert(users)
      .values({
        companyId: company.id,
        name: input.adminName.trim(),
        email,
        phone: input.adminPhone?.trim() || null,
      })
      .returning({ id: users.id, name: users.name, email: users.email });
    await tx.insert(userRoles).values({ userId: admin.id, role: "COMPANY_ADMIN" });

    const { token, expiresAt } = await issueActivationToken(tx, admin.id, { platformAdminId });

    await logEvent(tx, {
      companyId: company.id,
      eventType: "COMPANY_CREATED",
      actorType: "PLATFORM_ADMIN",
      actorId: platformAdminId,
      payload: { name: company.name, slug: company.slug },
    });
    await logEvent(tx, {
      companyId: company.id,
      eventType: "USER_INVITED",
      actorType: "PLATFORM_ADMIN",
      actorId: platformAdminId,
      payload: { userId: admin.id, email: admin.email, roles: ["COMPANY_ADMIN"] },
    });

    return { ok: true, company, admin, activationToken: token, activationExpiresAt: expiresAt };
  });
}

/** Nouveau lien pour un admin d'entreprise pas encore activé (lien perdu ou expiré). */
export async function regenerateActivationLink(db: Executor, userId: string, platformAdminId: string) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id, companyId: users.companyId, activatedAt: users.activatedAt, isActive: users.isActive })
      .from(users)
      .where(and(eq(users.id, userId)))
      .limit(1);
    if (!user || !user.isActive) return { ok: false as const, error: "Utilisateur introuvable." };
    if (user.activatedAt) return { ok: false as const, error: "Ce compte est déjà activé." };

    const issued = await issueActivationToken(tx, user.id, { platformAdminId });
    await logEvent(tx, {
      companyId: user.companyId,
      eventType: "ACTIVATION_LINK_REGENERATED",
      actorType: "PLATFORM_ADMIN",
      actorId: platformAdminId,
      payload: { userId: user.id },
    });
    return { ok: true as const, ...issued };
  });
}
