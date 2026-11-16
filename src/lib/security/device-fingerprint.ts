import { createHash } from "node:crypto";

/**
 * Signaux matériels et navigateurs utilisés pour calculer une empreinte
 * d'appareil côté serveur (tâche 2.4 : session livreur ; phase 4 : page client `/c/<jeton>`).
 */
export type DeviceSignals = {
  /** Navigateur et modèle (navigator.userAgent ou en-tête User-Agent). */
  userAgent?: string | null;
  /** Plateforme (navigator.platform ou Sec-CH-UA-Platform). */
  platform?: string | null;
  /** Modèle précis si fourni par Client Hints (Sec-CH-UA-Model). */
  model?: string | null;
  /** Écran : largeur × hauteur, ratio de pixels, profondeur (ex. "360x800@2:24"). */
  screen?: string | null;
  /** Langue principale du navigateur (ex. "fr-FR"). */
  language?: string | null;
  /** Fuseau horaire (ex. "Africa/Abidjan"). */
  timeZone?: string | null;
  /** Nombre de cœurs logiques (navigator.hardwareConcurrency). */
  hardwareConcurrency?: number | string | null;
  /** Points de contact tactile (navigator.maxTouchPoints). */
  maxTouchPoints?: number | string | null;
};

/**
 * Normalise la géométrie d'écran en triant largeur et hauteur afin que
 * l'orientation portrait ("360x800@2:24") et paysage ("800x360@2:24")
 * produisent la même empreinte sur un même appareil.
 */
export function normalizeScreen(raw: string | null | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const match = /^\s*(\d+)\s*[x×]\s*(\d+)(?:@([0-9.]+)?(?::(\d+))?)?\s*$/i.exec(trimmed);
  if (!match) return trimmed.toLowerCase();

  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return trimmed.toLowerCase();
  }

  const min = Math.min(w, h);
  const max = Math.max(w, h);
  const dpr = match[3] ?? "";
  const depth = match[4] ?? "";
  if (!dpr && !depth) return `${min}x${max}`;
  if (!depth) return `${min}x${max}@${dpr}`;
  return `${min}x${max}@${dpr}:${depth}`;
}

/**
 * Extrait et normalise la langue principale (ex. "fr-FR,fr;q=0.9" → "fr-fr")
 * pour aligner `navigator.language` et l'en-tête HTTP `Accept-Language`.
 */
export function normalizeLanguage(raw: string | null | undefined): string {
  if (!raw) return "";
  const primary = raw.split(/[,;]/, 1)[0]?.trim() ?? "";
  return primary.toLowerCase();
}

function normalizeText(raw: string | null | undefined, maxLen: number, lowercase = true): string {
  if (typeof raw !== "string") return "";
  let s = raw.trim();
  // Les en-têtes Client Hints (Sec-CH-UA-Platform, Sec-CH-UA-Model) sont souvent entourés de guillemets.
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1).trim();
  }
  if (!s) return "";
  const sliced = s.slice(0, maxLen);
  return lowercase ? sliced.toLowerCase() : sliced;
}

function normalizeBoundedInt(raw: number | string | null | undefined): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0 || n > 256) return "";
  return String(Math.trunc(n));
}

/**
 * Calcule une empreinte SHA-256 (64 caractères hex) déterministe à partir
 * des signaux de l'appareil. Retourne `null` si aucun signal d'appareil
 * significatif n'est disponible.
 */
export function computeDeviceFingerprint(signals: DeviceSignals): string | null {
  const ua = normalizeText(signals.userAgent, 500, false);
  const platform = normalizeText(signals.platform, 100);
  const model = normalizeText(signals.model, 100);
  const screen = normalizeScreen(signals.screen);

  if (!ua && !platform && !model && !screen) return null;

  const language = normalizeLanguage(signals.language);
  const timeZone = normalizeText(signals.timeZone, 100);
  const hc = normalizeBoundedInt(signals.hardwareConcurrency);
  const tp = normalizeBoundedInt(signals.maxTouchPoints);

  const canonical = ["ofika-fp-v1", ua, platform, model, screen, language, timeZone, hc, tp].join("\u0000");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function pickString(obj: Record<string, unknown>, key: string, maxLen: number): string | undefined {
  const v = obj[key];
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, maxLen) : undefined;
}

function pickBoundedInt(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  if (typeof v !== "number" && typeof v !== "string") return undefined;
  if (typeof v === "string" && !v.trim()) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > 256) return undefined;
  return Math.trunc(n);
}

/**
 * Analyse défensivement la chaîne JSON envoyée par le client dans un formulaire.
 * Retourne `{}` si l'entrée est absente, trop longue ou invalide.
 */
export function parseClientDeviceSignals(raw: unknown): DeviceSignals {
  if (typeof raw !== "string") return {};
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 4096) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {};
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  const obj = parsed as Record<string, unknown>;
  const out: DeviceSignals = {};

  const userAgent = pickString(obj, "userAgent", 500);
  if (userAgent !== undefined) out.userAgent = userAgent;

  const platform = pickString(obj, "platform", 100);
  if (platform !== undefined) out.platform = platform;

  const model = pickString(obj, "model", 100);
  if (model !== undefined) out.model = model;

  const screen = pickString(obj, "screen", 100);
  if (screen !== undefined) out.screen = screen;

  const language = pickString(obj, "language", 100);
  if (language !== undefined) out.language = language;

  const timeZone = pickString(obj, "timeZone", 100);
  if (timeZone !== undefined) out.timeZone = timeZone;

  const hc = pickBoundedInt(obj, "hardwareConcurrency");
  if (hc !== undefined) out.hardwareConcurrency = hc;

  const tp = pickBoundedInt(obj, "maxTouchPoints");
  if (tp !== undefined) out.maxTouchPoints = tp;

  return out;
}
