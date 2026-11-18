import type { McpToolDefinition, McpToolCallResult } from "./types";
import { db } from "@/db";
import { authenticateApiKey } from "@/lib/api-keys/api-keys";
import {
  handleV1AssignDelivery,
  handleV1CancelDelivery,
  handleV1CreateDelivery,
  handleV1GetDelivery,
  handleV1GetDeliveryEvents,
  handleV1ListCouriers,
  handleV1ListDeliveries,
  handleV1SimulateDelivery,
} from "@/lib/api-keys/v1-handlers";
import { getPlatformPricePerDelivery } from "@/lib/billing/billing";
import { DEFAULT_PRICE_PER_DELIVERY } from "@/lib/billing/billing-labels";

export const OFIKA_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: "ofika_create_delivery",
    description:
      "Creer une nouvelle commande de livraison securisee avec preuve bilaterale QR et code PIN a Abidjan.",
    inputSchema: {
      type: "object",
      properties: {
        recipient_name: {
          type: "string",
          description: "Nom et prenom du destinataire du colis.",
        },
        recipient_phone: {
          type: "string",
          description: "Numero de telephone ivoirien du destinataire (format +225... ou 10 chiffres).",
        },
        delivery_address: {
          type: "string",
          description: "Adresse complete ou indications de livraison a Abidjan.",
        },
        package_description: {
          type: "string",
          description: "Description de la marchandise ou du colis transporte.",
        },
        reference: {
          type: "string",
          description: "Reference interne unique de commande (ex: CMD-2026-0842).",
        },
        district: {
          type: "string",
          description: "Commune d'Abidjan (ex: Cocody, Yopougon, Marcory, Plateau, Treichville, Abobo).",
        },
        amount_to_collect: {
          type: "number",
          description: "Montant a encaisser a la livraison en F CFA (Cash on Delivery). Zero si deja paye en ligne.",
        },
        comment: {
          type: "string",
          description: "Instructions particulieres pour le coursier (ex: portail bleu, appeler a l'arrivee).",
        },
        idempotency_key: {
          type: "string",
          description: "Cle d'idempotence unique pour prevenir les doublons en cas de rejeu reseau.",
        },
        api_key: {
          type: "string",
          description: "Cle API Ofika (ofk_test_... ou ofk_live_...). Optionnel si definie dans OFIKA_API_KEY.",
        },
      },
      required: ["recipient_name", "recipient_phone", "delivery_address", "package_description"],
    },
  },
  {
    name: "ofika_get_delivery",
    description:
      "Recuperer l'etat complet, le coursier affecte, le pointage GPS et la preuve d'une livraison specifique.",
    inputSchema: {
      type: "object",
      properties: {
        delivery_id: {
          type: "string",
          description: "Identifiant unique UUID de la livraison.",
        },
        api_key: {
          type: "string",
          description: "Cle API Ofika. Optionnel si definie dans OFIKA_API_KEY.",
        },
      },
      required: ["delivery_id"],
    },
  },
  {
    name: "ofika_list_deliveries",
    description:
      "Lister les livraisons de l'entreprise avec filtrage optionnel par statut et pagination.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description:
            "Statut a filtrer: CREATED (enregistree), ASSIGNED (affectee), PICKED_UP (en cours), ARRIVED (sur place), DELIVERED (livree), CANCELLED (annulee).",
          enum: ["CREATED", "ASSIGNED", "PICKED_UP", "ARRIVED", "DELIVERED", "CANCELLED"],
        },
        limit: {
          type: "number",
          description: "Nombre maximum de livraisons a retourner (defaut 20, max 100).",
        },
        api_key: {
          type: "string",
          description: "Cle API Ofika. Optionnel si definie dans OFIKA_API_KEY.",
        },
      },
    },
  },
  {
    name: "ofika_assign_courier",
    description:
      "Affecter un coursier de la flotte a une livraison enregistree avant son depart.",
    inputSchema: {
      type: "object",
      properties: {
        delivery_id: {
          type: "string",
          description: "Identifiant UUID de la livraison.",
        },
        courier_id: {
          type: "string",
          description: "Identifiant UUID du coursier a affecter.",
        },
        api_key: {
          type: "string",
          description: "Cle API Ofika. Optionnel si definie dans OFIKA_API_KEY.",
        },
      },
      required: ["delivery_id", "courier_id"],
    },
  },
  {
    name: "ofika_cancel_delivery",
    description:
      "Annuler une livraison avant la prise en charge physique par le livreur au depot.",
    inputSchema: {
      type: "object",
      properties: {
        delivery_id: {
          type: "string",
          description: "Identifiant UUID de la livraison a annuler.",
        },
        reason: {
          type: "string",
          description: "Motif justifiant l'annulation de la course.",
        },
        api_key: {
          type: "string",
          description: "Cle API Ofika. Optionnel si definie dans OFIKA_API_KEY.",
        },
      },
      required: ["delivery_id", "reason"],
    },
  },
  {
    name: "ofika_list_couriers",
    description:
      "Lister les livreurs actifs de l'entreprise avec leur identifiant et numero de contact.",
    inputSchema: {
      type: "object",
      properties: {
        api_key: {
          type: "string",
          description: "Cle API Ofika. Optionnel si definie dans OFIKA_API_KEY.",
        },
      },
    },
  },
  {
    name: "ofika_simulate_delivery_step",
    description:
      "Simuler l'avancement d'une livraison de test dans le cycle logistique sans livreur physique (reserve aux cles ofk_test_...).",
    inputSchema: {
      type: "object",
      properties: {
        delivery_id: {
          type: "string",
          description: "Identifiant UUID de la livraison de test.",
        },
        target_status: {
          type: "string",
          description: "Statut cible a simuler.",
          enum: ["ASSIGNED", "PICKED_UP", "ARRIVED", "DELIVERED"],
        },
        api_key: {
          type: "string",
          description: "Cle API Ofika de test. Optionnel si definie dans OFIKA_API_KEY.",
        },
      },
      required: ["delivery_id", "target_status"],
    },
  },
  {
    name: "ofika_get_audit_trail",
    description:
      "Consulter le journal d'audit chaine SHA-256 et les horodatages certifies de chaque transition d'etat d'un colis.",
    inputSchema: {
      type: "object",
      properties: {
        delivery_id: {
          type: "string",
          description: "Identifiant UUID de la livraison a auditer.",
        },
        api_key: {
          type: "string",
          description: "Cle API Ofika. Optionnel si definie dans OFIKA_API_KEY.",
        },
      },
      required: ["delivery_id"],
    },
  },
  {
    name: "ofika_get_platform_pricing",
    description:
      "Consulter le tarif officiel en vigueur par livraison validee et les regles d'abonnement (zero abonnement).",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

async function resolveApiKey(providedKey?: unknown) {
  const token =
    (typeof providedKey === "string" && providedKey.trim().length > 0
      ? providedKey.trim()
      : process.env.OFIKA_API_KEY) ?? "";

  if (!token) {
    throw new Error(
      "Cle API manquante. Veuillez fournir l'argument 'api_key' ou configurer la variable d'environnement OFIKA_API_KEY.",
    );
  }

  const auth = await authenticateApiKey(db, token);
  if (!auth.ok) {
    throw new Error(`Cle API Ofika invalide ou revoquee (${auth.error}).`);
  }
  return auth.apiKey;
}

export async function executeMcpTool(
  toolName: string,
  args: Record<string, unknown> = {},
): Promise<McpToolCallResult> {
  try {
    switch (toolName) {
      case "ofika_get_platform_pricing": {
        let price = DEFAULT_PRICE_PER_DELIVERY;
        try {
          price = await getPlatformPricePerDelivery(db);
        } catch {
          price = DEFAULT_PRICE_PER_DELIVERY;
        }
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  platform: "Ofika Delivery",
                  currency: "XOF",
                  price_per_validated_delivery_cfa: price,
                  monthly_subscription_cfa: 0,
                  failed_or_returned_delivery_fee_cfa: 0,
                  billing_model: "Facturation 100% a l'usage reel sur courses certifiees",
                  currency_symbol: "F CFA",
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      case "ofika_create_delivery": {
        const apiKey = await resolveApiKey(args.api_key);
        const idempotencyKey =
          typeof args.idempotency_key === "string" ? args.idempotency_key : undefined;

        const payload: Record<string, unknown> = {
          recipient_name: args.recipient_name,
          recipient_phone: args.recipient_phone,
          address: args.delivery_address,
          package_description: args.package_description,
          reference: args.reference,
          district: args.district,
          amount_to_collect: args.amount_to_collect,
          comment: args.comment,
        };

        const res = await handleV1CreateDelivery(db, apiKey, payload, {
          idempotencyKey,
          meta: { userAgent: "ofika-mcp-server/1.0" },
        });

        if (res.status >= 400) {
          return {
            isError: true,
            content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
          };
        }

        return {
          content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
        };
      }

      case "ofika_get_delivery": {
        const apiKey = await resolveApiKey(args.api_key);
        const deliveryId = String(args.delivery_id || "").trim();
        if (!deliveryId) {
          return { isError: true, content: [{ type: "text", text: "Parametre 'delivery_id' requis." }] };
        }

        const res = await handleV1GetDelivery(db, apiKey, deliveryId);
        return {
          isError: res.status >= 400,
          content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
        };
      }

      case "ofika_list_deliveries": {
        const apiKey = await resolveApiKey(args.api_key);
        const status = typeof args.status === "string" ? args.status : undefined;
        const limit = typeof args.limit === "number" ? Math.max(1, args.limit) : 20;

        const res = await handleV1ListDeliveries(db, apiKey, {
          status: status as any,
        });

        if (res.status < 400 && Array.isArray(res.body.data)) {
          res.body.data = res.body.data.slice(0, limit);
        }

        return {
          isError: res.status >= 400,
          content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
        };
      }

      case "ofika_assign_courier": {
        const apiKey = await resolveApiKey(args.api_key);
        const deliveryId = String(args.delivery_id || "").trim();
        const courierId = String(args.courier_id || "").trim();

        if (!deliveryId || !courierId) {
          return {
            isError: true,
            content: [{ type: "text", text: "Parametres 'delivery_id' et 'courier_id' requis." }],
          };
        }

        const res = await handleV1AssignDelivery(
          db,
          apiKey,
          deliveryId,
          { courier_id: courierId },
          { meta: { userAgent: "ofika-mcp-server/1.0" } },
        );

        return {
          isError: res.status >= 400,
          content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
        };
      }

      case "ofika_cancel_delivery": {
        const apiKey = await resolveApiKey(args.api_key);
        const deliveryId = String(args.delivery_id || "").trim();
        const reason = String(args.reason || "").trim();

        if (!deliveryId || !reason) {
          return {
            isError: true,
            content: [{ type: "text", text: "Parametres 'delivery_id' et 'reason' requis." }],
          };
        }

        const res = await handleV1CancelDelivery(
          db,
          apiKey,
          deliveryId,
          { reason },
          { meta: { userAgent: "ofika-mcp-server/1.0" } },
        );

        return {
          isError: res.status >= 400,
          content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
        };
      }

      case "ofika_list_couriers": {
        const apiKey = await resolveApiKey(args.api_key);
        const res = await handleV1ListCouriers(db, apiKey);
        return {
          isError: res.status >= 400,
          content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
        };
      }

      case "ofika_simulate_delivery_step": {
        const apiKey = await resolveApiKey(args.api_key);
        const deliveryId = String(args.delivery_id || "").trim();
        const targetStatus = String(args.target_status || "").trim();

        if (!deliveryId || !targetStatus) {
          return {
            isError: true,
            content: [{ type: "text", text: "Parametres 'delivery_id' et 'target_status' requis." }],
          };
        }

        const res = await handleV1SimulateDelivery(
          db,
          apiKey,
          deliveryId,
          { status: targetStatus },
          { meta: { userAgent: "ofika-mcp-server/1.0" } },
        );

        return {
          isError: res.status >= 400,
          content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
        };
      }

      case "ofika_get_audit_trail": {
        const apiKey = await resolveApiKey(args.api_key);
        const deliveryId = String(args.delivery_id || "").trim();
        if (!deliveryId) {
          return { isError: true, content: [{ type: "text", text: "Parametre 'delivery_id' requis." }] };
        }

        const res = await handleV1GetDeliveryEvents(db, apiKey, deliveryId);
        return {
          isError: res.status >= 400,
          content: [{ type: "text", text: JSON.stringify(res.body, null, 2) }],
        };
      }

      default:
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Outil inconnu: ${toolName}. Utilisez 'tools/list' pour voir les outils disponibles.`,
            },
          ],
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      isError: true,
      content: [{ type: "text", text: `Erreur d'execution de l'outil ${toolName}: ${message}` }],
    };
  }
}
