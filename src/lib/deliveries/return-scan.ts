import { parseReferenceQrPayload } from "@/lib/qr/qr-matrix";
import type { FailureReason, ReturnCondition } from "./transitions";

export type ReturningDeliveryItem = {
  id: string;
  reference: string;
  recipientName: string;
  address: string;
  district: string | null;
  packageDescription: string | null;
  amountToCollect: number | null;
  courierId: string | null;
  courierName: string;
  returnDeclaredByCourierId: string | null;
  failureReason: FailureReason | null;
  failureComment: string | null;
  failurePhotoUrl: string | null;
  failedAt: Date | null;
  returningSince: Date;
  canReceive: boolean;
  cannotReceiveReason: string | null;
};

export type CourierReturningGroup = {
  courierId: string | null;
  courierName: string;
  courierPhone: string | null;
  items: ReturningDeliveryItem[];
};

export type ReceivedReturnItem = {
  deliveryId: string;
  reference: string;
  recipientName: string;
  courierName: string | null;
  condition: ReturnCondition;
  comment: string | null;
  photoUrl: string | null;
  receivedAt: Date;
  receivedByName: string;
};

/** Retrouve un colis en retour à partir d'un scan QR (`OFIKA-REF:<ref>:<id>`) ou d'une référence. */
export function matchReturningDeliveryByScan(
  groups: readonly CourierReturningGroup[],
  rawQuery: string,
): ReturningDeliveryItem | null {
  const parsed = parseReferenceQrPayload(rawQuery);
  if (!parsed) return null;
  const allItems = groups.flatMap((g) => g.items);
  if (parsed.deliveryId) {
    return allItems.find((item) => item.id.toLowerCase() === parsed.deliveryId) ?? null;
  }
  const targetRef = parsed.reference.trim().toLowerCase();
  return allItems.find((item) => item.reference.toLowerCase() === targetRef) ?? null;
}
