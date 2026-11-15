// Freine les essais de mot de passe : après MAX_FAILURES échecs en WINDOW_MS
// sur un même identifiant, toute tentative est refusée pendant LOCK_MS.
//
// En mémoire : suffisant pour le MVP (un seul processus sur le VPS). Les compteurs
// repartent à zéro au redémarrage. À déplacer en base ou dans Redis si l'app
// tourne un jour sur plusieurs processus.

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;
const LOCK_MS = 15 * 60_000;

type Entry = { failures: number[]; lockedUntil: number };
const entries = new Map<string, Entry>();

export function isLocked(key: string, now = Date.now()): boolean {
  const e = entries.get(key);
  return !!e && e.lockedUntil > now;
}

export function recordFailure(key: string, now = Date.now()) {
  const e = entries.get(key) ?? { failures: [], lockedUntil: 0 };
  e.failures = e.failures.filter((t) => now - t < WINDOW_MS);
  e.failures.push(now);
  if (e.failures.length >= MAX_FAILURES) {
    e.lockedUntil = now + LOCK_MS;
    e.failures = [];
  }
  entries.set(key, e);
}

export function recordSuccess(key: string) {
  entries.delete(key);
}

/** Pour les tests. */
export function resetThrottle() {
  entries.clear();
}
