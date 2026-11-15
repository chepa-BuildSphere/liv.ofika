"use client";

import type { AccessCodeView } from "./actions";

// Affiche le code d'accès du livreur UNE seule fois (seule son empreinte est en base).
export function AccessCodeBox({ access, appUrl }: { access: AccessCodeView; appUrl: string }) {
  const spaced = `${access.code.slice(0, 3)} ${access.code.slice(3)}`;
  const until = new Date(access.expiresAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Abidjan" });
  const url = `${appUrl}/livreur/premier-acces`;
  const message =
    `Bonjour ${access.courierName}, votre code d'accès Ofika Delivery est ${spaced} (valable 48 h, une seule fois). ` +
    `Ouvrez ${url} sur votre téléphone, saisissez votre numéro, ce code, puis choisissez votre code PIN à 6 chiffres.`;
  const wa = `https://wa.me/${access.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;

  return (
    <div className="rounded-lg border border-brand/30 bg-brand-soft p-4">
      <p className="text-sm font-medium">Code d&apos;accès de {access.courierName}</p>
      <p className="mt-2 font-mono text-3xl font-semibold tracking-widest tabular-nums" aria-label={`Code ${access.code.split("").join(" ")}`}>
        {spaced}
      </p>
      <p className="mt-2 text-xs text-ink-muted">
        Valable jusqu&apos;au {until}, une seule fois. Il ne sera plus affiché : donnez-le au livreur maintenant. Il
        l&apos;utilise sur la page <strong>{url}</strong> pour choisir son code PIN.
      </p>
      <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-3">
        Envoyer par WhatsApp
      </a>
    </div>
  );
}
