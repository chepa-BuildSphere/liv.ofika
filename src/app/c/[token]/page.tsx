import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Wordmark } from "@/components/wordmark";
import { db } from "@/db";
import { getPublicQrStatus } from "@/lib/deliveries/deliveries";
import { ClientConfirmView } from "./client-confirm-view";

export const metadata: Metadata = {
  title: "Confirmation de livraison — Ofika Delivery",
};

export default function ClientConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="border-b border-line bg-paper px-4 py-3 text-center">
        <Wordmark />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <Suspense
          fallback={
            <p className="card p-6 text-center text-sm text-ink-muted">
              Vérification du lien de livraison…
            </p>
          }
        >
          <ClientConfirmLoader params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function ClientConfirmLoader({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await connection();
  const { token } = await params;
  const initialStatus = await getPublicQrStatus(db, token);
  return <ClientConfirmView token={token} initialStatus={initialStatus} />;
}
