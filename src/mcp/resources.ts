import type { McpResourceDefinition, McpResourceContent } from "./types";
import { OFIKA_OPENAPI_SPEC } from "@/lib/api-keys/openapi-spec";
import { db } from "@/db";
import { getPlatformPricePerDelivery } from "@/lib/billing/billing";
import { DEFAULT_PRICE_PER_DELIVERY } from "@/lib/billing/billing-labels";

export const OFIKA_MCP_RESOURCES: McpResourceDefinition[] = [
  {
    uri: "ofika://platform/pricing",
    name: "Tarification Officielle Ofika Delivery",
    description: "Structure tarifaire de la plateforme (10 F CFA par course livree, 0 F abonnement, 0 F retour)",
    mimeType: "application/json",
  },
  {
    uri: "ofika://openapi/spec",
    name: "Specification OpenAPI 3.1 Ofika Delivery",
    description: "Definition complete des 11 endpoints REST v1 et des webhooks",
    mimeType: "application/json",
  },
  {
    uri: "ofika://protocol/overview",
    name: "Protocole de Preuve Bilaterale Ofika",
    description: "Fonctionnement du pointage GPS certifie, du QR code dynamique 3 minutes et du code secret a 4 chiffres",
    mimeType: "text/markdown",
  },
];

export async function readMcpResource(uri: string): Promise<McpResourceContent> {
  switch (uri) {
    case "ofika://platform/pricing": {
      let price = DEFAULT_PRICE_PER_DELIVERY;
      try {
        price = await getPlatformPricePerDelivery(db);
      } catch {
        price = DEFAULT_PRICE_PER_DELIVERY;
      }
      return {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(
          {
            currency: "XOF",
            price_per_validated_delivery_cfa: price,
            subscription_fee_cfa: 0,
            failed_delivery_fee_cfa: 0,
            guarantee: "Paiement a la reussite uniquement. Aucun frais si refus ou echec.",
          },
          null,
          2,
        ),
      };
    }

    case "ofika://openapi/spec": {
      return {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(OFIKA_OPENAPI_SPEC, null, 2),
      };
    }

    case "ofika://protocol/overview": {
      return {
        uri,
        mimeType: "text/markdown",
        text: `# Protocole de Preuve Bilaterale Ofika Delivery

Le protocole garantit une preuve infalsifiable entre le commercant, le livreur et le client a Abidjan:

1. Pointage GPS: Le livreur clique sur "Arrive" a proximite immediate de l'adresse du destinataire. Sa position GPS exacte est enregistree et scellee.
2. QR Code dynamique: Le client scanne un QR code valide 3 minutes genere pour la course.
3. Code secret a 4 chiffres: Le client dicte son code secret temporaire au livreur.
4. Validation & Scellement: Le livreur saisit le code sur son interface. Si le code concorde, la remise est certifiee et un evenement SHA-256 chaine est grave dans le journal d'audit.
5. Notification Webhook: Un webhook signe HMAC-SHA256 'delivery.delivered' est expedie en direct au systeme du commercant.`,
      };
    }

    default:
      throw new Error(`Ressource inconnue: ${uri}`);
  }
}
