import type { UserRole } from "@/lib/auth/company-user";

// Libellés et descriptions des rôles (mvp.md §4.2), partagés par les écrans.
export const ROLE_OPTIONS: { value: UserRole; label: string; description: string }[] = [
  {
    value: "COMPANY_ADMIN",
    label: "Admin entreprise",
    description: "Gère l'équipe, les clés API, les webhooks ; peut forcer « Livré ».",
  },
  { value: "MANAGER", label: "Gestionnaire", description: "Crée les livraisons, affecte les livreurs, gère les livreurs." },
  { value: "RETURNS_OFFICER", label: "Responsable retours", description: "Voit les colis en retour et réceptionne les retours." },
];

export const ROLE_LABEL: Record<UserRole, string> = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label])) as Record<
  UserRole,
  string
>;
