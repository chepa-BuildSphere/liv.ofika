export type QuickstartStep = {
  step: number;
  title: string;
  description: string;
  code: string;
};

export type ApiEndpointDoc = {
  method: "GET" | "POST" | "PATCH";
  path: string;
  description: string;
  testOnly?: boolean;
  example: string;
};

export type ApiErrorCodeDoc = {
  httpStatus: number;
  code: string;
  meaning: string;
};

export const QUICKSTART_15_MINUTES: readonly QuickstartStep[] = [
  {
    step: 1,
    title: "Créer une clé API Test",
    description:
      "Dans Clés API (/espace/cles-api), générez une clé Test (préfixe ofk_test_…). Vos essais n'apparaissent pas chez les livreurs et ne sont jamais facturés.",
    code: `export OFIKA_KEY="ofk_test_votre_cle_secrete"`,
  },
  {
    step: 2,
    title: "Créer une livraison depuis votre site",
    description:
      "Appelez POST /v1/deliveries avec votre référence de commande et vos metadata. Ajoutez Idempotency-Key pour éviter tout doublon en cas de nouvel essai réseau.",
    code: `curl -X POST https://votre-domaine/v1/deliveries \\
  -H "Authorization: Bearer $OFIKA_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: order-1042-create" \\
  -d '{
    "reference": "CMD-1042",
    "recipient_name": "Awa Koné",
    "recipient_phone": "07 07 07 07 07",
    "address": "Cocody Angré, Immeuble Bleu",
    "amount_to_collect": 15000,
    "metadata": { "order_id": 1042, "boutique": "sip" },
    "proof_mode": "QR"
  }'`,
  },
  {
    step: 3,
    title: "Brancher un webhook Test et simuler la livraison",
    description:
      "Enregistrez votre URL de test dans Webhooks (/espace/webhooks), cliquez sur « Envoyer un webhook de test », puis faites avancer la livraison sans livreur avec POST /v1/test/deliveries/{id}/simulate.",
    code: `curl -X POST https://votre-domaine/v1/test/deliveries/<DELIVERY_ID>/simulate \\
  -H "Authorization: Bearer $OFIKA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "status": "DELIVERED" }'`,
  },
  {
    step: 4,
    title: "Passer en Production",
    description:
      "Créez une clé Production (ofk_live_…) et une URL webhook Production dans votre espace. Remplacez OFIKA_KEY sur votre serveur : vos commandes deviennent visibles aux livreurs et les webhooks arrivent avec livemode: true.",
    code: `export OFIKA_KEY="ofk_live_votre_cle_production"`,
  },
];

export const V1_ENDPOINTS_DOCS: readonly ApiEndpointDoc[] = [
  {
    method: "POST",
    path: "/v1/deliveries",
    description: "Créer une livraison (avec reference, metadata, proof_mode: QR et Idempotency-Key).",
    example: `curl -X POST /v1/deliveries -H "Authorization: Bearer $OFIKA_KEY" -H "Idempotency-Key: k1" -d '{"reference":"CMD-1042","recipient_name":"Awa Koné","recipient_phone":"0707070707","address":"Cocody"}'`,
  },
  {
    method: "POST",
    path: "/v1/deliveries/import",
    description: "Import en lot au format CSV brut (text/csv) ou JSON {\"csv\": \"...\"}.",
    example: `curl -X POST /v1/deliveries/import -H "Authorization: Bearer $OFIKA_KEY" -H "Content-Type: text/csv" --data-binary @livraisons.csv`,
  },
  {
    method: "GET",
    path: "/v1/deliveries",
    description: "Lister les livraisons (filtres : status, courier_id, date, from, to, reference).",
    example: `curl "/v1/deliveries?reference=CMD-1042" -H "Authorization: Bearer $OFIKA_KEY"`,
  },
  {
    method: "GET",
    path: "/v1/deliveries/{id}",
    description: "Détail d'une livraison, statut courant, méthode de preuve et tarif éventuel.",
    example: `curl /v1/deliveries/<ID> -H "Authorization: Bearer $OFIKA_KEY"`,
  },
  {
    method: "PATCH",
    path: "/v1/deliveries/{id}",
    description: "Modifier une livraison avant sa prise en charge (CREATED ou ASSIGNED).",
    example: `curl -X PATCH /v1/deliveries/<ID> -H "Authorization: Bearer $OFIKA_KEY" -d '{"address":"Marcory Zone 4"}'`,
  },
  {
    method: "POST",
    path: "/v1/deliveries/{id}/assign",
    description: "Affecter, réaffecter ou désaffecter un livreur (courier_id ou null).",
    example: `curl -X POST /v1/deliveries/<ID>/assign -H "Authorization: Bearer $OFIKA_KEY" -d '{"courier_id":"<COURIER_ID>"}'`,
  },
  {
    method: "POST",
    path: "/v1/deliveries/{id}/cancel",
    description: "Annuler une livraison avant sa prise en charge (motif facultatif).",
    example: `curl -X POST /v1/deliveries/<ID>/cancel -H "Authorization: Bearer $OFIKA_KEY" -d '{"reason":"Commande annulée"}'`,
  },
  {
    method: "GET",
    path: "/v1/deliveries/{id}/events",
    description: "Historique complet et journal d'audit chaîné de la livraison.",
    example: `curl /v1/deliveries/<ID>/events -H "Authorization: Bearer $OFIKA_KEY"`,
  },
  {
    method: "GET",
    path: "/v1/deliveries/{id}/label.pdf",
    description: "Télécharger le bordereau PDF A4 contenant le QR de référence.",
    example: `curl /v1/deliveries/<ID>/label.pdf -H "Authorization: Bearer $OFIKA_KEY" -o bordereau.pdf`,
  },
  {
    method: "GET",
    path: "/v1/couriers",
    description: "Lister les livreurs actifs rattachés à votre entreprise.",
    example: `curl /v1/couriers -H "Authorization: Bearer $OFIKA_KEY"`,
  },
  {
    method: "POST",
    path: "/v1/test/deliveries/{id}/simulate",
    testOnly: true,
    description: "Réservé aux clés Test (ofk_test_…) : simule un changement de statut (ASSIGNED, PICKED_UP, ARRIVED, DELIVERED, DELIVERY_FAILED, RETURNING, RETURN_RECEIVED).",
    example: `curl -X POST /v1/test/deliveries/<ID>/simulate -H "Authorization: Bearer ofk_test_..." -d '{"status":"DELIVERED"}'`,
  },
];

export const WEBHOOK_PAYLOAD_EXAMPLE = `{
  "id": "evt_9f2c4a8d10...",
  "type": "delivery.delivered",
  "created_at": "2026-11-16T10:42:07Z",
  "livemode": true,
  "data": {
    "delivery_id": "3b1e8c40-...",
    "reference": "CMD-1042",
    "metadata": { "order_id": 1042, "boutique": "sip" },
    "status": "DELIVERED",
    "proof_method": "QR",
    "attempt": 1,
    "courier": { "name": "Kwamé" },
    "failure_reason": null,
    "occurred_at": "2026-11-16T10:42:05Z"
  }
}`;

export const WEBHOOK_VERIFY_NODE_SNIPPET = `import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyOfikaWebhook(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader) return false;
  const pairs = Object.fromEntries(
    signatureHeader.split(",").map((part) => {
      const i = part.indexOf("=");
      return i === -1 ? ["", ""] : [part.slice(0, i).trim(), part.slice(i + 1).trim()];
    }),
  );

  const t = Number(pairs.t);
  const v1 = pairs.v1;
  if (!Number.isInteger(t) || !v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSeconds) return false;

  const expected = createHmac("sha256", webhookSecret)
    .update(\`\${t}.\${rawBody}\`, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(v1, "hex");
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}`;

export const API_ERROR_CODES: readonly ApiErrorCodeDoc[] = [
  { httpStatus: 400, code: "INVALID / INVALID_JSON", meaning: "Champ manquant, format invalide, CSV erroné ou JSON mal formé." },
  { httpStatus: 401, code: "INVALID_KEY / REVOKED_KEY", meaning: "En-tête Authorization: Bearer absent, clé inconnue ou clé révoquée." },
  { httpStatus: 403, code: "FORBIDDEN / COMPANY_SUSPENDED", meaning: "Route de simulation appelée avec une clé LIVE, ou entreprise suspendue." },
  { httpStatus: 404, code: "NOT_FOUND", meaning: "Livraison introuvable, d'une autre entreprise ou d'un autre mode (test/live)." },
  { httpStatus: 409, code: "DUPLICATE_REFERENCE / AFTER_PICKUP / IDEMPOTENCY_KEY_CONFLICT", meaning: "Référence déjà utilisée, modification après prise en charge ou même Idempotency-Key avec un autre corps." },
];
