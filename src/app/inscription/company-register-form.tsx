"use client";

import { useActionState, useState } from "react";
import { registerCompanyAction, type RegisterState } from "./actions";
import {
  PackageIcon,
  PhoneIcon,
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  SpinnerIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
} from "@/components/icons";

export function CompanyRegisterForm({ pricePerDelivery = 10 }: { pricePerDelivery?: number }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(
    registerCompanyAction,
    {},
  );
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const formattedPrice = pricePerDelivery.toLocaleString("fr-FR");

  const errors = state.errors ?? {};
  const values = state.values ?? {};

  const isPasswordLongEnough = passwordValue.length >= 10;

  return (
    <form action={action} className="space-y-6">
      {/* 1. Informations de l'Entreprise */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#111111] font-mono text-[10px] font-bold text-white">
            1
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
            Votre entreprise ou commerce
          </h2>
        </div>

        <div>
          <label
            htmlFor="company-name"
            className="block text-xs font-semibold text-[#111111]"
          >
            Nom de l&apos;entreprise ou boutique <span className="text-[#DC2626]">*</span>
          </label>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#787774]">
              <PackageIcon className="h-4 w-4" />
            </div>
            <input
              id="company-name"
              name="companyName"
              type="text"
              required
              defaultValue={values.companyName}
              placeholder="Ex : Ivoire Mode & Beauté, Abidjan Grossiste…"
              className={`h-11 w-full rounded-[8px] border bg-white pl-10 pr-3.5 text-sm text-[#111111] placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 ${
                errors.companyName ? "border-[#DC2626]" : "border-[#EAEAEA]"
              }`}
            />
          </div>
          {errors.companyName && (
            <p className="mt-1 text-xs text-[#DC2626]">{errors.companyName}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="company-phone"
            className="block text-xs font-semibold text-[#787774]"
          >
            Téléphone de l&apos;entreprise (facultatif)
          </label>
          <div className="relative mt-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#787774]">
              <PhoneIcon className="h-4 w-4" />
            </div>
            <input
              id="company-phone"
              name="companyPhone"
              type="tel"
              defaultValue={values.companyPhone}
              placeholder="+225 27 20 00 00 00"
              className={`h-11 w-full rounded-[8px] border bg-white pl-10 pr-3.5 text-sm text-[#111111] placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 ${
                errors.companyPhone ? "border-[#DC2626]" : "border-[#EAEAEA]"
              }`}
            />
          </div>
          {errors.companyPhone && (
            <p className="mt-1 text-xs text-[#DC2626]">{errors.companyPhone}</p>
          )}
        </div>
      </div>

      {/* 2. Responsable / Administrateur */}
      <div className="space-y-3.5">
        <div className="flex items-center gap-2 border-b border-[#EAEAEA] pb-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#111111] font-mono text-[10px] font-bold text-white">
            2
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#111111]">
            Compte Administrateur Entreprise
          </h2>
        </div>

        <div>
          <label
            htmlFor="admin-name"
            className="block text-xs font-semibold text-[#111111]"
          >
            Votre nom complet <span className="text-[#DC2626]">*</span>
          </label>
          <input
            id="admin-name"
            name="adminName"
            type="text"
            required
            defaultValue={values.adminName}
            placeholder="Ex : Awa Konan, Jean-Marc Kouamé…"
            className={`mt-1 h-11 w-full rounded-[8px] border bg-white px-3.5 text-sm text-[#111111] placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 ${
              errors.adminName ? "border-[#DC2626]" : "border-[#EAEAEA]"
            }`}
          />
          {errors.adminName && (
            <p className="mt-1 text-xs text-[#DC2626]">{errors.adminName}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-semibold text-[#111111]"
            >
              Adresse e-mail <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#787774]">
                <MailIcon className="h-4 w-4" />
              </div>
              <input
                id="admin-email"
                name="adminEmail"
                type="email"
                autoComplete="email"
                required
                defaultValue={values.adminEmail}
                placeholder="contact@boutique.ci"
                className={`h-11 w-full rounded-[8px] border bg-white pl-10 pr-3.5 text-sm text-[#111111] placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 ${
                  errors.adminEmail ? "border-[#DC2626]" : "border-[#EAEAEA]"
                }`}
              />
            </div>
            {errors.adminEmail && (
              <p className="mt-1 text-xs text-[#DC2626]">{errors.adminEmail}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="admin-phone"
              className="block text-xs font-semibold text-[#787774]"
            >
              Téléphone mobile direct
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#787774]">
                <PhoneIcon className="h-4 w-4" />
              </div>
              <input
                id="admin-phone"
                name="adminPhone"
                type="tel"
                defaultValue={values.adminPhone}
                placeholder="07 00 00 00 00"
                className={`h-11 w-full rounded-[8px] border bg-white pl-10 pr-3.5 text-sm text-[#111111] placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 ${
                  errors.adminPhone ? "border-[#DC2626]" : "border-[#EAEAEA]"
                }`}
              />
            </div>
            {errors.adminPhone && (
              <p className="mt-1 text-xs text-[#DC2626]">{errors.adminPhone}</p>
            )}
          </div>
        </div>

        {/* Mot de passe et confirmation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="register-password"
                className="block text-xs font-semibold text-[#111111]"
              >
                Mot de passe <span className="text-[#DC2626]">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-[11px] font-medium text-[#787774] hover:text-[#111111]"
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#787774]">
                <LockIcon className="h-4 w-4" />
              </div>
              <input
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                placeholder="Au moins 10 caractères"
                className={`h-11 w-full rounded-[8px] border bg-white pl-10 pr-10 text-sm font-mono text-[#111111] placeholder:font-sans placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 ${
                  errors.password ? "border-[#DC2626]" : "border-[#EAEAEA]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Masquer" : "Afficher"}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#787774] hover:text-[#111111]"
              >
                {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-[#DC2626]">{errors.password}</p>
            )}
            <p className="mt-1 flex items-center gap-1 text-[11px] text-[#787774]">
              {isPasswordLongEnough ? (
                <CheckCircleIcon className="h-3 w-3 text-[#15803D]" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-[#A1A1AA]" />
              )}
              <span>10 caractères minimum</span>
            </p>
          </div>

          <div>
            <label
              htmlFor="register-password-confirm"
              className="block text-xs font-semibold text-[#111111]"
            >
              Confirmer le mot de passe <span className="text-[#DC2626]">*</span>
            </label>
            <div className="relative mt-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#787774]">
                <LockIcon className="h-4 w-4" />
              </div>
              <input
                id="register-password-confirm"
                name="passwordConfirmation"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                placeholder="Répétez le mot de passe"
                className={`h-11 w-full rounded-[8px] border bg-white pl-10 pr-3.5 text-sm font-mono text-[#111111] placeholder:font-sans placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 ${
                  errors.passwordConfirmation ? "border-[#DC2626]" : "border-[#EAEAEA]"
                }`}
              />
            </div>
            {errors.passwordConfirmation && (
              <p className="mt-1 text-xs text-[#DC2626]">{errors.passwordConfirmation}</p>
            )}
          </div>
        </div>
      </div>

      {state.generalError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[8px] border border-[#DC2626]/20 bg-[#FEF2F2] p-3 text-xs text-[#DC2626]"
        >
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#DC2626]" />
          <span className="font-medium">{state.generalError}</span>
        </div>
      )}

      {/* Bouton de création */}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] bg-[#C2410C] text-sm font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-[#9A3412] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <SpinnerIcon className="h-4 w-4" />
            <span>Création de votre compte business…</span>
          </>
        ) : (
          <span>Créer mon compte entreprise & démarrer</span>
        )}
      </button>

      <p className="text-center text-[11px] text-[#787774]">
        En créant un compte, vous acceptez les conditions de service d&apos;Ofika Delivery.
        Aucune carte bancaire requise · {formattedPrice} F CFA / livraison validée · Sans engagement.
      </p>
    </form>
  );
}
