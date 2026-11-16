"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import { env } from "@/env";
import { requireUser } from "@/lib/auth/user-session";
import { getRequestMeta } from "@/lib/request-meta";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  retryWebhookDelivery,
  sendTestWebhook,
  toggleWebhookEndpoint,
  WebhookError,
  type DispatchWebhookOutcome,
  type WebhookField,
} from "@/lib/webhooks/webhooks";

type Fields = Partial<Record<WebhookField, string>>;

export type CreateWebhookState =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fields: Fields;
      values: { url: string; environment: string; events: string[] };
    }
  | {
      status: "created";
      endpointId: string;
      url: string;
      environment: "TEST" | "LIVE";
      secret: string;
    };

export async function createWebhookEndpointAction(
  _prev: CreateWebhookState,
  formData: FormData,
): Promise<CreateWebhookState> {
  const actor = await requireUser();
  const url = String(formData.get("url") ?? "");
  const environment = String(formData.get("environment") ?? "TEST");
  const events = formData.getAll("events").map((e) => String(e));

  try {
    const res = await createWebhookEndpoint(
      db,
      actor,
      { url, environment, events },
      env.encryptionKey,
      await getRequestMeta(),
    );
    refresh();
    return {
      status: "created",
      endpointId: res.endpoint.id,
      url: res.endpoint.url,
      environment: res.endpoint.environment,
      secret: res.secret,
    };
  } catch (e) {
    if (e instanceof WebhookError) {
      return {
        status: "error",
        message: e.fields ? undefined : e.message,
        fields: e.fields ?? {},
        values: { url, environment, events },
      };
    }
    throw e;
  }
}

export type EndpointMutationState =
  | { status: "idle" }
  | { status: "error"; endpointId: string; message: string }
  | { status: "done"; endpointId: string };

export async function toggleWebhookEndpointAction(
  _prev: EndpointMutationState,
  formData: FormData,
): Promise<EndpointMutationState> {
  const actor = await requireUser();
  const endpointId = String(formData.get("endpointId") ?? "");
  const nextActive = String(formData.get("nextActive") ?? "") === "true";

  try {
    await toggleWebhookEndpoint(db, actor, endpointId, nextActive, await getRequestMeta());
    refresh();
    return { status: "done", endpointId };
  } catch (e) {
    if (e instanceof WebhookError) {
      return { status: "error", endpointId, message: e.message };
    }
    throw e;
  }
}

export async function deleteWebhookEndpointAction(
  _prev: EndpointMutationState,
  formData: FormData,
): Promise<EndpointMutationState> {
  const actor = await requireUser();
  const endpointId = String(formData.get("endpointId") ?? "");

  try {
    await deleteWebhookEndpoint(db, actor, endpointId, await getRequestMeta());
    refresh();
    return { status: "done", endpointId };
  } catch (e) {
    if (e instanceof WebhookError) {
      return { status: "error", endpointId, message: e.message };
    }
    throw e;
  }
}

export type SendTestWebhookState =
  | { status: "idle" }
  | { status: "error"; endpointId: string; message: string }
  | { status: "done"; endpointId: string; outcome: DispatchWebhookOutcome };

export async function sendTestWebhookAction(
  _prev: SendTestWebhookState,
  formData: FormData,
): Promise<SendTestWebhookState> {
  const actor = await requireUser();
  const endpointId = String(formData.get("endpointId") ?? "");

  try {
    const outcome = await sendTestWebhook(db, actor, endpointId, {
      masterKey: env.encryptionKey,
      meta: await getRequestMeta(),
    });
    refresh();
    return { status: "done", endpointId, outcome };
  } catch (e) {
    if (e instanceof WebhookError) {
      return { status: "error", endpointId, message: e.message };
    }
    throw e;
  }
}

export type RetryWebhookDeliveryState =
  | { status: "idle" }
  | { status: "error"; webhookDeliveryId: string; message: string }
  | { status: "done"; webhookDeliveryId: string; outcome: DispatchWebhookOutcome };

export async function retryWebhookDeliveryAction(
  _prev: RetryWebhookDeliveryState,
  formData: FormData,
): Promise<RetryWebhookDeliveryState> {
  const actor = await requireUser();
  const webhookDeliveryId = String(formData.get("webhookDeliveryId") ?? "");

  try {
    const outcome = await retryWebhookDelivery(db, actor, webhookDeliveryId, {
      masterKey: env.encryptionKey,
      meta: await getRequestMeta(),
    });
    refresh();
    return { status: "done", webhookDeliveryId, outcome };
  } catch (e) {
    if (e instanceof WebhookError) {
      return { status: "error", webhookDeliveryId, message: e.message };
    }
    throw e;
  }
}
