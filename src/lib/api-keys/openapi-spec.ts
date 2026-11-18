import { API_ERROR_CODES, WEBHOOK_PAYLOAD_EXAMPLE, WEBHOOK_VERIFY_NODE_SNIPPET } from "./developer-docs";

/**
 * Spécification OpenAPI 3.1.0 complète de l'API publique Ofika Delivery (/v1/*).
 * Alimente la documentation interactive Scalar (/api/reference et /espace/documentation).
 */
export const OFIKA_OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Ofika Delivery — API REST B2B (v1)",
    version: "1.0.0",
    summary: "API logistique de livraison certifiée par QR code bilatéral à Abidjan (Côte d'Ivoire).",
    description: [
      "Bienvenue dans la référence interactive **Scalar** de l'API **Ofika Delivery (v1)**.",
      "",
      "### Authentification (`Bearer Token`)",
      "Toutes les requêtes vers `/v1/*` doivent inclure l'en-tête HTTP :",
      "```http",
      "Authorization: Bearer <votre_cle_api>",
      "```",
      "- **Clé Test (`ofk_test_…`)** : Crée et manipule uniquement des livraisons en mode Test (`is_test: true`, `livemode: false`). Ces livraisons ne sont **jamais facturées**, n'apparaissent pas chez les livreurs réels et peuvent être pilotées via `POST /v1/test/deliveries/{id}/simulate`.",
      "- **Clé Production (`ofk_live_…`)** : Crée des livraisons réelles (`is_test: false`, `livemode: true`) visibles par votre flotte de livreurs.",
      "",
      "### Idempotence (`Idempotency-Key`)",
      "Tous les endpoints `POST` acceptent l'en-tête optionnel `Idempotency-Key` (ex: `order-1042-create`). En cas de coupure réseau, renvoyer la même requête avec la même clé retourne la réponse initiale sans créer de doublon.",
      "",
      "### Webhooks temps réel & Signature HMAC-SHA256",
      "Ofika envoie des requêtes `POST` signées vers vos endpoints configurés dans `/espace/webhooks` avec l'en-tête `X-Ofika-Signature: t=<timestamp>,v1=<hmac_sha256>`.",
      "```ts",
      WEBHOOK_VERIFY_NODE_SNIPPET,
      "```",
    ].join("\n"),
    contact: {
      name: "Support Technique Ofika Delivery",
      url: "https://ofika.ci",
    },
  },
  servers: [
    {
      url: "/",
      description: "Serveur courant Ofika Delivery",
    },
    {
      url: "http://localhost:5000",
      description: "Environnement de développement local",
    },
  ],
  security: [{ BearerAuth: [] }],
  tags: [
    {
      name: "Livraisons",
      description: "Création unitaire ou CSV, consultation, modification avant prise en charge, affectation livreur et annulation.",
    },
    {
      name: "Traçabilité & Bordereaux",
      description: "Journal d'audit chaîné SHA-256 et génération du bordereau PDF A4 avec QR code de référence.",
    },
    {
      name: "Flotte Livreurs",
      description: "Consultation des coursiers actifs rattachés à votre entreprise (salariés et indépendants).",
    },
    {
      name: "Mode Test & Simulation",
      description: "Simulation complète du cycle de vie d'une livraison sans livreur physique (réservé aux clés `ofk_test_…`).",
    },
  ],
  paths: {
    "/v1/deliveries": {
      post: {
        tags: ["Livraisons"],
        operationId: "createDelivery",
        summary: "Créer une livraison",
        description:
          "Crée une nouvelle livraison à l'état `CREATED`. Supporte l'en-tête `Idempotency-Key` pour éviter tout doublon en cas de réessai.",
        parameters: [
          {
            $ref: "#/components/parameters/IdempotencyKeyHeader",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CreateDeliveryRequest",
              },
              example: {
                reference: "CMD-2026-1042",
                recipient_name: "Awa Koné",
                recipient_phone: "+225 07 07 07 07 07",
                address: "Cocody Angré 8e Tranche, Immeuble Bleu",
                district: "Cocody",
                package_description: "2 robes en soie — Taille M",
                amount_to_collect: 15000,
                comment: "Appeler en arrivant au portail",
                proof_mode: "QR",
                metadata: {
                  order_id: 1042,
                  channel: "whatsapp",
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Livraison créée avec succès.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: { $ref: "#/components/schemas/Delivery" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequestError" },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
          "409": { $ref: "#/components/responses/ConflictError" },
        },
      },
      get: {
        tags: ["Livraisons"],
        operationId: "listDeliveries",
        summary: "Lister les livraisons",
        description:
          "Retourne la liste des livraisons de votre entreprise correspondant à l'environnement de la clé API (`TEST` ou `LIVE`), avec filtres optionnels.",
        parameters: [
          {
            name: "status",
            in: "query",
            description: "Filtrer par statut de livraison.",
            schema: { $ref: "#/components/schemas/DeliveryStatus" },
          },
          {
            name: "courier_id",
            in: "query",
            description: "UUID du livreur ou `UNASSIGNED` pour les courses non affectées.",
            schema: { type: "string" },
          },
          {
            name: "reference",
            in: "query",
            description: "Recherche partielle ou exacte sur la référence de commande.",
            schema: { type: "string", example: "CMD-2026-1042" },
          },
          {
            name: "date",
            in: "query",
            description: "Jour précis au format `YYYY-MM-DD`.",
            schema: { type: "string", format: "date" },
          },
          {
            name: "from",
            in: "query",
            description: "Date de début (`YYYY-MM-DD`).",
            schema: { type: "string", format: "date" },
          },
          {
            name: "to",
            in: "query",
            description: "Date de fin (`YYYY-MM-DD`).",
            schema: { type: "string", format: "date" },
          },
        ],
        responses: {
          "200": {
            description: "Liste des livraisons.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["livemode", "data"],
                  properties: {
                    livemode: { type: "boolean", example: false },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Delivery" },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
        },
      },
    },
    "/v1/deliveries/import": {
      post: {
        tags: ["Livraisons"],
        operationId: "importDeliveriesCsv",
        summary: "Importer un lot de livraisons (CSV)",
        description:
          "Importe plusieurs livraisons en une seule requête à partir d'un contenu CSV (`;`, `,` ou tabulation Excel). Retourne les livraisons créées ainsi que le rapport d'erreurs ligne par ligne.",
        parameters: [
          {
            $ref: "#/components/parameters/IdempotencyKeyHeader",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["csv"],
                properties: {
                  csv: {
                    type: "string",
                    description: "Contenu CSV complet avec ligne d'en-tête.",
                    example:
                      "reference;destinataire;telephone;adresse;commune;montant\nCMD-CSV-01;Koffi Serge;+2250700000001;Marcory Zone 4;Marcory;12000",
                  },
                },
              },
            },
            "text/csv": {
              schema: {
                type: "string",
                example:
                  "reference;destinataire;telephone;adresse;commune;montant\nCMD-CSV-01;Koffi Serge;+2250700000001;Marcory Zone 4;Marcory;12000",
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Import traité avec au moins une livraison créée.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ImportCsvResponse" },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequestError" },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
        },
      },
    },
    "/v1/deliveries/{id}": {
      get: {
        tags: ["Livraisons"],
        operationId: "getDelivery",
        summary: "Consulter le détail d'une livraison",
        description: "Récupère l'état complet d'une livraison par son identifiant UUID.",
        parameters: [{ $ref: "#/components/parameters/DeliveryIdParam" }],
        responses: {
          "200": {
            description: "Détail de la livraison.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: { $ref: "#/components/schemas/Delivery" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
          "404": { $ref: "#/components/responses/NotFoundError" },
        },
      },
      patch: {
        tags: ["Livraisons"],
        operationId: "updateDelivery",
        summary: "Modifier une livraison avant prise en charge",
        description:
          "Met à jour les informations d'une livraison tant qu'elle est au statut `CREATED` ou `ASSIGNED`. Toute modification après `PICKED_UP` est refusée (`409 AFTER_PICKUP`).",
        parameters: [{ $ref: "#/components/parameters/DeliveryIdParam" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PatchDeliveryRequest" },
              example: {
                address: "Marcory Zone 4, Rue Pierre et Marie Curie",
                amount_to_collect: 18500,
                comment: "Nouveau point de repère : Pharmacie de la Paix",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Livraison mise à jour.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: { $ref: "#/components/schemas/Delivery" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequestError" },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
          "404": { $ref: "#/components/responses/NotFoundError" },
          "409": { $ref: "#/components/responses/ConflictError" },
        },
      },
    },
    "/v1/deliveries/{id}/assign": {
      post: {
        tags: ["Livraisons"],
        operationId: "assignDeliveryCourier",
        summary: "Affecter, réaffecter ou désaffecter un livreur",
        description:
          "Affecte un livreur actif de votre flotte (`courier_id` UUID) à la livraison, ce qui la passe au statut `ASSIGNED`. Passer `courier_id: null` désaffecte le livreur et remet la livraison en `CREATED`.",
        parameters: [
          { $ref: "#/components/parameters/DeliveryIdParam" },
          { $ref: "#/components/parameters/IdempotencyKeyHeader" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["courier_id"],
                properties: {
                  courier_id: {
                    type: ["string", "null"],
                    format: "uuid",
                    description: "UUID du livreur rattaché à l'entreprise, ou `null` pour désaffecter.",
                    example: "c4f1d2a0-8b1e-4f3a-9c2d-123456789abc",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Affectation enregistrée.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: { $ref: "#/components/schemas/Delivery" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequestError" },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
          "404": { $ref: "#/components/responses/NotFoundError" },
          "409": { $ref: "#/components/responses/ConflictError" },
        },
      },
    },
    "/v1/deliveries/{id}/cancel": {
      post: {
        tags: ["Livraisons"],
        operationId: "cancelDelivery",
        summary: "Annuler une livraison avant prise en charge",
        description:
          "Passe la livraison au statut `CANCELLED` (uniquement si son statut actuel est `CREATED` ou `ASSIGNED`).",
        parameters: [
          { $ref: "#/components/parameters/DeliveryIdParam" },
          { $ref: "#/components/parameters/IdempotencyKeyHeader" },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  reason: {
                    type: ["string", "null"],
                    description: "Motif d'annulation (journalisé dans la chaîne d'audit).",
                    example: "Commande annulée à la demande de la cliente",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Livraison annulée.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: { $ref: "#/components/schemas/Delivery" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
          "404": { $ref: "#/components/responses/NotFoundError" },
          "409": { $ref: "#/components/responses/ConflictError" },
        },
      },
    },
    "/v1/deliveries/{id}/events": {
      get: {
        tags: ["Traçabilité & Bordereaux"],
        operationId: "getDeliveryEvents",
        summary: "Historique & chaîne d'audit SHA-256",
        description:
          "Retourne la chronologie complète et immuable des événements de la livraison, avec l'empreinte cryptographique `hash` de chaque maillon.",
        parameters: [{ $ref: "#/components/parameters/DeliveryIdParam" }],
        responses: {
          "200": {
            description: "Liste chronologique des événements d'audit de la livraison.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["delivery_id", "reference", "livemode", "data"],
                  properties: {
                    delivery_id: { type: "string", format: "uuid" },
                    reference: { type: "string", example: "CMD-2026-1042" },
                    livemode: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/DeliveryEvent" },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
          "404": { $ref: "#/components/responses/NotFoundError" },
        },
      },
    },
    "/v1/deliveries/{id}/label.pdf": {
      get: {
        tags: ["Traçabilité & Bordereaux"],
        operationId: "getDeliveryLabelPdf",
        summary: "Télécharger le bordereau PDF A4 (QR de référence)",
        description:
          "Génère et renvoie le bordereau officiel PDF 1.4 A4 de la livraison contenant le QR code de référence (`OFIKA-REF:<reference>:<id>`) utilisé au dépôt.",
        parameters: [{ $ref: "#/components/parameters/DeliveryIdParam" }],
        responses: {
          "200": {
            description: "Fichier PDF 1.4 (`application/pdf`).",
            content: {
              "application/pdf": {
                schema: {
                  type: "string",
                  format: "binary",
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
          "404": { $ref: "#/components/responses/NotFoundError" },
        },
      },
    },
    "/v1/couriers": {
      get: {
        tags: ["Flotte Livreurs"],
        operationId: "listCouriers",
        summary: "Lister les livreurs rattachés",
        description:
          "Retourne tous les livreurs actifs rattachés à votre entreprise, avec leur identifiant UUID (utile pour `POST /v1/deliveries/{id}/assign`) et leur statut (`EMPLOYEE` ou `INDEPENDENT`).",
        responses: {
          "200": {
            description: "Liste des livreurs actifs.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["livemode", "data"],
                  properties: {
                    livemode: { type: "boolean" },
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Courier" },
                    },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
        },
      },
    },
    "/v1/test/deliveries/{id}/simulate": {
      post: {
        tags: ["Mode Test & Simulation"],
        operationId: "simulateTestDelivery",
        summary: "Simuler une transition de statut (Clé Test uniquement)",
        description:
          "Permet de faire évoluer instantanément une livraison de test (`is_test: true`) vers n'importe quel statut (`ASSIGNED`, `PICKED_UP`, `ARRIVED`, `DELIVERED`, `DELIVERY_FAILED`, `RETURNING`, `RETURN_RECEIVED`) et de déclencher les webhooks associés sans intervention de livreur. Retourne `403 FORBIDDEN` si appelé avec une clé `ofk_live_…`.",
        parameters: [
          { $ref: "#/components/parameters/DeliveryIdParam" },
          { $ref: "#/components/parameters/IdempotencyKeyHeader" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: [
                      "ASSIGNED",
                      "PICKED_UP",
                      "ARRIVED",
                      "DELIVERED",
                      "DELIVERY_FAILED",
                      "RETURNING",
                      "RETURN_RECEIVED",
                    ],
                    example: "DELIVERED",
                  },
                  courier_id: {
                    type: ["string", "null"],
                    format: "uuid",
                    description: "Optionnel : UUID d'un livreur pour simuler l'affectation.",
                  },
                  failure_reason: {
                    type: ["string", "null"],
                    enum: [
                      "RECIPIENT_ABSENT",
                      "RECIPIENT_UNREACHABLE",
                      "RECIPIENT_REFUSED",
                      "WRONG_ADDRESS",
                      "PAYMENT_UNAVAILABLE",
                      "PACKAGE_DAMAGED",
                      "OTHER",
                      null,
                    ],
                    description: "Motif d'échec si `status = DELIVERY_FAILED`.",
                  },
                  reason: {
                    type: ["string", "null"],
                    description: "Commentaire ou détail facultatif.",
                  },
                },
              },
              example: {
                status: "DELIVERED",
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Statut simulé avec succès et webhook mis en file d'envoi.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data"],
                  properties: {
                    data: { $ref: "#/components/schemas/Delivery" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/BadRequestError" },
          "401": { $ref: "#/components/responses/UnauthorizedError" },
          "403": { $ref: "#/components/responses/ForbiddenError" },
          "404": { $ref: "#/components/responses/NotFoundError" },
        },
      },
    },
  },
  webhooks: {
    "delivery.event": {
      post: {
        tags: ["Traçabilité & Bordereaux"],
        summary: "Notification Webhook signée HMAC-SHA256",
        description:
          "Envoyée vers votre URL webhook à chaque changement d'état d'une livraison (`delivery.created`, `delivery.assigned`, `delivery.picked_up`, `delivery.arrived`, `delivery.delivered`, `delivery.failed`, `delivery.returning`, `delivery.return_received`, `delivery.cancelled` ou `webhook.test`).",
        parameters: [
          {
            name: "X-Ofika-Signature",
            in: "header",
            required: true,
            description: "Signature HMAC-SHA256 au format `t=<unix_timestamp>,v1=<hex_digest>`.",
            schema: {
              type: "string",
              example: "t=1794825727,v1=5d41402abc4b2a76b9719d911017c592...",
            },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WebhookEventPayload" },
              example: JSON.parse(WEBHOOK_PAYLOAD_EXAMPLE),
            },
          },
        },
        responses: {
          "200": {
            description: "Votre serveur confirme la bonne réception avec un code HTTP 2xx.",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "ofk_test_... | ofk_live_...",
        description: "Clé API Ofika générée depuis `/espace/cles-api` (`ofk_test_…` ou `ofk_live_…`).",
      },
    },
    parameters: {
      DeliveryIdParam: {
        name: "id",
        in: "path",
        required: true,
        description: "Identifiant UUID unique de la livraison.",
        schema: {
          type: "string",
          format: "uuid",
          example: "3b1e8c40-90a2-4c1b-8c19-7a2b3c4d5e6f",
        },
      },
      IdempotencyKeyHeader: {
        name: "Idempotency-Key",
        in: "header",
        required: false,
        description: "Clé d'idempotence unique (jusqu'à 255 caractères) garantissant l'exécution unique d'un `POST`.",
        schema: {
          type: "string",
          example: "order-1042-create",
        },
      },
    },
    schemas: {
      DeliveryStatus: {
        type: "string",
        enum: [
          "CREATED",
          "ASSIGNED",
          "PICKED_UP",
          "ARRIVED",
          "DELIVERED",
          "DELIVERY_FAILED",
          "RETURNING",
          "RETURN_RECEIVED",
          "CANCELLED",
        ],
      },
      CreateDeliveryRequest: {
        type: "object",
        required: ["reference", "recipient_name", "recipient_phone", "address"],
        properties: {
          reference: {
            type: "string",
            description: "Référence unique de la commande dans votre boutique (ex. `CMD-1042`).",
            example: "CMD-2026-1042",
          },
          recipient_name: {
            type: "string",
            description: "Nom complet du client destinataire.",
            example: "Awa Koné",
          },
          recipient_phone: {
            type: "string",
            description: "Numéro de téléphone mobile du destinataire (format ivoirien ou international).",
            example: "+225 07 07 07 07 07",
          },
          address: {
            type: "string",
            description: "Adresse précise de remise.",
            example: "Cocody Angré 8e Tranche, Immeuble Bleu",
          },
          district: {
            type: ["string", "null"],
            description: "Commune ou quartier (ex. Cocody, Marcory, Yopougon, Plateau).",
            example: "Cocody",
          },
          package_description: {
            type: ["string", "null"],
            description: "Nature ou description du colis.",
            example: "2 robes en soie — Taille M",
          },
          amount_to_collect: {
            type: ["integer", "null"],
            minimum: 0,
            description: "Montant à encaisser à la livraison (COD) en F CFA entiers (`0` si déjà payé).",
            example: 15000,
          },
          comment: {
            type: ["string", "null"],
            description: "Instructions pour le livreur.",
            example: "Appeler en arrivant devant le portail",
          },
          proof_mode: {
            type: "string",
            enum: ["QR", "QR_PHOTO", "QR_PHOTO_SIGNATURE", "REVERSE_QR"],
            default: "QR",
            description: "Niveau de preuve exigé à la remise.",
          },
          metadata: {
            type: ["object", "null"],
            additionalProperties: true,
            description: "Objet JSON libre restitué tel quel dans les réponses API et dans tous les webhooks.",
            example: { order_id: 1042, boutique: "sip" },
          },
        },
      },
      PatchDeliveryRequest: {
        type: "object",
        properties: {
          reference: { type: "string" },
          recipient_name: { type: "string" },
          recipient_phone: { type: "string" },
          address: { type: "string" },
          district: { type: ["string", "null"] },
          package_description: { type: ["string", "null"] },
          amount_to_collect: { type: ["integer", "null"], minimum: 0 },
          comment: { type: ["string", "null"] },
          proof_mode: {
            type: "string",
            enum: ["QR", "QR_PHOTO", "QR_PHOTO_SIGNATURE", "REVERSE_QR"],
          },
          metadata: {
            type: ["object", "null"],
            additionalProperties: true,
          },
        },
      },
      Delivery: {
        type: "object",
        required: [
          "id",
          "reference",
          "status",
          "proof_mode",
          "livemode",
          "is_test",
          "recipient_name",
          "address",
          "current_attempt",
          "created_at",
          "updated_at",
        ],
        properties: {
          id: { type: "string", format: "uuid", example: "3b1e8c40-90a2-4c1b-8c19-7a2b3c4d5e6f" },
          reference: { type: "string", example: "CMD-2026-1042" },
          metadata: { type: ["object", "null"], additionalProperties: true, example: { order_id: 1042 } },
          status: { $ref: "#/components/schemas/DeliveryStatus" },
          proof_mode: { type: "string", example: "QR" },
          proof_method: { type: ["string", "null"], example: "QR" },
          livemode: { type: "boolean", example: true },
          is_test: { type: "boolean", example: false },
          recipient_name: { type: "string", example: "Awa Koné" },
          recipient_phone: { type: ["string", "null"], example: "+2250707070707" },
          address: { type: "string", example: "Cocody Angré 8e Tranche" },
          district: { type: ["string", "null"], example: "Cocody" },
          package_description: { type: ["string", "null"], example: "Colis Mode" },
          amount_to_collect: { type: ["integer", "null"], example: 15000 },
          comment: { type: ["string", "null"] },
          courier_id: { type: ["string", "null"], format: "uuid" },
          courier_name: { type: ["string", "null"], example: "Koffi Kouamé" },
          current_attempt: { type: "integer", example: 1 },
          billed_price: { type: ["integer", "null"], description: "Tarif figé en F CFA une fois livrée (`null` en mode test).", example: 200 },
          assigned_at: { type: ["string", "null"], format: "date-time" },
          picked_up_at: { type: ["string", "null"], format: "date-time" },
          delivered_at: { type: ["string", "null"], format: "date-time" },
          cancelled_at: { type: ["string", "null"], format: "date-time" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      ImportCsvResponse: {
        type: "object",
        required: ["livemode", "total_rows", "imported_count", "data", "errors"],
        properties: {
          livemode: { type: "boolean" },
          total_rows: { type: "integer", example: 2 },
          imported_count: { type: "integer", example: 1 },
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Delivery" },
          },
          errors: {
            type: "array",
            items: {
              type: "object",
              required: ["line_number", "reference", "message"],
              properties: {
                line_number: { type: "integer", example: 3 },
                reference: { type: ["string", "null"], example: "CMD-ERR" },
                message: { type: "string", example: "Téléphone destinataire invalide." },
              },
            },
          },
        },
      },
      DeliveryEvent: {
        type: "object",
        required: ["id", "event_type", "label", "actor_type", "server_time", "hash"],
        properties: {
          id: { type: "number", example: 108 },
          event_type: { type: "string", example: "DELIVERY_DELIVERED" },
          label: { type: "string", example: "Livraison confirmée par échange QR + code" },
          summary: { type: ["string", "null"] },
          actor_type: { type: "string", example: "COURIER" },
          from_status: { type: ["string", "null"], example: "ARRIVED" },
          to_status: { type: ["string", "null"], example: "DELIVERED" },
          server_time: { type: "string", format: "date-time" },
          hash: { type: "string", description: "Empreinte SHA-256 chaînée du journal d'audit." },
        },
      },
      Courier: {
        type: "object",
        required: ["id", "name", "phone", "employment_type"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string", example: "Koffi Kouamé" },
          phone: { type: "string", example: "+2250708091011" },
          employment_type: { type: "string", enum: ["EMPLOYEE", "INDEPENDENT"], example: "EMPLOYEE" },
        },
      },
      WebhookEventPayload: {
        type: "object",
        required: ["id", "type", "created_at", "livemode", "data"],
        properties: {
          id: { type: "string", example: "evt_9f2c4a8d10..." },
          type: {
            type: "string",
            enum: [
              "delivery.created",
              "delivery.assigned",
              "delivery.picked_up",
              "delivery.arrived",
              "delivery.delivered",
              "delivery.failed",
              "delivery.returning",
              "delivery.return_received",
              "delivery.cancelled",
              "webhook.test",
            ],
          },
          created_at: { type: "string", format: "date-time" },
          livemode: { type: "boolean" },
          data: {
            type: "object",
            properties: {
              delivery_id: { type: "string", format: "uuid" },
              reference: { type: "string" },
              metadata: { type: ["object", "null"], additionalProperties: true },
              status: { $ref: "#/components/schemas/DeliveryStatus" },
              proof_method: { type: ["string", "null"] },
              attempt: { type: "integer" },
              courier: {
                type: ["object", "null"],
                properties: { name: { type: "string" } },
              },
              failure_reason: { type: ["string", "null"] },
              occurred_at: { type: "string", format: "date-time" },
            },
          },
        },
      },
      ApiErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: {
                type: "string",
                description: API_ERROR_CODES.map((c) => `${c.httpStatus}: ${c.code}`).join(" | "),
                example: "INVALID",
              },
              message: {
                type: "string",
                example: "Paramètres de livraison invalides.",
              },
              fields: {
                type: "object",
                additionalProperties: { type: "string" },
              },
            },
          },
        },
      },
    },
    responses: {
      BadRequestError: {
        description: "Requête invalide (400) — champ manquant, format invalide ou JSON mal formé.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorResponse" },
          },
        },
      },
      UnauthorizedError: {
        description: "Non authentifié (401) — clé Bearer manquante, invalide ou révoquée.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorResponse" },
          },
        },
      },
      ForbiddenError: {
        description: "Accès interdit (403) — route de simulation appelée avec une clé LIVE ou entreprise suspendue.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorResponse" },
          },
        },
      },
      NotFoundError: {
        description: "Ressource introuvable (404) — livraison inexistante ou appartenant à un autre environnement/entreprise.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorResponse" },
          },
        },
      },
      ConflictError: {
        description: "Conflit métier (409) — référence en doublon (`DUPLICATE_REFERENCE`), modification après prise en charge (`AFTER_PICKUP`) ou conflit `Idempotency-Key`.",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ApiErrorResponse" },
          },
        },
      },
    },
  },
} as const;
