import { describe, expect, it } from "vitest";
import { canonicalJson, computeAuditHash, type AuditContent } from "./chain";

const base: AuditContent = {
  companyId: "c1",
  deliveryId: null,
  eventType: "DELIVERY_ARRIVED",
  actorType: "COURIER",
  actorId: "k1",
  fromStatus: "IN_TRANSIT",
  toStatus: "ARRIVED",
  payload: { b: 1, a: [2, { d: null, c: "x" }] },
  lat: 5.3364,
  lng: -4.0267,
  accuracy: 12,
  ip: "1.2.3.4",
  userAgent: "test",
  serverTime: new Date("2026-11-15T10:00:00.123Z"),
};

describe("canonicalJson", () => {
  it("trie les clés à tous les niveaux", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}');
  });

  it("ignore undefined comme jsonb, garde null", () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it("refuse les nombres non finis", () => {
    expect(() => canonicalJson({ a: Number.NaN })).toThrow();
  });
});

describe("computeAuditHash", () => {
  it("est stable quel que soit l'ordre des clés du payload", () => {
    const reordered = { ...base, payload: { a: [2, { c: "x", d: null }], b: 1 } };
    expect(computeAuditHash(null, base)).toBe(computeAuditHash(null, reordered));
  });

  it("change si un seul champ change", () => {
    const h = computeAuditHash(null, base);
    expect(computeAuditHash(null, { ...base, toStatus: "DELIVERED" })).not.toBe(h);
    expect(computeAuditHash(null, { ...base, lat: 5.3365 })).not.toBe(h);
    expect(computeAuditHash(null, { ...base, serverTime: new Date("2026-11-15T10:00:00.124Z") })).not.toBe(h);
    expect(computeAuditHash(null, { ...base, payload: { b: 2, a: [2, { d: null, c: "x" }] } })).not.toBe(h);
  });

  it("dépend du maillon précédent", () => {
    expect(computeAuditHash("aa", base)).not.toBe(computeAuditHash("bb", base));
    expect(computeAuditHash(null, base)).not.toBe(computeAuditHash("", base));
  });
});
