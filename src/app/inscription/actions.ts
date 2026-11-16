"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { setUserCookie } from "@/lib/auth/user-session";
import {
  registerCompanyWithAdmin,
  type RegisterCompanyInput,
  type RegisterFieldErrors,
} from "@/lib/companies/register-company";
import { getRequestMeta } from "@/lib/request-meta";

export type RegisterState = {
  status?: "idle" | "error";
  errors?: RegisterFieldErrors;
  generalError?: string;
  values?: Partial<Record<keyof RegisterCompanyInput, string>>;
};

export async function registerCompanyAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const companyName = String(formData.get("companyName") ?? "");
  const companyPhone = String(formData.get("companyPhone") ?? "");
  const adminName = String(formData.get("adminName") ?? "");
  const adminEmail = String(formData.get("adminEmail") ?? "");
  const adminPhone = String(formData.get("adminPhone") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");

  const values = {
    companyName,
    companyPhone,
    adminName,
    adminEmail,
    adminPhone,
  };

  const result = await registerCompanyWithAdmin(
    db,
    {
      companyName,
      companyPhone,
      adminName,
      adminEmail,
      adminPhone,
      password,
      passwordConfirmation,
    },
    await getRequestMeta(),
  );

  if (!result.ok) {
    return {
      status: "error",
      errors: result.errors,
      values,
    };
  }

  // Connexion immédiate
  await setUserCookie(result.session.token, result.session.expiresAt);
  redirect("/dashboard");
}
