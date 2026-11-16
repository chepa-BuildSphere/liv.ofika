"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "../actions";
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon, SpinnerIcon } from "@/components/icons";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Champ E-mail */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#111111]">
          E-mail Super Admin
        </label>
        <div className="relative">
          <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#787774]" />
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue={state.email ?? "krs@ofika.com"}
            placeholder="superadmin@ofika.ci"
            className="w-full h-11 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] pl-9 pr-3 text-xs text-[#111111] placeholder:text-[#787774] focus:border-[#C2410C] focus:bg-white focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Champ Mot de passe */}
      <div className="space-y-1.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#111111]">
          Mot de passe
        </label>
        <div className="relative">
          <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#787774]" />
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            className="w-full h-11 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] pl-9 pr-10 text-xs text-[#111111] placeholder:text-[#787774] focus:border-[#C2410C] focus:bg-white focus:outline-none transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787774] hover:text-[#111111] transition-colors"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {state.error && (
        <div role="alert" className="rounded-lg border border-[#DC2626]/20 bg-[#FEF2F2] p-3 text-xs font-medium text-[#DC2626]">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#C2410C] text-xs font-bold uppercase tracking-wider text-white shadow-xs transition-all hover:bg-[#9A3412] active:scale-98 disabled:opacity-60"
      >
        {pending ? (
          <>
            <SpinnerIcon className="h-4 w-4" />
            <span>Authentification en cours…</span>
          </>
        ) : (
          <span>Accéder au back-office</span>
        )}
      </button>
    </form>
  );
}
