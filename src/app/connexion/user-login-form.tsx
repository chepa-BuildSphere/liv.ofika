"use client";

import { useActionState, useState } from "react";
import { userLoginAction, type UserLoginState } from "./actions";
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon, SpinnerIcon, AlertTriangleIcon } from "@/components/icons";

export function UserLoginForm() {
  const [state, action, pending] = useActionState<UserLoginState, FormData>(userLoginAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="user-email" className="block text-xs font-semibold uppercase tracking-wider text-[#787774]">
          Adresse e-mail professionnelle
        </label>
        <div className="relative mt-1.5">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#787774]">
            <MailIcon className="h-4 w-4" />
          </div>
          <input
            id="user-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue={state.email}
            placeholder="direction@votre-entreprise.ci"
            className="w-full rounded-[8px] border border-[#EAEAEA] bg-white py-2.5 pl-10 pr-3.5 text-sm text-[#111111] placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="user-password" className="block text-xs font-semibold uppercase tracking-wider text-[#787774]">
            Mot de passe
          </label>
        </div>
        <div className="relative mt-1.5">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#787774]">
            <LockIcon className="h-4 w-4" />
          </div>
          <input
            id="user-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••••••"
            className="w-full rounded-[8px] border border-[#EAEAEA] bg-white py-2.5 pl-10 pr-10 text-sm font-mono text-[#111111] placeholder:font-sans placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#787774] transition-colors hover:text-[#111111]"
          >
            {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {state.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[8px] border border-[#DC2626]/20 bg-[#FEF2F2] p-3 text-xs text-[#DC2626]">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#DC2626]" />
          <span className="font-medium">{state.error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] bg-[#111111] text-sm font-medium text-white transition-all duration-150 hover:bg-[#2F3437] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <SpinnerIcon className="h-4 w-4" />
            <span>Vérification des accès…</span>
          </>
        ) : (
          <span>Accéder au tableau de bord</span>
        )}
      </button>
    </form>
  );
}
