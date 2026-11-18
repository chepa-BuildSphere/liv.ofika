import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/db";
import { getPlatformPricePerDelivery, PLATFORM_PRICE_CACHE_TAG } from "./billing";

/**
 * Lit le tarif par livraison de la plateforme avec mise en cache Next.js 16 (`use cache`).
 * Invalidé immédiatement via `updateTag(PLATFORM_PRICE_CACHE_TAG)` dès qu'un Super Admin
 * modifie le prix dans la console d'administration.
 */
export async function getCachedPlatformPrice(): Promise<number> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PLATFORM_PRICE_CACHE_TAG);
  return getPlatformPricePerDelivery(db);
}
