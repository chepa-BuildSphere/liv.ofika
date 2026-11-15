import type { ReactNode } from "react";
import { Wordmark } from "@/components/wordmark";

// Espace livreur (PWA) : pensé d'abord pour un téléphone Android dans Chrome.
export default function CourierLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-line px-4 py-3">
        <Wordmark />
        <span className="ml-2 text-xs font-medium uppercase tracking-wide text-ink-muted">Livreur</span>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
