import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { ApiKeyError, listApiKeys } from "@/lib/api-keys/api-keys";
import { requireUser } from "@/lib/auth/user-session";
import { ApiKeysClient } from "./api-keys-client";

export const metadata: Metadata = { title: "Clés API — Ofika Delivery" };

export default function ApiKeysPage() {
  return (
    <>
      <Link href="/espace" className="text-sm text-ink-muted hover:underline">
        ← Accueil
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Clés API</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Authentifiez votre site ou boutique via l&apos;en-tête{" "}
        <code className="font-mono text-xs">Authorization: Bearer &lt;clé&gt;</code>.
      </p>
      <Suspense fallback={<p className="mt-6 text-sm text-ink-muted">Chargement des clés API…</p>}>
        <ApiKeysContent />
      </Suspense>
    </>
  );
}

async function ApiKeysContent() {
  const user = await requireUser();

  try {
    const keys = await listApiKeys(db, user);
    return <ApiKeysClient keys={keys} />;
  } catch (e) {
    if (e instanceof ApiKeyError && e.code === "FORBIDDEN") {
      return (
        <p role="alert" className="mt-6 rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
          {e.message}
        </p>
      );
    }
    throw e;
  }
}
