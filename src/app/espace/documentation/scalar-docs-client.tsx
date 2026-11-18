"use client";

import { useState, type ReactNode } from "react";

export function ScalarDocsClient({
  guideContent,
}: {
  guideContent: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"scalar" | "guide">("scalar");

  return (
    <div className="space-y-4">
      {/* Barre d'onglets Scalar / Guide 15 min */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EAEAEA] bg-white p-2 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("scalar")}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "scalar"
                ? "bg-[#111111] text-white shadow-xs"
                : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-[#C2410C]" />
            <span>Référence API Interactive (Scalar)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "guide"
                ? "bg-[#111111] text-white shadow-xs"
                : "text-[#555] hover:bg-[#F7F6F3] hover:text-[#111111]"
            }`}
          >
            <span>Guide 15 min &amp; Webhooks HMAC</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
          <a
            href="/api/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-[#FBFBFA] px-3 font-mono text-[11px] font-semibold text-[#111111] hover:border-[#111111] transition-colors"
          >
            <span>OpenAPI 3.1 JSON</span>
          </a>
          <a
            href="/api/reference"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#C2410C] px-3 text-[11px] font-bold text-white shadow-xs hover:bg-[#9A3412] transition-colors"
          >
            <span>Ouvrir Scalar en plein écran ↗</span>
          </a>
        </div>
      </div>

      {activeTab === "scalar" ? (
        <div className="overflow-hidden rounded-xl border border-[#EAEAEA] bg-white shadow-sm">
          <iframe
            src="/api/reference"
            title="Documentation API Interactive Scalar — Ofika Delivery"
            className="h-[800px] w-full border-0"
          />
        </div>
      ) : (
        guideContent
      )}
    </div>
  );
}
