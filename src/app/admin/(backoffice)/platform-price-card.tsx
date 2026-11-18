"use client";

import { useActionState, useState } from "react";
import { ReceiptIcon, CheckCircleIcon } from "@/components/icons";
import { setPlatformPriceAction, type BillingMutationState } from "./companies/actions";

export function PlatformPriceCard({
  currentPrice,
}: {
  currentPrice: number;
}) {
  const [state, action, pending] = useActionState<BillingMutationState, FormData>(
    setPlatformPriceAction,
    { status: "idle" },
  );
  const [applyToAll, setApplyToAll] = useState(true);

  return (
    <section
      aria-label="Configuration du tarif de livraison sur la plateforme"
      className="rounded-xl border border-[#EAEAEA] bg-white p-5 sm:p-6 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#C2410C]">
            <ReceiptIcon className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-[#111111]">
                Tarif par livraison (Page d&apos;accueil &amp; Tarif standard)
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#15803D]/20 bg-[#F0FDF4] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#15803D]">
                <CheckCircleIcon className="h-3 w-3" />
                <span>Actif : {currentPrice.toLocaleString("fr-FR")} F CFA / course</span>
              </span>
            </div>
            <p className="mt-1 text-xs text-[#787774]">
              Ce tarif est affiché dynamiquement sur la page d&apos;accueil publique, la page d&apos;inscription et appliqué par défaut aux nouvelles entreprises.
            </p>
          </div>
        </div>

        <form
          key={currentPrice}
          action={action}
          className="flex flex-col sm:items-end gap-2.5 shrink-0"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                name="pricePerDelivery"
                type="number"
                min={0}
                max={100000}
                step={1}
                required
                defaultValue={currentPrice}
                aria-label="Prix par livraison en F CFA (Page d'accueil)"
                className="h-9 w-36 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] pl-3 pr-14 font-mono text-xs font-bold text-[#111111] focus:border-[#C2410C] focus:bg-white focus:outline-none"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] font-semibold text-[#787774]">
                F CFA
              </span>
            </div>
            <input
              type="hidden"
              name="applyToExistingCompanies"
              value={applyToAll ? "true" : "false"}
            />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#C2410C] px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-[#9A3412] disabled:opacity-60 cursor-pointer"
            >
              {pending ? "Enregistrement…" : "Modifier le tarif"}
            </button>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-[#787774] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[#EAEAEA] accent-[#C2410C]"
            />
            <span>Appliquer aussi ce tarif aux entreprises existantes</span>
          </label>
        </form>
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-[#DC2626]/20 bg-[#FEF2F2] px-3 py-2 text-xs font-medium text-[#DC2626]"
        >
          {state.message}
        </p>
      )}
      {state.status === "done" && (
        <p
          role="status"
          className="rounded-lg border border-[#15803D]/20 bg-[#F0FDF4] px-3 py-2 text-xs font-medium text-[#15803D]"
        >
          {state.message}
        </p>
      )}
    </section>
  );
}
