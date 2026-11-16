"use server";

import { refresh } from "next/cache";
import { db } from "@/db";
import {
  ApiKeyError,
  createApiKey,
  revokeApiKey,
  type ApiKeyField,
} from "@/lib/api-keys/api-keys";
import { requireUser } from "@/lib/auth/user-session";
import { getRequestMeta } from "@/lib/request-meta";

type Fields = Partial<Record<ApiKeyField, string>>;

export type CreateApiKeyState =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fields: Fields;
      values: { name: string; environment: string };
    }
  | {
      status: "created";
      secretKey: string;
      keyName: string;
      environment: "TEST" | "LIVE";
    };

export async function createApiKeyAction(
  _prev: CreateApiKeyState,
  formData: FormData,
): Promise<CreateApiKeyState> {
  const actor = await requireUser();
  const name = String(formData.get("name") ?? "");
  const environment = String(formData.get("environment") ?? "TEST");

  try {
    const res = await createApiKey(
      db,
      actor,
      { name, environment },
      await getRequestMeta(),
    );
    refresh();
    return {
      status: "created",
      secretKey: res.secretKey,
      keyName: res.apiKey.name,
      environment: res.apiKey.environment,
    };
  } catch (e) {
    if (e instanceof ApiKeyError) {
      return {
        status: "error",
        message: e.fields ? undefined : e.message,
        fields: e.fields ?? {},
        values: { name, environment },
      };
    }
    throw e;
  }
}

export type RevokeApiKeyState =
  | { status: "idle" }
  | { status: "error"; apiKeyId: string; message: string }
  | { status: "done"; apiKeyId: string };

export async function revokeApiKeyAction(
  _prev: RevokeApiKeyState,
  formData: FormData,
): Promise<RevokeApiKeyState> {
  const actor = await requireUser();
  const apiKeyId = String(formData.get("apiKeyId") ?? "");

  try {
    await revokeApiKey(db, actor, apiKeyId, await getRequestMeta());
    refresh();
    return { status: "done", apiKeyId };
  } catch (e) {
    if (e instanceof ApiKeyError) {
      return {
        status: "error",
        apiKeyId,
        message: e.message,
      };
    }
    throw e;
  }
}
