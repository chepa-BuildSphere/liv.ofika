import "server-only";
import { env } from "@/env";

/** Lien d'activation à envoyer à l'utilisateur. */
export function activationUrl(token: string) {
  return `${env.appUrl}/activer/${token}`;
}
