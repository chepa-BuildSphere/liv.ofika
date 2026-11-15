import { createHash } from "node:crypto";

// Calcul pur du chaînage, sans base de données (testable seul).
// hash = SHA-256( "ofika-audit-v1" + prev_hash + contenu canonique de l'événement )

export type AuditContent = {
  companyId: string | null;
  deliveryId: string | null;
  eventType: string;
  actorType: string;
  actorId: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  payload: unknown;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  ip: string | null;
  userAgent: string | null;
  serverTime: Date;
};

/** JSON stable : clés triées à chaque niveau, undefined → absent, comme jsonb. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
    return `{${entries.join(",")}}`;
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Nombre non fini interdit dans le journal d'audit");
  }
  return JSON.stringify(value);
}

export function computeAuditHash(prevHash: string | null, e: AuditContent): string {
  const content = canonicalJson({
    companyId: e.companyId,
    deliveryId: e.deliveryId,
    eventType: e.eventType,
    actorType: e.actorType,
    actorId: e.actorId,
    fromStatus: e.fromStatus,
    toStatus: e.toStatus,
    payload: e.payload ?? null,
    lat: e.lat,
    lng: e.lng,
    accuracy: e.accuracy,
    ip: e.ip,
    userAgent: e.userAgent,
    serverTime: e.serverTime,
  });
  return createHash("sha256")
    .update("ofika-audit-v1\n")
    .update(prevHash ?? "GENESIS")
    .update("\n")
    .update(content)
    .digest("hex");
}
