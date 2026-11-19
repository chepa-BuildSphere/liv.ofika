import Link from "next/link";
import Image from "next/image";
import { Wordmark } from "@/components/wordmark";
import { getCachedPlatformPrice } from "@/lib/billing/public-price";
import {
  MinimalFaqAccordion,
  RevealOnScroll,
  DeveloperCodeShowcase,
} from "./minimalist-home-client";
import {
  CheckCircleIcon,
  PhoneIcon,
  BanknotesIcon,
  ArrowRightIcon,
  KeyIcon,
  CodeBracketIcon,
  CommandLineIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  GitHubIcon,
} from "@/components/icons";

const TIMELINE_SAMPLE = [
  {
    code: "DELIVERY_CREATED",
    label: "Commande enregistrée · Mode & Beauté",
    meta: "08:14 · Import Excel · Réf CMD-2026-0842",
    badge: "CRÉÉE",
    badgeStyle: "bg-[#F7F6F3] text-[#787774] border-[#EAEAEA]",
  },
  {
    code: "DELIVERY_ASSIGNED",
    label: "Affectée au coursier Koffi Kouamé",
    meta: "08:27 · Livreur salarié · Secteur Cocody",
    badge: "AFFECTÉE",
    badgeStyle: "bg-[#FBF3DB] text-[#956400] border-[#F3E5B5]",
  },
  {
    code: "DELIVERY_PICKED_UP",
    label: "Prise en charge au dépôt Marcory Zone 4",
    meta: "09:05 · Smartphone Android #d4e8a1",
    badge: "EN TOURNÉE",
    badgeStyle: "bg-[#E1F3FE] text-[#1F6C9F] border-[#CBE6FA]",
  },
  {
    code: "DELIVERY_ARRIVED",
    label: "Arrivée chez la cliente Aïcha Koné",
    meta: "09:41 · Position GPS certifiée (±12 m)",
    badge: "ARRIVÉ · QR ACTIF",
    badgeStyle: "bg-[#FFF7ED] text-[#C2410C] border-[#FFEDD5]",
  },
  {
    code: "DELIVERY_DELIVERED",
    label: "Code à 4 chiffres dicté par le client et validé",
    meta: "09:42 · Échange bilatéral scellé SHA-256",
    badge: "LIVRÉE · PREUVE CERTIFIÉE",
    badgeStyle: "bg-[#EDF3EC] text-[#346538] border-[#D4E6D1]",
  },
] as const;

function ParcelSketchIllustration() {
  return (
    <svg
      viewBox="0 0 220 120"
      fill="none"
      aria-hidden="true"
      className="h-24 w-44 shrink-0"
    >
      <rect x="34" y="24" width="68" height="58" rx="4" fill="#EDF3EC" />
      <path
        d="M24 38 L58 20 L92 38 L92 78 L58 96 L24 78 Z M24 38 L58 56 L92 38 M58 56 L58 96 M40 29 L74 47"
        stroke="#111111"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M92 64 C118 64, 126 36, 152 36 C168 36, 174 52, 188 52"
        stroke="#111111"
        strokeWidth="1.6"
        strokeDasharray="4 4"
        strokeLinecap="round"
      />
      <circle cx="188" cy="52" r="10" fill="#E1F3FE" stroke="#111111" strokeWidth="1.8" />
      <circle cx="188" cy="52" r="3" fill="#111111" />
    </svg>
  );
}

export default async function Home() {
  const pricePerDelivery = await getCachedPlatformPrice();
  const formattedPrice = pricePerDelivery.toLocaleString("fr-FR");

  return (
    <div className="relative min-h-screen bg-[#FBFBFA] text-[#111111]">
      {/* Lumière ambiante fixe subtile */}
      <div
        aria-hidden="true"
        className="minimal-ambient-glow pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          background:
            "radial-gradient(640px circle at 72% 18%, #C2410C 0%, rgba(194, 65, 12, 0) 70%)",
        }}
      />

      {/* ── NAVIGATION PRINCIPALE ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[#EAEAEA] bg-[#FBFBFA]/90 backdrop-blur-[6px]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Wordmark className="text-base sm:text-lg" />
            </Link>
            <span className="hidden rounded-full border border-[#EAEAEA] bg-[#F7F6F3] px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.05em] text-[#787774] md:inline-block">
              Abidjan · Côte d&apos;Ivoire
            </span>
          </div>

          <nav aria-label="Navigation principale" className="flex items-center gap-2 sm:gap-4">
            <a
              href="#how-it-works"
              className="hidden text-xs font-medium text-[#787774] transition-colors hover:text-[#111111] md:inline"
            >
              Fonctionnement
            </a>
            <a
              href="#pricing"
              className="hidden text-xs font-medium text-[#787774] transition-colors hover:text-[#111111] md:inline"
            >
              Tarifs
            </a>
            <a
              href="#developers"
              className="hidden text-xs font-medium text-[#787774] transition-colors hover:text-[#111111] md:inline"
            >
              Développeurs &amp; API
            </a>
            <a
              href="https://github.com/chepa-BuildSphere/liv.ofika"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-[#787774] transition-colors hover:text-[#111111]"
            >
              GitHub
            </a>
            <Link
              href="/courier/login"
              className="text-xs font-medium text-[#787774] transition-colors hover:text-[#111111]"
            >
              Espace Livreur
            </Link>
            <Link
              href="/login"
              className="inline-flex h-8.5 items-center justify-center rounded-[6px] border border-[#EAEAEA] bg-white px-3 text-xs font-semibold text-[#111111] transition-all hover:border-[#111111]"
            >
              Connexion
            </Link>
            <Link
              href="/register"
              className="inline-flex h-8.5 items-center justify-center rounded-[6px] bg-[#C2410C] px-3.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#9A3412] active:scale-95"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        {/* ── 1. SECTION HERO ────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-[#EAEAEA]">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]"
          >
            <defs>
              <pattern id="ofika-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#111111" strokeWidth="0.75" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#ofika-grid)" />
          </svg>

          <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <RevealOnScroll index={0}>
              <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
                {/* Colonne Gauche : Pitch & CTA */}
                <div className="lg:col-span-7">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#C2410C]/20 bg-[#FFF7ED] px-3 py-1 text-xs font-semibold text-[#C2410C]">
                    <span className="h-2 w-2 rounded-full bg-[#C2410C] animate-pulse" />
                    La preuve de livraison qui met fin aux palabres à Abidjan
                  </div>

                  <h1 className="mt-5 text-3xl font-extrabold leading-[1.14] tracking-[-0.03em] text-[#111111] sm:text-4xl lg:text-[42px]">
                    Fini les palabres de livraison. Le commerçant est rassuré, le livreur est protégé.
                  </h1>

                  <p className="mt-4 text-sm leading-[1.65] text-[#787774] sm:text-base">
                    Que vous vendiez sur WhatsApp, Facebook, TikTok ou en magasin à Abidjan : fini le client qui prétend n&apos;avoir rien reçu et le livreur accusé à tort. Le client scanne et dicte son code secret à 4 chiffres, la course est validée avec le point GPS, tout le monde est tranquille.
                  </p>

                  <div className="mt-7 flex flex-wrap items-center gap-3">
                    <Link
                      href="/register"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[#C2410C] px-6 text-sm font-bold uppercase tracking-wider text-white shadow-sm transition-all duration-150 hover:bg-[#9A3412] active:scale-[0.98]"
                    >
                      <span>Créer mon compte entreprise</span>
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>
                    <Link
                      href="/courier/login"
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] border border-[#EAEAEA] bg-white px-5 text-sm font-medium text-[#111111] transition-all duration-150 hover:border-[#111111] active:scale-[0.98]"
                    >
                      <PhoneIcon className="h-4 w-4 text-[#787774]" />
                      <span>Accès livreur terrain</span>
                    </Link>
                  </div>

                  {/* Puces de réassurance */}
                  <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-[#EAEAEA] pt-6 text-xs text-[#787774]">
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
                      <span><strong>{formattedPrice} F CFA</strong> par livraison</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
                      <span><strong>0 F d&apos;abonnement</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
                      <span><strong>Gratuit</strong> sur retours</span>
                    </div>
                  </div>
                </div>

                {/* Colonne Droite : Image Hero professionnelle avec badge de certification */}
                <div className="lg:col-span-5">
                  <div className="relative mx-auto max-w-md lg:max-w-none">
                    <div className="relative overflow-hidden rounded-[20px] border border-[#EAEAEA] bg-white p-2 shadow-[0_20px_50px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.03]">
                      <Image
                        src="/hero-delivery.jpg"
                        alt="Livreur Ofika Delivery remettant un colis certifié avec preuve QR code à Abidjan"
                        width={700}
                        height={525}
                        priority
                        className="aspect-[4/3] w-full rounded-[14px] object-cover"
                      />

                      {/* Badge flottant certifié */}
                      <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-[10px] border border-white/50 bg-white/95 p-3 shadow-lg backdrop-blur-md">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#15803D]/10 text-[#15803D]">
                            <CheckCircleIcon className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-[11px] font-bold text-[#111111]">Preuve QR bilatérale certifiée</p>
                            <p className="font-mono text-[10px] text-[#787774]">GPS + Code 4 chiffres scellé</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-[#EDF3EC] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#346538]">
                          Abidjan
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>

            {/* ── 1-BIS. SPOT PUBLICITAIRE VIDÉO 20 SECONDES (AIDA · ABIDJAN) ── */}
            <RevealOnScroll index={1} className="mt-14">
              <div className="overflow-hidden rounded-[20px] border border-[#EAEAEA] bg-[#111111] p-3 sm:p-5 text-white shadow-[0_24px_60px_rgba(0,0,0,0.12)]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#C2410C] animate-pulse" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#FFEDD5]">
                      Spot Publicitaire Officiel · 20 secondes (Abidjan)
                    </span>
                  </div>
                  <span className="rounded-full border border-white/15 bg-white/10 px-3 py-0.5 font-mono text-[11px] font-semibold text-[#F4F4F5]">
                    Voix-off &amp; Preuve QR certifiée · 10 F / livraison validée
                  </span>
                </div>

                <div className="relative overflow-hidden rounded-[14px] border border-white/10 bg-black">
                  <video
                    src="/ofika-promo-20s.mp4"
                    poster="/hero-delivery.jpg"
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full object-cover"
                  >
                    Votre navigateur ne supporte pas la lecture vidéo HTML5.
                  </video>
                </div>
              </div>
            </RevealOnScroll>

            {/* ── 2. DÉMONSTRATION EN DIRECT (FAUX-OS WINDOW CHROME) ────────── */}
            <RevealOnScroll index={1} className="mt-14">
              <div className="overflow-hidden rounded-[12px] border border-[#EAEAEA] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                <div className="flex items-center justify-between border-b border-[#EAEAEA] bg-[#F9F9F8] px-4 py-3">
                  <div className="flex items-center gap-2" aria-hidden="true">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#D4D4D4]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#E4E4E7]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#E4E4E7]" />
                  </div>
                  <span className="font-mono text-xs text-[#787774]">
                    ofika://espace/livraisons/CMD-2026-0842
                  </span>
                  <span className="rounded-full bg-[#EDF3EC] px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-[#346538]">
                    LIVRÉE · PREUVE VALIDE
                  </span>
                </div>

                <div className="grid grid-cols-1 divide-y divide-[#EAEAEA] lg:grid-cols-12 lg:divide-x lg:divide-y-0">
                  <div className="flex flex-col justify-between gap-6 p-6 sm:p-8 lg:col-span-5">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-mono text-xs uppercase tracking-[0.05em] text-[#787774]">
                            Dossier de course
                          </p>
                          <p className="mt-1 font-mono text-lg font-bold text-[#111111]">
                            CMD-2026-0842
                          </p>
                        </div>
                        <span className="rounded-full bg-[#FFF7ED] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#C2410C]">
                          SUCCÈS
                        </span>
                      </div>

                      <div className="my-5 flex justify-center rounded-[8px] border border-[#EAEAEA] bg-[#FBFBFA] py-4">
                        <ParcelSketchIllustration />
                      </div>

                      <dl className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-xs">
                        <div>
                          <dt className="font-mono text-[10px] uppercase text-[#787774]">Expéditeur</dt>
                          <dd className="mt-0.5 font-semibold text-[#111111]">Maison Kora Mode</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[10px] uppercase text-[#787774]">Destinataire</dt>
                          <dd className="mt-0.5 font-semibold text-[#111111]">Aïcha Koné</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[10px] uppercase text-[#787774]">Zone</dt>
                          <dd className="mt-0.5 text-[#111111]">Cocody Ambassades</dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[10px] uppercase text-[#787774]">À encaisser (COD)</dt>
                          <dd className="mt-0.5 font-mono font-bold text-[#15803D]">
                            18 500 F CFA
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8 lg:col-span-7">
                    <div className="flex items-center justify-between gap-2 border-b border-[#EAEAEA] pb-3">
                      <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#787774]">
                        Traçabilité chaîne d&apos;audit SHA-256
                      </p>
                      <span className="font-mono text-xs text-[#15803D] font-bold">5 maillons scellés</span>
                    </div>

                    <ol className="mt-4 divide-y divide-[#EAEAEA]">
                      {TIMELINE_SAMPLE.map((item) => (
                        <li
                          key={item.code}
                          className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-xs font-semibold text-[#111111]">{item.label}</p>
                            <p className="font-mono text-[11px] text-[#787774]">{item.meta}</p>
                          </div>
                          <span
                            className={`w-fit shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${item.badgeStyle}`}
                          >
                            {item.badge}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ── 3. COMMENT ÇA MARCHE EN 3 ÉTAPES ───────────────────────────── */}
        <section id="how-it-works" className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <RevealOnScroll index={0}>
            <div className="max-w-2xl">
              <span className="inline-block rounded-full border border-[#EAEAEA] bg-white px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#C2410C]">
                Sur le terrain
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#111111] sm:text-4xl">
                Comment ça se passe concrètement sur le terrain ?
              </h2>
              <p className="mt-2 text-sm text-[#787774] leading-relaxed">
                Une mécanique simple en 3 étapes pensée pour le rythme des rues d&apos;Abidjan.
              </p>
            </div>
          </RevealOnScroll>

          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Étape 1 */}
            <RevealOnScroll index={1}>
              <div className="h-full rounded-[12px] border border-[#EAEAEA] bg-white p-6 shadow-sm space-y-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111111] font-mono text-sm font-bold text-white">
                  01
                </span>
                <h3 className="text-base font-bold text-[#111111]">
                  Vous confiez vos colis à vos livreurs
                </h3>
                <p className="text-xs leading-relaxed text-[#787774]">
                  Importez vos commandes WhatsApp ou votre fichier Excel en 1 clic. Affectez chaque colis à votre livreur (votre employé motard ou un coursier partenaire). Le bordereau avec QR code est généré direct.
                </p>
                <div className="pt-2 text-[11px] font-mono text-[#787774]">
                  → Fini les feuilles volantes et cahiers égarés
                </div>
              </div>
            </RevealOnScroll>

            {/* Étape 2 */}
            <RevealOnScroll index={2}>
              <div className="h-full rounded-[12px] border border-[#EAEAEA] bg-white p-6 shadow-sm space-y-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C2410C] font-mono text-sm font-bold text-white">
                  02
                </span>
                <h3 className="text-base font-bold text-[#111111]">
                  Le livreur roule sans prise de tête
                </h3>
                <p className="text-xs leading-relaxed text-[#787774]">
                  Sur sa moto (à Cocody, Yopougon, Marcory ou Adjamé), il ouvre Chrome avec son numéro et son code PIN. En arrivant devant le portail, il clique sur « Arrivé » : son téléphone enregistre son point GPS.
                </p>
                <div className="pt-2 text-[11px] font-mono text-[#787774]">
                  → Aucune appli lourde Play Store à installer
                </div>
              </div>
            </RevealOnScroll>

            {/* Étape 3 */}
            <RevealOnScroll index={3}>
              <div className="h-full rounded-[12px] border border-[#EAEAEA] bg-white p-6 shadow-sm space-y-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#15803D] font-mono text-sm font-bold text-white">
                  03
                </span>
                <h3 className="text-base font-bold text-[#111111]">
                  Le client scanne et dicte son code
                </h3>
                <p className="text-xs leading-relaxed text-[#787774]">
                  Le livreur montre son écran. Le client scanne le QR code avec son smartphone : un code secret à 4 chiffres apparaît. Le client le donne au livreur. La remise est certifiée, tout le monde est couvert !
                </p>
                <div className="pt-2 text-[11px] font-mono text-[#15803D] font-bold">
                  → Le livreur est libéré, le commerçant est rassuré
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ── 4. SECTION TARIFICATION CLAIRE (EXIGÉE PAR L'UTILISATEUR) ── */}
        <section id="pricing" className="border-t border-[#EAEAEA] bg-white py-20 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <RevealOnScroll index={0}>
              <div className="text-center max-w-2xl mx-auto">
                <span className="inline-block rounded-full border border-[#15803D]/20 bg-[#F0FDF4] px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#15803D]">
                  Tarifs 100% transparents
                </span>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#111111] sm:text-4xl">
                  Payez uniquement pour les livraisons réussies.
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-[#787774]">
                  Pas de frais d&apos;inscription, pas d&apos;abonnement récurrent, aucun engagement.
                </p>
              </div>
            </RevealOnScroll>

            {/* Disposition 2 colonnes : Image paiement & commerçante + Carte tarifaire */}
            <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              {/* Colonne Gauche : Image professionnelle commerçante & relevé Ofika */}
              <RevealOnScroll index={1} className="lg:col-span-6 flex">
                <div className="relative flex flex-col justify-between w-full overflow-hidden rounded-[20px] border border-[#EAEAEA] bg-[#FBFBFA] p-3 sm:p-4 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.06)]">
                  <div className="relative overflow-hidden rounded-[14px]">
                    <Image
                      src="/pricing-payment.jpg"
                      alt="Commerçante à Abidjan consultant son relevé transparent de livraisons Ofika Delivery"
                      width={700}
                      height={600}
                      className="aspect-square w-full object-cover object-bottom"
                    />

                    {/* Badge flottant en haut de l'image */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full border border-white/60 bg-white/95 px-3 py-1 shadow-md backdrop-blur-md">
                      <span className="h-2 w-2 rounded-full bg-[#15803D] animate-pulse" />
                      <span className="text-[11px] font-bold text-[#111111]">Facturation 100% à l&apos;usage réel</span>
                    </div>
                  </div>

                  {/* Bandeau relevé mensuel sous l'image (sans masquer le QR code du colis) */}
                  <div className="mt-3 flex items-center justify-between rounded-[12px] border border-[#EAEAEA] bg-white p-3 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#15803D]/10 text-[#15803D]">
                        <BanknotesIcon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold text-[#111111]">Relevé mensuel transparent</p>
                        <p className="font-mono text-[10px] text-[#787774]">Historique scellé + preuve QR consultable</p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#EDF3EC] px-2.5 py-1 font-mono text-[10px] font-bold text-[#346538]">
                      {formattedPrice} F / course
                    </span>
                  </div>

                  {/* Badges de réassurance sous l'image */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-[10px] border border-[#EAEAEA] bg-white p-3 shadow-2xs">
                      <p className="text-[11px] font-bold text-[#111111]">0 F si échec ou refus</p>
                      <p className="mt-0.5 text-[10px] text-[#787774]">Si le client ne prend pas son colis, la course n&apos;est pas facturée.</p>
                    </div>
                    <div className="rounded-[10px] border border-[#EAEAEA] bg-white p-3 shadow-2xs">
                      <p className="text-[11px] font-bold text-[#111111]">Tarif personnalisable</p>
                      <p className="mt-0.5 text-[10px] text-[#787774]">Ajustable en base par entreprise selon vos volumes mensuels.</p>
                    </div>
                  </div>
                </div>
              </RevealOnScroll>

              {/* Colonne Droite : Carte de tarification principale (sans bordure noire) */}
              <RevealOnScroll index={2} className="lg:col-span-6 flex">
                <div className="flex flex-col justify-between w-full rounded-[20px] border border-[#EAEAEA] bg-white p-8 sm:p-10 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.08)] space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[#111111] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                        Formule Unique Business
                      </span>
                      <span className="font-mono text-xs font-semibold text-[#15803D]">Sans engagement</span>
                    </div>

                    <div className="mt-6 border-b border-[#EAEAEA] pb-6">
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-extrabold tracking-tight text-[#111111]">{formattedPrice} F</span>
                        <span className="text-lg font-semibold text-[#787774]">CFA / livraison livrée</span>
                      </div>
                      <p className="mt-2 text-xs text-[#787774]">
                        Facturation cumulée en fin de mois avec relevé officiel téléchargeable.
                      </p>
                    </div>

                    <ul className="mt-6 space-y-3.5 text-xs text-[#111111]">
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
                        <span><strong>0 F d&apos;abonnement mensuel</strong> (vous ne payez que votre volume réel)</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
                        <span><strong>0 F sur les échecs et retours</strong> au dépôt</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
                        <span>Nombre de livreurs et d&apos;utilisateurs <strong>illimité</strong></span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
                        <span>Preuve par QR code temporaire (3 min) + code 4 chiffres</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
                        <span>Clés API test &amp; production + webhooks en temps réel inclus</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D]" />
                        <span>Bordereaux de livraison PDF avec QR de référence</span>
                      </li>
                    </ul>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Link
                      href="/register"
                      className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] bg-[#C2410C] text-sm font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-[#9A3412] active:scale-98"
                    >
                      <span>Créer mon compte entreprise</span>
                      <ArrowRightIcon className="h-4 w-4" />
                    </Link>

                    <p className="text-center text-[11px] text-[#787774]">
                      Inscription en 2 minutes · Aucune carte bancaire requise à la création
                    </p>
                  </div>
                </div>
              </RevealOnScroll>
            </div>
          </div>
        </section>

        {/* ── 5. COMPARATIF : CE QUI SE PASSE VRAIMENT SUR LE TERRAIN ────── */}
        <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
          <RevealOnScroll index={0}>
            <div className="max-w-3xl">
              <span className="inline-block rounded-full border border-[#EAEAEA] bg-white px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[#C2410C]">
                La réalité du terrain à Abidjan
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#111111] sm:text-4xl">
                Pourquoi commerçants et livreurs choisissent Ofika ?
              </h2>
              <p className="mt-2 text-sm text-[#787774] leading-relaxed">
                Sous le soleil d&apos;Abidjan, dans les embouteillages et face aux clients indécis : voici la différence entre la galère d&apos;hier et la sérénité d&apos;aujourd&apos;hui.
              </p>
            </div>
          </RevealOnScroll>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Sans Ofika */}
            <RevealOnScroll index={1}>
              <div className="h-full rounded-[16px] border border-[#DC2626]/20 bg-[#FEF2F2]/50 p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#DC2626] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                    Sans Ofika Delivery
                  </span>
                  <span className="text-xs font-semibold text-[#DC2626]">Les palabres de tous les jours</span>
                </div>

                <ul className="space-y-4 text-xs text-[#787774]">
                  <li className="flex items-start gap-2.5">
                    <span className="text-[#DC2626] font-bold font-mono text-sm leading-none shrink-0 mt-0.5">✕</span>
                    <div>
                      <strong className="text-[#111111]">Le client prétend qu&apos;il n&apos;a rien reçu :</strong>
                      <p className="mt-0.5 text-[#555] leading-relaxed">
                        Le client prend le colis ou dit « laisse au gardien », puis appelle le vendeur : « Je n&apos;ai jamais vu ton livreur, remboursez-moi ». C&apos;est parole contre parole et le commerçant perd son argent.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-[#DC2626] font-bold font-mono text-sm leading-none shrink-0 mt-0.5">✕</span>
                    <div>
                      <strong className="text-[#111111]">Le livreur est accusé à tort de vol :</strong>
                      <p className="mt-0.5 text-[#555] leading-relaxed">
                        Le coursier a bravé la pluie et les bouchons, mais sans preuve écrite, c&apos;est toujours sur lui qu&apos;on crie ou sur son salaire qu&apos;on veut couper l&apos;argent.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-[#DC2626] font-bold font-mono text-sm leading-none shrink-0 mt-0.5">✕</span>
                    <div>
                      <strong className="text-[#111111]">Le faux « Patron j&apos;étais là-bas mais il décrochait pas » :</strong>
                      <p className="mt-0.5 text-[#555] leading-relaxed">
                        Impossible de savoir si le livreur est réellement parti devant la maison du client ou s&apos;il a abandonné la course au carrefour.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-[#DC2626] font-bold font-mono text-sm leading-none shrink-0 mt-0.5">✕</span>
                    <div>
                      <strong className="text-[#111111]">Les colis « fantômes » qui disparaissent :</strong>
                      <p className="mt-0.5 text-[#555] leading-relaxed">
                        Le client a refusé la commande, le colis dort pendant des jours dans le sac de moto et personne ne sait où il est passé.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-[#DC2626] font-bold font-mono text-sm leading-none shrink-0 mt-0.5">✕</span>
                    <div>
                      <strong className="text-[#111111]">Les comptes du soir qui chauffent la tête :</strong>
                      <p className="mt-0.5 text-[#555] leading-relaxed">
                        Entre les encaissements en espèces (COD), les dépôts Wave ou Orange Money, le commerçant et le livreur perdent 1 heure à faire les comptes le soir.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </RevealOnScroll>

            {/* Avec Ofika */}
            <RevealOnScroll index={2}>
              <div className="h-full rounded-[16px] border border-[#15803D]/25 bg-[#F0FDF4]/60 p-6 sm:p-8 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-[#15803D] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
                    Avec Ofika Delivery
                  </span>
                  <span className="text-xs font-semibold text-[#15803D]">Chacun est couvert et serein</span>
                </div>

                <ul className="space-y-4 text-xs text-[#111111]">
                  <li className="flex items-start gap-2.5">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D] mt-0.5" />
                    <div>
                      <strong className="text-[#15803D]">Pour le Commerçant : La certitude que votre vente est scellée</strong>
                      <p className="mt-0.5 text-[#333] leading-relaxed">
                        Le client scanne le QR code et dicte son code secret à 4 chiffres au livreur. S&apos;il a donné le code, il a le colis en main. Aucune contestation possible !
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D] mt-0.5" />
                    <div>
                      <strong className="text-[#15803D]">Pour le Livreur : Protection totale contre les faux soupçons</strong>
                      <p className="mt-0.5 text-[#333] leading-relaxed">
                        Dès que vous validez le code à 4 chiffres, la course est enregistrée et certifiée. Le commerçant a la preuve que vous avez bien fait votre travail. Personne ne peut couper votre paie.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D] mt-0.5" />
                    <div>
                      <strong className="text-[#15803D]">Pointage GPS certifié sur place :</strong>
                      <p className="mt-0.5 text-[#333] leading-relaxed">
                        L&apos;heure exacte et la position GPS sont enregistrées quand le livreur clique sur « Arrivé ». Tout le monde voit que le coursier s&apos;est réellement déplacé.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D] mt-0.5" />
                    <div>
                      <strong className="text-[#15803D]">Retour au magasin en 2 minutes chrono :</strong>
                      <p className="mt-0.5 text-[#333] leading-relaxed">
                        Le soir au dépôt, le gestionnaire scanne les colis non livrés. Le livreur est libéré de sa responsabilité immédiatement, le stock est remis à jour sans dispute.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <CheckCircleIcon className="h-4 w-4 shrink-0 text-[#15803D] mt-0.5" />
                    <div>
                      <strong className="text-[#15803D]">{formattedPrice} F CFA seulement par livraison livrée :</strong>
                      <p className="mt-0.5 text-[#333] leading-relaxed">
                        Vous ne payez que lorsque le client a reçu son colis. Si le client refuse ou que le colis revient au magasin, c&apos;est <strong>0 F CFA (gratuit)</strong>.
                      </p>
                    </div>
                  </li>
                </ul>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ── 6. ESPACE DÉVELOPPEURS & INTÉGRATEURS (STYLE STRIPE ÉPURÉ) ──── */}
        <section id="developers" className="border-t border-[#EAEAEA] bg-[#FBFBFA] py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <RevealOnScroll index={0}>
              <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
                {/* Colonne Gauche : Pitch & Cas d'usage développeurs / e-commerce / apps */}
                <div className="lg:col-span-6 space-y-6">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#C2410C]/20 bg-[#FFF7ED] px-3 py-1 text-xs font-semibold text-[#C2410C]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#C2410C]" />
                    <span>Conçu pour les développeurs &amp; intégrateurs</span>
                  </div>

                  <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#111111] leading-[1.15]">
                    Ne recodez pas la logistique.
                    <br />
                    <span className="text-[#C2410C]">Branchez l&apos;API en 15 minutes.</span>
                  </h2>

                  <p className="text-sm sm:text-base text-[#787774] leading-relaxed">
                    Vous développez une boutique en ligne, une application mobile, un SaaS ou un logiciel de gestion pour vous ou vos clients à Abidjan ?
                    Déléguez l&apos;intégralité de la preuve de livraison, le pointage GPS certifié et l&apos;échange sécurisé par QR code sans réinventer la roue.
                  </p>

                  {/* 3 Avantages clés développeurs (Style Stripe) */}
                  <div className="space-y-3.5 pt-1">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#EAEAEA] bg-white text-[#111111] shadow-2xs">
                        <CommandLineIcon className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-xs font-bold text-[#111111]">API REST v1 &amp; Webhooks temps réel</h3>
                        <p className="text-xs text-[#787774] leading-relaxed">
                          Création unitaire ou batch, réception instantanée des statuts scellés par signature HMAC-SHA256.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#EAEAEA] bg-white text-[#111111] shadow-2xs">
                        <KeyIcon className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-xs font-bold text-[#111111]">Sandbox &amp; Clés de test gratuites</h3>
                        <p className="text-xs text-[#787774] leading-relaxed">
                          Développez en local avec vos clés <code className="rounded bg-[#F0EFEA] px-1 py-0.5 font-mono text-[11px] text-[#111111]">ofk_test_…</code> sans livreur physique et à 0 F de coût.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#EAEAEA] bg-white text-[#111111] shadow-2xs">
                        <ShieldCheckIcon className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="text-xs font-bold text-[#111111]">Compatible tout écosystème</h3>
                        <p className="text-xs text-[#787774] leading-relaxed">
                          Intégration directe dans WooCommerce, Shopify, Next.js, React Native, Flutter, Python ou PHP.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Boutons d'action développeurs */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Link
                      href="/api/reference"
                      target="_blank"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] bg-[#111111] px-5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-black active:scale-95"
                    >
                      <span>Consulter la doc Scalar</span>
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href="/espace/documentation"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#EAEAEA] bg-white px-4 text-xs font-semibold text-[#111111] shadow-2xs transition-all hover:border-[#111111] active:scale-95"
                    >
                      <DocumentTextIcon className="h-4 w-4 text-[#787774]" />
                      <span>Guide 15 minutes</span>
                    </Link>
                    <a
                      href="https://github.com/chepa-BuildSphere/liv.ofika"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-[#EAEAEA] bg-white px-4 text-xs font-semibold text-[#111111] shadow-2xs transition-all hover:border-[#111111] active:scale-95"
                      title="Projet Open Source sur GitHub"
                    >
                      <GitHubIcon className="h-4 w-4 fill-current text-[#111111]" />
                      <span>GitHub (Open Source)</span>
                    </a>
                  </div>
                </div>

                {/* Colonne Droite : Code Card compacte Style Stripe */}
                <div className="lg:col-span-6">
                  <div className="relative">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-3 rounded-[24px] bg-gradient-to-r from-[#C2410C]/10 to-[#10B981]/10 opacity-60 blur-xl"
                    />
                    <div className="relative">
                      <DeveloperCodeShowcase />
                    </div>
                  </div>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ── 7. QUESTIONS FRÉQUENTES ────────────────────────────────────── */}
        <section className="border-t border-[#EAEAEA] bg-[#FBFBFA] py-20 sm:py-28">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <RevealOnScroll index={0}>
              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#787774]">
                    FAQ
                  </span>
                  <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111111]">
                    Questions fréquentes
                  </h2>
                  <p className="mt-2 text-xs text-[#787774] leading-relaxed">
                    Tout ce qu&apos;il faut savoir pour démarrer vos livraisons dès aujourd&apos;hui.
                  </p>
                </div>
                <div className="lg:col-span-8">
                  <MinimalFaqAccordion pricePerDelivery={pricePerDelivery} />
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </section>

        {/* ── 7. BANDEAU FINAL D'ENGAGEMENT (CTA) ───────────────────────── */}
        <section className="border-t border-[#EAEAEA] bg-[#111111] py-16 text-white sm:py-20">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 space-y-6">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              Passez à la livraison certifiée dès aujourd&apos;hui.
            </h2>
            <p className="max-w-xl mx-auto text-xs sm:text-sm text-[#A1A1AA] leading-relaxed">
              Créez votre compte entreprise en 2 minutes. Équipez vos livreurs et sécurisez vos premières
              courses sans carte bancaire et sans engagement.
            </p>
            <div className="pt-2">
              <Link
                href="/register"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[8px] bg-[#C2410C] px-8 text-sm font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:bg-[#EA580C] active:scale-95"
              >
                <span>Créer mon compte entreprise</span>
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-[#EAEAEA] bg-[#FBFBFA]">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Wordmark className="text-sm" />
            <p className="mt-1 text-xs text-[#787774]">
              Plateforme logistique B2B sécurisée — Abidjan, Côte d&apos;Ivoire
            </p>
          </div>

          <nav aria-label="Liens de pied de page" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#787774]">
            <Link href="/register" className="font-semibold text-[#C2410C] hover:underline">
              Créer un compte
            </Link>
            <Link href="/login" className="hover:text-[#111111]">
              Connexion entreprise
            </Link>
            <Link href="/api/reference" className="hover:text-[#111111]" target="_blank">
              Documentation API (Scalar)
            </Link>
            <Link href="/courier/login" className="hover:text-[#111111]">
              Espace livreur
            </Link>
            <Link href="/courier/first-access" className="hover:text-[#111111]">
              Premier accès PIN
            </Link>
            <Link href="/admin/login" className="hover:text-[#111111]">
              Back-office
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
