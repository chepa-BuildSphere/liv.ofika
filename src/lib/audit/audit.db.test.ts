// Test d'intégration sur la vraie base (branche Neon liée, normalement `dev`).
// Tout se passe dans une transaction annulée à la fin : rien ne reste en base.
// Lancer avec : npm run test:db
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { logEvent, verifyAuditChain, type Executor } from ".";

class Rollback extends Error {}

/** Exécute `fn` dans une transaction toujours annulée. */
async function inRolledBackTx(fn: (tx: Executor) => Promise<void>) {
  await db
    .transaction(async (tx) => {
      await fn(tx);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

beforeAll(() => {
  if (process.env.NEON_BRANCH === "production") {
    throw new Error("Tests base interdits sur la branche production : faire `neon checkout dev`");
  }
});

afterAll(async () => {
  await pool.end();
});

describe("journal d'audit chaîné (base réelle)", () => {
  it("chaîne les événements et vérifie la chaîne", async () => {
    await inRolledBackTx(async (tx) => {
      const before = await verifyAuditChain(tx);
      expect(before.ok).toBe(true);

      const e1 = await logEvent(tx, { eventType: "TEST_A", actorType: "SYSTEM", payload: { n: 1 } });
      const e2 = await logEvent(tx, {
        eventType: "TEST_B",
        actorType: "SYSTEM",
        payload: { z: [1, 2], a: { y: true } },
        lat: 5.3364,
        lng: -4.0267,
      });
      expect(e2.prevHash).toBe(e1.hash);

      const after = await verifyAuditChain(tx);
      expect(after).toEqual({ ok: true, checked: before.checked + 2 });
    });
  });

  it("détecte une ligne modifiée à la main", async () => {
    await inRolledBackTx(async (tx) => {
      await logEvent(tx, { eventType: "TEST_A", actorType: "SYSTEM" });
      const target = await logEvent(tx, { eventType: "TEST_B", actorType: "SYSTEM", payload: { montant: 5000 } });
      await logEvent(tx, { eventType: "TEST_C", actorType: "SYSTEM" });

      // Un fraudeur avec accès admin désactive la protection et change le montant
      await tx.execute(sql`ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_update`);
      await tx.execute(sql`UPDATE audit_events SET payload = '{"montant": 500}' WHERE id = ${target.id}`);

      const check = await verifyAuditChain(tx);
      expect(check.ok).toBe(false);
      if (!check.ok) {
        expect(check.brokenAtId).toBe(target.id);
        expect(check.reason).toMatch(/modifié/);
      }
    });
  });

  it("détecte une ligne supprimée", async () => {
    await inRolledBackTx(async (tx) => {
      await logEvent(tx, { eventType: "TEST_A", actorType: "SYSTEM" });
      const removed = await logEvent(tx, { eventType: "TEST_B", actorType: "SYSTEM" });
      const next = await logEvent(tx, { eventType: "TEST_C", actorType: "SYSTEM" });

      await tx.execute(sql`ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_update`);
      await tx.execute(sql`DELETE FROM audit_events WHERE id = ${removed.id}`);

      const check = await verifyAuditChain(tx);
      expect(check.ok).toBe(false);
      if (!check.ok) expect(check.brokenAtId).toBe(next.id);
    });
  });
});
