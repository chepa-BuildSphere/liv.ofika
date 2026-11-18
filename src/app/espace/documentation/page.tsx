import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  API_ERROR_CODES,
  QUICKSTART_15_MINUTES,
  V1_ENDPOINTS_DOCS,
  WEBHOOK_PAYLOAD_EXAMPLE,
  WEBHOOK_VERIFY_NODE_SNIPPET,
} from "@/lib/api-keys/developer-docs";
import { requireUser } from "@/lib/auth/user-session";
import { WEBHOOK_EVENT_LABELS, WEBHOOK_EVENT_TYPES } from "@/lib/webhooks/webhook-types";
import { ChevronRightIcon, KeyIcon } from "@/components/icons";
import { ScalarDocsClient } from "./scalar-docs-client";

export const metadata: Metadata = { title: "Documentation API Scalar — Ofika Delivery" };

export default function DocumentationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-ink-muted">Chargement de la documentation Scalar…</p>}>
      <DocumentationContent />
    </Suspense>
  );
}

async function DocumentationContent() {
  await requireUser();

  const guideContent = (
    <div className="space-y-8">
      <section aria-label="Brancher mon site en 15 minutes" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Brancher mon site en 15 minutes</h2>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link href="/espace/cles-api" className="link">
              Gérer mes clés API →
            </Link>
            <Link href="/espace/webhooks" className="link">
              Configurer mes webhooks →
            </Link>
          </div>
        </div>

        <ol className="grid gap-4 md:grid-cols-2">
          {QUICKSTART_15_MINUTES.map((item) => (
            <li key={item.step} className="card space-y-2 p-4 text-sm">
              <p className="font-semibold">
                <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-strong text-xs font-bold text-white">
                  {item.step}
                </span>
                {item.title}
              </p>
              <p className="text-xs text-ink-muted">{item.description}</p>
              <pre className="overflow-x-auto rounded border border-line bg-surface p-3 font-mono text-xs">
                {item.code}
              </pre>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Authentification et mode test" className="card space-y-3 p-5 text-sm">
        <h2 className="text-lg font-semibold">Authentification &amp; Mode test</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-xs text-ink-muted">
          <li>
            Passez votre clé API dans l&apos;en-tête HTTP{" "}
            <code className="font-mono text-ink">Authorization: Bearer &lt;clé&gt;</code>.
          </li>
          <li>
            Une clé <code className="font-mono text-ink">ofk_test_…</code> crée uniquement des livraisons en mode{" "}
            <strong>Test</strong> (<code className="font-mono">is_test: true</code>,{" "}
            <code className="font-mono">livemode: false</code>) : jamais facturées, jamais envoyées aux livreurs et isolées des livraisons réelles.
          </li>
          <li>
            En-tête <code className="font-mono text-ink">Idempotency-Key</code> supporté sur tous les{" "}
            <code className="font-mono">POST</code> pour éviter de créer deux fois la même livraison.
          </li>
        </ul>
      </section>

      <section aria-label="Endpoints de l'API v1" className="space-y-4">
        <h2 className="text-lg font-semibold">Endpoints REST (/v1)</h2>
        <ul className="card divide-y divide-line text-sm">
          {V1_ENDPOINTS_DOCS.map((ep) => (
            <li key={`${ep.method}:${ep.path}`} className="space-y-2 px-4 py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-surface px-2 py-0.5 font-mono text-xs font-semibold text-brand-strong">
                  {ep.method}
                </span>
                <code className="font-mono text-xs font-semibold">{ep.path}</code>
                {ep.testOnly && (
                  <span className="rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
                    Clé test uniquement
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-muted">{ep.description}</p>
              <pre className="overflow-x-auto rounded border border-line bg-surface p-2.5 font-mono text-xs">
                {ep.example}
              </pre>
            </li>
          ))}
        </ul>
      </section>

      <section id="webhooks" aria-label="Webhooks et signature HMAC" className="space-y-4">
        <h2 className="text-lg font-semibold">Webhooks &amp; Vérification de signature</h2>
        <div className="card space-y-4 p-5 text-sm">
          <div>
            <h3 className="font-semibold">Événements émis</h3>
            <div className="mt-2 grid gap-1.5 text-xs sm:grid-cols-2">
              {WEBHOOK_EVENT_TYPES.map((ev) => (
                <div key={ev} className="rounded border border-line bg-surface px-2.5 py-1.5">
                  {WEBHOOK_EVENT_LABELS[ev]}
                </div>
              ))}
              <div className="rounded border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-warning">
                Test manuel (<code className="font-mono">webhook.test</code>)
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold">Exemple de contenu envoyé</h3>
            <pre className="mt-2 overflow-x-auto rounded border border-line bg-surface p-3 font-mono text-xs">
              {WEBHOOK_PAYLOAD_EXAMPLE}
            </pre>
          </div>

          <div>
            <h3 className="font-semibold">
              Vérifier l&apos;en-tête <code className="font-mono text-xs">X-Ofika-Signature</code> (Node.js / TypeScript)
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              Signé avec HMAC-SHA256 sur <code className="font-mono">{`\${t}.\${rawBody}`}</code>. En cas d&apos;échec ou hors 2xx, Ofika réessaie automatiquement avec délai croissant (1 min, 5 min, 30 min, 2 h).
            </p>
            <pre className="mt-2 overflow-x-auto rounded border border-line bg-surface p-3 font-mono text-xs">
              {WEBHOOK_VERIFY_NODE_SNIPPET}
            </pre>
          </div>
        </div>
      </section>

      <section aria-label="Codes d'erreur API" className="space-y-3">
        <h2 className="text-lg font-semibold">Codes d&apos;erreur</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-surface font-medium uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">HTTP</th>
                <th className="px-4 py-2.5">Code(s)</th>
                <th className="px-4 py-2.5">Signification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {API_ERROR_CODES.map((err) => (
                <tr key={err.code}>
                  <td className="px-4 py-2.5 font-mono font-semibold tabular-nums">{err.httpStatus}</td>
                  <td className="px-4 py-2.5 font-mono">{err.code}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{err.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Fil d'ariane */}
      <nav aria-label="Fil d'ariane" className="flex items-center gap-2 text-xs text-[#787774]">
        <Link href="/dashboard" className="hover:text-[#111111] transition-colors">
          Tableau de bord
        </Link>
        <ChevronRightIcon className="h-3.5 w-3.5" />
        <span className="font-semibold text-[#111111]">Documentation API (Scalar)</span>
      </nav>

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EAEAEA] pb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#111111] text-white">
            <KeyIcon className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#111111]">
                Documentation API — Scalar OpenAPI 3.1
              </h1>
              <span className="rounded-full border border-[#C2410C]/20 bg-[#FFF7ED] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#C2410C]">
                v1.0
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[#787774]">
              Explorez et testez en direct les 11 endpoints REST `/v1/*` et les webhooks signés d&apos;Ofika Delivery avec Scalar.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Link
            href="/espace/cles-api"
            className="inline-flex h-9 items-center rounded-lg border border-[#EAEAEA] bg-white px-3 font-semibold text-[#111111] hover:border-[#111111] transition-colors"
          >
            Mes clés API
          </Link>
          <Link
            href="/espace/webhooks"
            className="inline-flex h-9 items-center rounded-lg border border-[#EAEAEA] bg-white px-3 font-semibold text-[#111111] hover:border-[#111111] transition-colors"
          >
            Mes webhooks
          </Link>
        </div>
      </div>

      <ScalarDocsClient guideContent={guideContent} />
    </div>
  );
}
