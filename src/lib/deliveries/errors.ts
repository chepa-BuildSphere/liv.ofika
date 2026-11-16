export type DeliveryErrorCode =
  | "FORBIDDEN"
  | "INVALID"
  | "DUPLICATE_REFERENCE"
  | "NOT_FOUND"
  | "AFTER_PICKUP";

export type DeliveryField =
  | "reference"
  | "recipientName"
  | "recipientPhone"
  | "address"
  | "district"
  | "packageDescription"
  | "amountToCollect"
  | "comment"
  | "metadata"
  | "proofMode"
  | "courierId"
  | "failureReason"
  | "afterFailure"
  | "photoUrl"
  | "condition"
  | "reason"
  | "attachmentUrl";

export class DeliveryError extends Error {
  constructor(
    readonly code: DeliveryErrorCode,
    message: string,
    readonly fields?: Partial<Record<DeliveryField, string>>,
  ) {
    super(message);
    this.name = "DeliveryError";
  }
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type GpsCoordsInput = {
  lat?: number | string | null;
  lng?: number | string | null;
  accuracy?: number | string | null;
};

function parseFiniteNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const n = typeof value === "number" ? value : Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

/** Valide et normalise des coordonnées GPS, ou marque explicitement GPS absent. */
export function normalizeGpsCoords(raw?: GpsCoordsInput | null): {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  gpsMissing: boolean;
} {
  const lat = parseFiniteNumber(raw?.lat);
  const lng = parseFiniteNumber(raw?.lng);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { lat: null, lng: null, accuracy: null, gpsMissing: true };
  }
  const rawAccuracy = parseFiniteNumber(raw?.accuracy);
  const accuracy = rawAccuracy !== null && rawAccuracy >= 0 ? rawAccuracy : null;
  return { lat, lng, accuracy, gpsMissing: false };
}
