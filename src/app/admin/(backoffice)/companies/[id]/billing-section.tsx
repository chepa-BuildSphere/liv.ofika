"use client";

import { useActionState } from "react";
import type { CompanyBillingOverview } from "@/lib/billing/billing";
import {
  BILLING_SETTING_LABEL,
  formatBillingPeriod,
  formatBillingSettingValue,
  STATEMENT_STATUS_LABEL,
} from "@/lib/billing/billing-labels";
import {
  generateStatementAction,
  setPriceAction,
  toggleBillingAction,
  type BillingMutationState,
} from "../actions";
import { MarkPaidButton } from "../../facturation/mark-paid-button";

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString("fr-FR", {
    timeZone: "Africa/Abidjan",
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function BillingSection({ overview }: { overview: CompanyBillingOverview }) {
  const [toggleState, toggleAction, togglePending] = useActionState<BillingMutationState, FormData>(
    toggleBillingAction,
    { status: "idle" },
  );
  const [priceState, priceAction, pricePending] = useActionState<BillingMutationState, FormData>(
    setPriceAction,
    { status: "idle" },
  );
  const [statementState, statementAction, statementPending] = useActionState<BillingMutationState, FormData>(
    generateStatementAction,
    { status: "idle" },
  );

  const { company, currentPeriod, statements, history } = overview;

  return (
    <section aria-label="Facturation de l'entreprise" className="mt-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Facturation</h2>
        <span
          className={
            company.billingEnabled
              ? "rounded-full border border-success/30 bg-success-soft px-3 py-1 text-xs font-medium text-success"
              : "rounded-full border border-warning/30 bg-warning-soft px-3 py-1 text-xs font-medium text-warning"
          }
        >
          {company.billingEnabled
            ? `Facturation ON · ${company.pricePerDelivery.toLocaleString("fr-FR")} F CFA / livraison`
            : "Facturation OFF (période gratuite : 0 F)"}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-3 p-4 text-sm">
          <p className="font-medium">Bouton Facturation ON / OFF</p>
          <p className="text-xs text-ink-muted">
            En mode OFF, les livraisons livrées restent comptabilisées mais figées à 0 F CFA. Chaque changement est historisé.
          </p>
          <form action={toggleAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <input type="hidden" name="billingEnabled" value={String(!company.billingEnabled)} />
            <button
              type="submit"
              disabled={togglePending}
              className={company.billingEnabled ? "btn-secondary" : "btn-primary h-9 px-4 text-sm"}
            >
              {togglePending
                ? "Modification…"
                : company.billingEnabled
                  ? "Passer en période gratuite (OFF)"
                  : "Activer la facturation (ON)"}
            </button>
          </form>
          {toggleState.status === "error" && (
            <p role="alert" className="alert-error text-xs">
              {toggleState.message}
            </p>
          )}
          {toggleState.status === "done" && (
            <p role="status" className="text-xs text-success">
              {toggleState.message}
            </p>
          )}
        </div>

        <div className="card space-y-3 p-4 text-sm">
          <p className="font-medium">Prix par livraison (F CFA)</p>
          <p className="text-xs text-ink-muted">
            Le tarif est figé à la livraison : modifier ce prix ne change jamais les livraisons passées.
          </p>
          <form
            key={company.pricePerDelivery}
            action={priceAction}
            className="flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="companyId" value={company.id} />
            <input
              name="pricePerDelivery"
              type="number"
              min={0}
              max={100000}
              step={1}
              required
              defaultValue={company.pricePerDelivery}
              aria-label="Prix par livraison en F CFA"
              className="input h-9 w-36 text-sm"
            />
            <button type="submit" disabled={pricePending} className="btn-secondary">
              {pricePending ? "Enregistrement…" : "Enregistrer le prix"}
            </button>
          </form>
          {priceState.status === "error" && (
            <p role="alert" className="alert-error text-xs">
              {priceState.message}
            </p>
          )}
          {priceState.status === "done" && (
            <p role="status" className="text-xs text-success">
              {priceState.message}
            </p>
          )}
        </div>
      </div>

      <div className="card space-y-3 p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium capitalize">
              Mois en cours : {formatBillingPeriod(currentPeriod.period)}
            </p>
            <p className="text-xs text-ink-muted tabular-nums">
              {currentPeriod.deliveredCount} livrée(s) (dont {currentPeriod.forcedCount} forcée(s) et{" "}
              {currentPeriod.freeCount} gratuite(s) à 0 F) — Total :{" "}
              <strong className="text-ink">
                {currentPeriod.totalAmount.toLocaleString("fr-FR")} F CFA
              </strong>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={statementAction}>
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="period" value={currentPeriod.period} />
              <input type="hidden" name="issue" value="false" />
              <button type="submit" disabled={statementPending} className="btn-secondary">
                {statementPending ? "Calcul…" : "Calculer le relevé"}
              </button>
            </form>
            <form action={statementAction}>
              <input type="hidden" name="companyId" value={company.id} />
              <input type="hidden" name="period" value={currentPeriod.period} />
              <input type="hidden" name="issue" value="true" />
              <button type="submit" disabled={statementPending} className="btn-primary h-9 px-3 text-xs">
                {statementPending ? "Émission…" : "Émettre le relevé"}
              </button>
            </form>
          </div>
        </div>
        {statementState.status === "error" && (
          <p role="alert" className="alert-error text-xs">
            {statementState.message}
          </p>
        )}
        {statementState.status === "done" && (
          <p role="status" className="text-xs text-success">
            {statementState.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Relevés mensuels ({statements.length})</h3>
        {statements.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-xs text-ink-muted">
            Aucun relevé généré pour cette entreprise.
          </p>
        ) : (
          <ul className="card divide-y divide-line text-sm">
            {statements.map((st) => (
              <li key={st.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium capitalize">{formatBillingPeriod(st.period)}</span>
                    <span
                      className={
                        st.status === "PAID"
                          ? "rounded-full border border-success/30 bg-success-soft px-2 py-0.5 text-xs font-medium text-success"
                          : "rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink-muted"
                      }
                    >
                      {STATEMENT_STATUS_LABEL[st.status]}
                    </span>
                  </div>
                  <p className="text-xs tabular-nums text-ink-muted">
                    {st.deliveredCount} livrée(s) (dont {st.freeCount} gratuite(s)) ·{" "}
                    <strong className="text-ink">{st.totalAmount.toLocaleString("fr-FR")} F CFA</strong>
                    {st.paidAt ? ` · Payé le ${formatDateTime(st.paidAt)}` : ""}
                  </p>
                </div>
                {st.status !== "PAID" && <MarkPaidButton statementId={st.id} />}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Historique des réglages ({history.length})</h3>
        {history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-xs text-ink-muted">
            Aucune modification tarifaire enregistrée.
          </p>
        ) : (
          <ul className="card divide-y divide-line text-xs">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span>
                  <span className="font-medium">{BILLING_SETTING_LABEL[h.setting]} :</span>{" "}
                  {formatBillingSettingValue(h.setting, h.oldValue)} →{" "}
                  <strong>{formatBillingSettingValue(h.setting, h.newValue)}</strong>
                </span>
                <span className="tabular-nums text-ink-muted">
                  Par {h.changedByAdminName} · {formatDateTime(h.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
