import { describe, expect, it } from "vitest";
import {
  API_ERROR_CODES,
  QUICKSTART_15_MINUTES,
  V1_ENDPOINTS_DOCS,
  WEBHOOK_PAYLOAD_EXAMPLE,
  WEBHOOK_VERIFY_NODE_SNIPPET,
} from "@/lib/api-keys/developer-docs";
import {
  computeNextRetryAt,
  RETRY_DELAYS_SECONDS,
  signWebhookPayload,
  validateWebhookEndpointInput,
  verifyWebhookSignature,
  WEBHOOK_EVENT_TYPES,
} from "./webhooks";

describe("validateWebhookEndpointInput (6.6)", () => {
  it("accepte une URL publique valide, TEST/LIVE et dédoublonne les événements", () => {
    const res = validateWebhookEndpointInput({
      url: "  https://boutique.example.ci/hooks/ofika ",
      environment: "LIVE",
      events: ["delivery.delivered", "delivery.failed", "delivery.delivered"],
    });
    expect(res).toEqual({
      ok: true,
      data: {
        url: "https://boutique.example.ci/hooks/ofika",
        environment: "LIVE",
        events: ["delivery.delivered", "delivery.failed"],
      },
    });
  });

  it("refuse localhost, IP privées/métadonnées (anti-SSRF), schéma invalide et événements inconnus", () => {
    for (const badUrl of [
      "http://localhost:3000/hook",
      "http://127.0.0.1/hook",
      "http://169.254.169.254/latest/meta-data",
      "http://192.168.1.10/hook",
      "http://10.0.0.5/hook",
      "ftp://example.com/hook",
      "https://user:pass@example.com/hook",
    ]) {
      const r = validateWebhookEndpointInput({
        url: badUrl,
        environment: "TEST",
        events: ["delivery.created"],
      });
      expect(r.ok, badUrl).toBe(false);
      if (!r.ok) expect(r.fields.url).toBeDefined();
    }

    const badEvents = validateWebhookEndpointInput({
      url: "https://example.com/hook",
      environment: "TEST",
      events: ["delivery.unknown"],
    });
    expect(badEvents.ok).toBe(false);
    if (!badEvents.ok) expect(badEvents.fields.events).toBeDefined();

    const emptyEvents = validateWebhookEndpointInput({
      url: "https://example.com/hook",
      environment: "TEST",
      events: [],
    });
    expect(emptyEvents.ok).toBe(false);
    if (!emptyEvents.ok) expect(emptyEvents.fields.events).toBeDefined();
  });
});

describe("signature HMAC & backoff croissant (6.7)", () => {
  it("signe et vérifie X-Ofika-Signature et rejette mauvais secret ou horodatage expiré", () => {
    const body = JSON.stringify({ id: "evt_1", type: "delivery.delivered" });
    const secret = "whsec_secret_test_123";
    const t = 1_700_000_000;

    const signed = signWebhookPayload(body, secret, t);
    expect(signed.header).toMatch(/^t=1700000000,v1=[0-9a-f]{64}$/);

    expect(verifyWebhookSignature(body, signed.header, secret, { nowSec: t + 120 })).toBe(true);
    expect(verifyWebhookSignature(body, signed.header, "whsec_autre", { nowSec: t + 10 })).toBe(false);
    expect(verifyWebhookSignature(`${body} `, signed.header, secret, { nowSec: t + 10 })).toBe(false);
    expect(verifyWebhookSignature(body, signed.header, secret, { nowSec: t + 301 })).toBe(false);
  });

  it("calcule des délais croissants entre nouvelles tentatives", () => {
    const base = new Date("2026-11-16T10:00:00Z");
    const expected = [60, 300, 1800, 7200];
    expect([...RETRY_DELAYS_SECONDS]).toEqual(expected);

    for (let i = 0; i < expected.length; i++) {
      const next = computeNextRetryAt(i + 1, base);
      expect(next.getTime() - base.getTime()).toBe(expected[i] * 1000);
    }
  });
});

describe("documentation développeur & guide 15 minutes (6.10)", () => {
  it("contient les 4 étapes du guide, les 11 endpoints §9.2, la vérification HMAC et les codes d'erreur", () => {
    expect(QUICKSTART_15_MINUTES).toHaveLength(4);
    expect(V1_ENDPOINTS_DOCS).toHaveLength(11);
    expect(V1_ENDPOINTS_DOCS.some((e) => e.path === "/v1/test/deliveries/{id}/simulate" && e.testOnly)).toBe(true);
    expect(WEBHOOK_EVENT_TYPES).toHaveLength(10);
    expect(WEBHOOK_PAYLOAD_EXAMPLE).toContain('"reference"');
    expect(WEBHOOK_PAYLOAD_EXAMPLE).toContain('"metadata"');
    expect(WEBHOOK_VERIFY_NODE_SNIPPET).toContain("timingSafeEqual");
    expect(API_ERROR_CODES.map((c) => c.httpStatus)).toEqual([400, 401, 403, 404, 409]);
  });
});
