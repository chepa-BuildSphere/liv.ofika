import { describe, expect, it } from "vitest";
import {
  BillingError,
  formatBillingSettingValue,
  parseBillingPeriod,
  validatePricePerDelivery,
} from "./billing";

describe("validatePricePerDelivery (7.1)", () => {
  it("accepte 0 F CFA et tout entier jusqu'à 100 000 F CFA", () => {
    expect(validatePricePerDelivery("  10 ")).toEqual({ ok: true, price: 10 });
    expect(validatePricePerDelivery(0)).toEqual({ ok: true, price: 0 });
    expect(validatePricePerDelivery(100_000)).toEqual({ ok: true, price: 100_000 });
  });

  it("refuse les décimales, nombres négatifs et montants hors bornes", () => {
    expect(validatePricePerDelivery("12.5").ok).toBe(false);
    expect(validatePricePerDelivery(-5).ok).toBe(false);
    expect(validatePricePerDelivery("100001").ok).toBe(false);
    expect(validatePricePerDelivery("abc").ok).toBe(false);
  });
});

describe("parseBillingPeriod & formatBillingSettingValue (7.2 & 7.3)", () => {
  it("normalise YYYY-MM, YYYY-MM-01 et le mois courant UTC (dont passage d'année)", () => {
    expect(parseBillingPeriod("2026-12")).toEqual({
      period: "2026-12-01",
      startUtc: new Date("2026-12-01T00:00:00.000Z"),
      endExclusiveUtc: new Date("2027-01-01T00:00:00.000Z"),
    });

    expect(parseBillingPeriod("2026-11-01")).toEqual({
      period: "2026-11-01",
      startUtc: new Date("2026-11-01T00:00:00.000Z"),
      endExclusiveUtc: new Date("2026-12-01T00:00:00.000Z"),
    });

    expect(parseBillingPeriod(null, new Date("2026-02-15T18:00:00Z"))).toEqual({
      period: "2026-02-01",
      startUtc: new Date("2026-02-01T00:00:00.000Z"),
      endExclusiveUtc: new Date("2026-03-01T00:00:00.000Z"),
    });

    expect(() => parseBillingPeriod("2026-13")).toThrowError(BillingError);
    expect(() => parseBillingPeriod("invalid")).toThrowError(BillingError);
  });

  it("formate les valeurs ON/OFF et prix F CFA", () => {
    expect(formatBillingSettingValue("BILLING_ENABLED", "true")).toBe("Facturation ON");
    expect(formatBillingSettingValue("BILLING_ENABLED", "false")).toContain("OFF");
    expect(formatBillingSettingValue("PRICE_PER_DELIVERY", "25")).toContain("25 F CFA");
  });
});
