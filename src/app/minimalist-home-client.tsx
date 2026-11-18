"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export function RevealOnScroll({
  children,
  index = 0,
  className = "",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () => typeof window !== "undefined" && typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible={visible ? "true" : "false"}
      style={{ "--index": index } as CSSProperties}
      className={`minimal-reveal ${className}`}
    >
      {children}
    </div>
  );
}

type FaqItem = {
  question: string;
  answer: string;
};

function buildFaqItems(pricePerDelivery: number): readonly FaqItem[] {
  const formattedPrice = pricePerDelivery.toLocaleString("fr-FR");
  return [
    {
      question: "Combien coûte le service Ofika Delivery pour un commerçant ?",
      answer:
        `C'est seulement ${formattedPrice} F CFA par livraison livrée avec succès au client. Il n'y a aucun abonnement mensuel, aucun frais caché et aucun engagement. Si le client est absent, refuse le colis ou que le paquet revient au magasin, vous payez 0 F CFA (gratuit).`,
    },
    {
      question: "Comment ça protège le livreur sur sa moto à Abidjan ?",
      answer:
        "Le livreur est protégé à 100% contre les fausses accusations. Pour valider une remise, le client doit scanner le QR code et lui donner un code secret à 4 chiffres. Si le livreur a ce code et le point GPS, c'est la preuve indiscutable qu'il a bien remis le colis en main propre. Le commerçant ne peut plus douter de lui ni retenir son salaire.",
    },
    {
      question: "Si le client refuse le colis ou n'a pas l'argent, comment se passe le retour ?",
      answer:
        "Le livreur signale l'échec sur son téléphone (ex: client injoignable, argent insuffisant). Le colis passe en statut « Retour au dépôt ». En fin de journée au magasin, le gérant scanne le QR code du colis retourné. En 5 secondes, le livreur est libéré de sa responsabilité, les comptes sont nets et la marchandise réintègre le stock sans dispute.",
    },
    {
      question: "Est-ce que le livreur doit télécharger une grosse application ?",
      answer:
        "Non, absolument rien à installer depuis le Play Store ! Beaucoup de livreurs n'ont pas assez de mémoire sur leur smartphone (Tecno, Infinix, Samsung...) ou n'ont pas envie de gaspiller leurs gigas. Ofika fonctionne directement dans Google Chrome avec leur numéro et leur code PIN secret à 6 chiffres. C'est rapide, très léger et ça tourne même avec une petite connexion.",
    },
    {
      question: "Comment créer un compte pour mon commerce ou ma boutique en ligne ?",
      answer:
        "Cliquez sur « Créer mon compte entreprise ». En 2 minutes chrono, vous renseignez le nom de votre boutique et votre e-mail. Vous êtes immédiatement administrateur de votre compte : vous pouvez ajouter vos livreurs, entrer vos commandes ou importer un fichier Excel, sans carte bancaire requise.",
    },
    {
      question: "Puis-je travailler avec mes propres motards ou des coursiers indépendants ?",
      answer:
        "Les deux ! Vous pouvez ajouter vos livreurs internes salariés ou faire appel à des coursiers indépendants qui livrent pour plusieurs boutiques. Chaque commerçant ne voit que ses propres colis en toute confidentialité.",
    },
  ];
}

export function MinimalFaqAccordion({ pricePerDelivery = 10 }: { pricePerDelivery?: number }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const faqItems = buildFaqItems(pricePerDelivery);

  return (
    <div className="divide-y divide-[#EAEAEA] border-t border-b border-[#EAEAEA]">
      {faqItems.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div key={item.question}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left transition-colors hover:text-[#111111]"
            >
              <span className="text-[15px] font-semibold leading-[1.4] text-[#111111]">
                {item.question}
              </span>
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#EAEAEA] font-mono text-sm font-bold text-[#111111]"
              >
                {isOpen ? "−" : "+"}
              </span>
            </button>
            {isOpen && (
              <p className="pb-6 pr-8 text-[14px] leading-[1.6] text-[#787774]">
                {item.answer}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

const CODE_SNIPPETS = {
  curl: {
    id: "curl",
    label: "cURL",
    filename: "terminal · bash",
    rawCode: `curl -X POST https://ofika.ci/v1/deliveries \\
  -H "Authorization: Bearer ofk_test_51Nx8...42" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: cart-2026-0842" \\
  -d '{
    "recipient_name": "Aïcha Koné",
    "recipient_phone": "+2250708091011",
    "delivery_address": "Cocody Angré 8e Tranche, Abidjan",
    "package_description": "Colis Mode & Beauté #CMD-0842"
  }'`,
    highlighted: (
      <>
        <span className="text-[#F97316] font-bold">curl</span>{" "}
        <span className="text-[#60A5FA]">-X POST</span>{" "}
        <span className="text-[#34D399]">https://ofika.ci/v1/deliveries</span>{" "}
        <span className="text-zinc-500">\</span>
        {"\n"}  <span className="text-[#60A5FA]">-H</span>{" "}
        <span className="text-[#34D399]">&quot;Authorization: Bearer ofk_test_51Nx8...42&quot;</span>{" "}
        <span className="text-zinc-500">\</span>
        {"\n"}  <span className="text-[#60A5FA]">-H</span>{" "}
        <span className="text-[#34D399]">&quot;Content-Type: application/json&quot;</span>{" "}
        <span className="text-zinc-500">\</span>
        {"\n"}  <span className="text-[#60A5FA]">-H</span>{" "}
        <span className="text-[#34D399]">&quot;Idempotency-Key: cart-2026-0842&quot;</span>{" "}
        <span className="text-zinc-500">\</span>
        {"\n"}  <span className="text-[#60A5FA]">-d</span>{" "}
        <span className="text-[#E4E4E7]">&#39;&#123;</span>
        {"\n"}    <span className="text-[#93C5FD]">&quot;recipient_name&quot;</span>:{" "}
        <span className="text-[#34D399]">&quot;Aïcha Koné&quot;</span>,
        {"\n"}    <span className="text-[#93C5FD]">&quot;recipient_phone&quot;</span>:{" "}
        <span className="text-[#34D399]">&quot;+2250708091011&quot;</span>,
        {"\n"}    <span className="text-[#93C5FD]">&quot;delivery_address&quot;</span>:{" "}
        <span className="text-[#34D399]">&quot;Cocody Angré 8e Tranche, Abidjan&quot;</span>,
        {"\n"}    <span className="text-[#93C5FD]">&quot;package_description&quot;</span>:{" "}
        <span className="text-[#34D399]">&quot;Colis Mode &amp; Beauté #CMD-0842&quot;</span>
        {"\n"}  <span className="text-[#E4E4E7]">&#125;&#39;</span>
      </>
    ),
  },
  typescript: {
    id: "typescript",
    label: "TypeScript / Next.js",
    filename: "ofika-delivery.ts",
    rawCode: `// Intégration directe dans votre boutique Next.js, Remix ou backend Node
export async function createDelivery(order: CustomerOrder) {
  const res = await fetch("https://ofika.ci/v1/deliveries", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.OFIKA_API_KEY}\`,
      "Content-Type": "application/json",
      "Idempotency-Key": \`order_\${order.id}\`,
    },
    body: JSON.stringify({
      recipient_name: order.customer.name,
      recipient_phone: order.customer.phone,
      delivery_address: order.shippingAddress,
      package_description: \`Commande \${order.reference}\`,
    }),
  });

  if (!res.ok) throw new Error("Échec création livraison");
  return await res.json(); // { id, status, tracking_code, qr_reference }
}`,
    highlighted: (
      <>
        <span className="text-zinc-500">// Intégration directe dans votre boutique Next.js, Remix ou backend Node</span>
        {"\n"}<span className="text-[#F97316] font-bold">export async function</span>{" "}
        <span className="text-[#60A5FA]">createDelivery</span>
        <span className="text-zinc-300">(order: CustomerOrder) &#123;</span>
        {"\n"}  <span className="text-[#F97316] font-bold">const</span> res ={" "}
        <span className="text-[#F97316] font-bold">await</span>{" "}
        <span className="text-[#60A5FA]">fetch</span>
        <span className="text-zinc-300">(</span>
        <span className="text-[#34D399]">&quot;https://ofika.ci/v1/deliveries&quot;</span>
        <span className="text-zinc-300">, &#123;</span>
        {"\n"}    method: <span className="text-[#34D399]">&quot;POST&quot;</span>,
        {"\n"}    headers: &#123;
        {"\n"}      Authorization: <span className="text-[#34D399]">&grave;Bearer $&#123;process.env.OFIKA_API_KEY&#125;&grave;</span>,
        {"\n"}      <span className="text-[#34D399]">&quot;Content-Type&quot;</span>: <span className="text-[#34D399]">&quot;application/json&quot;</span>,
        {"\n"}      <span className="text-[#34D399]">&quot;Idempotency-Key&quot;</span>: <span className="text-[#34D399]">&grave;order_$&#123;order.id&#125;&grave;</span>,
        {"\n"}    &#125;,
        {"\n"}    body: <span className="text-[#60A5FA]">JSON.stringify</span>(&#123;
        {"\n"}      recipient_name: order.customer.name,
        {"\n"}      recipient_phone: order.customer.phone,
        {"\n"}      delivery_address: order.shippingAddress,
        {"\n"}      package_description: <span className="text-[#34D399]">&grave;Commande $&#123;order.reference&#125;&grave;</span>,
        {"\n"}    &#125;),
        {"\n"}  &#125;);
        {"\n"}
        {"\n"}  <span className="text-[#F97316] font-bold">if</span> (!res.ok){" "}
        <span className="text-[#F97316] font-bold">throw new</span>{" "}
        <span className="text-[#60A5FA]">Error</span>
        (<span className="text-[#34D399]">&quot;Échec création livraison&quot;</span>);
        {"\n"}  <span className="text-[#F97316] font-bold">return await</span> res.
        <span className="text-[#60A5FA]">json</span>();{" "}
        <span className="text-zinc-500">// &#123; id, status, tracking_code, qr_reference &#125;</span>
        {"\n"}<span className="text-zinc-300">&#125;</span>
      </>
    ),
  },
  python: {
    id: "python",
    label: "Python",
    filename: "client.py",
    rawCode: `import os, requests

# Intégration dans votre backend Django, FastAPI ou Flask
def dispatch_ofika_delivery(order_id, recipient, phone, address, items):
    url = "https://ofika.ci/v1/deliveries"
    headers = {
        "Authorization": f"Bearer {os.getenv('OFIKA_API_KEY')}",
        "Idempotency-Key": f"django_order_{order_id}",
    }
    payload = {
        "recipient_name": recipient,
        "recipient_phone": phone,
        "delivery_address": address,
        "package_description": f"Colis #{order_id} - {items}",
    }
    response = requests.post(url, json=payload, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()`,
    highlighted: (
      <>
        <span className="text-[#F97316] font-bold">import</span> os, requests
        {"\n"}
        {"\n"}<span className="text-zinc-500"># Intégration dans votre backend Django, FastAPI ou Flask</span>
        {"\n"}<span className="text-[#F97316] font-bold">def</span>{" "}
        <span className="text-[#60A5FA]">dispatch_ofika_delivery</span>(order_id, recipient, phone, address, items):
        {"\n"}    url = <span className="text-[#34D399]">&quot;https://ofika.ci/v1/deliveries&quot;</span>
        {"\n"}    headers = &#123;
        {"\n"}        <span className="text-[#34D399]">&quot;Authorization&quot;</span>: <span className="text-[#34D399]">f&quot;Bearer &#123;os.getenv(&#39;OFIKA_API_KEY&#39;)&#125;&quot;</span>,
        {"\n"}        <span className="text-[#34D399]">&quot;Idempotency-Key&quot;</span>: <span className="text-[#34D399]">f&quot;django_order_&#123;order_id&#125;&quot;</span>,
        {"\n"}    &#125;
        {"\n"}    payload = &#123;
        {"\n"}        <span className="text-[#34D399]">&quot;recipient_name&quot;</span>: recipient,
        {"\n"}        <span className="text-[#34D399]">&quot;recipient_phone&quot;</span>: phone,
        {"\n"}        <span className="text-[#34D399]">&quot;delivery_address&quot;</span>: address,
        {"\n"}        <span className="text-[#34D399]">&quot;package_description&quot;</span>: <span className="text-[#34D399]">f&quot;Colis #&#123;order_id&#125; - &#123;items&#125;&quot;</span>,
        {"\n"}    &#125;
        {"\n"}    response = requests.<span className="text-[#60A5FA]">post</span>(url, json=payload, headers=headers, timeout=10)
        {"\n"}    response.<span className="text-[#60A5FA]">raise_for_status</span>()
        {"\n"}    <span className="text-[#F97316] font-bold">return</span> response.<span className="text-[#60A5FA]">json</span>()
      </>
    ),
  },
  webhooks: {
    id: "webhooks",
    label: "Webhooks Signés",
    filename: "webhook-handler.ts",
    rawCode: `// Réception instantanée des étapes (Arrivé, QR scanné, Livré)
import { createHmac, timingSafeEqual } from "crypto";

export async function POST(req: Request) {
  const signature = req.headers.get("x-ofika-signature");
  const payload = await req.text();

  // Signature HMAC-SHA256 officielle Ofika Delivery
  const [tPart, vPart] = (signature || "").split(",");
  const timestamp = (tPart || "").split("=")[1];
  const hash = (vPart || "").split("=")[1];

  const expected = createHmac("sha256", process.env.OFIKA_WEBHOOK_SECRET!)
    .update(\`\${timestamp}.\${payload}\`)
    .digest("hex");

  if (!hash || !timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) {
    return new Response("Signature invalide", { status: 401 });
  }

  const { event, data } = JSON.parse(payload);
  if (event === "delivery.delivered") {
    // Colis certifié remis en main propre par le livreur !
    await markOrderAsFulfilled(data.delivery_id);
  }
  return new Response("OK");
}`,
    highlighted: (
      <>
        <span className="text-zinc-500">// Réception instantanée des étapes (Arrivé, QR scanné, Livré)</span>
        {"\n"}<span className="text-[#F97316] font-bold">import</span> &#123; createHmac, timingSafeEqual &#125;{" "}
        <span className="text-[#F97316] font-bold">from</span>{" "}
        <span className="text-[#34D399]">&quot;crypto&quot;</span>;
        {"\n"}
        {"\n"}<span className="text-[#F97316] font-bold">export async function</span>{" "}
        <span className="text-[#60A5FA]">POST</span>(req: Request) &#123;
        {"\n"}  <span className="text-[#F97316] font-bold">const</span> signature = req.headers.<span className="text-[#60A5FA]">get</span>(<span className="text-[#34D399]">&quot;x-ofika-signature&quot;</span>);
        {"\n"}  <span className="text-[#F97316] font-bold">const</span> payload = <span className="text-[#F97316] font-bold">await</span> req.<span className="text-[#60A5FA]">text</span>();
        {"\n"}
        {"\n"}  <span className="text-zinc-500">// Signature HMAC-SHA256 officielle Ofika Delivery</span>
        {"\n"}  <span className="text-[#F97316] font-bold">const</span> [tPart, vPart] = (signature || <span className="text-[#34D399]">&quot;&quot;</span>).<span className="text-[#60A5FA]">split</span>(<span className="text-[#34D399]">&quot;,&quot;</span>);
        {"\n"}  <span className="text-[#F97316] font-bold">const</span> timestamp = (tPart || <span className="text-[#34D399]">&quot;&quot;</span>).<span className="text-[#60A5FA]">split</span>(<span className="text-[#34D399]">&quot;=&quot;</span>)[1];
        {"\n"}  <span className="text-[#F97316] font-bold">const</span> hash = (vPart || <span className="text-[#34D399]">&quot;&quot;</span>).<span className="text-[#60A5FA]">split</span>(<span className="text-[#34D399]">&quot;=&quot;</span>)[1];
        {"\n"}
        {"\n"}  <span className="text-[#F97316] font-bold">const</span> expected = <span className="text-[#60A5FA]">createHmac</span>(<span className="text-[#34D399]">&quot;sha256&quot;</span>, process.env.OFIKA_WEBHOOK_SECRET!)
        {"\n"}    .<span className="text-[#60A5FA]">update</span>(<span className="text-[#34D399]">&grave;$&#123;timestamp&#125;.$&#123;payload&#125;&grave;</span>)
        {"\n"}    .<span className="text-[#60A5FA]">digest</span>(<span className="text-[#34D399]">&quot;hex&quot;</span>);
        {"\n"}
        {"\n"}  <span className="text-[#F97316] font-bold">if</span> (!hash || !<span className="text-[#60A5FA]">timingSafeEqual</span>(Buffer.from(hash), Buffer.from(expected))) &#123;
        {"\n"}    <span className="text-[#F97316] font-bold">return new</span> <span className="text-[#60A5FA]">Response</span>(<span className="text-[#34D399]">&quot;Signature invalide&quot;</span>, &#123; status: 401 &#125;);
        {"\n"}  &#125;
        {"\n"}
        {"\n"}  <span className="text-[#F97316] font-bold">const</span> &#123; event, data &#125; = <span className="text-[#60A5FA]">JSON.parse</span>(payload);
        {"\n"}  <span className="text-[#F97316] font-bold">if</span> (event === <span className="text-[#34D399]">&quot;delivery.delivered&quot;</span>) &#123;
        {"\n"}    <span className="text-zinc-500">// Colis certifié remis en main propre par le livreur !</span>
        {"\n"}    <span className="text-[#F97316] font-bold">await</span> <span className="text-[#60A5FA]">markOrderAsFulfilled</span>(data.delivery_id);
        {"\n"}  &#125;
        {"\n"}  <span className="text-[#F97316] font-bold">return new</span> <span className="text-[#60A5FA]">Response</span>(<span className="text-[#34D399]">&quot;OK&quot;</span>);
        {"\n"}&#125;
      </>
    ),
  },
} as const;

type SnippetKey = keyof typeof CODE_SNIPPETS;

export function DeveloperCodeShowcase() {
  const [activeTab, setActiveTab] = useState<SnippetKey>("curl");
  const [copied, setCopied] = useState(false);
  const [simStep, setSimStep] = useState<number>(4); // default: full delivery verified
  const [isSimulating, setIsSimulating] = useState(false);

  const snippet = CODE_SNIPPETS[activeTab];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const runSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimStep(1);

    setTimeout(() => setSimStep(2), 700);
    setTimeout(() => setSimStep(3), 1500);
    setTimeout(() => {
      setSimStep(4);
      setIsSimulating(false);
    }, 2300);
  };

  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#0A0B0E]/90 shadow-[0_20px_70px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
      {/* Ligne lumineuse en haut (Linear signature) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#C2410C] to-transparent opacity-80" />

      {/* Barre de commande supérieure / Header IDE */}
      <div className="flex flex-wrap items-center justify-between border-b border-white/[0.08] bg-[#0E1015]/80 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Faux contrôles de fenêtre */}
          <div className="flex items-center gap-1.5 mr-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]/70" />
          </div>

          {/* Onglets langages style Linear */}
          <div className="flex flex-wrap items-center gap-1">
            {(Object.keys(CODE_SNIPPETS) as SnippetKey[]).map((key) => {
              const item = CODE_SNIPPETS[key];
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setActiveTab(key);
                    setCopied(false);
                  }}
                  className={`relative cursor-pointer rounded-full px-3 py-1 font-mono text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.08)]"
                      : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {isActive && (
                    <span className="absolute -bottom-[13px] left-1/2 h-[2px] w-5 -translate-x-1/2 bg-[#C2410C]" />
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contrôles droits */}
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-[11px] text-zinc-500 sm:inline">
            {snippet.filename}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-mono text-[11px] font-semibold text-zinc-200 transition-all hover:bg-white/10 hover:text-white active:scale-95"
            title="Copier le code"
          >
            {copied ? (
              <>
                <span className="text-[#34D399]">✓</span>
                <span className="text-[#34D399]">Copié !</span>
              </>
            ) : (
              <>
                <span>📋</span>
                <span>Copier</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Disposition Split-Screen Studio (Stripe + Linear) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.08]">
        {/* Colonne Gauche : Code Editor avec numéros de lignes (Col 7) */}
        <div className="lg:col-span-7 p-4 sm:p-6 overflow-x-auto font-mono text-xs sm:text-[13px] leading-[1.75] bg-[#07080A]/80">
          <pre className="text-zinc-300">
            <code>{snippet.highlighted}</code>
          </pre>
        </div>

        {/* Colonne Droite : Live Sandbox & Event Stream (Col 5) */}
        <div className="lg:col-span-5 flex flex-col justify-between bg-[#0B0C10]/95 p-4 sm:p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]" />
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Live Stream Événements
                </span>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] font-semibold text-zinc-400">
                sandbox · testmode
              </span>
            </div>

            {/* Pipeline d'étapes interactif */}
            <div className="space-y-2.5">
              {/* Étape 1 */}
              <div
                className={`flex items-start gap-3 rounded-xl border p-2.5 transition-all ${
                  simStep >= 1
                    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                    : "border-white/[0.05] bg-white/[0.02] text-zinc-500"
                }`}
              >
                <span className="mt-0.5 font-mono text-[11px] font-bold">01</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold">POST /v1/deliveries</span>
                    <span className="font-mono text-[10px] text-emerald-400">201 CREATED</span>
                  </div>
                  <p className="font-mono text-[11px] text-zinc-400 truncate">
                    OFK-2026-0842 · Idempotency-Key scellée
                  </p>
                </div>
              </div>

              {/* Étape 2 */}
              <div
                className={`flex items-start gap-3 rounded-xl border p-2.5 transition-all ${
                  simStep >= 2
                    ? "border-sky-500/30 bg-sky-950/20 text-sky-300"
                    : "border-white/[0.05] bg-white/[0.02] text-zinc-500"
                }`}
              >
                <span className="mt-0.5 font-mono text-[11px] font-bold">02</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold">delivery.assigned</span>
                    <span className="font-mono text-[10px] text-sky-400">DISPATCHED</span>
                  </div>
                  <p className="font-mono text-[11px] text-zinc-400 truncate">
                    Coursier Koffi Kouamé (Marcory Zone 4)
                  </p>
                </div>
              </div>

              {/* Étape 3 */}
              <div
                className={`flex items-start gap-3 rounded-xl border p-2.5 transition-all ${
                  simStep >= 3
                    ? "border-amber-500/30 bg-amber-950/20 text-amber-300"
                    : "border-white/[0.05] bg-white/[0.02] text-zinc-500"
                }`}
              >
                <span className="mt-0.5 font-mono text-[11px] font-bold">03</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold">delivery.arrived</span>
                    <span className="font-mono text-[10px] text-amber-400">GPS ±12m</span>
                  </div>
                  <p className="font-mono text-[11px] text-zinc-400 truncate">
                    Arrivée certifiée chez le client à Cocody
                  </p>
                </div>
              </div>

              {/* Étape 4 */}
              <div
                className={`flex items-start gap-3 rounded-xl border p-2.5 transition-all ${
                  simStep >= 4
                    ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                    : "border-white/[0.05] bg-white/[0.02] text-zinc-500"
                }`}
              >
                <span className="mt-0.5 font-mono text-[11px] font-bold">04</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs font-bold">delivery.delivered</span>
                    <span className="font-mono text-[10px] font-bold text-emerald-400">SCELLÉ SHA-256</span>
                  </div>
                  <p className="font-mono text-[11px] text-zinc-400 truncate">
                    Code secret <strong className="text-white">4 8 2 9</strong> validé bilatéralement
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bouton de test interactif Stripe/Linear */}
          <div className="pt-2">
            <button
              type="button"
              onClick={runSimulation}
              disabled={isSimulating}
              className="w-full inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#C2410C] to-[#EA580C] px-4 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_rgba(194,65,12,0.35)] transition-all hover:brightness-110 active:scale-98 disabled:opacity-50"
            >
              <span>{isSimulating ? "Simulation en cours…" : "Simuler un cycle complet en direct"}</span>
              <span className="text-xs">⚡</span>
            </button>
          </div>
        </div>
      </div>

      {/* Barre de bas de page avec specs techniques */}
      <div className="flex flex-wrap items-center justify-between border-t border-white/[0.08] bg-[#0E1015]/90 px-4 py-2.5 sm:px-6 gap-2 text-xs font-mono text-zinc-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
            <span>OpenAPI 3.1.0</span>
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">HMAC-SHA256 Webhooks</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">99.98% Uptime SLA</span>
        </div>
        <div className="text-[11px] text-zinc-500">
          Latence moyenne API : <span className="text-emerald-400 font-bold">~42 ms</span>
        </div>
      </div>
    </div>
  );
}
