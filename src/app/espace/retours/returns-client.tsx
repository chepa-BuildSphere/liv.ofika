"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  matchReturningDeliveryByScan,
  type CourierReturningGroup,
  type ReceivedReturnItem,
  type ReturningDeliveryItem,
} from "@/lib/deliveries/return-scan";
import {
  FAILURE_REASON_LABEL,
  RETURN_CONDITION_LABEL,
  RETURN_CONDITIONS,
  type ReturnCondition,
} from "@/lib/deliveries/transitions";
import { compressImageToDataUrl } from "@/lib/media/compress-image";
import { isSafeMediaUrl } from "@/lib/media/safe-url";
import { formatPhone } from "@/lib/validation";
import { receiveReturnAction, type ReceiveReturnState } from "./actions";

type DetectedBarcode = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function formatAbidjanDateTime(date: Date): string {
  return new Date(date).toLocaleString("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function ReturnConfirmForm({
  item,
  defaultOpen,
}: {
  item: ReturningDeliveryItem;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [condition, setCondition] = useState<ReturnCondition>("GOOD");
  const [comment, setComment] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ReceiveReturnState, FormData>(
    receiveReturnAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  if (!item.canReceive) {
    return (
      <p
        role="status"
        className="mt-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning"
      >
        {item.cannotReceiveReason ??
          "Vous avez déclaré ce retour : un collègue doit le réceptionner."}
      </p>
    );
  }

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

  if (!open) {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-primary h-9 px-4 text-xs"
        >
          Réceptionner ce retour
        </button>
      </div>
    );
  }

  const rowError =
    state.status === "error" && state.deliveryId === item.id ? state.message : null;
  const fieldErrors =
    state.status === "error" && state.deliveryId === item.id ? state.fields : undefined;

  return (
    <form
      action={action}
      className="mt-3 space-y-3 rounded-lg border border-line bg-surface p-3 text-sm"
    >
      <input type="hidden" name="deliveryId" value={item.id} />
      <input type="hidden" name="photoUrl" value={photoUrl} />

      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">Confirmer la réception de {item.reference}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="link text-xs"
        >
          Fermer
        </button>
      </div>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-medium text-ink">État physique du colis</legend>
        <div className="flex flex-wrap gap-3">
          {RETURN_CONDITIONS.map((cond) => (
            <label
              key={cond}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-paper px-3 py-2 text-xs font-medium"
            >
              <input
                type="radio"
                name="condition"
                value={cond}
                checked={condition === cond}
                onChange={() => setCondition(cond)}
              />
              <span>{RETURN_CONDITION_LABEL[cond]}</span>
            </label>
          ))}
        </div>
        {fieldErrors?.condition && (
          <p className="field-error text-xs">{fieldErrors.condition}</p>
        )}
      </fieldset>

      <label className="field-label text-xs">
        Commentaire (facultatif)
        <textarea
          name="comment"
          rows={2}
          maxLength={1000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Emballage intact, carton ouvert, produit manquant…"
          className="input h-auto py-2 text-sm"
        />
        {fieldErrors?.comment && (
          <span className="field-error text-xs">{fieldErrors.comment}</span>
        )}
      </label>

      <div className="space-y-1.5">
        <label className="field-label text-xs">
          Photo du colis retourné (facultative)
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="text-xs text-ink-muted"
          />
        </label>
        {photoError && <p className="field-error text-xs">{photoError}</p>}
        {fieldErrors?.photoUrl && (
          <p className="field-error text-xs">{fieldErrors.photoUrl}</p>
        )}
        {photoUrl && isSafeMediaUrl(photoUrl) && (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt="Aperçu du colis retourné"
              className="h-16 w-16 rounded border border-line object-cover"
            />
            <button
              type="button"
              onClick={() => setPhotoUrl("")}
              className="link text-xs"
            >
              Retirer la photo
            </button>
          </div>
        )}
      </div>

      {rowError && (
        <p role="alert" className="alert-error text-xs">
          {rowError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary h-9 px-4 text-xs"
        >
          {pending ? "Enregistrement…" : "Confirmer la réception"}
        </button>
      </div>
    </form>
  );
}

export function ReturnsClient({
  groups,
  recentReceived,
}: {
  groups: CourierReturningGroup[];
  recentReceived: ReceivedReturnItem[];
}) {
  const [scanInput, setScanInput] = useState("");
  const [matchedId, setMatchedId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopCamera() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
      }
    };
  }, []);

  function locateByScan(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      setMatchedId(null);
      setScanMessage(null);
      return;
    }
    const found = matchReturningDeliveryByScan(groups, trimmed);
    if (!found) {
      setMatchedId(null);
      setScanMessage({
        kind: "error",
        text: "Aucun colis en attente de retour ne correspond à ce QR ou cette référence.",
      });
      return;
    }
    setMatchedId(found.id);
    setScanMessage({
      kind: "ok",
      text: `Colis trouvé : ${found.reference} (${found.recipientName}) — livreur ${found.courierName}.`,
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    locateByScan(scanInput);
  }

  async function startCameraScan() {
    setCameraError(null);
    const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!ctor || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Le scan caméra n'est pas pris en charge par ce navigateur. Utilisez une douchette ou saisissez la référence ci-dessus.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOpen(true);

      const detector = new ctor({ formats: ["qr_code"] });
      const scanLoop = async () => {
        if (!streamRef.current || !videoRef.current) return;
        if (videoRef.current.readyState >= 2) {
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes.find((c) => c.rawValue?.trim())?.rawValue?.trim();
            if (value) {
              setScanInput(value);
              locateByScan(value);
              stopCamera();
              return;
            }
          } catch {
            // frame non lisible : poursuivre le scan
          }
        }
        window.setTimeout(scanLoop, 250);
      };

      window.setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          void videoRef.current.play().catch(() => {});
          void scanLoop();
        }
      }, 50);
    } catch {
      stopCamera();
      setCameraError(
        "Impossible d'accéder à la caméra. Saisissez ou scannez avec une douchette dans le champ ci-dessus.",
      );
    }
  }

  const totalReturning = groups.reduce((acc, g) => acc + g.items.length, 0);
  const displayedGroups = matchedId
    ? groups
        .map((g) => ({ ...g, items: g.items.filter((i) => i.id === matchedId) }))
        .filter((g) => g.items.length > 0)
    : groups;

  return (
    <div className="mt-6 space-y-8">
      <section aria-label="Scanner un QR de référence" className="card space-y-3 p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="field-label flex-1">
            Scanner le QR de référence du bordereau ou rechercher une référence
            <input
              type="search"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="OFIKA-REF:CMD-1042:… ou CMD-1042"
              className="input h-10 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary h-10 px-4 text-sm">
              Localiser
            </button>
            {cameraOpen ? (
              <button type="button" onClick={stopCamera} className="btn-secondary h-10 px-3 text-sm">
                Arrêter la caméra
              </button>
            ) : (
              <button
                type="button"
                onClick={startCameraScan}
                className="btn-secondary h-10 px-3 text-sm"
              >
                Scanner avec la caméra
              </button>
            )}
            {matchedId && (
              <button
                type="button"
                onClick={() => {
                  setMatchedId(null);
                  setScanInput("");
                  setScanMessage(null);
                }}
                className="btn-secondary h-10 px-3 text-sm"
              >
                Tout afficher ({totalReturning})
              </button>
            )}
          </div>
        </form>

        {cameraOpen && (
          <div className="space-y-2 rounded-lg border border-line bg-surface p-3">
            <p className="text-xs text-ink-muted">
              Placez le QR de référence du bordereau devant la caméra…
            </p>
            <video
              ref={videoRef}
              playsInline
              muted
              className="max-h-64 w-full rounded bg-black object-cover"
            />
          </div>
        )}

        {cameraError && (
          <p role="alert" className="alert-error text-xs">
            {cameraError}
          </p>
        )}

        {scanMessage && (
          <p
            role={scanMessage.kind === "error" ? "alert" : "status"}
            className={
              scanMessage.kind === "error"
                ? "alert-error text-xs"
                : "rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-xs text-success"
            }
          >
            {scanMessage.text}
          </p>
        )}
      </section>

      <section aria-label="Retours en attente par livreur" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">
            Colis en attente de réception ({totalReturning})
          </h2>
        </div>

        {displayedGroups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-muted">
            {totalReturning === 0
              ? "Aucun colis en retour au dépôt pour l'instant."
              : "Aucun colis correspondant."}
          </p>
        ) : (
          <div className="space-y-5">
            {displayedGroups.map((group) => (
              <section
                key={group.courierId ?? "__unassigned__"}
                className="card overflow-hidden"
                aria-label={`Retours de ${group.courierName}`}
              >
                <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3">
                  <div>
                    <h3 className="font-semibold">{group.courierName}</h3>
                    {group.courierPhone && (
                      <p className="text-xs tabular-nums text-ink-muted">
                        {formatPhone(group.courierPhone)}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs font-medium">
                    {group.items.length} colis en retour
                  </span>
                </header>

                <ul className="divide-y divide-line">
                  {group.items.map((item) => (
                    <li key={item.id} className="space-y-1.5 px-4 py-4 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">
                          <Link
                            href={`/espace/livraisons/${item.id}`}
                            className="link font-mono"
                          >
                            {item.reference}
                          </Link>{" "}
                          · {item.recipientName}
                        </p>
                        <span className="text-xs tabular-nums text-ink-muted">
                          Retour déclaré le {formatAbidjanDateTime(item.returningSince)}
                        </span>
                      </div>

                      <p className="text-ink-muted">
                        {item.address}
                        {item.district ? ` · ${item.district}` : ""}
                        {item.packageDescription ? ` · ${item.packageDescription}` : ""}
                      </p>

                      {item.failureReason && (
                        <p className="text-xs text-danger">
                          Motif de l&apos;échec :{" "}
                          <span className="font-medium">
                            {FAILURE_REASON_LABEL[item.failureReason]}
                          </span>
                          {item.failureComment ? ` — ${item.failureComment}` : ""}
                        </p>
                      )}

                      {item.failurePhotoUrl && isSafeMediaUrl(item.failurePhotoUrl) && (
                        <div className="pt-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.failurePhotoUrl}
                            alt={`Photo d'échec pour ${item.reference}`}
                            className="h-20 w-20 rounded border border-line object-cover"
                          />
                        </div>
                      )}

                      <ReturnConfirmForm
                        item={item}
                        defaultOpen={matchedId === item.id}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Retours récemment réceptionnés" className="space-y-3">
        <h2 className="text-lg font-semibold">
          Derniers retours réceptionnés ({recentReceived.length})
        </h2>
        {recentReceived.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-muted">
            Aucun retour réceptionné pour l&apos;instant.
          </p>
        ) : (
          <ul className="card divide-y divide-line text-sm">
            {recentReceived.map((r) => (
              <li key={r.deliveryId} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    <Link
                      href={`/espace/livraisons/${r.deliveryId}`}
                      className="link font-mono"
                    >
                      {r.reference}
                    </Link>{" "}
                    · {r.recipientName}
                    {r.courierName ? (
                      <span className="font-normal text-ink-muted"> · Livreur : {r.courierName}</span>
                    ) : null}
                  </p>
                  <span
                    className={
                      r.condition === "DAMAGED"
                        ? "rounded-full border border-danger/30 bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger"
                        : "rounded-full border border-success/30 bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success"
                    }
                  >
                    {RETURN_CONDITION_LABEL[r.condition]}
                  </span>
                </div>
                {r.comment && <p className="text-xs text-ink-muted">{r.comment}</p>}
                <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                  <span>Réceptionné par {r.receivedByName}</span>
                  <span className="tabular-nums">{formatAbidjanDateTime(r.receivedAt)}</span>
                </div>
                {r.photoUrl && isSafeMediaUrl(r.photoUrl) && (
                  <div className="pt-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.photoUrl}
                      alt={`Photo de retour pour ${r.reference}`}
                      className="h-16 w-16 rounded border border-line object-cover"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
