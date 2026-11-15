// Charge les variables pour les tests qui touchent la base.
// @next/env ignore volontairement .env.local quand NODE_ENV=test (ce que fait
// vitest) : on le charge donc directement avec Node.
import { existsSync } from "node:fs";

for (const file of [".env.test.local", ".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file); // n'écrase pas une variable déjà définie
}
