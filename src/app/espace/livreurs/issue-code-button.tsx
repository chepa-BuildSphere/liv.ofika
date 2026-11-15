"use client";

import { useActionState } from "react";
import { AccessCodeBox } from "./access-code-box";
import { issueCodeAction, type IssueCodeState } from "./actions";

export function IssueCodeButton({ courierId, appUrl }: { courierId: string; appUrl: string }) {
  const [state, action, pending] = useActionState<IssueCodeState, FormData>(issueCodeAction, { status: "idle" });

  if (state.status === "done") return <AccessCodeBox access={state.access} appUrl={appUrl} />;

  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="courierId" value={courierId} />
      <button type="submit" disabled={pending} className="btn-secondary">
        {pending ? "Génération…" : "Nouveau code d'accès"}
      </button>
      {state.status === "error" && <span className="text-sm text-danger">{state.message}</span>}
    </form>
  );
}
