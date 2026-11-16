"use client";

import { useActionState, useState } from "react";
import { markStatementPaidAction, type BillingMutationState } from "../companies/actions";

export function MarkPaidButton({ statementId }: { statementId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<BillingMutationState, FormData>(
    markStatementPaidAction,
    { status: "idle" },
  );

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn-primary h-8 px-3 text-xs"
      >
        Marquer comme payé
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="statementId" value={statementId} />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary h-8 px-3 text-xs"
        >
          {pending ? "Validation…" : "Confirmer paiement"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="link text-xs"
        >
          Annuler
        </button>
      </form>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-danger">
          {state.message}
        </p>
      )}
    </div>
  );
}
