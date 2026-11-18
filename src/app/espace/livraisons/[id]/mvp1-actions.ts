"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import { userActor } from "@/lib/auth/permissions";
import {
  addDeliveryComment,
  openDeliveryDispute,
  resolveDeliveryDispute,
  type DisputeReason,
} from "@/lib/mvp1";

export async function addDeliveryCommentAction(formData: FormData) {
  const user = await requireUser();
  const deliveryId = String(formData.get("deliveryId") ?? "");
  const message = String(formData.get("message") ?? "");

  await addDeliveryComment(db, userActor(user), {
    companyId: user.companyId,
    deliveryId,
    message,
    authorName: user.name,
  });

  revalidatePath(`/espace/livraisons/${deliveryId}`);
}

export async function openDisputeAction(formData: FormData) {
  const user = await requireUser();
  const deliveryId = String(formData.get("deliveryId") ?? "");
  const reason = String(formData.get("reason") ?? "OTHER") as DisputeReason;
  const description = String(formData.get("description") ?? "");

  await openDeliveryDispute(db, userActor(user), {
    companyId: user.companyId,
    deliveryId,
    reason,
    description,
  });

  revalidatePath(`/espace/livraisons/${deliveryId}`);
  revalidatePath(`/espace/litiges`);
}

export async function resolveDisputeAction(formData: FormData) {
  const user = await requireUser();
  const deliveryId = String(formData.get("deliveryId") ?? "");
  const disputeId = String(formData.get("disputeId") ?? "");
  const resolutionNotes = String(formData.get("resolutionNotes") ?? "");
  const status = (String(formData.get("status") ?? "RESOLVED") as "RESOLVED" | "REJECTED");

  await resolveDeliveryDispute(db, userActor(user), {
    companyId: user.companyId,
    disputeId,
    resolutionNotes,
    status,
  });

  revalidatePath(`/espace/livraisons/${deliveryId}`);
  revalidatePath(`/espace/litiges`);
}
