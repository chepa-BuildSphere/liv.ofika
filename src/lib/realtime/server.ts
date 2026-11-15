import "server-only";
import { createRealtime } from "@neon/realtime/server";
import { drizzleAdapter } from "@neon/realtime-drizzle";
import { databaseName } from "@/db";

// Scelle les requêtes live côté serveur. Le navigateur ne voit jamais le SQL
// ni les paramètres : il reçoit un jeton scellé (à traiter comme un secret).
// Toujours vérifier la session et filtrer par entreprise / livreur DANS la
// requête avant de sceller (pas de RLS avec Realtime).
export const realtime = createRealtime({
  secret: process.env.NEON_REALTIME_SECRET!,
  db: databaseName(),
  adapter: drizzleAdapter(),
  debugMode: process.env.NODE_ENV === "development",
});
