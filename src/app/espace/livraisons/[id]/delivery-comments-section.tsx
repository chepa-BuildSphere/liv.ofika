"use client";

import { useActionState } from "react";
import { addDeliveryCommentAction } from "./mvp1-actions";

type CommentItem = {
  id: string;
  authorType: string;
  authorName: string;
  message: string;
  createdAt: Date;
};

export function DeliveryCommentsSection({
  deliveryId,
  comments,
}: {
  deliveryId: string;
  comments: CommentItem[];
}) {
  return (
    <section aria-label="Fil de discussion" className="card space-y-4 p-5 text-sm">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <h2 className="font-semibold">Fil de discussion entreprise ↔ livreur</h2>
        <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-ink-muted">
          {comments.length} message{comments.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-xs text-ink-muted italic">
            Aucun commentaire échangé pour cette livraison.
          </p>
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li
                key={c.id}
                className={`rounded-lg border p-3 ${
                  c.authorType === "COURIER"
                    ? "border-accent/20 bg-accent-soft/30 text-ink"
                    : "border-line bg-surface text-ink"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-accent-strong">
                    {c.authorName} ({c.authorType === "COURIER" ? "Livreur" : "Entreprise"})
                  </span>
                  <time className="text-ink-muted">
                    {new Date(c.createdAt).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.message}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action={addDeliveryCommentAction} className="mt-4 space-y-2">
        <input type="hidden" name="deliveryId" value={deliveryId} />
        <div>
          <label htmlFor="message" className="sr-only">
            Ajouter un commentaire
          </label>
          <textarea
            id="message"
            name="message"
            rows={2}
            required
            maxLength={1000}
            placeholder="Écrire une instruction ou une précision..."
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-secondary text-xs">
            Envoyer le message
          </button>
        </div>
      </form>
    </section>
  );
}
