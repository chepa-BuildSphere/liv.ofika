"use client";

import { useActionState, useState } from "react";
import type { PublicApiKeyItem } from "@/lib/api-keys/api-keys";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  type CreateApiKeyState,
  type RevokeApiKeyState,
} from "./actions";

const ENV_BADGE: Record<"TEST" | "LIVE", { label: string; className: string }> = {
  TEST: {
    label: "Test",
    className: "rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning",
  },
  LIVE: {
    label: "Production",
    className: "rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success",
  },
};

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function RevokeKeyButton({
  apiKeyId,
  name,
}: {
  apiKeyId: string;
  name: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<RevokeApiKeyState, FormData>(
    revokeApiKeyAction,
    { status: "idle" },
  );

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn-secondary h-8 px-3 text-xs text-danger"
      >
        Révoquer
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="apiKeyId" value={apiKeyId} />
        <button
          type="submit"
          disabled={pending}
          className="btn-secondary h-8 border-danger/40 px-3 text-xs text-danger"
        >
          {pending ? "Révocation…" : `Confirmer révocation (${name})`}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="link text-xs"
        >
          Annuler
        </button>
      </form>
      {state.status === "error" && state.apiKeyId === apiKeyId && (
        <p role="alert" className="alert-error text-xs">
          {state.message}
        </p>
      )}
    </div>
  );
}

export function ApiKeysClient({ keys }: { keys: PublicApiKeyItem[] }) {
  const [createState, createAction, createPending] = useActionState<CreateApiKeyState, FormData>(
    createApiKeyAction,
    { status: "idle" },
  );
  const [copied, setCopied] = useState(false);
  const [dismissedSecret, setDismissedSecret] = useState<string | null>(null);

  const fields = createState.status === "error" ? createState.fields : {};
  const values = createState.status === "error" ? createState.values : undefined;

  const visibleSecret =
    createState.status === "created" && dismissedSecret !== createState.secretKey
      ? createState
      : null;

  async function copySecret(secretKey: string) {
    try {
      await navigator.clipboard.writeText(secretKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <section aria-label="Créer une clé API" className="card space-y-4 p-5">
        <div>
          <h2 className="text-base font-semibold">Nouvelle clé API</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Utilisez une clé <strong>Test</strong> (<code>ofk_test_…</code>) pour brancher et tester votre site sans impacter vos livreurs ni votre facturation, puis une clé <strong>Production</strong> (<code>ofk_live_…</code>).
          </p>
        </div>

        <form action={createAction} className="grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
          <label className="field-label">
            Nom de la clé
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              defaultValue={values?.name ?? ""}
              placeholder="Ex. Boutique Shopify, Site principal…"
              aria-invalid={!!fields.name}
              className="input h-10 text-sm"
            />
            {fields.name && <span className="field-error text-xs">{fields.name}</span>}
          </label>

          <label className="field-label">
            Environnement
            <select
              name="environment"
              defaultValue={values?.environment ?? "TEST"}
              aria-invalid={!!fields.environment}
              className="input h-10 text-sm"
            >
              <option value="TEST">Test (ofk_test_…)</option>
              <option value="LIVE">Production (ofk_live_…)</option>
            </select>
            {fields.environment && <span className="field-error text-xs">{fields.environment}</span>}
          </label>

          <button type="submit" disabled={createPending} className="btn-primary h-10 px-4 text-sm">
            {createPending ? "Création…" : "Créer la clé"}
          </button>
        </form>

        {createState.status === "error" && createState.message && (
          <p role="alert" className="alert-error text-xs">
            {createState.message}
          </p>
        )}

        {visibleSecret && (
          <div
            role="status"
            className="space-y-2 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ink">
                Clé {visibleSecret.environment === "TEST" ? "Test" : "Production"} créée — {visibleSecret.keyName}
              </p>
              <button
                type="button"
                onClick={() => setDismissedSecret(visibleSecret.secretKey)}
                className="link text-xs"
              >
                Fermer
              </button>
            </div>
            <p className="text-xs text-warning">
              Copiez cette clé maintenant : pour votre sécurité, elle ne sera plus jamais affichée après fermeture ou rechargement de la page.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded border border-line bg-paper px-3 py-2 font-mono text-xs select-all">
                {visibleSecret.secretKey}
              </code>
              <button
                type="button"
                onClick={() => copySecret(visibleSecret.secretKey)}
                className="btn-secondary h-9 px-3 text-xs"
              >
                {copied ? "Copiée ✓" : "Copier"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Clés API existantes" className="space-y-3">
        <h2 className="text-lg font-semibold">Clés API ({keys.length})</h2>
        {keys.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
            Aucune clé API créée pour l&apos;instant.
          </p>
        ) : (
          <ul className="card divide-y divide-line text-sm">
            {keys.map((k) => {
              const badge = ENV_BADGE[k.environment];
              return (
                <li
                  key={k.id}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{k.name}</span>
                      <span className={badge.className}>{badge.label}</span>
                      {k.revokedAt ? (
                        <span className="rounded-full border border-danger/30 bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger">
                          Révoquée
                        </span>
                      ) : (
                        <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink-muted">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted">
                      Préfixe : <code className="font-mono text-ink">{k.prefix}…</code> · Créée par{" "}
                      {k.createdByName} le{" "}
                      <span className="tabular-nums">{formatDateTime(k.createdAt)}</span>
                    </p>
                    <p className="text-xs text-ink-muted">
                      {k.lastUsedAt ? (
                        <>
                          Dernière utilisation :{" "}
                          <span className="tabular-nums">{formatDateTime(k.lastUsedAt)}</span>
                        </>
                      ) : (
                        "Jamais utilisée"
                      )}
                      {k.revokedAt && (
                        <>
                          {" · "}Révoquée le{" "}
                          <span className="tabular-nums">{formatDateTime(k.revokedAt)}</span>
                        </>
                      )}
                    </p>
                  </div>

                  {!k.revokedAt && <RevokeKeyButton apiKeyId={k.id} name={k.name} />}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
