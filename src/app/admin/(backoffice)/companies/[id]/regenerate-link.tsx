"use client";

import { useActionState } from "react";
import { ActivationLinkBox } from "../activation-link-box";
import { regenerateLinkAction, type RegenerateState } from "../actions";

export function RegenerateLink({ userId, userName, userPhone }: { userId: string; userName: string; userPhone: string | null }) {
  const [state, action, pending] = useActionState<RegenerateState, FormData>(regenerateLinkAction, { status: "idle" });

  if (state.status === "done") {
    return <ActivationLinkBox url={state.url} expiresAt={state.expiresAt} recipientName={userName} recipientPhone={userPhone} />;
  }

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        disabled={pending}
        className="btn-secondary self-start"
      >
        {pending ? "Génération…" : "Générer un nouveau lien"}
      </button>
      <span className="text-xs text-ink-muted">L&apos;ancien lien ne fonctionnera plus.</span>
      {state.status === "error" && <span className="text-sm text-danger">{state.message}</span>}
    </form>
  );
}
