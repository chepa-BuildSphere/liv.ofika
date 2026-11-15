# Design system — Ofika Delivery

> Décidé le 15/11/2026 : **fond blanc, texte noir, boutons et actions en orange.**
> Source unique : `src/app/globals.css`. Ne jamais écrire une couleur en dur dans une page.

## Principes

1. **Blanc** = fond principal. **Noir** = texte. **Orange** = ce sur quoi on agit (boutons, liens, focus).
2. L'orange se mérite : **un seul bouton orange par écran** (l'action principale). Les autres actions sont en bouton secondaire (contour).
3. Les statuts gardent leur code universel, lisible d'un coup d'œil sur le terrain : **vert** = livré / activé, **ambre** = en attente, **rouge** = échec / erreur.
4. Mode clair uniquement (le fond blanc fait partie de l'identité).
5. Lisible au soleil sur un téléphone : contraste minimum **4,5:1** pour tout texte (WCAG AA).

## Couleurs (3 niveaux)

### 1. Primitives — les teintes brutes

| Nom | Valeur | |
|---|---|---|
| `orange-50` | `#FFF7ED` | fond très léger |
| `orange-100` | `#FFEDD5` | sélection de texte |
| `orange-500` | `#F97316` | — |
| `orange-600` | `#EA580C` | orange vif de la marque |
| `orange-700` | `#C2410C` | orange des boutons |
| `orange-800` | `#9A3412` | survol des boutons |

### 2. Sémantique — le rôle de chaque couleur

| Rôle (classe Tailwind) | Valeur | Usage |
|---|---|---|
| `paper` | `#FFFFFF` | Fond principal |
| `surface` | `#FAFAFA` | Fond secondaire (en-têtes de tableau, survols) |
| `ink` | `#0A0A0A` | Texte principal (noir) |
| `ink-muted` | `#52525B` | Texte secondaire, aides, dates |
| `line` | `#E4E4E7` | Bordures, séparateurs |
| `line-strong` | `#A1A1AA` | Bordures de champs et de boutons secondaires |
| `brand` | `#EA580C` | Accents : liens, focus, mot « Delivery » |
| `brand-strong` | `#C2410C` | Fond des boutons d'action |
| `brand-stronger` | `#9A3412` | Survol des boutons d'action |
| `brand-soft` | `#FFF7ED` | Zones mises en avant |
| `success` / `success-soft` | `#15803D` / `#F0FDF4` | Livré, activé, réussi |
| `warning` / `warning-soft` | `#B45309` / `#FFFBEB` | En attente, lien bientôt expiré |
| `danger` / `danger-soft` | `#B91C1C` / `#FEF2F2` | Erreur, échec de livraison |

Exemples : `text-ink`, `text-ink-muted`, `bg-paper`, `border-line`, `text-brand`, `bg-success-soft text-success`.

### Contrastes vérifiés

| Texte sur fond | Contraste | Verdict |
|---|---|---|
| Noir `#0A0A0A` sur blanc | 19,8:1 | ✅ |
| Gris `#52525B` sur blanc | 7,7:1 | ✅ |
| Blanc sur orange `#C2410C` (boutons) | 5,2:1 | ✅ |
| Blanc sur orange vif `#EA580C` | 3,6:1 | ❌ pour du texte courant → **réservé aux accents**, jamais pour un bouton avec texte blanc |

## Composants

| Classe | Rendu | Quand |
|---|---|---|
| `btn-primary` | Fond orange, texte blanc, 44 px de haut | L'action principale de l'écran (Se connecter, Créer, Activer) |
| `btn-secondary` | Contour gris, texte noir | Actions secondaires (Se déconnecter, Générer un nouveau lien, WhatsApp) |
| `input` | Champ 44 px, bordure grise, focus orange, rouge si invalide (`aria-invalid`) | Tous les champs de saisie |
| `field-label` / `field-error` | Libellé au-dessus / message d'erreur rouge sous le champ | Formulaires |
| `card` | Bordure fine, fond blanc | Blocs, compteurs |
| `link` | Orange foncé, souligné au survol | Liens dans le texte |
| `alert-error` | Fond rouge pâle, texte rouge | Message d'erreur d'un formulaire |
| `<Wordmark />` | « Ofika » noir + « Delivery » orange | Signature de marque, en attendant un logo (`src/components/wordmark.tsx`) |

## Typographie

- Police : **Geist** (sans-serif, chargée par `next/font`), repli `system-ui`.
- Corps de texte : 16 px dans les champs (évite le zoom automatique sur iPhone), 14 px pour les textes d'interface.
- Titres : `text-2xl font-semibold tracking-tight`.
- Chiffres dans les tableaux : `tabular-nums`.

## Règles d'accessibilité (skill ui-ux-pro-max)

- Zones cliquables d'au moins 44 px de haut pour les actions principales (doigts sur le terrain).
- Focus visible au clavier : contour orange (`focus-visible:outline-brand`).
- Ne jamais transmettre une information **seulement** par la couleur : un statut a toujours un libellé (« Activé », « En attente »).
- Pas d'emoji comme icône ; icônes SVG le moment venu.
- Testé aux largeurs 375 px, 768 px, 1024 px, 1440 px.

## À venir

- **Logo** : à créer (skill `logo-design`) ou à fournir. Il remplacera `<Wordmark />`.
- Icônes (Lucide) et composants des écrans livreur (PWA mobile).
