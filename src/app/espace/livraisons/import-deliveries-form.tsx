"use client";

import { useActionState, useState } from "react";
import { importDeliveriesAction, type ImportDeliveriesState } from "./actions";

export function ImportDeliveriesForm({ template }: { template: string }) {
  const [round, setRound] = useState(0);
  return <Inner key={round} template={template} startOpen={round > 0} onReset={() => setRound((n) => n + 1)} />;
}

function Inner({ template, startOpen, onReset }: { template: string; startOpen: boolean; onReset: () => void }) {
  const [open, setOpen] = useState(startOpen);
  const [state, action, pending] = useActionState<ImportDeliveriesState, FormData>(importDeliveriesAction, {
    status: "idle",
  });

  if (!open && state.status === "idle") {
    return (
      <button type="button" className="btn-secondary h-11 px-4" onClick={() => setOpen(true)}>
        Importer CSV / Excel
      </button>
    );
  }

  return (
    <div className="card flex w-full flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Importer des livraisons (CSV / Excel)</h2>
          <p className="text-sm text-ink-muted">
            Colonnes obligatoires : <span className="font-mono text-xs">reference</span>,{" "}
            <span className="font-mono text-xs">destinataire</span>,{" "}
            <span className="font-mono text-xs">telephone</span>,{" "}
            <span className="font-mono text-xs">adresse</span> (séparateur <span className="font-mono">;</span>,{" "}
            <span className="font-mono">,</span> ou tabulation Excel).
          </p>
        </div>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`}
          download="modele-livraisons-ofika.csv"
          className="link text-sm"
        >
          Télécharger le modèle CSV
        </a>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <label className="field-label">
          Fichier CSV (export Excel en CSV UTF-8 ou point-virgule)
          <input
            type="file"
            name="file"
            accept=".csv,.txt,text/csv,text/tab-separated-values"
            className="block w-full text-sm text-ink file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line-strong file:bg-paper file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:border-ink"
          />
        </label>

        <label className="field-label">
          Ou collez directement vos lignes copiées depuis Excel
          <textarea
            name="csvText"
            rows={5}
            placeholder={"reference\tdestinataire\ttelephone\tadresse\tquartier\tmontant\nCMD-1045\tAwa Koné\t07 07 07 07 07\tRue des Jardins\tCocody\t15000"}
            className="input h-auto py-2 font-mono text-xs"
          />
        </label>

        {state.status === "error" && (
          <p role="alert" className="alert-error">
            {state.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={pending} className="btn-primary">
            {pending ? "Import en cours…" : "Lancer l'import"}
          </button>
          <button
            type="button"
            className="btn-secondary h-11"
            onClick={() => {
              setOpen(false);
              if (state.status !== "idle") onReset();
            }}
          >
            Fermer
          </button>
        </div>
      </form>

      {state.status === "done" && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <p
            role="status"
            className={`rounded-lg border px-4 py-3 text-sm ${
              state.importedCount > 0
                ? "border-success/30 bg-success-soft text-success"
                : "border-warning/30 bg-warning-soft text-warning"
            }`}
          >
            <strong>
              {state.importedCount} sur {state.totalRows} livraison{state.totalRows > 1 ? "s" : ""} importée
              {state.importedCount > 1 ? "s" : ""}
            </strong>
            {state.errors.length > 0 && ` (${state.errors.length} ligne${state.errors.length > 1 ? "s" : ""} en erreur)`}.
          </p>

          {state.errors.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-line bg-surface text-ink-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Ligne</th>
                    <th className="px-3 py-2 font-medium">Référence</th>
                    <th className="px-3 py-2 font-medium">Erreur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {state.errors.map((err, i) => (
                    <tr key={`${err.lineNumber}-${i}`}>
                      <td className="px-3 py-2 tabular-nums font-medium">{err.lineNumber}</td>
                      <td className="px-3 py-2 font-mono">{err.reference ?? "—"}</td>
                      <td className="px-3 py-2 text-danger">{err.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
