import type { ApiKeyEnvironment } from "@/lib/security/api-key";

export const WEBHOOK_EVENT_TYPES = [
  "delivery.created",
  "delivery.assigned",
  "delivery.picked_up",
  "delivery.arrived",
  "delivery.delivered",
  "delivery.failed",
  "delivery.retry",
  "delivery.returning",
  "delivery.return_received",
  "delivery.cancelled",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
  "delivery.created": "Livraison créée (delivery.created)",
  "delivery.assigned": "Livreur affecté (delivery.assigned)",
  "delivery.picked_up": "Prise en charge (delivery.picked_up)",
  "delivery.arrived": "Livreur arrivé (delivery.arrived)",
  "delivery.delivered": "Livraison effectuée (delivery.delivered)",
  "delivery.failed": "Échec de livraison (delivery.failed)",
  "delivery.retry": "Nouvelle tentative (delivery.retry)",
  "delivery.returning": "Retour au dépôt en cours (delivery.returning)",
  "delivery.return_received": "Retour réceptionné (delivery.return_received)",
  "delivery.cancelled": "Livraison annulée (delivery.cancelled)",
};

export type PublicWebhookEndpointItem = {
  id: string;
  url: string;
  environment: ApiKeyEnvironment;
  events: string[];
  isActive: boolean;
  createdAt: Date;
};

export type WebhookDeliveryHistoryItem = {
  id: string;
  endpointId: string;
  endpointUrl: string;
  environment: ApiKeyEnvironment;
  eventType: string;
  reference: string | null;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  attemptCount: number;
  nextAttemptAt: Date;
  lastResponseStatus: number | null;
  lastError: string | null;
  deliveredAt: Date | null;
  createdAt: Date;
};

export type DispatchWebhookOutcome = {
  webhookDeliveryId: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  responseStatus: number | null;
  durationMs: number;
  error: string | null;
};
