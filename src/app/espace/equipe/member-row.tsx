"use client";

import { useActionState, useState } from "react";
import { ActivationLinkBox } from "@/components/activation-link-box";
import type { UserRole } from "@/lib/auth/company-user";
import { regenerateLinkAction, toggleActiveAction, updateRolesAction, type MemberActionState } from "./actions";
import { ROLE_LABEL, ROLE_OPTIONS } from "./roles";

export type MemberView = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  roles: UserRole[];
  isActive: boolean;
  activated: boolean;
  pendingLinkExpiresAt: string | null;
  isSelf: boolean;
};

const idle: MemberActionState = { status: "idle" };

export function MemberRow({ m }: { m: MemberView }) {
  const [editing, setEditing] = useState(false);
  // L'éditeur se ferme quand l'enregistrement réussit, et peut être rouvert ensuite
  const [rolesState, rolesAction, rolesPending] = useActionState(async (prev: MemberActionState, fd: FormData) => {
    const result = await updateRolesAction(prev, fd);
    if (result.status === "saved") setEditing(false);
    return result;
  }, idle);
  const [activeState, activeAction, activePending] = useActionState(toggleActiveAction, idle);
  const [linkState, linkAction, linkPending] = useActionState(regenerateLinkAction, idle);

  const error = [rolesState, activeState, linkState].find((s) => s.status === "error");
  const showEditor = editing;

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-sm">
          <p className="font-medium">
            {m.name}
            {m.isSelf && <span className="ml-2 text-xs font-normal text-ink-muted">(vous)</span>}
          </p>
          <p className="text-ink-muted">
            {m.email}
            {m.phone && ` · ${m.phone}`}
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Rôles">
            {m.roles.map((r) => (
              <li key={r} className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs">
                {ROLE_LABEL[r]}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            <Status m={m} />
          </p>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          {m.isActive && !showEditor && (
            <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
              Modifier les rôles
            </button>
          )}
          {m.isActive && !m.activated && (
            <form action={linkAction}>
              <input type="hidden" name="userId" value={m.id} />
              <button type="submit" disabled={linkPending} className="btn-secondary">
                {linkPending ? "Génération…" : "Nouveau lien"}
              </button>
            </form>
          )}
          {!m.isSelf && (
            <form
              action={activeAction}
              onSubmit={(e) => {
                if (m.isActive && !confirm(`Désactiver ${m.name} ? Ses sessions seront coupées immédiatement.`)) e.preventDefault();
              }}
            >
              <input type="hidden" name="userId" value={m.id} />
              <input type="hidden" name="active" value={m.isActive ? "false" : "true"} />
              <button type="submit" disabled={activePending} className="btn-secondary">
                {m.isActive ? "Désactiver" : "Réactiver"}
              </button>
            </form>
          )}
        </div>
      </div>

      {showEditor && (
        <form action={rolesAction} className="card flex flex-col gap-3 p-4">
          <input type="hidden" name="userId" value={m.id} />
          <fieldset>
            <legend className="text-sm font-medium">Rôles de {m.name}</legend>
            <div className="mt-2 flex flex-col gap-2">
              {ROLE_OPTIONS.map((r) => (
                <label key={r.value} className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="roles"
                    value={r.value}
                    defaultChecked={m.roles.includes(r.value)}
                    className="mt-0.5 size-4 accent-brand-strong"
                  />
                  <span>
                    <span className="font-medium">{r.label}</span>
                    <span className="block text-ink-muted">{r.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex gap-2">
            <button type="submit" disabled={rolesPending} className="btn-primary">
              {rolesPending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" className="btn-secondary h-11" onClick={() => setEditing(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {error && error.status === "error" && (
        <p role="alert" className="alert-error">
          {error.message}
        </p>
      )}
      {linkState.status === "link" && (
        <ActivationLinkBox url={linkState.url} expiresAt={linkState.expiresAt} recipientName={linkState.name} recipientPhone={m.phone} />
      )}
    </li>
  );
}

function Status({ m }: { m: MemberView }) {
  if (!m.isActive) return <span className="text-danger">Désactivé</span>;
  if (m.activated) return <span className="text-success">Actif</span>;
  if (m.pendingLinkExpiresAt) {
    const until = new Date(m.pendingLinkExpiresAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    return <span className="text-warning">Invitation envoyée : lien valable jusqu&apos;au {until}</span>;
  }
  return <span className="text-warning">Invitation expirée : générez un nouveau lien</span>;
}
