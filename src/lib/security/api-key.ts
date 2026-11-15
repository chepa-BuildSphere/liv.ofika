import { hashToken } from "./hash";
import { randomToken } from "./random";

export type ApiKeyEnvironment = "TEST" | "LIVE";

const PREFIX: Record<ApiKeyEnvironment, string> = { TEST: "ofk_test_", LIVE: "ofk_live_" };

/**
 * Nouvelle clé API. `key` n'est montrée qu'une fois au client ;
 * on stocke `prefix` (pour la reconnaître) et `hash` (pour la vérifier).
 */
export function generateApiKey(environment: ApiKeyEnvironment) {
  const key = PREFIX[environment] + randomToken(32);
  return { key, prefix: key.slice(0, PREFIX[environment].length + 4), hash: hashToken(key) };
}

/** Environnement d'une clé reçue, ou null si elle n'a pas le bon format. */
export function apiKeyEnvironment(key: string): ApiKeyEnvironment | null {
  if (key.startsWith(PREFIX.LIVE)) return "LIVE";
  if (key.startsWith(PREFIX.TEST)) return "TEST";
  return null;
}
