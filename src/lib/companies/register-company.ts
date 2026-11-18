import { eq, like, or } from "drizzle-orm";
import { companies, userRoles, users } from "@/db/schema";
import { logEvent, type Executor } from "@/lib/audit";
import { USER_SESSION_TTL_MS } from "@/lib/auth/company-user";
import { normalizeEmail } from "@/lib/auth/platform-admin";
import { createSession, type SessionMeta } from "@/lib/auth/sessions";
import { getPlatformPricePerDelivery } from "@/lib/billing/billing";
import { hashSecret } from "@/lib/security";
import { EMAIL_RE, PHONE_RE } from "@/lib/validation";

export const MIN_PASSWORD_LENGTH = 10;

export type RegisterCompanyInput = {
  companyName: string;
  companyPhone?: string;
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
  password: string;
  passwordConfirmation: string;
};

export type RegisterFieldErrors = Partial<Record<keyof RegisterCompanyInput, string>>;

export function validateRegisterCompany(input: RegisterCompanyInput): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};

  const cName = input.companyName.trim();
  if (cName.length < 2 || cName.length > 100) {
    errors.companyName = "Le nom de l'entreprise doit contenir entre 2 et 100 caractères.";
  }

  if (input.companyPhone?.trim() && !PHONE_RE.test(input.companyPhone.trim())) {
    errors.companyPhone = "Numéro de téléphone invalide (ex: +225 07 00 00 00 00).";
  }

  const aName = input.adminName.trim();
  if (aName.length < 2 || aName.length > 100) {
    errors.adminName = "Votre nom complet doit contenir entre 2 et 100 caractères.";
  }

  const normEmail = normalizeEmail(input.adminEmail);
  if (!EMAIL_RE.test(normEmail)) {
    errors.adminEmail = "Veuillez renseigner une adresse e-mail professionnelle valide.";
  }

  if (input.adminPhone?.trim() && !PHONE_RE.test(input.adminPhone.trim())) {
    errors.adminPhone = "Numéro de mobile invalide (ex: +225 07 00 00 00 00).";
  }

  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Le mot de passe doit comporter au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }

  if (input.password !== input.passwordConfirmation) {
    errors.passwordConfirmation = "Les mots de passe ne correspondent pas.";
  }

  return errors;
}

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
  // tenant-guard: unicité de slug globale entre toutes les entreprises
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

export type RegisterCompanyResult =
  | {
      ok: true;
      company: { id: string; name: string; slug: string };
      admin: { id: string; name: string; email: string };
      session: { token: string; expiresAt: Date };
    }
  | { ok: false; errors: RegisterFieldErrors };

export async function registerCompanyWithAdmin(
  db: Executor,
  input: RegisterCompanyInput,
  meta: SessionMeta = {},
): Promise<RegisterCompanyResult> {
  const errors = validateRegisterCompany(input);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const email = normalizeEmail(input.adminEmail);

  return db.transaction(async (tx) => {
    // tenant-guard: vérification de l'unicité globale de l'adresse e-mail avant inscription
    const [existing] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return {
        ok: false,
        errors: { adminEmail: "Cette adresse e-mail est déjà associée à un compte existant." },
      };
    }

    const cName = input.companyName.trim();
    const slug = await uniqueSlug(tx, slugify(cName));
    const defaultPrice = await getPlatformPricePerDelivery(tx);

    // tenant-guard: création d'entreprise autonome avec le tarif plateforme en vigueur en base
    const [company] = await tx
      .insert(companies)
      .values({
        name: cName,
        slug,
        phone: input.companyPhone?.trim() || null,
        status: "ACTIVE",
        billingEnabled: true,
        pricePerDelivery: defaultPrice,
      })
      .returning({ id: companies.id, name: companies.name, slug: companies.slug });

    const passwordHash = await hashSecret(input.password);
    const now = new Date();

    // tenant-guard: création du premier administrateur avec activation immédiate
    const [admin] = await tx
      .insert(users)
      .values({
        companyId: company.id,
        name: input.adminName.trim(),
        email,
        phone: input.adminPhone?.trim() || null,
        passwordHash,
        isActive: true,
        activatedAt: now,
      })
      .returning({ id: users.id, name: users.name, email: users.email });

    // tenant-guard: attribution du rôle COMPANY_ADMIN au créateur de l'entreprise
    await tx.insert(userRoles).values({ userId: admin.id, role: "COMPANY_ADMIN" });

    // Journal d'audit cryptographique
    await logEvent(tx, {
      companyId: company.id,
      eventType: "COMPANY_REGISTERED",
      actorType: "USER",
      actorId: admin.id,
      payload: { name: company.name, slug: company.slug, selfService: true },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await logEvent(tx, {
      companyId: company.id,
      eventType: "USER_REGISTERED",
      actorType: "USER",
      actorId: admin.id,
      payload: { userId: admin.id, email: admin.email, role: "COMPANY_ADMIN" },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    // Création automatique de la session utilisateur pour accès immédiat
    const session = await createSession(
      tx,
      { kind: "user", id: admin.id },
      USER_SESSION_TTL_MS,
      meta,
    );

    return {
      ok: true,
      company,
      admin,
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    };
  });
}
