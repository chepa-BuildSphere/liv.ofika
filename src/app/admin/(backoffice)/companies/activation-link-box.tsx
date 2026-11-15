"use client";

import { useState } from "react";

// Affiche un lien d'activation une seule fois, avec copie et envoi WhatsApp.
export function ActivationLinkBox({
  url,
  expiresAt,
  recipientName,
  recipientPhone,
}: {
  url: string;
  expiresAt: string;
  recipientName: string;
  recipientPhone?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const message = `Bonjour ${recipientName}, voici votre lien pour activer votre compte Ofika Delivery et choisir votre mot de passe (valable 48 h, utilisable une seule fois) : ${url}`;
  const waNumber = recipientPhone?.replace(/[^0-9]/g, "");
  const waHref = `https://wa.me/${waNumber ?? ""}?text=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-success/30 bg-success-soft p-4">
      <p className="text-sm font-medium text-success">Lien d&apos;activation pour {recipientName}</p>
      <p className="mt-1 text-xs text-success">
        Valable jusqu&apos;au {new Date(expiresAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}, une
        seule fois. Il ne sera plus affiché : envoyez-le maintenant.
      </p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Lien d'activation"
        className="mt-3 h-10 w-full rounded-md border border-success/30 bg-paper px-3 font-mono text-xs"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copy}
          className="btn-primary"
        >
          {copied ? "Copié ✓" : "Copier le lien"}
        </button>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary"
        >
          Envoyer par WhatsApp
        </a>
      </div>
    </div>
  );
}
