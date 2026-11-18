"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import { userActor } from "@/lib/auth/permissions";
import { reconcileCashHandover } from "@/lib/mvp1";

export async function recordCashHandoverAction(formData: FormData) {
  const user = await requireUser();
  const courierId = String(formData.get("courierId") ?? "");
  const handedOverAmount = parseInt(String(formData.get("handedOverAmount") ?? "0"), 10);
  const notes = String(formData.get("notes") ?? "");

  await reconcileCashHandover(db, userActor(user), {
    companyId: user.companyId,
    courierId,
    handedOverAmount,
    notes,
  });

  revalidatePath("/espace/encaissements");
  revalidatePath("/espace/livreurs");
}
