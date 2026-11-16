"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { collectBrowserDeviceSignals } from "@/lib/device-signals-client";
import { courierLoginAction, type CourierLoginState } from "./actions";
import { PhoneIcon, LockIcon, EyeIcon, EyeOffIcon, SpinnerIcon, AlertTriangleIcon } from "@/components/icons";

export function CourierLoginForm() {
  const [state, action, pending] = useActionState<CourierLoginState, FormData>(courierLoginAction, {});
  const [deviceSignals, setDeviceSignals] = useState("");
  const [pinValue, setPinValue] = useState("");
  const [showPin, setShowPin] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDeviceSignals(collectBrowserDeviceSignals());
  }, []);

  function handlePinChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPinValue(raw);
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="deviceSignals" value={deviceSignals} />

      {/* Numéro de téléphone */}
      <div>
        <label htmlFor="courier-phone" className="block text-xs font-semibold uppercase tracking-wider text-[#787774]">
          Numéro de téléphone
        </label>
        <div className="relative mt-1.5">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#787774]">
            <PhoneIcon className="h-4 w-4" />
          </div>
          <input
            id="courier-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            defaultValue={state.phone}
            placeholder="07 00 00 00 00"
            className="h-12 w-full rounded-[10px] border border-[#EAEAEA] bg-white pl-10 pr-4 text-base font-medium text-[#111111] placeholder:text-[#A1A1AA] transition-colors focus:border-[#C2410C] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20"
          />
        </div>
        <p className="mt-1 text-[11px] text-[#787774]">Format 10 chiffres (ex: 07 07 07 07 07)</p>
      </div>

      {/* Code PIN 6 chiffres */}
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="courier-pin" className="block text-xs font-semibold uppercase tracking-wider text-[#787774]">
            Code PIN secret (6 chiffres)
          </label>
          <button
            type="button"
            onClick={() => setShowPin((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-medium text-[#787774] hover:text-[#111111]"
          >
            {showPin ? (
              <>
                <EyeOffIcon className="h-3.5 w-3.5" />
                <span>Masquer</span>
              </>
            ) : (
              <>
                <EyeIcon className="h-3.5 w-3.5" />
                <span>Afficher</span>
              </>
            )}
          </button>
        </div>

        {/* Input réel avec grille visuelle au clic */}
        <div className="relative mt-2" onClick={() => pinInputRef.current?.focus()}>
          {/* Grille tactile de 6 boîtes */}
          <div className="grid grid-cols-6 gap-2 sm:gap-2.5">
            {[0, 1, 2, 3, 4, 5].map((idx) => {
              const char = pinValue[idx];
              const isFilled = Boolean(char);
              const isCurrent = pinValue.length === idx;

              return (
                <div
                  key={idx}
                  className={`flex h-13 sm:h-14 items-center justify-center rounded-[8px] border text-xl font-mono font-semibold transition-all ${
                    isCurrent
                      ? "border-[#C2410C] bg-[#FFF7ED] ring-2 ring-[#C2410C]/20 text-[#C2410C]"
                      : isFilled
                        ? "border-[#111111] bg-white text-[#111111]"
                        : "border-[#EAEAEA] bg-[#FAFAFA] text-[#A1A1AA]"
                  }`}
                >
                  {isFilled ? (showPin ? char : "•") : ""}
                </div>
              );
            })}
          </div>

          {/* Input invisible pour l'accessibilité et la saisie clavier natif */}
          <input
            ref={pinInputRef}
            id="courier-pin"
            name="pin"
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            autoComplete="current-password"
            pattern="\d{6}"
            maxLength={6}
            required
            value={pinValue}
            onChange={handlePinChange}
            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
            aria-label="Code PIN secret à 6 chiffres"
          />
        </div>
      </div>

      {state.error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-[10px] border border-[#DC2626]/20 bg-[#FEF2F2] p-3 text-xs text-[#DC2626]">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#DC2626]" />
          <span className="font-medium leading-relaxed">{state.error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-[#C2410C] text-base font-medium text-white shadow-sm transition-all duration-150 hover:bg-[#9A3412] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <>
            <SpinnerIcon className="h-5 w-5" />
            <span>Vérification…</span>
          </>
        ) : (
          <span>Ouvrir ma tournée</span>
        )}
      </button>
    </form>
  );
}
