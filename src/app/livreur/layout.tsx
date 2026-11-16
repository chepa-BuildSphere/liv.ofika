import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { PwaStatus } from "./pwa-status";

export const viewport: Viewport = {
  themeColor: "#C2410C",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "Espace livreur — Ofika Delivery",
  appleWebApp: {
    capable: true,
    title: "Ofika Livreur",
    statusBarStyle: "default",
  },
};

export default function CourierLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col bg-[#FBFBFA] text-[#111111]">
      {/* Header compact et fixe en haut pour la PWA */}
      <header className="sticky top-0 z-30 border-b border-[#EAEAEA] bg-white/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2">
          <Link href="/courier" className="flex items-center gap-2 transition-opacity hover:opacity-85">
            <Wordmark className="text-sm sm:text-base" />
            <span className="rounded-md border border-[#EAEAEA] bg-[#F7F6F3] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#C2410C]">
              Livreur
            </span>
          </Link>
          <PwaStatus />
        </div>
      </header>

      {/* Conteneur principal fluide et ergonomique au pouce */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
