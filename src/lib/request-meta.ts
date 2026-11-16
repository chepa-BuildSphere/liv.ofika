import "server-only";
import { headers } from "next/headers";
import type { SessionMeta } from "@/lib/auth/sessions";
import { computeDeviceFingerprint, parseClientDeviceSignals } from "@/lib/security";

/** IP, navigateur et empreinte d'appareil de la requête en cours, pour l'audit et les sessions. */
export async function getRequestMeta(rawDeviceSignals?: FormDataEntryValue | string | null): Promise<SessionMeta> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const headerUserAgent = h.get("user-agent");
  const client = parseClientDeviceSignals(typeof rawDeviceSignals === "string" ? rawDeviceSignals : null);

  const userAgent = headerUserAgent || client.userAgent || null;
  const deviceFingerprint = computeDeviceFingerprint({
    ...client,
    userAgent,
    platform: client.platform ?? h.get("sec-ch-ua-platform"),
    model: client.model ?? h.get("sec-ch-ua-model"),
    language: client.language ?? h.get("accept-language"),
  });

  return {
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent,
    deviceFingerprint,
  };
}
