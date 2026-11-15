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
        className="h-9 self-start rounded-lg border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {pending ? "Génération…" : "Générer un nouveau lien"}
      </button>
      <span className="text-xs text-zinc-500">L&apos;ancien lien ne fonctionnera plus.</span>
      {state.status === "error" && <span className="text-sm text-red-600">{state.message}</span>}
    </form>
  );
}
