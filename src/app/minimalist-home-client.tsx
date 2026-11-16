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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

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

const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: "Combien coûte le service Ofika Delivery pour un commerçant ?",
    answer:
      "C'est seulement 10 F CFA par livraison livrée avec succès au client. Il n'y a aucun abonnement mensuel, aucun frais caché et aucun engagement. Si le client est absent, refuse le colis ou que le paquet revient au magasin, vous payez 0 F CFA (gratuit).",
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

export function MinimalFaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-[#EAEAEA] border-t border-b border-[#EAEAEA]">
      {FAQ_ITEMS.map((item, idx) => {
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
