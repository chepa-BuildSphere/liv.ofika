import type { DeviceSignals } from "@/lib/security/device-fingerprint";

/**
 * Collecte côté navigateur les signaux utilisés pour calculer l'empreinte
 * d'appareil côté serveur (utilisable sur la PWA livreur et la page `/c/<jeton>`).
 */
export function collectBrowserDeviceSignals(): string {
  if (typeof window === "undefined") return "";

  const nav = window.navigator;
  const scr = window.screen;
  const signals: DeviceSignals = {};

  if (typeof nav.userAgent === "string" && nav.userAgent) {
    signals.userAgent = nav.userAgent.slice(0, 500);
  }

  const uaPlatform = (nav as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
  const platform = uaPlatform || nav.platform;
  if (typeof platform === "string" && platform) {
    signals.platform = platform.slice(0, 100);
  }

  if (scr && typeof scr.width === "number" && typeof scr.height === "number" && scr.width > 0 && scr.height > 0) {
    const dpr = typeof window.devicePixelRatio === "number" && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    const depth = typeof scr.colorDepth === "number" && scr.colorDepth > 0 ? scr.colorDepth : 24;
    signals.screen = `${scr.width}x${scr.height}@${dpr}:${depth}`;
  }

  if (typeof nav.language === "string" && nav.language) {
    signals.language = nav.language.slice(0, 100);
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (typeof tz === "string" && tz) signals.timeZone = tz.slice(0, 100);
  } catch {
    // Ignore si l'API Intl est restreinte
  }

  if (typeof nav.hardwareConcurrency === "number" && Number.isFinite(nav.hardwareConcurrency)) {
    signals.hardwareConcurrency = nav.hardwareConcurrency;
  }

  if (typeof nav.maxTouchPoints === "number" && Number.isFinite(nav.maxTouchPoints)) {
    signals.maxTouchPoints = nav.maxTouchPoints;
  }

  return JSON.stringify(signals);
}
