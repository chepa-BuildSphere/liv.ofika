"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { logoutCompanyUser } from "@/lib/auth/company-user";
import { clearUserCookie, readUserToken } from "@/lib/auth/user-session";
import { getRequestMeta } from "@/lib/request-meta";

export async function userLogoutAction() {
  await logoutCompanyUser(db, await readUserToken(), await getRequestMeta());
  await clearUserCookie();
  redirect("/connexion");
}
