"use client";
import { createRealtimeClient } from "@neon/realtime/client";
import { drizzleParsers } from "@neon/realtime-drizzle/client";

// Un seul client par page : toutes les souscriptions partagent sa connexion.
// À créer dans un initialiseur useState (voir docs Realtime SSR), pas au niveau module.
export function makeRealtimeClient() {
  return createRealtimeClient({
    url: process.env.NEXT_PUBLIC_NEON_REALTIME_URL!,
    parsers: { ...drizzleParsers },
    logLevel: process.env.NODE_ENV === "development" ? "debug" : "warn",
  });
}
