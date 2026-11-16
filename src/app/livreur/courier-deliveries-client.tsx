"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import {
  deliveryStatusLabel,
  FAILURE_REASON_LABEL,
  FAILURE_REASONS,
  type DeliveryStatus,
  type FailureReason,
  type ProofMethod,
} from "@/lib/deliveries/transitions";
import { formatPhone } from "@/lib/validation";
import {
  chooseAfterFailureAction,
  confirmPickupAction,
  declareArrivedAction,
  declareFailureAction,
  generateQrAction,
  verifyHandoverCodeAction,
  type AfterFailureState,
  type ConfirmPickupState,
  type DeclareArrivedState,
  type DeclareFailureState,
  type GenerateQrState,
  type VerifyHandoverState,
} from "./actions";
import { useIsOnline } from "./pwa-status";
import {
  PhoneIcon,
  MapPinIcon,
  QrCodeIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  BanknotesIcon,
  PackageIcon,
  SpinnerIcon,
} from "@/components/icons";

export type CourierClientCompany = {
  id: string;
  name: string;
};

export type CourierClientDelivery = {
  id: string;
  companyId: string;
  reference: string;
  recipientName: string;
  recipientPhone: string | null;
  address: string;
  district: string | null;
  packageDescription: string | null;
  amountToCollect: number | null;
  comment: string | null;
  status: DeliveryStatus;
  proofMethod: ProofMethod | null;
  currentAttempt: number;
  pickedUpAt: Date | null;
};

function readCurrentGps(
  timeoutMs = 6000,
): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (coords: { lat: number; lng: number; accuracy: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(coords);
    };
    const fallbackTimer = setTimeout(() => done(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(fallbackTimer);
        done({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        clearTimeout(fallbackTimer);
        done(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

function StatusBadge({
  status,
  proofMethod,
}: {
  status: DeliveryStatus;
  proofMethod: ProofMethod | null;
}) {
  const label = deliveryStatusLabel(status, proofMethod);

  switch (status) {
    case "DELIVERED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#15803D]/20 bg-[#F0FDF4] px-2.5 py-0.5 text-[11px] font-semibold text-[#15803D]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#15803D]" />
          {label}
        </span>
      );
    case "ARRIVED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C2410C]/20 bg-[#FFF7ED] px-2.5 py-0.5 text-[11px] font-semibold text-[#C2410C]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C] animate-pulse" />
          {label}
        </span>
      );
    case "PICKED_UP":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2563EB]/20 bg-[#EFF6FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#2563EB]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
          {label}
        </span>
      );
    case "DELIVERY_FAILED":
    case "CANCELLED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#DC2626]/20 bg-[#FEF2F2] px-2.5 py-0.5 text-[11px] font-semibold text-[#DC2626]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#DC2626]" />
          {label}
        </span>
      );
    case "RETURNING":
    case "RETURN_RECEIVED":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#B45309]/20 bg-[#FFFBEB] px-2.5 py-0.5 text-[11px] font-semibold text-[#B45309]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#B45309]" />
          {label}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#EAEAEA] bg-[#F7F6F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#787774]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#787774]" />
          {label}
        </span>
      );
  }
}

function CountdownBadge({ expiresAtIso }: { expiresAtIso: string }) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const remainingSec = Math.min(
    180,
    Math.max(0, Math.ceil((Date.parse(expiresAtIso) - nowMs) / 1000)),
  );
  const mins = String(Math.floor(remainingSec / 60)).padStart(2, "0");
  const secs = String(remainingSec % 60).padStart(2, "0");

  if (remainingSec === 0) {
    return (
      <span role="alert" className="inline-flex items-center gap-1 rounded-md bg-[#FEF2F2] px-2 py-0.5 text-[11px] font-semibold text-[#DC2626]">
        QR expiré · Régénérez un QR
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-[#C2410C]/20 bg-[#FFF7ED] px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-[#C2410C]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C] animate-pulse" />
      Expire dans {mins}:{secs}
    </span>
  );
}

function DeliveryQrPanel({
  deliveryId,
  reference,
  isOnline,
  verifyState,
  verifyPending,
  onVerifyCode,
}: {
  deliveryId: string;
  reference: string;
  isOnline: boolean;
  verifyState: VerifyHandoverState;
  verifyPending: boolean;
  onVerifyCode: (deliveryId: string, code: string) => Promise<void>;
}) {
  const [qrState, qrAction, qrPending] = useActionState<GenerateQrState, FormData>(
    generateQrAction,
    { status: "idle" },
  );
  const [code, setCode] = useState("");
  const [submittingGps, setSubmittingGps] = useState(false);

  const rowError =
    verifyState.status === "error" && verifyState.deliveryId === deliveryId
      ? verifyState.message
      : null;

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline || verifyPending || submittingGps || code.length !== 4) return;
    setSubmittingGps(true);
    try {
      await onVerifyCode(deliveryId, code);
    } finally {
      setSubmittingGps(false);
    }
  }

  return (
    <div className="mt-3 space-y-4 rounded-[12px] border border-[#EAEAEA] bg-[#FAFAFA] p-4">
      {qrState.status === "error" && (
        <div role="alert" className="flex items-start gap-2 rounded-[8px] border border-[#DC2626]/20 bg-[#FEF2F2] p-2.5 text-xs text-[#DC2626]">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#DC2626]" />
          <span>{qrState.message}</span>
        </div>
      )}

      {qrState.status === "ready" ? (
        <div className="space-y-3 text-center">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EAEAEA] pb-2 text-xs">
            <span className="font-semibold text-[#111111]">
              Faites scanner ce QR par le destinataire
            </span>
            <CountdownBadge key={qrState.qrTokenId} expiresAtIso={qrState.expiresAtIso} />
          </div>

          <div className="relative mx-auto inline-block rounded-[12px] border border-[#EAEAEA] bg-white p-3 shadow-sm">
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(qrState.qrSvg)}`}
              alt={`QR code de confirmation pour ${reference}`}
              className="h-48 w-48 sm:h-52 sm:w-52"
            />
          </div>

          {qrState.revokedPreviousCount > 0 && (
            <p className="text-[11px] text-[#787774]">
              Le précédent QR a été invalidé automatiquement pour des raisons de sécurité.
            </p>
          )}

          <form action={qrAction}>
            <input type="hidden" name="deliveryId" value={deliveryId} />
            <button
              type="submit"
              disabled={qrPending || !isOnline}
              className="inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-[#EAEAEA] bg-white text-xs font-medium text-[#111111] transition-colors hover:bg-[#F7F6F3] disabled:opacity-60"
            >
              {qrPending ? (
                <>
                  <SpinnerIcon className="h-3.5 w-3.5" />
                  <span>Régénération…</span>
                </>
              ) : (
                <span>Régénérer un nouveau QR</span>
              )}
            </button>
          </form>
        </div>
      ) : (
        <form action={qrAction}>
          <input type="hidden" name="deliveryId" value={deliveryId} />
          <button
            type="submit"
            disabled={qrPending || !isOnline}
            className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#C2410C] text-xs font-semibold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-[#9A3412] active:scale-[0.99] disabled:opacity-60"
          >
            {qrPending ? (
              <>
                <SpinnerIcon className="h-4 w-4" />
                <span>Génération du QR code…</span>
              </>
            ) : (
              <>
                <QrCodeIcon className="h-4 w-4" />
                <span>Afficher le QR code client (3 min)</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* Saisie du code à 4 chiffres */}
      <form onSubmit={handleCodeSubmit} className="space-y-3 border-t border-[#EAEAEA] pt-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#787774]">
            Code à 4 chiffres dicté par le destinataire
          </label>
          <p className="text-[11px] text-[#787774]">
            Le client reçoit ce code par SMS ou sur son écran de scan.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="one-time-code"
            aria-label="Code de remise à 4 chiffres"
            placeholder="0000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="h-12 w-32 rounded-[8px] border border-[#EAEAEA] bg-white text-center font-mono text-xl font-bold tracking-[0.3em] text-[#111111] focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20"
          />
          <button
            type="submit"
            disabled={!isOnline || verifyPending || submittingGps || code.length !== 4}
            className="inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[8px] bg-[#111111] text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-[#2F3437] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submittingGps || verifyPending ? (
              <>
                <SpinnerIcon className="h-4 w-4" />
                <span>Validation GPS…</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4" />
                <span>Valider la remise</span>
              </>
            )}
          </button>
        </div>

        {rowError && (
          <div role="alert" className="flex items-start gap-2 rounded-[8px] border border-[#DC2626]/20 bg-[#FEF2F2] p-2.5 text-xs text-[#DC2626]">
            <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#DC2626]" />
            <span className="font-medium">{rowError}</span>
          </div>
        )}
      </form>
    </div>
  );
}

function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image non reconnue."));
      img.onload = () => {
        const maxSide = 1024;
        const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Traitement image indisponible."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        if (dataUrl.length > 700_000) {
          reject(new Error("La photo compressée reste trop volumineuse (500 Ko max)."));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result ?? "");
    };
    reader.readAsDataURL(file);
  });
}

function FailureFormPanel({
  deliveryId,
  isOnline,
  failureState,
  failurePending,
  onSubmitFailure,
}: {
  deliveryId: string;
  isOnline: boolean;
  failureState: DeclareFailureState;
  failurePending: boolean;
  onSubmitFailure: (payload: {
    deliveryId: string;
    failureReason: FailureReason;
    comment: string;
    photoUrl: string;
    afterFailure: string;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [failureReason, setFailureReason] = useState<FailureReason>("RECIPIENT_ABSENT");
  const [comment, setComment] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [afterFailure, setAfterFailure] = useState("");
  const [submittingGps, setSubmittingGps] = useState(false);

  const rowError =
    failureState.status === "error" && failureState.deliveryId === deliveryId
      ? failureState.message
      : null;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) {
      setPhotoUrl("");
      return;
    }
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setPhotoUrl(dataUrl);
    } catch (err) {
      setPhotoUrl("");
      setPhotoError(err instanceof Error ? err.message : "Image invalide.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isOnline || failurePending || submittingGps) return;
    setSubmittingGps(true);
    try {
      await onSubmitFailure({ deliveryId, failureReason, comment, photoUrl, afterFailure });
    } finally {
      setSubmittingGps(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        disabled={!isOnline}
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-[#EAEAEA] bg-white text-xs font-medium text-[#787774] transition-colors hover:border-[#DC2626]/40 hover:text-[#DC2626] disabled:opacity-60"
      >
        <span>Signaler un problème ou échec</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-3 rounded-[12px] border border-[#DC2626]/20 bg-[#FEF2F2]/60 p-4 text-xs"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#DC2626]/10 pb-2">
        <p className="font-bold text-[#DC2626]">Déclaration d&apos;échec de livraison</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-medium text-[#787774] hover:text-[#111111]"
        >
          Annuler
        </button>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#111111]">
          Motif de l&apos;échec
        </label>
        <select
          value={failureReason}
          onChange={(e) => setFailureReason(e.target.value as FailureReason)}
          className="mt-1 h-9.5 w-full rounded-[6px] border border-[#EAEAEA] bg-white px-2.5 text-xs text-[#111111] focus:border-[#C2410C] focus:outline-none"
        >
          {FAILURE_REASONS.map((r) => (
            <option key={r} value={r}>
              {FAILURE_REASON_LABEL[r]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#111111]">
          {failureReason === "OTHER"
            ? "Commentaire obligatoire"
            : "Commentaire facultatif"}
        </label>
        <textarea
          rows={2}
          required={failureReason === "OTHER"}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ex : Client injoignable après 3 appels, porte fermée…"
          className="mt-1 w-full rounded-[6px] border border-[#EAEAEA] bg-white p-2 text-xs text-[#111111] placeholder:text-[#A1A1AA] focus:border-[#C2410C] focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#111111]">
          Preuve photo (facultative)
        </label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoChange}
          className="mt-1 block w-full text-xs text-[#787774] file:mr-2 file:rounded-[6px] file:border file:border-[#EAEAEA] file:bg-white file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-[#111111]"
        />
        {photoUrl && (
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#15803D]">
            <span>Photo prise en compte</span>
            <button
              type="button"
              onClick={() => setPhotoUrl("")}
              className="text-[#DC2626] hover:underline"
            >
              Supprimer
            </button>
          </div>
        )}
        {photoError && <span className="mt-1 block text-[11px] text-[#DC2626]">{photoError}</span>}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-[#111111]">
          Suite donnée au colis
        </label>
        <select
          value={afterFailure}
          onChange={(e) => setAfterFailure(e.target.value)}
          className="mt-1 h-9.5 w-full rounded-[6px] border border-[#EAEAEA] bg-white px-2.5 text-xs text-[#111111] focus:border-[#C2410C] focus:outline-none"
        >
          <option value="">Sélectionner plus tard</option>
          <option value="RETRY">Nouvelle tentative aujourd&apos;hui</option>
          <option value="RETURN_TO_DEPOT">Retour vers le dépôt</option>
        </select>
      </div>

      {rowError && (
        <div role="alert" className="flex items-start gap-2 rounded-[6px] border border-[#DC2626]/20 bg-white p-2 text-xs text-[#DC2626]">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#DC2626]" />
          <span>{rowError}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!isOnline || failurePending || submittingGps}
        className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-[#DC2626] text-xs font-semibold uppercase tracking-wider text-white transition-all hover:bg-[#B91C1C] disabled:opacity-60"
      >
        {submittingGps || failurePending ? (
          <>
            <SpinnerIcon className="h-4 w-4" />
            <span>Enregistrement…</span>
          </>
        ) : (
          <span>Enregistrer l&apos;échec</span>
        )}
      </button>
    </form>
  );
}

function formatTimeAbidjan(date: Date | null): string | null {
  if (!date) return null;
  return new Date(date).toLocaleTimeString("fr-FR", {
    timeZone: "Africa/Abidjan",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CourierDeliveriesClient({
  companies,
  deliveries,
}: {
  companies: readonly CourierClientCompany[];
  deliveries: readonly CourierClientDelivery[];
}) {
  const isOnline = useIsOnline();
  const [companyFilter, setCompanyFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [locatingId, setLocatingId] = useState<string | null>(null);

  const [pickupState, pickupFormAction, pickupPending] = useActionState<
    ConfirmPickupState,
    FormData
  >(confirmPickupAction, { status: "idle" });
  const [arrivedState, arrivedFormAction, arrivedPending] = useActionState<
    DeclareArrivedState,
    FormData
  >(declareArrivedAction, { status: "idle" });
  const [verifyState, verifyFormAction, verifyPending] = useActionState<
    VerifyHandoverState,
    FormData
  >(verifyHandoverCodeAction, { status: "idle" });
  const [failureState, failureFormAction, failurePending] = useActionState<
    DeclareFailureState,
    FormData
  >(declareFailureAction, { status: "idle" });
  const [afterState, afterFormAction, afterPending] = useActionState<
    AfterFailureState,
    FormData
  >(chooseAfterFailureAction, { status: "idle" });

  async function handleDeclareFailure(payload: {
    deliveryId: string;
    failureReason: FailureReason;
    comment: string;
    photoUrl: string;
    afterFailure: string;
  }) {
    if (!isOnline) return;
    const coords = await readCurrentGps(4000);
    const fd = new FormData();
    fd.set("deliveryId", payload.deliveryId);
    fd.set("failureReason", payload.failureReason);
    fd.set("comment", payload.comment);
    fd.set("photoUrl", payload.photoUrl);
    if (payload.afterFailure) fd.set("afterFailure", payload.afterFailure);
    if (coords) {
      fd.set("lat", String(coords.lat));
      fd.set("lng", String(coords.lng));
      fd.set("accuracy", String(coords.accuracy));
    }
    startTransition(() => {
      failureFormAction(fd);
    });
  }

  async function handleDeclareArrived(deliveryId: string) {
    if (!isOnline) return;
    setLocatingId(deliveryId);
    const coords = await readCurrentGps();
    setLocatingId(null);
    const fd = new FormData();
    fd.set("deliveryId", deliveryId);
    if (coords) {
      fd.set("lat", String(coords.lat));
      fd.set("lng", String(coords.lng));
      fd.set("accuracy", String(coords.accuracy));
    }
    startTransition(() => {
      arrivedFormAction(fd);
    });
  }

  async function handleVerifyHandoverCode(deliveryId: string, code: string) {
    if (!isOnline) return;
    const coords = await readCurrentGps(2000);
    const fd = new FormData();
    fd.set("deliveryId", deliveryId);
    fd.set("code", code);
    if (coords) {
      fd.set("lat", String(coords.lat));
      fd.set("lng", String(coords.lng));
      fd.set("accuracy", String(coords.accuracy));
    }
    startTransition(() => {
      verifyFormAction(fd);
    });
  }

  const assignedIdSet = new Set(
    deliveries.filter((d) => d.status === "ASSIGNED").map((d) => d.id),
  );
  const validSelected = selectedIds.filter((id) => assignedIdSet.has(id));
  const selectedSet = new Set(validSelected);

  function toggleOne(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleCompanyAll(companyAssignedIds: string[]) {
    const allChecked =
      companyAssignedIds.length > 0 &&
      companyAssignedIds.every((id) => selectedSet.has(id));
    setSelectedIds((prev) => {
      if (allChecked) {
        return prev.filter((id) => !companyAssignedIds.includes(id));
      }
      return [...new Set([...prev, ...companyAssignedIds])];
    });
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#EAEAEA] bg-white p-8 text-center text-xs text-[#787774]">
        <PackageIcon className="mx-auto h-8 w-8 text-[#A1A1AA]" />
        <p className="mt-2 font-medium text-[#111111]">Aucune entreprise rattachée</p>
        <p className="mt-1">Demandez à votre entreprise de vous ajouter à son équipe.</p>
      </div>
    );
  }

  // KPIs de la tournée
  const totalDeliveries = deliveries.length;
  const toPickupCount = deliveries.filter((d) => d.status === "ASSIGNED").length;
  const onRouteCount = deliveries.filter((d) => d.status === "PICKED_UP" || d.status === "ARRIVED").length;
  const deliveredCount = deliveries.filter((d) => d.status === "DELIVERED").length;
  const totalCodAmount = deliveries
    .filter((d) => d.status !== "CANCELLED" && d.status !== "RETURN_RECEIVED" && d.amountToCollect)
    .reduce((sum, d) => sum + (d.amountToCollect ?? 0), 0);

  const visibleCompanies =
    companyFilter === "ALL"
      ? companies
      : companies.filter((c) => c.id === companyFilter);

  return (
    <div className="space-y-6">
      {/* 1. Bento Dashboard Tournée : métriques clés */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[12px] border border-[#EAEAEA] bg-white p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#787774]">Colis total</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#111111]">{totalDeliveries}</p>
        </div>
        <div className="rounded-[12px] border border-[#EAEAEA] bg-white p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#787774]">À récupérer</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#C2410C]">{toPickupCount}</p>
        </div>
        <div className="rounded-[12px] border border-[#EAEAEA] bg-white p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#787774]">En livraison</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#2563EB]">{onRouteCount}</p>
        </div>
        <div className="rounded-[12px] border border-[#EAEAEA] bg-white p-3.5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#787774]">Livrées</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-[#15803D]">{deliveredCount}</p>
        </div>
      </div>

      {/* Montant total à encaisser si non nul */}
      {totalCodAmount > 0 && (
        <div className="flex items-center justify-between rounded-[10px] border border-[#15803D]/20 bg-[#F0FDF4] px-4 py-2.5 text-xs text-[#15803D]">
          <div className="flex items-center gap-2 font-semibold">
            <BanknotesIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
            <span>Espèces à encaisser (COD)</span>
          </div>
          <span className="font-mono text-sm font-bold tabular-nums">
            {totalCodAmount.toLocaleString("fr-FR")} F CFA
          </span>
        </div>
      )}

      {/* 2. Filtres par entreprise */}
      {companies.length > 1 && (
        <div
          aria-label="Filtrer par entreprise"
          className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
        >
          <button
            type="button"
            onClick={() => setCompanyFilter("ALL")}
            className={`inline-flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors ${
              companyFilter === "ALL"
                ? "bg-[#111111] text-white"
                : "border border-[#EAEAEA] bg-white text-[#787774] hover:border-[#111111] hover:text-[#111111]"
            }`}
          >
            Toutes les entreprises ({deliveries.length})
          </button>
          {companies.map((c) => {
            const count = deliveries.filter((d) => d.companyId === c.id).length;
            const active = companyFilter === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCompanyFilter(c.id)}
                className={`inline-flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-xs font-semibold transition-colors ${
                  active
                    ? "bg-[#111111] text-white"
                    : "border border-[#EAEAEA] bg-white text-[#787774] hover:border-[#111111] hover:text-[#111111]"
                }`}
              >
                {c.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Messages de statut et feedback */}
      {verifyState.status === "delivered" && (
        <div role="status" className="flex items-center gap-2.5 rounded-[10px] border border-[#15803D]/30 bg-[#F0FDF4] p-3 text-xs font-semibold text-[#15803D]">
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
          <span>{verifyState.message}</span>
        </div>
      )}

      {pickupState.status === "error" && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-[#DC2626]/20 bg-[#FEF2F2] p-3 text-xs text-[#DC2626]">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#DC2626]" />
          <span>{pickupState.message}</span>
        </div>
      )}
      {pickupState.status === "done" && (
        <div role="status" className="flex items-center gap-2.5 rounded-[10px] border border-[#15803D]/30 bg-[#F0FDF4] p-3 text-xs text-[#15803D]">
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
          <span>{pickupState.message}</span>
        </div>
      )}
      {arrivedState.status === "error" && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-[#DC2626]/20 bg-[#FEF2F2] p-3 text-xs text-[#DC2626]">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#DC2626]" />
          <span>{arrivedState.message}</span>
        </div>
      )}
      {arrivedState.status === "done" && (
        <div role="status" className="flex items-center gap-2.5 rounded-[10px] border border-[#15803D]/30 bg-[#F0FDF4] p-3 text-xs text-[#15803D]">
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
          <span>{arrivedState.message}</span>
        </div>
      )}
      {failureState.status === "done" && (
        <div role="status" className="flex items-center gap-2.5 rounded-[10px] border border-[#B45309]/30 bg-[#FFFBEB] p-3 text-xs text-[#B45309]">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#B45309]" />
          <span>{failureState.message}</span>
        </div>
      )}
      {afterState.status === "error" && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-[#DC2626]/20 bg-[#FEF2F2] p-3 text-xs text-[#DC2626]">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#DC2626]" />
          <span>{afterState.message}</span>
        </div>
      )}
      {afterState.status === "done" && (
        <div role="status" className="flex items-center gap-2.5 rounded-[10px] border border-[#15803D]/30 bg-[#F0FDF4] p-3 text-xs text-[#15803D]">
          <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
          <span>{afterState.message}</span>
        </div>
      )}

      {/* 4. Barre d'action collective flottante */}
      {validSelected.length > 0 && (
        <form
          action={pickupFormAction}
          className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-[#C2410C]/30 bg-[#FFF7ED] p-3.5 shadow-md"
        >
          {validSelected.map((id) => (
            <input key={id} type="hidden" name="deliveryIds" value={id} />
          ))}
          <div className="flex items-center gap-2 text-xs font-bold text-[#111111]">
            <PackageIcon className="h-4 w-4 text-[#C2410C]" />
            <span>
              {validSelected.length} colis sélectionné{validSelected.length > 1 ? "s" : ""}
            </span>
          </div>
          <button
            type="submit"
            disabled={pickupPending || !isOnline}
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] bg-[#C2410C] px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-[#9A3412] active:scale-95 disabled:opacity-60"
          >
            {pickupPending ? (
              <>
                <SpinnerIcon className="h-3.5 w-3.5" />
                <span>Prise en charge…</span>
              </>
            ) : (
              <span>Prendre en charge ({validSelected.length})</span>
            )}
          </button>
        </form>
      )}

      {/* 5. Listing des colis par entreprise */}
      <div className="space-y-6">
        {visibleCompanies.map((c) => {
          const items = deliveries.filter((d) => d.companyId === c.id);
          const toPickUp = items.filter((d) => d.status === "ASSIGNED");
          const onRoute = items.filter((d) => d.status !== "ASSIGNED");
          const companyAssignedIds = toPickUp.map((d) => d.id);
          const allCompanyChecked =
            companyAssignedIds.length > 0 &&
            companyAssignedIds.every((id) => selectedSet.has(id));

          return (
            <div key={c.id} className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#EAEAEA] pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#111111]">{c.name}</h2>
                  <span className="rounded-full border border-[#EAEAEA] bg-white px-2 py-0.5 font-mono text-[11px] text-[#787774]">
                    {items.length} colis
                  </span>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="rounded-[12px] border border-[#EAEAEA] bg-white p-6 text-center text-xs text-[#787774]">
                  Aucun colis assigné pour {c.name}.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Section À PRENDRE EN CHARGE */}
                  {toPickUp.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#C2410C]">
                          À récupérer au dépôt ({toPickUp.length})
                        </span>
                        {toPickUp.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggleCompanyAll(companyAssignedIds)}
                            className="text-xs font-medium text-[#C2410C] hover:underline"
                          >
                            {allCompanyChecked ? "Tout désélectionner" : "Tout sélectionner"}
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {toPickUp.map((d) => {
                          const checked = selectedSet.has(d.id);
                          return (
                            <div
                              key={d.id}
                              className={`rounded-[12px] border p-4 transition-all ${
                                checked
                                  ? "border-[#C2410C] bg-[#FFF7ED]/30 shadow-sm"
                                  : "border-[#EAEAEA] bg-white hover:border-[#D4D4D4]"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleOne(d.id)}
                                  aria-label={`Sélectionner ${d.reference}`}
                                  className="mt-1 h-5 w-5 rounded border-[#A1A1AA] text-[#C2410C] focus:ring-[#C2410C]"
                                />
                                <div className="min-w-0 flex-1 space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-mono text-xs font-bold text-[#111111]">
                                      {d.reference}
                                    </span>
                                    <StatusBadge status={d.status} proofMethod={d.proofMethod} />
                                  </div>

                                  <div>
                                    <p className="text-sm font-bold text-[#111111]">{d.recipientName}</p>
                                    <p className="mt-0.5 text-xs text-[#787774]">
                                      {d.address}
                                      {d.district ? ` · ${d.district}` : ""}
                                    </p>
                                  </div>

                                  {d.packageDescription && (
                                    <p className="text-xs text-[#787774] italic">
                                      {d.packageDescription}
                                    </p>
                                  )}

                                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAEAEA] pt-2">
                                    <div className="flex flex-wrap items-center gap-3 text-xs">
                                      {d.recipientPhone ? (
                                        <a
                                          href={`tel:${d.recipientPhone}`}
                                          className="inline-flex items-center gap-1 font-semibold text-[#15803D] hover:underline"
                                        >
                                          <PhoneIcon className="h-3.5 w-3.5" />
                                          <span>{formatPhone(d.recipientPhone)}</span>
                                        </a>
                                      ) : (
                                        <span className="text-[#A1A1AA]">Numéro masqué</span>
                                      )}
                                      {d.amountToCollect !== null && (
                                        <span className="inline-flex items-center gap-1 font-bold text-[#111111]">
                                          <BanknotesIcon className="h-3.5 w-3.5 text-[#15803D]" />
                                          <span>{d.amountToCollect.toLocaleString("fr-FR")} F CFA</span>
                                        </span>
                                      )}
                                    </div>

                                    <form action={pickupFormAction}>
                                      <input type="hidden" name="deliveryIds" value={d.id} />
                                      <button
                                        type="submit"
                                        disabled={pickupPending || !isOnline}
                                        className="inline-flex h-8 cursor-pointer items-center justify-center rounded-[6px] border border-[#111111] bg-[#111111] px-3 text-xs font-medium text-white transition-colors hover:bg-[#333333] disabled:opacity-60"
                                      >
                                        Prendre en charge
                                      </button>
                                    </form>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Section EN TOURNÉE / LIVRAISON */}
                  {onRoute.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB]">
                        En tournée ({onRoute.length})
                      </span>

                      <div className="space-y-3">
                        {onRoute.map((d) => {
                          const pickedTime = formatTimeAbidjan(d.pickedUpAt);

                          return (
                            <div
                              key={d.id}
                              className="rounded-[12px] border border-[#EAEAEA] bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono text-xs font-bold text-[#111111]">
                                  {d.reference}
                                </span>
                                <StatusBadge status={d.status} proofMethod={d.proofMethod} />
                              </div>

                              <div>
                                <h3 className="text-base font-bold text-[#111111]">{d.recipientName}</h3>
                                <p className="mt-0.5 text-xs text-[#787774]">
                                  {d.address}
                                  {d.district ? ` · ${d.district}` : ""}
                                </p>
                              </div>

                              {d.packageDescription && (
                                <p className="text-xs text-[#787774] italic">
                                  {d.packageDescription}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAEAEA] pt-2 text-xs">
                                <div className="flex flex-wrap items-center gap-3">
                                  {d.recipientPhone ? (
                                    <a
                                      href={`tel:${d.recipientPhone}`}
                                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[#15803D]/20 bg-[#F0FDF4] px-3 font-semibold text-[#15803D] transition-colors hover:bg-[#DCFCE7]"
                                    >
                                      <PhoneIcon className="h-3.5 w-3.5" />
                                      <span>Appeler {formatPhone(d.recipientPhone)}</span>
                                    </a>
                                  ) : (
                                    <span className="text-[#A1A1AA]">Téléphone masqué</span>
                                  )}
                                  {d.amountToCollect !== null && (
                                    <span className="inline-flex items-center gap-1 font-bold text-[#111111]">
                                      <BanknotesIcon className="h-4 w-4 text-[#15803D]" />
                                      <span>À encaisser : {d.amountToCollect.toLocaleString("fr-FR")} F CFA</span>
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-[#787774]">
                                  {pickedTime && <span>Pris à {pickedTime}</span>}
                                  {d.currentAttempt > 0 && <span className="ml-2 font-mono">Tentative #{d.currentAttempt}</span>}
                                </div>
                              </div>

                              {/* Action Arrivée chez le client */}
                              {d.status === "PICKED_UP" && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    disabled={locatingId === d.id || arrivedPending || !isOnline}
                                    onClick={() => handleDeclareArrived(d.id)}
                                    className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#C2410C] text-sm font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-[#9A3412] active:scale-[0.99] disabled:opacity-60"
                                  >
                                    {locatingId === d.id ? (
                                      <>
                                        <SpinnerIcon className="h-4 w-4" />
                                        <span>Acquisition position GPS…</span>
                                      </>
                                    ) : arrivedPending ? (
                                      <>
                                        <SpinnerIcon className="h-4 w-4" />
                                        <span>Enregistrement arrivée…</span>
                                      </>
                                    ) : (
                                      <>
                                        <MapPinIcon className="h-4 w-4" />
                                        <span>Je suis arrivé chez le client</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Validation par QR code ou Déclaration d'échec */}
                              {d.status === "ARRIVED" && (
                                <div className="space-y-2">
                                  <DeliveryQrPanel
                                    deliveryId={d.id}
                                    reference={d.reference}
                                    isOnline={isOnline}
                                    verifyState={verifyState}
                                    verifyPending={verifyPending}
                                    onVerifyCode={handleVerifyHandoverCode}
                                  />
                                  <FailureFormPanel
                                    deliveryId={d.id}
                                    isOnline={isOnline}
                                    failureState={failureState}
                                    failurePending={failurePending}
                                    onSubmitFailure={handleDeclareFailure}
                                  />
                                </div>
                              )}

                              {/* Actions après échec */}
                              {d.status === "DELIVERY_FAILED" && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <form action={afterFormAction}>
                                    <input type="hidden" name="deliveryId" value={d.id} />
                                    <input type="hidden" name="afterFailure" value="RETRY" />
                                    <button
                                      type="submit"
                                      disabled={!isOnline || afterPending}
                                      className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-[8px] bg-[#111111] text-xs font-semibold text-white transition-colors hover:bg-[#333333] disabled:opacity-60"
                                    >
                                      Nouvelle tentative
                                    </button>
                                  </form>
                                  <form action={afterFormAction}>
                                    <input type="hidden" name="deliveryId" value={d.id} />
                                    <input
                                      type="hidden"
                                      name="afterFailure"
                                      value="RETURN_TO_DEPOT"
                                    />
                                    <button
                                      type="submit"
                                      disabled={!isOnline || afterPending}
                                      className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-[8px] border border-[#EAEAEA] bg-white text-xs font-semibold text-[#111111] transition-colors hover:bg-[#F7F6F3] disabled:opacity-60"
                                    >
                                      Retour au dépôt
                                    </button>
                                  </form>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
