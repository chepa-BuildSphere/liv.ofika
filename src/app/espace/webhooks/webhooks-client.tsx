"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENT_TYPES,
  type PublicWebhookEndpointItem,
  type WebhookDeliveryHistoryItem,
} from "@/lib/webhooks/webhook-types";
import {
  createWebhookEndpointAction,
  deleteWebhookEndpointAction,
  retryWebhookDeliveryAction,
  sendTestWebhookAction,
  toggleWebhookEndpointAction,
  type CreateWebhookState,
  type EndpointMutationState,
  type RetryWebhookDeliveryState,
  type SendTestWebhookState,
} from "./actions";

const ENV_BADGE: Record<"TEST" | "LIVE", { label: string; className: string }> = {
  TEST: {
    label: "Test",
    className:
      "rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning",
  },
  LIVE: {
    label: "Production",
    className:
      "rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success",
  },
};

const DELIVERY_STATUS_BADGE: Record<
  WebhookDeliveryHistoryItem["status"],
  { label: string; className: string }
> = {
  SUCCEEDED: {
    label: "Envoyé",
    className:
      "rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success",
  },
  PENDING: {
    label: "En attente",
    className:
      "rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning",
  },
  FAILED: {
    label: "Échoué",
    className:
      "rounded-full border border-danger/30 bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger",
  },
};

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function EndpointActions({ endpoint }: { endpoint: PublicWebhookEndpointItem }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [testState, testAction, testPending] = useActionState<SendTestWebhookState, FormData>(
    sendTestWebhookAction,
    { status: "idle" },
  );
  const [toggleState, toggleAction, togglePending] = useActionState<EndpointMutationState, FormData>(
    toggleWebhookEndpointAction,
    { status: "idle" },
  );
  const [delState, delAction, delPending] = useActionState<EndpointMutationState, FormData>(
    deleteWebhookEndpointAction,
    { status: "idle" },
  );

  const testResult =
    testState.status !== "idle" && testState.endpointId === endpoint.id ? testState : null;

  return (
    <div className="space-y-2 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <form action={testAction}>
          <input type="hidden" name="endpointId" value={endpoint.id} />
          <button
            type="submit"
            disabled={testPending}
            className="btn-primary h-8 px-3 text-xs"
          >
            {testPending ? "Envoi…" : "Envoyer un webhook de test"}
          </button>
        </form>

        <form action={toggleAction}>
          <input type="hidden" name="endpointId" value={endpoint.id} />
          <input type="hidden" name="nextActive" value={String(!endpoint.isActive)} />
          <button
            type="submit"
            disabled={togglePending}
            className="btn-secondary h-8 px-3 text-xs"
          >
            {togglePending ? "Mise à jour…" : endpoint.isActive ? "Désactiver" : "Activer"}
          </button>
        </form>

        {confirmDelete ? (
          <form action={delAction} className="flex items-center gap-2">
            <input type="hidden" name="endpointId" value={endpoint.id} />
            <button
              type="submit"
              disabled={delPending}
              className="btn-secondary h-8 border-danger/40 px-3 text-xs text-danger"
            >
              {delPending ? "Suppression…" : "Confirmer la suppression"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="link text-xs"
            >
              Annuler
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="btn-secondary h-8 px-3 text-xs text-danger"
          >
            Supprimer
          </button>
        )}
      </div>

      {testResult?.status === "done" && (
        <div
          role="status"
          className={
            testResult.outcome.status === "SUCCEEDED"
              ? "rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-xs text-success"
              : "alert-error text-xs"
          }
        >
          <span className="font-semibold">
            Webhook de test {testResult.outcome.status === "SUCCEEDED" ? "reçu" : "en échec"} :
          </span>{" "}
          {testResult.outcome.responseStatus !== null
            ? `HTTP ${testResult.outcome.responseStatus}`
            : "aucune réponse HTTP"}
          {" · "}
          <span className="tabular-nums">{testResult.outcome.durationMs} ms</span>
          {testResult.outcome.error ? ` · ${testResult.outcome.error}` : ""}
        </div>
      )}

      {testResult?.status === "error" && (
        <p role="alert" className="alert-error text-xs">
          {testResult.message}
        </p>
      )}
      {toggleState.status === "error" && toggleState.endpointId === endpoint.id && (
        <p role="alert" className="alert-error text-xs">
          {toggleState.message}
        </p>
      )}
      {delState.status === "error" && delState.endpointId === endpoint.id && (
        <p role="alert" className="alert-error text-xs">
          {delState.message}
        </p>
      )}
    </div>
  );
}

function RetryDeliveryButton({ deliveryId }: { deliveryId: string }) {
  const [state, action, pending] = useActionState<RetryWebhookDeliveryState, FormData>(
    retryWebhookDeliveryAction,
    { status: "idle" },
  );

  return (
    <div className="space-y-1">
      <form action={action}>
        <input type="hidden" name="webhookDeliveryId" value={deliveryId} />
        <button
          type="submit"
          disabled={pending}
          className="btn-secondary h-8 px-3 text-xs"
        >
          {pending ? "Renvoi…" : "Renvoyer"}
        </button>
      </form>
      {state.status === "done" && state.webhookDeliveryId === deliveryId && (
        <p
          role="status"
          className={
            state.outcome.status === "SUCCEEDED"
              ? "text-xs text-success"
              : "text-xs text-danger"
          }
        >
          {state.outcome.responseStatus !== null
            ? `HTTP ${state.outcome.responseStatus}`
            : state.outcome.error ?? "Échec"}{" "}
          ({state.outcome.durationMs} ms)
        </p>
      )}
      {state.status === "error" && state.webhookDeliveryId === deliveryId && (
        <p role="alert" className="text-xs text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}

export function WebhooksClient({
  endpoints,
  deliveries,
}: {
  endpoints: PublicWebhookEndpointItem[];
  deliveries: WebhookDeliveryHistoryItem[];
}) {
  const [createState, createAction, createPending] = useActionState<CreateWebhookState, FormData>(
    createWebhookEndpointAction,
    { status: "idle" },
  );
  const [selectedEvents, setSelectedEvents] = useState<string[]>([...WEBHOOK_EVENT_TYPES]);
  const [dismissedSecret, setDismissedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const fields = createState.status === "error" ? createState.fields : {};
  const values = createState.status === "error" ? createState.values : undefined;
  const visibleSecret =
    createState.status === "created" && dismissedSecret !== createState.secret
      ? createState
      : null;

  function toggleEvent(ev: string) {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((item) => item !== ev) : [...prev, ev],
    );
  }

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      window.setTimeout(() => setCopiedSecret(false), 2500);
    } catch {
      setCopiedSecret(false);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <section aria-label="Configurer un webhook" className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Ajouter une URL de webhook</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Chaque événement est signé HMAC-SHA256 via l&apos;en-tête{" "}
              <code className="font-mono">X-Ofika-Signature: t=…,v1=…</code>.{" "}
              <Link href="/espace/documentation#webhooks" className="link">
                Voir un exemple de vérification →
              </Link>
            </p>
          </div>
        </div>

        <form action={createAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
            <label className="field-label">
              URL de réception (HTTP/HTTPS publique)
              <input
                name="url"
                type="url"
                required
                defaultValue={values?.url ?? ""}
                placeholder="https://boutique.ci/api/webhooks/ofika"
                aria-invalid={!!fields.url}
                className="input h-10 text-sm"
              />
              {fields.url && <span className="field-error text-xs">{fields.url}</span>}
            </label>

            <label className="field-label">
              Environnement
              <select
                name="environment"
                defaultValue={values?.environment ?? "TEST"}
                aria-invalid={!!fields.environment}
                className="input h-10 text-sm"
              >
                <option value="TEST">Test (livemode: false)</option>
                <option value="LIVE">Production (livemode: true)</option>
              </select>
              {fields.environment && (
                <span className="field-error text-xs">{fields.environment}</span>
              )}
            </label>
          </div>

          <fieldset className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-xs font-medium text-ink">Événements écoutés</legend>
              <button
                type="button"
                onClick={() =>
                  setSelectedEvents((prev) =>
                    prev.length === WEBHOOK_EVENT_TYPES.length ? [] : [...WEBHOOK_EVENT_TYPES],
                  )
                }
                className="link text-xs"
              >
                {selectedEvents.length === WEBHOOK_EVENT_TYPES.length
                  ? "Tout décocher"
                  : "Tout cocher"}
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {WEBHOOK_EVENT_TYPES.map((ev) => (
                <label
                  key={ev}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs"
                >
                  <input
                    type="checkbox"
                    name="events"
                    value={ev}
                    checked={selectedEvents.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                  />
                  <span>{WEBHOOK_EVENT_LABELS[ev]}</span>
                </label>
              ))}
            </div>
            {fields.events && <p className="field-error text-xs">{fields.events}</p>}
          </fieldset>

          {createState.status === "error" && createState.message && (
            <p role="alert" className="alert-error text-xs">
              {createState.message}
            </p>
          )}

          <button type="submit" disabled={createPending} className="btn-primary h-10 px-4 text-sm">
            {createPending ? "Enregistrement…" : "Enregistrer le webhook"}
          </button>
        </form>

        {visibleSecret && (
          <div
            role="status"
            className="space-y-2 rounded-lg border border-warning/40 bg-warning-soft p-4 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ink">
                Secret de signature HMAC ({visibleSecret.environment === "TEST" ? "Test" : "Production"})
              </p>
              <button
                type="button"
                onClick={() => setDismissedSecret(visibleSecret.secret)}
                className="link text-xs"
              >
                Fermer
              </button>
            </div>
            <p className="text-xs text-warning">
              Enregistrez ce secret dans vos variables d&apos;environnement pour vérifier l&apos;en-tête{" "}
              <code className="font-mono">X-Ofika-Signature</code>.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded border border-line bg-paper px-3 py-2 font-mono text-xs select-all">
                {visibleSecret.secret}
              </code>
              <button
                type="button"
                onClick={() => copySecret(visibleSecret.secret)}
                className="btn-secondary h-9 px-3 text-xs"
              >
                {copiedSecret ? "Copié ✓" : "Copier"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section aria-label="Endpoints configurés" className="space-y-3">
        <h2 className="text-lg font-semibold">Endpoints enregistrés ({endpoints.length})</h2>
        {endpoints.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
            Aucun webhook configuré pour l&apos;instant.
          </p>
        ) : (
          <ul className="card divide-y divide-line text-sm">
            {endpoints.map((ep) => {
              const badge = ENV_BADGE[ep.environment];
              return (
                <li key={ep.id} className="space-y-1.5 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-xs font-semibold text-ink">{ep.url}</code>
                      <span className={badge.className}>{badge.label}</span>
                      <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink-muted">
                        {ep.isActive ? "Actif" : "Désactivé"}
                      </span>
                    </div>
                    <span className="text-xs tabular-nums text-ink-muted">
                      Créé le {formatDateTime(ep.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-ink-muted">
                    Événements :{" "}
                    <span className="font-mono text-ink">{ep.events.join(", ")}</span>
                  </p>
                  <EndpointActions endpoint={ep} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Historique des envois" className="space-y-3">
        <h2 className="text-lg font-semibold">Historique des envois ({deliveries.length})</h2>
        {deliveries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
            Aucun envoi de webhook enregistré pour l&apos;instant.
          </p>
        ) : (
          <ul className="card divide-y divide-line text-sm">
            {deliveries.map((d) => {
              const st = DELIVERY_STATUS_BADGE[d.status];
              const envBadge = ENV_BADGE[d.environment];
              return (
                <li
                  key={d.id}
                  className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="font-mono text-xs font-semibold">{d.eventType}</code>
                      <span className={envBadge.className}>{envBadge.label}</span>
                      <span className={st.className}>{st.label}</span>
                      {d.reference && (
                        <span className="font-mono text-xs text-ink-muted">{d.reference}</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted">
                      Vers <code className="font-mono text-ink">{d.endpointUrl}</code> ·{" "}
                      <span className="tabular-nums">{d.attemptCount} tentative(s)</span>
                      {d.lastResponseStatus !== null ? ` · HTTP ${d.lastResponseStatus}` : ""}
                      {d.lastError ? ` · ${d.lastError}` : ""}
                    </p>
                    <p className="text-xs tabular-nums text-ink-muted">
                      Créé le {formatDateTime(d.createdAt)}
                      {d.deliveredAt
                        ? ` · Reçu le ${formatDateTime(d.deliveredAt)}`
                        : d.status === "PENDING"
                          ? ` · Prochain essai : ${formatDateTime(d.nextAttemptAt)}`
                          : ""}
                    </p>
                  </div>

                  <RetryDeliveryButton deliveryId={d.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
