"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import {
  DeliveryError,
  receiveDeliveryReturn,
  type DeliveryField,
} from "@/lib/deliveries/deliveries";
import { getRequestMeta } from "@/lib/request-meta";

type Fields = Partial<Record<DeliveryField, string>>;

export type ReceiveReturnState =
  | { status: "idle" }
  | { status: "error"; deliveryId: string; message: string; fields?: Fields }
  | { status: "done"; deliveryId: string; reference: string };

export async function receiveReturnAction(
  _prev: ReceiveReturnState,
  formData: FormData,
): Promise<ReceiveReturnState> {
  const actor = await requireUser();
  const deliveryId = String(formData.get("deliveryId") ?? "");
  const condition = String(formData.get("condition") ?? "");
  const comment = String(formData.get("comment") ?? "");
  const photoUrl = String(formData.get("photoUrl") ?? "");

  try {
    const res = await receiveDeliveryReturn(
      db,
      actor,
      { deliveryId, condition, comment, photoUrl },
      await getRequestMeta(),
    );
    refresh();
    return {
      status: "done",
      deliveryId,
      reference: res.delivery.reference,
    };
  } catch (e) {
    if (e instanceof DeliveryError) {
      return {
        status: "error",
        deliveryId,
        message: e.message,
        fields: e.fields,
      };
    }
    throw e;
  }
}
