"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicDeliverySummary, PublicQrStatus, ScanQrResult } from "@/lib/deliveries/deliveries";
import { collectBrowserDeviceSignals } from "@/lib/device-signals-client";
import { scanClientQrAction } from "./actions";

function readClientGps(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val: { lat: number; lng: number; accuracy: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    const timer = setTimeout(() => finish(null), 3500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        finish({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        clearTimeout(timer);
        finish(null);
      },
      { enableHighAccuracy: true, timeout: 3200, maximumAge: 0 },
    );
  });
}

function DeliverySummaryCard({ delivery }: { delivery: PublicDeliverySummary }) {
  return (
    <section aria-label="Détails du colis" className="card p-5 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        Récapitulatif de votre livraison
      </p>
      <dl className="mt-3 space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">Expéditeur</dt>
          <dd className="text-right font-medium text-ink">{delivery.companyName}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">Référence</dt>
          <dd className="text-right font-mono font-medium text-ink">{delivery.reference}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-ink-muted">Destinataire</dt>
          <dd className="text-right text-ink">{delivery.recipientName}</dd>
        </div>
        {delivery.packageDescription && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-ink-muted">Colis</dt>
            <dd className="text-right text-ink">{delivery.packageDescription}</dd>
          </div>
        )}
        {delivery.amountToCollect !== null && (
          <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
            <dt className="font-medium text-ink">Montant</dt>
            <dd className="text-right font-semibold tabular-nums text-ink">
              {delivery.amountToCollect.toLocaleString("fr-FR")} F CFA
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export function ClientConfirmView({
  token,
  initialStatus,
}: {
  token: string;
  initialStatus: PublicQrStatus;
}) {
  const [scanResult, setScanResult] = useState<ScanQrResult | null>(() => {
    if (!initialStatus.found) {
      return {
        ok: false,
        code: "NOT_FOUND",
        message: "Ce lien de confirmation est introuvable.",
      };
    }
    if (initialStatus.state === "DELIVERED") {
      return { ok: true, state: "DELIVERED", delivery: initialStatus.delivery };
    }
    if (initialStatus.state !== "ACTIVE") {
      return {
        ok: false,
        code: initialStatus.state,
        message:
          initialStatus.state === "EXPIRED"
            ? "Ce QR code a expiré (validité 3 minutes). Demandez un nouveau QR au livreur."
            : initialStatus.state === "LOCKED"
              ? "Ce QR code est bloqué après 3 codes erronés."
              : initialStatus.state === "REVOKED"
                ? "Ce QR code a été remplacé par un nouveau QR."
                : "Cette livraison n'est plus en attente de confirmation.",
        delivery: initialStatus.delivery,
      };
    }
    return null;
  });

  const hasScannedRef = useRef(false);

  // Au premier affichage d'un QR actif, collecte les signaux de l'appareil et génère le code à 4 chiffres.
  useEffect(() => {
    if (!initialStatus.found || initialStatus.state !== "ACTIVE") return;
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;

    let cancelled = false;
    (async () => {
      const signals = collectBrowserDeviceSignals();
      const gps = await readClientGps();
      const res = await scanClientQrAction(token, signals, gps);
      if (!cancelled) {
        setScanResult(res);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialStatus, token]);

  // Rafraîchissement automatique : dès que le livreur saisit le bon code, passe à « Livré ✅ ».
  useEffect(() => {
    if (!scanResult || !scanResult.ok || scanResult.state !== "CODE_ISSUED") return;

    const timer = setInterval(async () => {
      try {
        const resp = await fetch(`/c/${encodeURIComponent(token)}/status`, {
          cache: "no-store",
        });
        if (!resp.ok) return;
        const status = (await resp.json()) as PublicQrStatus;
        if (!status.found) return;
        if (status.state === "DELIVERED") {
          setScanResult({ ok: true, state: "DELIVERED", delivery: status.delivery });
        } else if (status.state !== "ACTIVE") {
          setScanResult({
            ok: false,
            code: status.state,
            message:
              status.state === "EXPIRED"
                ? "Ce QR code a expiré (validité 3 minutes). Demandez un nouveau QR au livreur."
                : status.state === "LOCKED"
                  ? "Ce QR code est bloqué après 3 codes erronés."
                  : status.state === "REVOKED"
                    ? "Ce QR code a été remplacé par un nouveau QR."
                    : "Cette livraison n'est plus en attente de confirmation.",
            delivery: status.delivery,
          });
        }
      } catch {
        // Réessai silencieux au cycle suivant
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [scanResult, token]);

  if (!scanResult) {
    return (
      <div className="space-y-4">
        <div className="card p-6 text-center text-sm text-ink-muted">
          Préparation de votre code de remise sécurisé…
        </div>
        {initialStatus.found && <DeliverySummaryCard delivery={initialStatus.delivery} />}
      </div>
    );
  }

  if (scanResult.ok && scanResult.state === "DELIVERED") {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="rounded-lg border border-success/30 bg-success-soft p-6 text-center"
        >
          <p className="text-xl font-semibold text-success">Livré ✅</p>
          <p className="mt-1 text-sm text-ink">
            Merci, la remise de votre colis est confirmée et enregistrée.
          </p>
        </div>
        <DeliverySummaryCard delivery={scanResult.delivery} />
      </div>
    );
  }

  if (scanResult.ok && scanResult.state === "CODE_ISSUED") {
    return (
      <div className="space-y-4">
        <div className="card border-brand/40 bg-brand-soft p-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-strong">
            Donnez ce code au livreur
          </p>
          <p
            aria-label="Code de remise à 4 chiffres"
            onCopy={(e) => e.preventDefault()}
            className="mt-3 select-none font-mono text-5xl font-bold tracking-[0.25em] text-ink"
          >
            {scanResult.handoverCode}
          </p>
          <p className="mt-3 text-xs text-ink-muted">
            Dictez ces 4 chiffres à voix haute au livreur. Cette page se mettra à jour automatiquement après validation.
          </p>
        </div>
        <DeliverySummaryCard delivery={scanResult.delivery} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div role="alert" className="alert-error p-5 text-center">
        <p className="font-semibold">Confirmation impossible</p>
        <p className="mt-1 text-sm">{scanResult.message}</p>
      </div>
      {scanResult.delivery && <DeliverySummaryCard delivery={scanResult.delivery} />}
    </div>
  );
}
