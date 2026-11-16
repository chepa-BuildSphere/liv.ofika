"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { firstAccessAction, type FirstAccessState } from "./actions";
import { PhoneIcon, KeyIcon, LockIcon, EyeIcon, EyeOffIcon, SpinnerIcon, CheckCircleIcon, AlertTriangleIcon } from "@/components/icons";

export function FirstAccessForm() {
  const [state, action, pending] = useActionState<FirstAccessState, FormData>(firstAccessAction, { status: "idle" });
  const [showPin, setShowPin] = useState(false);

  if (state.status === "done") {
    return (
      <div role="status" className="rounded-[12px] border border-[#15803D]/30 bg-[#F0FDF4] p-6 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]">
          <CheckCircleIcon className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#15803D]">Code PIN enregistré avec succès</h2>
          <p className="mt-1 text-xs text-[#166534] leading-relaxed">
            Votre compte est désormais activé. Vous pouvez vous connecter à tout moment avec votre numéro et ce code PIN.
          </p>
        </div>
        <Link
          href="/courier/login"
          className="inline-flex h-11 w-full items-center justify-center rounded-[8px] bg-[#15803D] text-sm font-medium text-white transition-colors hover:bg-[#166534]"
        >
          Aller à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {/* 1. Téléphone */}
      <div>
        <label htmlFor="first-access-phone" className="block text-xs font-semibold uppercase tracking-wider text-[#787774]">
          Votre numéro de téléphone
        </label>
        <div className="relative mt-1.5">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#787774]">
            <PhoneIcon className="h-4 w-4" />
          </div>
          <input
            id="first-access-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            defaultValue={state.status === "error" ? state.phone : undefined}
            placeholder="07 00 00 00 00"
            className="h-11 w-full rounded-[8px] border border-[#EAEAEA] bg-white pl-10 pr-3.5 text-sm font-medium text-[#111111] placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20"
          />
        </div>
      </div>

      {/* 2. Code d'accès fourni par l'entreprise */}
      <div>
        <label htmlFor="first-access-code" className="block text-xs font-semibold uppercase tracking-wider text-[#787774]">
          Code d&apos;accès fourni par votre entreprise
        </label>
        <div className="relative mt-1.5">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#787774]">
            <KeyIcon className="h-4 w-4" />
          </div>
          <input
            id="first-access-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
            defaultValue={state.status === "error" ? state.code : undefined}
            placeholder="Ex : 123 456"
            className="h-11 w-full rounded-[8px] border border-[#EAEAEA] bg-white pl-10 pr-3.5 font-mono text-base tracking-widest text-[#111111] placeholder:font-sans placeholder:tracking-normal placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20"
          />
        </div>
        <p className="mt-1 text-[11px] text-[#787774]">Ce code à 6 chiffres vous a été transmis lors de votre enregistrement.</p>
      </div>

      {/* 3. Choix du PIN secret */}
      <div className="rounded-[10px] border border-[#EAEAEA] bg-[#FBFBFA] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
              Votre code PIN secret (6 chiffres)
            </h3>
            <p className="text-[11px] text-[#787774]">
              Évitez les séquences simples comme 123456 ou 000000.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPin((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium text-[#787774] hover:text-[#111111]"
          >
            {showPin ? <EyeOffIcon className="h-3.5 w-3.5" /> : <EyeIcon className="h-3.5 w-3.5" />}
            <span>{showPin ? "Masquer" : "Afficher"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="new-pin" className="block text-[11px] font-medium text-[#787774]">
              Nouveau code PIN
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#787774]">
                <LockIcon className="h-3.5 w-3.5" />
              </div>
              <input
                id="new-pin"
                name="pin"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                autoComplete="new-password"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="6 chiffres"
                className="h-11 w-full rounded-[8px] border border-[#EAEAEA] bg-white pl-9 pr-3 text-center font-mono text-base tracking-[0.2em] text-[#111111] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="confirm-pin" className="block text-[11px] font-medium text-[#787774]">
              Confirmer le code PIN
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#787774]">
                <LockIcon className="h-3.5 w-3.5" />
              </div>
              <input
                id="confirm-pin"
                name="pinConfirmation"
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                autoComplete="new-password"
                pattern="\d{6}"
                maxLength={6}
                required
                placeholder="6 chiffres"
                className="h-11 w-full rounded-[8px] border border-[#EAEAEA] bg-white pl-9 pr-3 text-center font-mono text-base tracking-[0.2em] text-[#111111] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20"
              />
            </div>
          </div>
        </div>
      </div>

      {state.status === "error" && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[8px] border border-[#DC2626]/20 bg-[#FEF2F2] p-3 text-xs text-[#DC2626]">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#DC2626]" />
          <span className="font-medium leading-relaxed">{state.message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] bg-[#C2410C] text-sm font-medium text-white transition-all duration-150 hover:bg-[#9A3412] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <SpinnerIcon className="h-4 w-4" />
            <span>Enregistrement sécurisé…</span>
          </>
        ) : (
          <span>Valider et enregistrer mon code PIN</span>
        )}
      </button>

      <div className="text-center pt-2">
        <Link href="/courier/login" className="text-xs text-[#787774] hover:text-[#111111] underline-offset-2 hover:underline">
          Retour à la page de connexion livreur
        </Link>
      </div>
    </form>
  );
}
