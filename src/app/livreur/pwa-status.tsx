"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangleIcon } from "@/components/icons";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

function getOnlineSnapshot() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getOnlineServerSnapshot() {
  return true;
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot,
  );
}

export function PwaStatus() {
  const isOnline = useIsOnline();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Pastille de connectivité */}
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
          isOnline
            ? "border-[#15803D]/20 bg-[#F0FDF4] text-[#15803D]"
            : "border-[#B45309]/30 bg-[#FFFBEB] text-[#B45309]"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            isOnline ? "bg-[#15803D] animate-pulse" : "bg-[#B45309]"
          }`}
        />
        <span>{isOnline ? "En ligne" : "Hors ligne"}</span>
      </div>

      {/* Bouton d'installation PWA */}
      {installPrompt && (
        <button
          type="button"
          onClick={handleInstall}
          className="inline-flex h-7 items-center gap-1.5 rounded-[6px] border border-[#111111] bg-[#111111] px-2.5 text-[11px] font-medium text-white transition-colors hover:bg-[#333333] active:scale-95"
        >
          <span>Installer</span>
        </button>
      )}

      {/* Alerte flottante hors ligne */}
      {!isOnline && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center gap-2.5 rounded-[10px] border border-[#B45309]/30 bg-[#FFFBEB] p-3 text-xs font-medium text-[#B45309] shadow-lg"
        >
          <AlertTriangleIcon className="h-4 w-4 shrink-0 text-[#B45309]" />
          <span>Hors ligne — reconnexion requise pour valider un colis ou générer un QR code.</span>
        </div>
      )}
    </div>
  );
}
