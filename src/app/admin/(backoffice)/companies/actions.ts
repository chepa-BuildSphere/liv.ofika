"use server";

import { refresh, revalidatePath, updateTag } from "next/cache";
import { db } from "@/db";
import { activationUrl } from "@/lib/app-url";
import { requireAdmin } from "@/lib/auth/admin-session";
import { assertCan, platformAdminActor } from "@/lib/auth/permissions";
import {
  BillingError,
  generateMonthlyStatement,
  markMonthlyStatementPaid,
  PLATFORM_PRICE_CACHE_TAG,
  setCompanyDeliveryPrice,
  setPlatformPricePerDelivery,
  toggleCompanyBilling,
} from "@/lib/billing/billing";
import {
  createCompanyWithAdmin,
  regenerateActivationLink,
  type CreateCompanyInput,
  type FieldErrors,
} from "@/lib/companies/create-company";
import { getRequestMeta } from "@/lib/request-meta";

export type ActivationLink = { url: string; expiresAt: string; adminName: string; adminPhone: string | null };

export type CreateCompanyState =
  | { status: "idle" }
  | { status: "error"; errors: FieldErrors; values: CreateCompanyInput }
  | { status: "created"; companyId: string; companyName: string; link: ActivationLink };

export async function createCompanyAction(_prev: CreateCompanyState, formData: FormData): Promise<CreateCompanyState> {
  const admin = await requireAdmin(); // re-vérifié ici : ne jamais se fier au formulaire
  assertCan(platformAdminActor(admin), "company.createOrSuspend", undefined);

  const values: CreateCompanyInput = {
    companyName: String(formData.get("companyName") ?? ""),
    companyPhone: String(formData.get("companyPhone") ?? ""),
    adminName: String(formData.get("adminName") ?? ""),
    adminEmail: String(formData.get("adminEmail") ?? ""),
    adminPhone: String(formData.get("adminPhone") ?? ""),
  };

  const result = await createCompanyWithAdmin(db, values, admin.id);
  if (!result.ok) return { status: "error", errors: result.errors, values };

  return {
    status: "created",
    companyId: result.company.id,
    companyName: result.company.name,
    link: {
      url: activationUrl(result.activationToken),
      expiresAt: result.activationExpiresAt.toISOString(),
      adminName: result.admin.name,
      adminPhone: values.adminPhone?.trim() || null,
    },
  };
}

export type RegenerateState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; url: string; expiresAt: string };

export async function regenerateLinkAction(_prev: RegenerateState, formData: FormData): Promise<RegenerateState> {
  const admin = await requireAdmin();
  const result = await regenerateActivationLink(db, String(formData.get("userId") ?? ""), admin.id);
  if (!result.ok) return { status: "error", message: result.error };
  return { status: "done", url: activationUrl(result.token), expiresAt: result.expiresAt.toISOString() };
}

export type BillingMutationState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; message: string };

export async function toggleBillingAction(
  _prev: BillingMutationState,
  formData: FormData,
): Promise<BillingMutationState> {
  const admin = await requireAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const nextEnabled = String(formData.get("billingEnabled") ?? "") === "true";

  try {
    const res = await toggleCompanyBilling(db, admin, companyId, nextEnabled, await getRequestMeta());
    refresh();
    return {
      status: "done",
      message: res.billingEnabled ? "Facturation activée (ON)." : "Facturation désactivée (OFF, période gratuite).",
    };
  } catch (e) {
    if (e instanceof BillingError) return { status: "error", message: e.message };
    throw e;
  }
}

export async function setPriceAction(
  _prev: BillingMutationState,
  formData: FormData,
): Promise<BillingMutationState> {
  const admin = await requireAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const pricePerDelivery = String(formData.get("pricePerDelivery") ?? "");
  const syncPlatformPrice = formData.get("syncPlatformPrice") !== "false";

  try {
    const meta = await getRequestMeta();
    const res = await setCompanyDeliveryPrice(
      db,
      admin,
      companyId,
      pricePerDelivery,
      meta,
    );
    if (syncPlatformPrice) {
      await setPlatformPricePerDelivery(db, admin, res.pricePerDelivery, {
        applyToExistingCompanies: false,
        meta,
      });
    }
    updateTag(PLATFORM_PRICE_CACHE_TAG);
    revalidatePath("/");
    revalidatePath("/register");
    revalidatePath("/inscription");
    revalidatePath("/admin");
    revalidatePath("/admin/facturation");
    refresh();
    return {
      status: "done",
      message: `Tarif mis à jour : ${res.pricePerDelivery.toLocaleString("fr-FR")} F CFA / livraison.`,
    };
  } catch (e) {
    if (e instanceof BillingError) return { status: "error", message: e.message };
    throw e;
  }
}

export async function setPlatformPriceAction(
  _prev: BillingMutationState,
  formData: FormData,
): Promise<BillingMutationState> {
  const admin = await requireAdmin();
  const pricePerDelivery = String(formData.get("pricePerDelivery") ?? "");
  const applyToExistingCompanies = formData.get("applyToExistingCompanies") === "true";

  try {
    const res = await setPlatformPricePerDelivery(db, admin, pricePerDelivery, {
      applyToExistingCompanies,
      meta: await getRequestMeta(),
    });
    updateTag(PLATFORM_PRICE_CACHE_TAG);
    revalidatePath("/");
    revalidatePath("/register");
    revalidatePath("/inscription");
    revalidatePath("/admin");
    revalidatePath("/admin/facturation");
    refresh();
    return {
      status: "done",
      message: `Tarif plateforme enregistré : ${res.pricePerDelivery.toLocaleString("fr-FR")} F CFA / livraison (affiché sur la page d'accueil${
        res.updatedCompaniesCount > 0
          ? ` et appliqué à ${res.updatedCompaniesCount} entreprise(s)`
          : ""
      }).`,
    };
  } catch (e) {
    if (e instanceof BillingError) return { status: "error", message: e.message };
    throw e;
  }
}

export async function generateStatementAction(
  _prev: BillingMutationState,
  formData: FormData,
): Promise<BillingMutationState> {
  const admin = await requireAdmin();
  const companyId = String(formData.get("companyId") ?? "");
  const period = String(formData.get("period") ?? "");
  const issue = String(formData.get("issue") ?? "") === "true";

  try {
    const st = await generateMonthlyStatement(db, admin, companyId, period, {
      issue,
      meta: await getRequestMeta(),
    });
    refresh();
    return {
      status: "done",
      message: `Relevé ${st.period.slice(0, 7)} enregistré (${st.totalAmount.toLocaleString("fr-FR")} F CFA).`,
    };
  } catch (e) {
    if (e instanceof BillingError) return { status: "error", message: e.message };
    throw e;
  }
}

export async function markStatementPaidAction(
  _prev: BillingMutationState,
  formData: FormData,
): Promise<BillingMutationState> {
  const admin = await requireAdmin();
  const statementId = String(formData.get("statementId") ?? "");

  try {
    const res = await markMonthlyStatementPaid(db, admin, statementId, await getRequestMeta());
    refresh();
    return {
      status: "done",
      message: `Relevé ${res.statement.period.slice(0, 7)} marqué comme payé.`,
    };
  } catch (e) {
    if (e instanceof BillingError) return { status: "error", message: e.message };
    throw e;
  }
}
