"use server";

import { db } from "@/db";
import { env } from "@/env";
import { getCurrentCourier } from "@/lib/auth/courier-session";
import {
  scanDeliveryQrToken,
  type GpsCoordsInput,
  type ScanQrResult,
} from "@/lib/deliveries/deliveries";
import { getRequestMeta } from "@/lib/request-meta";

export async function scanClientQrAction(
  rawToken: string,
  rawDeviceSignals: string,
  gps: GpsCoordsInput | null,
): Promise<ScanQrResult> {
  const meta = await getRequestMeta(rawDeviceSignals);
  const currentCourier = await getCurrentCourier();
  return scanDeliveryQrToken(
    db,
    rawToken,
    {
      deviceFingerprint: meta.deviceFingerprint,
      courierIdFromCookie: currentCourier?.id ?? null,
      gps,
      ip: meta.ip,
      userAgent: meta.userAgent,
    },
    env.encryptionKey,
  );
}
