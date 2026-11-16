import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth/user-session";
import { listCouriers } from "@/lib/couriers/couriers";
import {
  DELIVERY_STATUS_LABEL,
  DeliveryError,
  deliveryStatusLabel,
  getDeliveryDetail,
  RETURN_CONDITION_LABEL,
} from "@/lib/deliveries/deliveries";
import { isSafeMediaUrl } from "@/lib/media/safe-url";
import { formatPhone } from "@/lib/validation";
import { DeliveryRowActions } from "../delivery-row-actions";
import { ForceDeliveredForm } from "./force-delivered-form";

export const metadata: Metadata = { title: "Détail livraison — Ofika Delivery" };

function formatDateTime(d: Date): string {
  return d.toLocaleString("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function hasMetadataEntries(metadata: unknown): metadata is Record<string, unknown> {
  return Boolean(
    metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      Object.keys(metadata as Record<string, unknown>).length > 0,
  );
}

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Chargement de la livraison…</p>}>
      <DeliveryDetailView params={params} />
    </Suspense>
  );
}

async function DeliveryDetailView({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let detail;
  try {
    detail = await getDeliveryDetail(db, user, id);
  } catch (e) {
    if (e instanceof DeliveryError) {
      if (e.code === "NOT_FOUND") notFound();
      if (e.code === "FORBIDDEN") {
        return (
          <div className="space-y-4">
            <Link href="/espace/livraisons" className="link text-sm">
              ← Retour aux livraisons
            </Link>
            <div role="alert" className="rounded-lg border border-warning/30 bg-warning-soft p-4 text-sm text-warning">
              {e.message}
            </div>
          </div>
        );
      }
    }
    throw e;
  }

  const d = detail.delivery;
  const beforePickup = d.status === "CREATED" || d.status === "ASSIGNED";
  const attachedCouriers =
    detail.canEdit && beforePickup
      ? (await listCouriers(db, user))
          .filter((c) => c.attached)
          .map((c) => ({ id: c.id, name: c.name }))
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/espace/livraisons" className="link text-sm">
          ← Retour aux livraisons
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {d.isTest && (
            <span className="rounded-full border border-warning/40 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
              TEST
            </span>
          )}
          {detail.canGeneratePdf && (
            <a
              href={`/espace/livraisons/${d.id}/bordereau.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Bordereau PDF
            </a>
          )}
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium">
            {deliveryStatusLabel(d.status, d.proofMethod)}
          </span>
        </div>
      </div>

      {d.isTest && (
        <div
          role="status"
          className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          <strong>TEST</strong> — Livraison créée en mode test : jamais envoyée aux livreurs et jamais facturée.
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Livraison <span className="font-mono">{d.reference}</span>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Pour {d.recipientName}
          {d.recipientPhone ? ` · ${formatPhone(d.recipientPhone)}` : " · Téléphone masqué"}
        </p>
      </div>

      <section aria-label="Informations de la livraison" className="card space-y-4 p-5">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Destinataire</dt>
            <dd className="mt-0.5 font-medium">{d.recipientName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Téléphone</dt>
            <dd className="mt-0.5 tabular-nums">{d.recipientPhone ? formatPhone(d.recipientPhone) : "Masqué"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Livreur affecté</dt>
            <dd className="mt-0.5">{detail.courierName ?? "Non affectée"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Adresse</dt>
            <dd className="mt-0.5">
              {d.address}
              {d.district ? ` (${d.district})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Description du colis</dt>
            <dd className="mt-0.5">{d.packageDescription ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Montant à encaisser</dt>
            <dd className="mt-0.5 tabular-nums">
              {d.amountToCollect !== null ? `${d.amountToCollect.toLocaleString("fr-FR")} F CFA` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Mode de preuve demandé</dt>
            <dd className="mt-0.5">{d.proofMode === "QR_OTP" ? "QR code + OTP" : "QR code"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Tentative courante</dt>
            <dd className="mt-0.5 tabular-nums">{d.currentAttempt}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Créée le</dt>
            <dd className="mt-0.5 tabular-nums">{formatDateTime(d.createdAt)}</dd>
          </div>
          {d.assignedAt && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Affectée le</dt>
              <dd className="mt-0.5 tabular-nums">{formatDateTime(d.assignedAt)}</dd>
            </div>
          )}
          {d.pickedUpAt && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Prise en charge le</dt>
              <dd className="mt-0.5 tabular-nums">{formatDateTime(d.pickedUpAt)}</dd>
            </div>
          )}
          {d.deliveredAt && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Livrée le</dt>
              <dd className="mt-0.5 tabular-nums">{formatDateTime(d.deliveredAt)}</dd>
            </div>
          )}
          {d.cancelledAt && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Annulée le</dt>
              <dd className="mt-0.5 tabular-nums">{formatDateTime(d.cancelledAt)}</dd>
            </div>
          )}
          {d.proofMethod && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Preuve validée</dt>
              <dd className="mt-0.5 font-mono text-xs">{d.proofMethod}</dd>
            </div>
          )}
          {d.billedPrice !== null && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Tarif facturé</dt>
              <dd className="mt-0.5 tabular-nums">{d.billedPrice.toLocaleString("fr-FR")} F CFA</dd>
            </div>
          )}
          {d.comment && (
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">Commentaire</dt>
              <dd className="mt-0.5 whitespace-pre-wrap">{d.comment}</dd>
            </div>
          )}
        </dl>

        {hasMetadataEntries(d.metadata) && (
          <div className="border-t border-line pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Métadonnées</p>
            <pre className="mt-1.5 overflow-x-auto rounded bg-surface p-3 font-mono text-xs">
              {JSON.stringify(d.metadata, null, 2)}
            </pre>
          </div>
        )}

        {!d.isTest && detail.canEdit && d.recipientPhone !== null && beforePickup && (
          <div className="border-t border-line pt-4">
            <DeliveryRowActions
              couriers={attachedCouriers}
              delivery={{
                id: d.id,
                reference: d.reference,
                status: d.status,
                courierId: d.courierId,
                recipientName: d.recipientName,
                recipientPhone: d.recipientPhone,
                address: d.address,
                district: d.district,
                packageDescription: d.packageDescription,
                amountToCollect: d.amountToCollect,
                comment: d.comment,
              }}
            />
          </div>
        )}

        {!d.isTest && (detail.canForceDelivered || detail.cannotForceDeliveredReason) && (
          <div className="border-t border-line pt-4">
            {detail.canForceDelivered ? (
              <ForceDeliveredForm deliveryId={d.id} reference={d.reference} />
            ) : (
              <p
                role="status"
                className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning"
              >
                « Forcer Livré » indisponible : {detail.cannotForceDeliveredReason}.
              </p>
            )}
          </div>
        )}
      </section>

      {detail.manualOverride && (
        <section aria-label="Preuve manuelle" className="card space-y-2 p-5 text-sm">
          <h2 className="font-semibold">Preuve manuelle (« Livré (forcé) »)</h2>
          <p className="text-xs text-ink-muted">
            Validé par {detail.manualOverride.userName} le{" "}
            <span className="tabular-nums">{formatDateTime(detail.manualOverride.createdAt)}</span>
          </p>
          <p>
            <span className="font-medium">Motif :</span> {detail.manualOverride.reason}
          </p>
          {isSafeMediaUrl(detail.manualOverride.attachmentUrl) && (
            <div className="pt-1">
              {detail.manualOverride.attachmentUrl.startsWith("data:") ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={detail.manualOverride.attachmentUrl}
                  alt={`Pièce jointe pour ${d.reference}`}
                  className="max-h-48 rounded border border-line object-contain"
                />
              ) : (
                <a
                  href={detail.manualOverride.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link text-xs"
                >
                  Ouvrir la pièce jointe →
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {detail.returnReception && (
        <section aria-label="Réception du retour au dépôt" className="card space-y-2 p-5 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Réception du retour au dépôt</h2>
            <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium">
              {RETURN_CONDITION_LABEL[detail.returnReception.condition]}
            </span>
          </div>
          <p className="text-xs text-ink-muted">
            Réceptionné par {detail.returnReception.receivedByName} le{" "}
            <span className="tabular-nums">{formatDateTime(detail.returnReception.receivedAt)}</span>
          </p>
          {detail.returnReception.comment && (
            <p>
              <span className="font-medium">Commentaire :</span> {detail.returnReception.comment}
            </p>
          )}
          {isSafeMediaUrl(detail.returnReception.photoUrl) && (
            <div className="pt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={detail.returnReception.photoUrl}
                alt={`Photo du retour ${d.reference}`}
                className="max-h-48 rounded border border-line object-contain"
              />
            </div>
          )}
        </section>
      )}

      <section aria-label="Historique de la livraison">
        <h2 className="text-lg font-semibold">Historique ({detail.timeline.length})</h2>
        {detail.timeline.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
            Aucun événement d&apos;historique visible pour ce colis.
          </p>
        ) : (
          <ol aria-label="Timeline de la livraison" className="mt-4 space-y-3">
            {detail.timeline.map((ev) => {
              const transition =
                ev.fromStatus || ev.toStatus
                  ? `${ev.fromStatus ? (DELIVERY_STATUS_LABEL[ev.fromStatus] ?? ev.fromStatus) : "Nouvelle"} → ${ev.toStatus ? (DELIVERY_STATUS_LABEL[ev.toStatus] ?? ev.toStatus) : "—"}`
                  : null;
              return (
                <li key={ev.id} className="card space-y-1.5 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{ev.label}</span>
                      {transition && (
                        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink-muted">
                          {transition}
                        </span>
                      )}
                    </div>
                    <time
                      dateTime={ev.serverTime.toISOString()}
                      className="tabular-nums text-xs text-ink-muted"
                    >
                      {formatDateTime(ev.serverTime)}
                    </time>
                  </div>
                  {ev.summary && <p className="text-ink-muted">{ev.summary}</p>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                    <span>Par {ev.actorName}</span>
                    {ev.lat !== null && ev.lng !== null && (
                      <span className="tabular-nums">
                        GPS : {Number(ev.lat).toFixed(5)}, {Number(ev.lng).toFixed(5)}
                        {ev.accuracy !== null ? ` (±${Math.round(Number(ev.accuracy))} m)` : ""}
                      </span>
                    )}
                    <span className="font-mono">#{ev.hash.slice(0, 8)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
