"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { env } from "@/env";
import { requireCourier } from "@/lib/auth/courier-session";
import { courierActor } from "@/lib/auth/permissions";
import {
  chooseCourierAfterFailure,
  confirmCourierPickup,
  declareCourierArrived,
  declareCourierFailure,
  DeliveryError,
  issueDeliveryQrToken,
  verifyDeliveryHandoverCode,
  type AfterFailureChoice,
} from "@/lib/deliveries/deliveries";
import { addDeliveryComment, verifyReverseQrHandover } from "@/lib/mvp1";
import { getRequestMeta } from "@/lib/request-meta";

export type ConfirmPickupState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; message: string; pickedUpCount: number };

export async function confirmPickupAction(
  _prev: ConfirmPickupState,
  formData: FormData,
): Promise<ConfirmPickupState> {
  const courier = await requireCourier();
  const ids = formData
    .getAll("deliveryIds")
    .map((v) => String(v).trim())
    .filter(Boolean);

  try {
    const res = await confirmCourierPickup(db, courier, ids, await getRequestMeta());
    refresh();
    return {
      status: "done",
      pickedUpCount: res.pickedUpCount,
      message:
        res.pickedUpCount > 1
          ? `${res.pickedUpCount} colis pris en charge.`
          : "Colis pris en charge.",
    };
  } catch (e) {
    if (e instanceof DeliveryError) {
      return { status: "error", message: e.message };
    }
    throw e;
  }
}

export type DeclareArrivedState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; message: string; attemptNumber: number; gpsMissing: boolean };

export async function declareArrivedAction(
  _prev: DeclareArrivedState,
  formData: FormData,
): Promise<DeclareArrivedState> {
  const courier = await requireCourier();
  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  const lat = formData.get("lat")?.toString() ?? null;
  const lng = formData.get("lng")?.toString() ?? null;
  const accuracy = formData.get("accuracy")?.toString() ?? null;

  try {
    const res = await declareCourierArrived(
      db,
      courier,
      deliveryId,
      { lat, lng, accuracy },
      await getRequestMeta(),
    );
    refresh();
    return {
      status: "done",
      attemptNumber: res.attempt.attemptNumber,
      gpsMissing: res.gpsMissing,
      message: res.gpsMissing
        ? `Arrivée enregistrée (tentative n°${res.attempt.attemptNumber} · GPS absent).`
        : `Arrivée enregistrée avec position GPS (tentative n°${res.attempt.attemptNumber}).`,
    };
  } catch (e) {
    if (e instanceof DeliveryError) {
      return { status: "error", message: e.message };
    }
    throw e;
  }
}

export type GenerateQrState =
  | { status: "idle" }
  | { status: "error"; deliveryId: string; message: string }
  | {
      status: "ready";
      deliveryId: string;
      qrTokenId: string;
      qrSvg: string;
      expiresAtIso: string;
      attemptNumber: number;
      revokedPreviousCount: number;
    };

export async function generateQrAction(
  _prev: GenerateQrState,
  formData: FormData,
): Promise<GenerateQrState> {
  const courier = await requireCourier();
  const deliveryId = String(formData.get("deliveryId") ?? "").trim();

  try {
    const issued = await issueDeliveryQrToken(db, courier, deliveryId, {
      appUrl: env.appUrl,
      ...(await getRequestMeta()),
    });
    return {
      status: "ready",
      deliveryId,
      qrTokenId: issued.qrTokenId,
      qrSvg: issued.qrSvg,
      expiresAtIso: issued.expiresAt.toISOString(),
      attemptNumber: issued.attemptNumber,
      revokedPreviousCount: issued.revokedPreviousCount,
    };
  } catch (e) {
    if (e instanceof DeliveryError) {
      return { status: "error", deliveryId, message: e.message };
    }
    throw e;
  }
}

export type VerifyHandoverState =
  | { status: "idle" }
  | { status: "error"; deliveryId: string; code?: string; message: string }
  | {
      status: "delivered";
      deliveryId: string;
      message: string;
      suspiciousDeviceReuse: boolean;
    };

export async function verifyHandoverCodeAction(
  _prev: VerifyHandoverState,
  formData: FormData,
): Promise<VerifyHandoverState> {
  const courier = await requireCourier();
  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const lat = formData.get("lat")?.toString() ?? null;
  const lng = formData.get("lng")?.toString() ?? null;
  const accuracy = formData.get("accuracy")?.toString() ?? null;

  const photoUrl = formData.get("photoUrl") ? String(formData.get("photoUrl")) : null;
  const signatureUrl = formData.get("signatureUrl") ? String(formData.get("signatureUrl")) : null;
  const recipientName = formData.get("recipientName") ? String(formData.get("recipientName")) : null;
  const rawAmount = formData.get("amountCollected") ? String(formData.get("amountCollected")).trim() : "";
  const amountCollected = rawAmount ? parseInt(rawAmount, 10) : null;
  const paymentMethod = (formData.get("paymentMethod")
    ? String(formData.get("paymentMethod"))
    : null) as "CASH" | "WAVE" | "ORANGE_MONEY" | "MTN_MOMO" | "MOOV_MONEY" | "OTHER" | null;
  const paymentReference = formData.get("paymentReference")
    ? String(formData.get("paymentReference"))
    : null;

  try {
    const meta = await getRequestMeta();
    const res = await verifyDeliveryHandoverCode(
      db,
      courier,
      {
        deliveryId,
        code,
        gps: { lat, lng, accuracy },
        ip: meta.ip,
        userAgent: meta.userAgent,
        photoUrl,
        signatureUrl,
        recipientName,
        amountCollected,
        paymentMethod,
        paymentReference,
      },
      env.encryptionKey,
    );

    if (!res.ok) {
      return {
        status: "error",
        deliveryId,
        code: res.code,
        message: res.message,
      };
    }

    refresh();
    return {
      status: "delivered",
      deliveryId,
      message: "Livré ✅ — Colis confirmé et verrouillé.",
      suspiciousDeviceReuse: res.suspiciousDeviceReuse,
    };
  } catch (e) {
    if (e instanceof DeliveryError) {
      return { status: "error", deliveryId, message: e.message };
    }
    throw e;
  }
}

export async function verifyReverseQrAction(
  _prev: VerifyHandoverState,
  formData: FormData,
): Promise<VerifyHandoverState> {
  const courier = await requireCourier();
  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  const scannedPayload = String(formData.get("scannedPayload") ?? "").trim();
  const photoUrl = formData.get("photoUrl") ? String(formData.get("photoUrl")) : null;
  const signatureUrl = formData.get("signatureUrl") ? String(formData.get("signatureUrl")) : null;
  const recipientName = formData.get("recipientName") ? String(formData.get("recipientName")) : null;
  const rawAmount = formData.get("amountCollected") ? String(formData.get("amountCollected")).trim() : "";
  const amountCollected = rawAmount ? parseInt(rawAmount, 10) : null;
  const paymentMethod = (formData.get("paymentMethod")
    ? String(formData.get("paymentMethod"))
    : null) as "CASH" | "WAVE" | "ORANGE_MONEY" | "MTN_MOMO" | "MOOV_MONEY" | "OTHER" | null;
  const paymentReference = formData.get("paymentReference")
    ? String(formData.get("paymentReference"))
    : null;
  const lat = formData.get("lat")?.toString() ?? null;
  const lng = formData.get("lng")?.toString() ?? null;
  const accuracy = formData.get("accuracy")?.toString() ?? null;

  try {
    const meta = await getRequestMeta();
    await verifyReverseQrHandover(db, courier, {
      deliveryId,
      scannedPayload,
      gps: { lat, lng, accuracy },
      ip: meta.ip,
      userAgent: meta.userAgent,
      photoUrl,
      signatureUrl,
      recipientName,
      amountCollected,
      paymentMethod,
      paymentReference,
    });
    refresh();
    return {
      status: "delivered",
      deliveryId,
      message: "Livré (QR Inversé) ✅ — Colis confirmé et verrouillé.",
      suspiciousDeviceReuse: false,
    };
  } catch (e) {
    if (e instanceof DeliveryError) {
      return { status: "error", deliveryId, message: e.message };
    }
    throw e;
  }
}

export async function addCourierCommentAction(formData: FormData) {
  const courier = await requireCourier();
  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  const companyId = String(formData.get("companyId") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  await addDeliveryComment(db, courierActor(courier), {
    companyId,
    deliveryId,
    message,
    authorName: courier.name ?? "Livreur",
  });
  refresh();
}

export type DeclareFailureState =
  | { status: "idle" }
  | { status: "error"; deliveryId: string; message: string }
  | { status: "done"; deliveryId: string; message: string };

export async function declareFailureAction(
  _prev: DeclareFailureState,
  formData: FormData,
): Promise<DeclareFailureState> {
  const courier = await requireCourier();
  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  const failureReason = String(formData.get("failureReason") ?? "").trim();
  const comment = String(formData.get("comment") ?? "");
  const photoUrl = String(formData.get("photoUrl") ?? "");
  const afterFailure = String(formData.get("afterFailure") ?? "").trim() || null;
  const lat = formData.get("lat")?.toString() ?? null;
  const lng = formData.get("lng")?.toString() ?? null;
  const accuracy = formData.get("accuracy")?.toString() ?? null;

  try {
    const meta = await getRequestMeta();
    const res = await declareCourierFailure(
      db,
      courier,
      {
        deliveryId,
        failureReason,
        comment,
        photoUrl,
        afterFailure,
        gps: { lat, lng, accuracy },
      },
      { ip: meta.ip, userAgent: meta.userAgent },
    );
    refresh();
    const nextMsg =
      res.delivery.status === "PICKED_UP"
        ? "Échec enregistré — nouvelle tentative démarrée."
        : res.delivery.status === "RETURNING"
          ? "Échec enregistré — colis marqué en retour au dépôt."
          : `Échec enregistré (tentative n°${res.attempt.attemptNumber}).`;
    return { status: "done", deliveryId, message: nextMsg };
  } catch (e) {
    if (e instanceof DeliveryError) {
      return { status: "error", deliveryId, message: e.message };
    }
    throw e;
  }
}

export type AfterFailureState =
  | { status: "idle" }
  | { status: "error"; deliveryId: string; message: string }
  | { status: "done"; deliveryId: string; message: string };

export async function chooseAfterFailureAction(
  _prev: AfterFailureState,
  formData: FormData,
): Promise<AfterFailureState> {
  const courier = await requireCourier();
  const deliveryId = String(formData.get("deliveryId") ?? "").trim();
  const afterFailure = String(formData.get("afterFailure") ?? "").trim() as AfterFailureChoice;

  try {
    const meta = await getRequestMeta();
    const res = await chooseCourierAfterFailure(db, courier, deliveryId, afterFailure, {
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    refresh();
    return {
      status: "done",
      deliveryId,
      message:
        res.afterFailure === "RETRY"
          ? "Nouvelle tentative prête — cliquez sur « Arrivé » chez le destinataire."
          : "Colis marqué en retour au dépôt.",
    };
  } catch (e) {
    if (e instanceof DeliveryError) {
      return { status: "error", deliveryId, message: e.message };
    }
    throw e;
  }
}
