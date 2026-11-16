"use client";

import { useActionState, useState } from "react";
import { detachCourierAction, type DetachCourierState } from "./actions";

export function DetachCourierButton({ courierId, courierName }: { courierId: string; courierName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<DetachCourierState, FormData>(detachCourierAction, { status: "idle" });

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="btn-secondary shrink-0">
        Détacher
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border border-danger/20 bg-danger-soft p-3 text-xs">
      <input type="hidden" name="courierId" value={courierId} />
      <p className="text-ink">
        Détacher <span className="font-medium">{courierName}</span> ? Il ne verra plus vos colis.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="btn-primary h-9 px-3 text-xs">
          {pending ? "Détachement…" : "Confirmer"}
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="btn-secondary">
          Annuler
        </button>
      </div>
      {state.status === "error" && <p role="alert" className="text-danger">{state.message}</p>}
    </form>
  );
}
