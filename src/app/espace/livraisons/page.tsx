import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { db } from "@/db";
import { can, userActor } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/user-session";
import { listCouriers } from "@/lib/couriers/couriers";
import { CSV_TEMPLATE } from "@/lib/deliveries/csv-import";
import {
  DELIVERY_STATUS_LABEL,
  deliveryStatusLabel,
  listDeliveries,
  normalizeDeliveryFilters,
} from "@/lib/deliveries/deliveries";
import { DELIVERY_STATUSES } from "@/lib/deliveries/transitions";
import { formatPhone } from "@/lib/validation";
import {
  PackageIcon,
  ChevronRightIcon,
  SearchIcon,
} from "@/components/icons";
import { CreateDeliveryForm } from "./create-delivery-form";
import { DeliveryRowActions } from "./delivery-row-actions";
import { ImportDeliveriesForm } from "./import-deliveries-form";

export const metadata: Metadata = { title: "Livraisons & Expéditions — Ofika Delivery" };

type SearchParams = Promise<{
  status?: string;
  courierId?: string;
  date?: string;
  reference?: string;
  includeTest?: string;
}>;

export default function DeliveriesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="space-y-6">
      {/* ── BREADCRUMB ─────────────────────────────────────────────────── */}
      <nav aria-label="Fil d'ariane" className="flex items-center gap-2 text-xs text-[#787774]">
        <Link href="/dashboard" className="hover:text-[#111111] transition-colors">
          Tableau de bord
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-[#111111]">Livraisons</span>
      </nav>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="border-b border-[#EAEAEA] pb-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-white">
            <PackageIcon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#111111]">
              Gestion des Livraisons
            </h1>
            <p className="text-xs text-[#787774]">
              Créez vos colis, importez vos bordereaux CSV, affectez vos livreurs et suivez la remise certifiée.
            </p>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex h-48 items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-[#787774]">
              <span className="h-2 w-2 rounded-full bg-[#C2410C] animate-ping" />
              <span>Chargement des livraisons…</span>
            </div>
          </div>
        }
      >
        <Deliveries searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Deliveries({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  if (!can(userActor(user), "delivery.create", { companyId: user.companyId }).allowed) {
    return (
      <div role="alert" className="rounded-xl border border-[#B45309]/20 bg-[#FFFBEB] p-5 text-xs text-[#B45309]">
        La création et le suivi des livraisons sont réservés à l&apos;administrateur et au gestionnaire de l&apos;entreprise.
      </div>
    );
  }

  const params = await searchParams;
  const filters = normalizeDeliveryFilters(params);
  const [list, couriersList] = await Promise.all([listDeliveries(db, user, params), listCouriers(db, user)]);
  const attachedCouriers = couriersList.filter((c) => c.attached).map((c) => ({ id: c.id, name: c.name }));
  const hasFilters = !!(filters.status || filters.courierId || filters.date || filters.reference || filters.includeTest);

  return (
    <div className="space-y-6">
      {/* ── ACTIONS DE CRÉATION & IMPORT CSV ──────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <CreateDeliveryForm />
        <ImportDeliveriesForm template={CSV_TEMPLATE} />
      </div>

      {/* ── BARRE DE FILTRES PRO ───────────────────────────────────────── */}
      <form
        key={`${filters.status ?? ""}-${filters.courierId ?? ""}-${filters.date ?? ""}-${filters.reference ?? ""}-${filters.includeTest ? "1" : "0"}`}
        method="GET"
        action="/espace/livraisons"
        className="rounded-xl border border-[#EAEAEA] bg-white p-4 shadow-xs space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-5">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#111111]">
            Statut
            <select name="status" defaultValue={filters.status ?? ""} className="h-10 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] px-3 text-xs text-[#111111] focus:border-[#C2410C] focus:outline-none">
              <option value="">Tous les statuts</option>
              {DELIVERY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DELIVERY_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#111111]">
            Livreur affecté
            <select name="courierId" defaultValue={filters.courierId ?? ""} className="h-10 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] px-3 text-xs text-[#111111] focus:border-[#C2410C] focus:outline-none">
              <option value="">Tous les livreurs</option>
              <option value="UNASSIGNED">Non affectée</option>
              {couriersList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.attached ? " (détaché)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#111111]">
            Date de course
            <input type="date" name="date" defaultValue={filters.date ?? ""} className="h-10 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] px-3 text-xs text-[#111111] focus:border-[#C2410C] focus:outline-none font-mono" />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-[#111111]">
            Référence
            <input
              type="search"
              name="reference"
              placeholder="Ex: CMD-1042"
              defaultValue={filters.reference ?? ""}
              className="h-10 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] px-3 text-xs text-[#111111] focus:border-[#C2410C] focus:outline-none font-mono"
            />
          </label>

          <div className="flex items-end gap-2">
            <button type="submit" className="h-10 flex-1 rounded-lg bg-[#C2410C] text-xs font-bold text-white hover:bg-[#9A3412] transition-colors">
              Filtrer
            </button>
            {hasFilters && (
              <Link href="/espace/livraisons" className="h-10 inline-flex items-center rounded-lg border border-[#EAEAEA] bg-white px-3 text-xs font-semibold text-[#787774] hover:border-[#111111] hover:text-[#111111]">
                Effacer
              </Link>
            )}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-[#787774]">
          <input
            type="checkbox"
            name="includeTest"
            value="1"
            defaultChecked={filters.includeTest}
            className="size-3.5 accent-[#C2410C]"
          />
          <span>Afficher le mode test (livraisons créées via clé API test)</span>
        </label>
      </form>

      {filters.includeTest && (
        <div
          role="status"
          className="rounded-lg border border-[#B45309]/30 bg-[#FFFBEB] px-4 py-2 text-xs text-[#B45309]"
        >
          <strong>MODE TEST</strong> — Ces livraisons sont virtuelles : aucun livreur n&apos;est alerté et aucun frais n&apos;est facturé.
        </div>
      )}

      {/* ── LISTE PRO DES LIVRAISONS ───────────────────────────────────── */}
      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#EAEAEA] bg-white p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-[#111111]">
            {hasFilters ? "Aucune livraison ne correspond à ces critères." : "Aucune livraison pour l'instant."}
          </p>
          <p className="text-xs text-[#787774]">
            Créez une livraison avec le bouton ci-dessus ou importez votre fichier de commandes.
          </p>
        </div>
      ) : (
        <ul className="rounded-xl border border-[#EAEAEA] bg-white divide-y divide-[#EAEAEA] shadow-xs" aria-label="Livraisons de l'entreprise">
          {list.map((d) => {
            const label = deliveryStatusLabel(d.status, d.proofMethod);
            return (
              <li key={d.id} className="flex flex-col gap-3 p-4 sm:p-5 text-xs transition-colors hover:bg-[#FBFBFA]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/espace/livraisons/${d.id}`} className="font-mono font-bold text-sm text-[#C2410C] hover:underline">
                        {d.reference}
                      </Link>
                      <span className="font-semibold text-[#111111]">· {d.recipientName}</span>
                      <span className="font-mono text-[#787774]">({formatPhone(d.recipientPhone)})</span>
                      {d.isTest && (
                        <span className="rounded-full border border-[#B45309]/40 bg-[#FFFBEB] px-2 py-0.5 font-mono text-[9px] font-bold text-[#B45309]">
                          TEST
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[#787774]">
                      {d.address}
                      {d.district ? ` · ${d.district}` : ""}
                      {d.packageDescription ? ` · ${d.packageDescription}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#787774]">
                      {d.courierName ? `Livreur : ${d.courierName}` : "Non affectée"} ·{" "}
                      {d.createdAt.toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" })}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {d.amountToCollect !== null && (
                      <span className="font-mono font-bold text-[#15803D] bg-[#F0FDF4] border border-[#15803D]/20 px-2 py-0.5 rounded-md text-[11px]">
                        {d.amountToCollect.toLocaleString("fr-FR")} F CFA
                      </span>
                    )}
                    <span className="rounded-full border border-[#EAEAEA] bg-[#F7F6F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#111111]">
                      {label}
                    </span>
                    <a
                      href={`/espace/livraisons/${d.id}/bordereau.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C2410C] font-semibold hover:underline"
                    >
                      Bordereau PDF
                    </a>
                    <Link href={`/espace/livraisons/${d.id}`} className="text-[#111111] font-semibold hover:underline">
                      Détail →
                    </Link>
                  </div>
                </div>

                {!d.isTest && (
                  <DeliveryRowActions
                    couriers={attachedCouriers}
                    delivery={{
                      id: d.id,
                      reference: d.reference,
                      status: d.status,
                      courierId: d.courierId,
                      recipientName: d.recipientName,
                      recipientPhone: d.recipientPhone,
                      address: d.address,
                      district: d.district,
                      packageDescription: d.packageDescription,
                      amountToCollect: d.amountToCollect,
                      comment: d.comment,
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
