import { asc, desc, gt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { auditEvents } from "@/db/schema";
import { computeAuditHash, type AuditContent } from "./chain";

export { canonicalJson, computeAuditHash } from "./chain";

/** `db` ou une transaction Drizzle en cours. */
export type Executor = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

type AuditInsert = typeof auditEvents.$inferInsert;

export type AuditEventInput = Pick<AuditInsert, "eventType" | "actorType"> &
  Partial<
    Pick<
      AuditInsert,
      | "companyId"
      | "deliveryId"
      | "actorId"
      | "fromStatus"
      | "toStatus"
      | "payload"
      | "lat"
      | "lng"
      | "accuracy"
      | "ip"
      | "userAgent"
    >
  >;

// Verrou applicatif : un seul ajout au journal à la fois, jusqu'à la fin de la
// transaction. Garantit que chaque événement s'accroche au vrai dernier maillon.
const AUDIT_LOCK_KEY = 0x0f1a_a0d1;

/**
 * Ajoute un événement au journal, chaîné au précédent.
 * À appeler avec la transaction qui fait le changement métier : si elle est
 * annulée, l'événement l'est aussi (pas d'événement fantôme).
 */
export async function logEvent(executor: Executor, input: AuditEventInput) {
  return executor.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY})`);

    const [last] = await tx
      .select({ hash: auditEvents.hash })
      .from(auditEvents)
      .orderBy(desc(auditEvents.id))
      .limit(1);
    const prevHash = last?.hash ?? null;

    const content: AuditContent = {
      companyId: input.companyId ?? null,
      deliveryId: input.deliveryId ?? null,
      eventType: input.eventType,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      payload: input.payload ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      accuracy: input.accuracy ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      serverTime: new Date(),
    };

    const [row] = await tx
      .insert(auditEvents)
      .values({
        ...content,
        actorType: input.actorType,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus ?? null,
        prevHash,
        hash: computeAuditHash(prevHash, content),
      })
      .returning();
    return row;
  });
}

export type ChainCheck =
  | { ok: true; checked: number }
  | { ok: false; checked: number; brokenAtId: number; reason: string };

/**
 * Relit tout le journal dans l'ordre et recalcule chaque maillon.
 * Détecte : une ligne modifiée, supprimée, insérée ou déplacée dans la chaîne.
 */
export async function verifyAuditChain(executor: Executor, batchSize = 1000): Promise<ChainCheck> {
  let prevHash: string | null = null;
  let lastId = 0;
  let checked = 0;

  for (;;) {
    const rows = await executor
      .select()
      .from(auditEvents)
      .where(gt(auditEvents.id, lastId))
      .orderBy(asc(auditEvents.id))
      .limit(batchSize);
    if (rows.length === 0) return { ok: true, checked };

    for (const row of rows) {
      if (row.prevHash !== prevHash) {
        return {
          ok: false,
          checked,
          brokenAtId: row.id,
          reason: "prev_hash ne correspond pas au maillon précédent (ligne supprimée, insérée ou déplacée)",
        };
      }
      const expected = computeAuditHash(prevHash, row);
      if (row.hash !== expected) {
        return {
          ok: false,
          checked,
          brokenAtId: row.id,
          reason: "le contenu de la ligne a été modifié (hash recalculé différent)",
        };
      }
      prevHash = row.hash;
      lastId = row.id;
      checked++;
    }
  }
}
