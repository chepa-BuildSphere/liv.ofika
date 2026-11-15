"use server";

import { db } from "@/db";
import { activationUrl } from "@/lib/app-url";
import { requireAdmin } from "@/lib/auth/admin-session";
import { assertCan, platformAdminActor } from "@/lib/auth/permissions";
import {
  createCompanyWithAdmin,
  regenerateActivationLink,
  type CreateCompanyInput,
  type FieldErrors,
} from "@/lib/companies/create-company";

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
