import { describe, expect, it } from "vitest";
import { checkTransition, DELIVERY_STATUSES, type DeliveryStatus } from "./transitions";

// Tableau de référence, recopié de mvp.md §5 : toute autre paire est refusée.
const ALLOWED = new Set([
  "CREATED>ASSIGNED",
  "CREATED>CANCELLED",
  "ASSIGNED>ASSIGNED",
  "ASSIGNED>CREATED",
  "ASSIGNED>PICKED_UP",
  "ASSIGNED>CANCELLED",
  "PICKED_UP>ARRIVED",
  "ARRIVED>DELIVERY_FAILED",
  "DELIVERY_FAILED>PICKED_UP",
  "DELIVERY_FAILED>RETURNING",
  "RETURNING>RETURN_RECEIVED",
]);

describe("checkTransition — matrice complète (hors DELIVERED)", () => {
  for (const from of DELIVERY_STATUSES) {
    for (const to of DELIVERY_STATUSES) {
      if (to === "DELIVERED") continue;
      const expected = ALLOWED.has(`${from}>${to}`);
      it(`${from} → ${to} : ${expected ? "autorisé" : "refusé"}`, () => {
        expect(checkTransition(from, to).ok).toBe(expected);
      });
    }
  }
});

describe("checkTransition — DELIVERED", () => {
  it("CREATED → DELIVERED est refusé, même avec une preuve", () => {
    expect(checkTransition("CREATED", "DELIVERED").ok).toBe(false);
    expect(checkTransition("CREATED", "DELIVERED", { proofMethod: "QR" }).ok).toBe(false);
    expect(checkTransition("CREATED", "DELIVERED", { proofMethod: "MANUAL", reason: "x" }).ok).toBe(false);
  });

  it("ARRIVED → DELIVERED exige une preuve", () => {
    expect(checkTransition("ARRIVED", "DELIVERED")).toMatchObject({ ok: false, code: "PROOF_REQUIRED" });
    expect(checkTransition("ARRIVED", "DELIVERED", { proofMethod: "QR" })).toEqual({ ok: true, forced: false });
    expect(checkTransition("ARRIVED", "DELIVERED", { proofMethod: "QR_OTP" }).ok).toBe(true);
  });

  it("la preuve QR n'est valable que depuis ARRIVED", () => {
    for (const from of ["PICKED_UP", "DELIVERY_FAILED", "RETURNING"] as DeliveryStatus[]) {
      expect(checkTransition(from, "DELIVERED", { proofMethod: "QR" }).ok).toBe(false);
    }
  });

  it("« Forcer Livré » depuis PICKED_UP, ARRIVED, DELIVERY_FAILED, RETURNING uniquement", () => {
    for (const from of DELIVERY_STATUSES) {
      const ok = ["PICKED_UP", "ARRIVED", "DELIVERY_FAILED", "RETURNING"].includes(from);
      expect(checkTransition(from, "DELIVERED", { proofMethod: "MANUAL", reason: "Client a confirmé par appel" }).ok).toBe(ok);
    }
  });

  it("« Forcer Livré » exige un motif non vide", () => {
    expect(checkTransition("ARRIVED", "DELIVERED", { proofMethod: "MANUAL" })).toMatchObject({ code: "REASON_REQUIRED" });
    expect(checkTransition("ARRIVED", "DELIVERED", { proofMethod: "MANUAL", reason: "   " })).toMatchObject({ code: "REASON_REQUIRED" });
    expect(checkTransition("ARRIVED", "DELIVERED", { proofMethod: "MANUAL", reason: "ok" })).toEqual({ ok: true, forced: true });
  });

  it("une preuve hors DELIVERED est refusée", () => {
    expect(checkTransition("PICKED_UP", "ARRIVED", { proofMethod: "QR" })).toMatchObject({ code: "PROOF_NOT_ALLOWED" });
  });
});

describe("statuts verrouillés", () => {
  it("rien ne sort de DELIVERED, RETURN_RECEIVED ni CANCELLED", () => {
    for (const from of ["DELIVERED", "RETURN_RECEIVED", "CANCELLED"] as DeliveryStatus[]) {
      for (const to of DELIVERY_STATUSES) {
        expect(checkTransition(from, to, { proofMethod: "MANUAL", reason: "x" })).toMatchObject({ code: "LOCKED" });
      }
    }
  });
});
