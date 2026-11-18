# Serveur Model Context Protocol (MCP) — Ofika Delivery

Le serveur MCP d'Ofika Delivery permet aux assistants IA et agents autonomes (Claude Desktop, Cursor, Antigravity, ChatGPT, scripts d'agents) de piloter et d'auditer l'ensemble du cycle de livraison a Abidjan de maniere securisee.

---

## 1. Architecture et Transports

Le serveur est disponible selon deux modes de transport standard:

1. **Transport STDIO (Local / Desktop) :**  
   Pour les applications clientes locales comme Claude Desktop, Cursor ou des lignes de commande.  
   Commande d'execution :
   \`\`\`bash
   npm run mcp
   # ou directement via tsx :
   npx tsx src/mcp/server.ts
   \`\`\`

2. **Transport HTTP / REST (Distant / Cloud) :**  
   Pour les agents distants, webhooks ou architectures serverless.  
   Endpoint : \`POST /api/mcp\`  
   Format : JSON-RPC 2.0 avec entete \`Authorization: Bearer <ofk_test_... ou ofk_live_...>\`.

---

## 2. Configuration pour Claude Desktop

Dans votre fichier \`claude_desktop_config.json\` :

\`\`\`json
{
  "mcpServers": {
    "ofika-delivery": {
      "command": "npx",
      "args": ["tsx", "C:/Chemin/Vers/ofika-delivery/src/mcp/server.ts"],
      "env": {
        "OFIKA_API_KEY": "ofk_test_votre_cle_api_secrete",
        "DATABASE_URL": "postgresql://neondb_owner:..."
      }
    }
  }
}
\`\`\`

---

## 3. Catalogue des Outils (Tools)

| Nom de l'outil | Description | Parametres cles |
|---|---|---|
| \`ofika_create_delivery\` | Creer une livraison certifiee avec preuve bilaterale | \`recipient_name\`, \`recipient_phone\`, \`delivery_address\`, \`package_description\`, \`amount_to_collect\`, \`district\` |
| \`ofika_get_delivery\` | Consulter l'etat, le coursier, le GPS et la preuve | \`delivery_id\` |
| \`ofika_list_deliveries\` | Lister les livraisons avec filtre de statut et pagination | \`status\` (\`CREATED\`, \`ASSIGNED\`, \`PICKED_UP\`, \`ARRIVED\`, \`DELIVERED\`, \`CANCELLED\`), \`limit\` |
| \`ofika_assign_courier\` | Affecter un coursier a une livraison avant son depart | \`delivery_id\`, \`courier_id\` |
| \`ofika_cancel_delivery\` | Annuler une livraison avant prise en charge | \`delivery_id\`, \`reason\` |
| \`ofika_list_couriers\` | Lister la flotte des livreurs actifs de l'entreprise | - |
| \`ofika_simulate_delivery_step\` | Simuler une etape logistique sans livreur physique (mode test) | \`delivery_id\`, \`target_status\` (\`ASSIGNED\`, \`PICKED_UP\`, \`ARRIVED\`, \`DELIVERED\`) |
| \`ofika_get_audit_trail\` | Recuperer le journal d'audit cryptographique chaine SHA-256 | \`delivery_id\` |
| \`ofika_get_platform_pricing\` | Consulter les tarifs officiels par course livree (10 F CFA) | - |

---

## 4. Ressources Disponibles (Resources)

- \`ofika://platform/pricing\` : Tarifs officiels en vigueur (10 F CFA par livraison validee, 0 F abonnement, 0 F retours).
- \`ofika://openapi/spec\` : Specification OpenAPI 3.1.0 complete du service REST.
- \`ofika://protocol/overview\` : Documentation detaillee du protocole de preuve bilaterale par QR code temporaire et code secret.

---

## 5. Modeles de Prompts (Prompts)

- \`ofika_dispatch_delivery\` : Assistant interactif pour planifier, verifier l'adresse et assigner un colis a Abidjan.
- \`ofika_audit_investigator\` : Guide methodologique pour auditer les preuves cryptographiques et horodatages en cas de contestation.

---

## 6. Securite et Bonnes Pratiques

- **Cloisonnement strict :** Chaque cle API est attachee a une entreprise specifique. Aucune fuite de donnees entre commercants n'est permise.
- **Mode Sandbox :** Les cles d'environnement \`ofk_test_...\` permettent d'exercer toutes les fonctions sans impact sur le terrain et a 0 F de cout.
- **Idempotence :** Toutes les creations et mutations supportent l'en-tête d'idempotence pour se premunir des rejeux sur les reseaux mobiles d'Abidjan.
- **Aucun emoji :** Conforme a la charte technique stricte du projet.
