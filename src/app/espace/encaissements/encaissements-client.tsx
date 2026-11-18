"use client";

import { useState } from "react";
import { recordCashHandoverAction } from "./actions";

type CourierSummary = {
  courierId: string;
  courierName: string;
  courierPhone: string;
  totalDeliveriesWithCod: number;
  totalExpectedAmount: number;
  totalCollectedAmount: number;
  totalCashCollected: number;
  totalDigitalCollected: number;
  totalAlreadyHandedOver: number;
  pendingCashOnHand: number;
};

type HandoverItem = {
  id: string;
  courierName: string;
  courierPhone: string;
  expectedAmount: number;
  handedOverAmount: number;
  discrepancy: number;
  receivedByUserName: string;
  notes: string | null;
  createdAt: Date;
};

export function EncaissementsClient({
  courierSummaries,
  handovers,
  canReconcile,
}: {
  courierSummaries: CourierSummary[];
  handovers: HandoverItem[];
  canReconcile: boolean;
}) {
  const [selectedCourier, setSelectedCourier] = useState<CourierSummary | null>(null);

  const totalInField = courierSummaries.reduce((sum, c) => sum + c.pendingCashOnHand, 0);
  const totalDigital = courierSummaries.reduce((sum, c) => sum + c.totalDigitalCollected, 0);

  return (
    <div className="space-y-8">
      {/* Statistiques globales de caisse */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5 border-l-4 border-l-accent">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Espèces en circulation (Livreurs)
          </p>
          <p className="mt-2 text-2xl font-black text-ink tabular-nums">
            {totalInField.toLocaleString("fr-FR")} F CFA
          </p>
          <p className="mt-1 text-xs text-ink-muted">Montant à récupérer au retour des tournées</p>
        </div>

        <div className="card p-5 border-l-4 border-l-success">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Paiements digitaux (Wave / MoMo)
          </p>
          <p className="mt-2 text-2xl font-black text-success tabular-nums">
            {totalDigital.toLocaleString("fr-FR")} F CFA
          </p>
          <p className="mt-1 text-xs text-ink-muted">Encaissés directement sans manipulation de billets</p>
        </div>

        <div className="card p-5 border-l-4 border-l-ink">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-muted">
            Remises clôturées
          </p>
          <p className="mt-2 text-2xl font-black text-ink tabular-nums">
            {handovers.length} remise{handovers.length > 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-xs text-ink-muted">Historique des versements au dépôt</p>
        </div>
      </div>

      {/* Situation de caisse par livreur */}
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div>
            <h2 className="text-lg font-bold text-ink">Situation de caisse par livreur</h2>
            <p className="text-xs text-ink-muted">
              Rapprochement des montants collectés et suivi des espèces à remettre
            </p>
          </div>
        </div>

        {courierSummaries.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-muted">Aucun livreur actif rattaché.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface text-ink-muted">
                <tr>
                  <th className="p-3">Livreur</th>
                  <th className="p-3">Colis COD</th>
                  <th className="p-3">Espèces encaissées</th>
                  <th className="p-3">Wave / MoMo</th>
                  <th className="p-3">Déjà remis</th>
                  <th className="p-3">Reste à remettre</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {courierSummaries.map((c) => (
                  <tr key={c.courierId} className="hover:bg-surface/50">
                    <td className="p-3">
                      <p className="font-semibold text-ink">{c.courierName}</p>
                      <p className="text-[10px] text-ink-muted tabular-nums">{c.courierPhone}</p>
                    </td>
                    <td className="p-3 tabular-nums font-medium">{c.totalDeliveriesWithCod}</td>
                    <td className="p-3 tabular-nums font-semibold text-ink">
                      {c.totalCashCollected.toLocaleString("fr-FR")} F
                    </td>
                    <td className="p-3 tabular-nums text-success">
                      {c.totalDigitalCollected.toLocaleString("fr-FR")} F
                    </td>
                    <td className="p-3 tabular-nums text-ink-muted">
                      {c.totalAlreadyHandedOver.toLocaleString("fr-FR")} F
                    </td>
                    <td className="p-3 tabular-nums font-bold text-accent-strong">
                      {c.pendingCashOnHand.toLocaleString("fr-FR")} F CFA
                    </td>
                    <td className="p-3 text-right">
                      {canReconcile && (
                        <button
                          type="button"
                          onClick={() => setSelectedCourier(c)}
                          className="btn-primary text-xs py-1 px-2.5"
                        >
                          Encaisser
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal de remise de caisse */}
      {selectedCourier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="card w-full max-w-md space-y-4 p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-bold text-base text-ink">
                Remise d'espèces — {selectedCourier.courierName}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedCourier(null)}
                className="text-ink-muted hover:text-ink font-bold"
              >
                ✕
              </button>
            </div>

            <div className="rounded-lg bg-surface p-3 text-xs space-y-1">
              <p className="text-ink-muted">
                Montant en attente calculé par le système :
              </p>
              <p className="text-lg font-black text-accent-strong tabular-nums">
                {selectedCourier.pendingCashOnHand.toLocaleString("fr-FR")} F CFA
              </p>
            </div>

            <form
              action={async (formData) => {
                await recordCashHandoverAction(formData);
                setSelectedCourier(null);
              }}
              className="space-y-4 text-xs"
            >
              <input type="hidden" name="courierId" value={selectedCourier.courierId} />

              <div>
                <label htmlFor="handedOverAmount" className="block font-semibold text-ink">
                  Montant physique remis (en F CFA)
                </label>
                <input
                  type="number"
                  id="handedOverAmount"
                  name="handedOverAmount"
                  required
                  min={0}
                  defaultValue={selectedCourier.pendingCashOnHand}
                  className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 text-sm font-bold tabular-nums"
                />
                <p className="mt-1 text-[11px] text-ink-muted">
                  Si le montant remis diffère, un écart d'encaissement sera consigné dans l'audit.
                </p>
              </div>

              <div>
                <label htmlFor="notes" className="block font-semibold text-ink">
                  Notes ou observations (facultatif)
                </label>
                <input
                  type="text"
                  id="notes"
                  name="notes"
                  placeholder="Ex : Billets vérifiés, solde parfait"
                  className="mt-1 w-full rounded border border-line bg-surface px-3 py-2 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={() => setSelectedCourier(null)}
                  className="btn-secondary text-xs"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Valider la remise
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Historique des remises */}
      <section className="card space-y-4 p-5">
        <h2 className="text-lg font-bold text-ink">Historique des remises physiques d'espèces</h2>
        {handovers.length === 0 ? (
          <p className="py-4 text-xs text-ink-muted">Aucune remise d'espèces enregistrée pour le moment.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-line bg-surface text-ink-muted">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Livreur</th>
                  <th className="p-3">Attendu</th>
                  <th className="p-3">Remis</th>
                  <th className="p-3">Écart</th>
                  <th className="p-3">Réceptionné par</th>
                  <th className="p-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {handovers.map((h) => (
                  <tr key={h.id}>
                    <td className="p-3 tabular-nums text-ink-muted">
                      {new Date(h.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3 font-semibold text-ink">{h.courierName}</td>
                    <td className="p-3 tabular-nums">{h.expectedAmount.toLocaleString("fr-FR")} F</td>
                    <td className="p-3 tabular-nums font-bold text-ink">
                      {h.handedOverAmount.toLocaleString("fr-FR")} F
                    </td>
                    <td className="p-3 tabular-nums">
                      {h.discrepancy === 0 ? (
                        <span className="text-success font-semibold">0 F (Conforme)</span>
                      ) : (
                        <span className="text-warning font-bold">
                          {h.discrepancy > 0 ? `+${h.discrepancy}` : h.discrepancy} F
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-ink-muted">{h.receivedByUserName}</td>
                    <td className="p-3 text-ink-muted">{h.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
