export const STATEMENT_STATUS_LABEL = {
  OPEN: "En cours",
  ISSUED: "Émis",
  PAID: "Payé",
} as const;

export type StatementStatus = keyof typeof STATEMENT_STATUS_LABEL;

export const BILLING_SETTING_LABEL = {
  BILLING_ENABLED: "Statut facturation",
  PRICE_PER_DELIVERY: "Prix par livraison",
} as const;

/** Tarif unitaire par défaut appliqué aux nouvelles entreprises (en F CFA par livraison livrée). */
export const DEFAULT_PRICE_PER_DELIVERY = 10;

export function formatBillingSettingValue(setting: "BILLING_ENABLED" | "PRICE_PER_DELIVERY", value: string): string {
  if (setting === "BILLING_ENABLED") {
    return value === "true" ? "Facturation ON" : "Période gratuite (OFF)";
  }
  const num = Number(value);
  return Number.isFinite(num) ? `${num.toLocaleString("fr-FR")} F CFA` : value;
}

export function formatBillingPeriod(periodDate: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(periodDate);
  if (!m) return periodDate;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}
