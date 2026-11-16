import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import {
  listWebhookDeliveries,
  listWebhookEndpoints,
  WebhookError,
} from "@/lib/webhooks/webhooks";
import { WebhooksClient } from "./webhooks-client";

export const metadata: Metadata = { title: "Webhooks — Ofika Delivery" };

export default function WebhooksPage() {
  return (
    <>
      <Link href="/espace" className="text-sm text-ink-muted hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Webhooks</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Configurez vos URLs de notification en mode Test et Production, testez la réception en direct et consultez l&apos;historique des envois.
      </p>
      <Suspense fallback={<p className="mt-6 text-sm text-ink-muted">Chargement des webhooks…</p>}>
        <WebhooksContent />
      </Suspense>
    </>
  );
}

async function WebhooksContent() {
  const user = await requireUser();

  try {
    const [endpoints, deliveries] = await Promise.all([
      listWebhookEndpoints(db, user),
      listWebhookDeliveries(db, user, 50),
    ]);
    return <WebhooksClient endpoints={endpoints} deliveries={deliveries} />;
  } catch (e) {
    if (e instanceof WebhookError && e.code === "FORBIDDEN") {
      return (
        <p role="alert" className="mt-6 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
          {e.message}
        </p>
      );
    }
    throw e;
  }
}
