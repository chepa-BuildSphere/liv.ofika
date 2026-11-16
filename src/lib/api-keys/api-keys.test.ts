import { describe, expect, it } from "vitest";
import { extractBearerToken, validateCreateApiKeyInput } from "./api-keys";
import { computeIdempotencyRequestHash } from "./idempotency";
import { serializeV1Delivery } from "./v1-handlers";

describe("validateCreateApiKeyInput (6.1)", () => {
  it("accepte un nom valide et TEST / LIVE après nettoyage", () => {
    expect(validateCreateApiKeyInput({ name: "  Boutique Test ", environment: "TEST" })).toEqual({
      ok: true,
      data: { name: "Boutique Test", environment: "TEST" },
    });

    expect(validateCreateApiKeyInput({ name: "Serveur prod", environment: " LIVE " })).toEqual({
      ok: true,
      data: { name: "Serveur prod", environment: "LIVE" },
    });
  });

  it("refuse un nom trop court / long ou un environnement inconnu", () => {
    const badName = validateCreateApiKeyInput({ name: " A ", environment: "TEST" });
    expect(badName.ok).toBe(false);
    if (!badName.ok) expect(badName.fields.name).toBeDefined();

    const longName = validateCreateApiKeyInput({ name: "X".repeat(81), environment: "LIVE" });
    expect(longName.ok).toBe(false);
    if (!longName.ok) expect(longName.fields.name).toBeDefined();

    const badEnv = validateCreateApiKeyInput({ name: "Site", environment: "STAGING" });
    expect(badEnv.ok).toBe(false);
    if (!badEnv.ok) expect(badEnv.fields.environment).toBeDefined();
  });
});

describe("extractBearerToken (6.1)", () => {
  it("extrait le jeton Bearer insensible à la casse et rejette les en-têtes mal formés", () => {
    expect(extractBearerToken("Bearer ofk_test_abc123")).toBe("ofk_test_abc123");
    expect(extractBearerToken("  bearer   ofk_live_xyz987  ")).toBe("ofk_live_xyz987");
    expect(extractBearerToken("Basic abc123")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
    expect(extractBearerToken("Bearer tok1 tok2")).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });
});

describe("computeIdempotencyRequestHash & serializeV1Delivery (6.2 → 6.5)", () => {
  it("produit une empreinte déterministe sensible à la méthode, au chemin et au corps", () => {
    const h1 = computeIdempotencyRequestHash("post", "/v1/deliveries", '{"reference":"CMD-1"}');
    const h2 = computeIdempotencyRequestHash("POST", "/v1/deliveries", '{"reference":"CMD-1"}');
    const h3 = computeIdempotencyRequestHash("POST", "/v1/deliveries", '{"reference":"CMD-2"}');

    expect(h1).toHaveLength(64);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });

  it("sérialise une livraison test ou live en JSON snake_case conforme à §9.2", () => {
    const createdAt = new Date("2026-11-16T12:00:00Z");
    const updatedAt = new Date("2026-11-16T12:05:00Z");
    const serialized = serializeV1Delivery(
      {
        id: "11111111-1111-4111-8111-111111111111",
        reference: "CMD-TEST-1",
        metadata: { order_id: 99 },
        status: "DELIVERED",
        proofMode: "QR",
        proofMethod: "QR",
        isTest: true,
        recipientName: "Awa",
        recipientPhone: "+2250707070707",
        address: "Cocody",
        district: "Angré",
        packageDescription: "Livre",
        amountToCollect: 12000,
        comment: null,
        courierId: "22222222-2222-4222-8222-222222222222",
        currentAttempt: 1,
        billedPrice: 0,
        assignedAt: createdAt,
        pickedUpAt: null,
        deliveredAt: updatedAt,
        cancelledAt: null,
        createdAt,
        updatedAt,
      },
      { courierName: "Kwamé" },
    );

    expect(serialized).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      reference: "CMD-TEST-1",
      metadata: { order_id: 99 },
      status: "DELIVERED",
      proof_mode: "QR",
      proof_method: "QR",
      livemode: false,
      is_test: true,
      recipient_name: "Awa",
      courier_name: "Kwamé",
      billed_price: 0,
    });
  });
});
