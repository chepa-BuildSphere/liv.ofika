import type { McpPromptDefinition, McpPromptMessage } from "./types";

export const OFIKA_MCP_PROMPTS: McpPromptDefinition[] = [
  {
    name: "ofika_dispatch_delivery",
    description:
      "Assister un operateur dans la creation, la verification d'adresse et l'affectation d'un colis a Abidjan.",
    arguments: [
      {
        name: "recipient_name",
        description: "Nom du destinataire",
        required: true,
      },
      {
        name: "commune",
        description: "Commune d'Abidjan (Cocody, Yopougon, Marcory, Plateau, etc.)",
        required: true,
      },
    ],
  },
  {
    name: "ofika_audit_investigator",
    description:
      "Analyser le journal d'audit cryptographique et les horodatages en cas de reclamation de livraison.",
    arguments: [
      {
        name: "delivery_id",
        description: "Identifiant UUID de la livraison a analyser",
        required: true,
      },
    ],
  },
];

export function getMcpPromptMessages(
  name: string,
  args: Record<string, string> = {},
): McpPromptMessage[] {
  switch (name) {
    case "ofika_dispatch_delivery":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Je souhaite expedier un colis a ${args.recipient_name || "un destinataire"} dans la commune de ${args.commune || "Abidjan"}.
Peux-tu:
1. Verifier les informations indispensables requises par l'outil 'ofika_create_delivery' (nom, telephone +225, adresse precise, description du colis, montant COD eventuel).
2. Lister les livreurs actifs disponibles via 'ofika_list_couriers'.
3. M'aider a creer la course puis a l'affecter au coursier le plus approprie pour cette commune.`,
          },
        },
      ];

    case "ofika_audit_investigator":
      return [
        {
          role: "user",
          content: {
            type: "text",
            text: `Une contestation a ete signalee sur la livraison ${args.delivery_id || "<id>"}.
Peux-tu:
1. Recuperer les details complets de la livraison avec 'ofika_get_delivery'.
2. Recuperer le journal d'audit chaine avec 'ofika_get_audit_trail'.
3. Analyser les horodatages, le pointage GPS a l'arrivee, le code a 4 chiffres valide et la continuite des empreintes SHA-256.
4. Conclure si la remise en main propre est juridiquement prouvee ou s'il y a une anomalie.`,
          },
        },
      ];

    default:
      throw new Error(`Prompt inconnu: ${name}`);
  }
}
