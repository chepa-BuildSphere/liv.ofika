# Avancement du projet

> Mis à jour le 15/11/2026. À relire en début de session.
> Le découpage des tâches est dans `taches-mvp.md`.

## Où on en est

| Phase | État |
|---|---|
| **Phase 0 — Fondations** | ✅ Terminée (0.1 → 0.7) |
| **Phase 1 — Comptes et droits** | ✅ Terminée (1.1 → 1.7) |
| Phase 2 — Livreurs | 🔄 En cours : 2.1 faite → prochaine **tâche 2.2** (premier accès : le livreur choisit son PIN à 6 chiffres) |

### Détail de la phase 2

| # | Tâche | Preuve |
|---|---|---|
| 2.1 | Ajouter / rattacher un livreur (`/espace/livreurs`) | 6 tests base (même téléphone écrit autrement = 1 livreur rattaché à 2 entreprises, type de contrat par entreprise, doublon refusé, rattachement après détachement, validations, droits) + 18 tests de numéros + navigateur |

**Livreurs (2.1)** : `src/lib/couriers/couriers.ts`. Le téléphone est normalisé (`normalizePhone`, format +2250707070707) : un numéro = un compte livreur sur toute la plateforme. Ajouter un numéro qui existe déjà le **rattache** sans changer son nom ; l'entreprise ne voit jamais ses autres rattachements. Type Employé / Indépendant propre à chaque entreprise. Admin entreprise + gestionnaire (`couriers.manage`).

Cahier de recette de la phase 1 : `docs/CAHIER-DE-RECETTE.docx` (52 tests, 23 P1) + `docs/BUGS_ET_AMELIORATIONS.docx`. Bloquant : compte admin plateforme de recette à fournir.

### Détail de la phase 1

| # | Tâche | Preuve |
|---|---|---|
| 1.1 | Connexion admin plateforme + back-office `/admin` | 7 tests base (`npm run test:db`) + test navigateur : redirection sans session, mauvais mot de passe refusé, connexion, déconnexion |
| 1.2 | Création entreprise + premier admin, lien d'activation | 7 tests base + test navigateur : création, lien affiché, activation, lien réutilisé refusé, « Activé » au tableau de bord |

| 1.3 | Connexion utilisateurs d'entreprise `/connexion` → `/espace` | 8 tests base + navigateur : redirection, connexion, back-office toujours fermé, déconnexion. Revue `security-review` : aucune faille retenue |

| 1.4 | Équipe : invitation, rôles multiples, désactivation (`/espace/equipe`) | 9 tests base (dont gestionnaire + resp. retours, autre entreprise refusée, dernier admin protégé) + navigateur |

| 1.5 | Garde unique des droits `src/lib/auth/permissions.ts` | 45 tests : les 29 lignes de la matrice §4.2 × 6 acteurs, périmètres 🔸, cloisonnement, règle 6, refus par défaut. Revue `security-review` : aucune faille |

| 1.6 | Cloisonnement : `tenantScope` + garde statique du code | 6 tests base (A ne voit rien de B sur les 10 tables d'entreprise, tentatives, lecture/modif par identifiant, insertion détournée) + 5 tests de la garde statique |

| 1.7 | Consultations du support journalisées (`SUPPORT_VIEW`) | 5 tests base (journalisé, visible par l'admin, pas de doublon en 5 min, invisible pour une autre entreprise, gestionnaire oui / resp. retours non) + navigateur |

**Support (1.7)** : ouvrir la fiche d'une entreprise dans le back-office enregistre `SUPPORT_VIEW` dans l'audit de cette entreprise (`src/lib/support/support-view.ts`), sans doublon si l'on recharge dans les 5 min. L'espace entreprise affiche « Consultations du support Ofika » (qui, quoi, quand) aux rôles autorisés par `audit.view`. Le tableau de bord (liste des entreprises) n'est pas journalisé : c'est le pilotage de la plateforme. Tout nouvel écran du back-office qui montre des données d'entreprise doit appeler `logSupportView`.

**Cloisonnement (1.6)** : toute requête sur une table d'entreprise passe par `tenantScope(db, companyId)` (`src/lib/tenant/scope.ts`) : filtre imposé en lecture/mise à jour, `company_id` forcé à l'insertion et non modifiable. Le test `tenant-guard.test.ts` lit tout le code et échoue sur une requête directe non justifiée (exceptions listées avec leur raison, ou commentaire `tenant-guard: <raison>`). Pas de RLS PostgreSQL : incompatible avec Neon Realtime. **Trou corrigé** : `changeDeliveryStatus` exige maintenant `companyId` (une livraison d'une autre entreprise est « introuvable »).

**Droits (1.5)** : toute décision passe par `can(acteur, action, ressource)` / `assertCan(...)`. La matrice est une table (une ligne par action) ; refus par défaut ; l'admin plateforme lit en « support » (`supportAccess`, à journaliser en 1.7). Le test recopie la matrice du document avec ses symboles et vérifie que garde et matrice ont les mêmes actions. Règle 6 : l'acteur porte `courierId` si l'utilisateur est aussi livreur — **le rapprochement utilisateur ↔ livreur reste à faire en phase 2**. Le service de statut (0.7) sera branché sur la garde quand les écrans de livraison existeront (phase 3).

**Équipe (1.4)** : réservé à l'admin entreprise (`src/lib/team/team.ts`). Invitation = même lien d'activation 48 h. Rôles cumulables. Garde-fous : toujours au moins un admin actif (entreprise verrouillée pendant la modification), on ne se désactive pas soi-même, un utilisateur d'une autre entreprise est « introuvable ». Désactiver coupe immédiatement sessions et liens.

**Connexion entreprise (1.3)** : cookie `ofika_session` distinct de `ofika_admin`, session 7 jours. Refus si compte non activé, désactivé, ou entreprise suspendue (vérifié à chaque requête : la suspension coupe l'accès tout de suite). Même blocage 15 min après 5 échecs.

**Création d'entreprise (1.2)** : `/admin/companies/new` crée l'entreprise, son admin (rôle `COMPANY_ADMIN`, sans mot de passe) et un **lien d'activation** à usage unique valable 48 h (table `user_access_tokens`, empreinte seulement), à copier ou envoyer par WhatsApp. L'admin entreprise choisit son mot de passe (≥ 10 caractères) sur `/activer/<jeton>`. Fiche `/admin/companies/<id>` : statut d'activation + « Générer un nouveau lien » (révoque l'ancien). Migration `0002_user_activation`.

**Données de test laissées dans `dev`** : entreprise « Test E2E (dev) » (admin `awa.e2e@ofika.test`) et admins plateforme `e2e-admin@…` supprimé / `e2e-admin-12@ofika.test` désactivé. Le journal d'audit étant en ajout seul, ces traces restent : c'est voulu.

**Auth admin plateforme (1.1)** : sessions en base (`sessions`), cookie `ofika_admin` httpOnly de 12 h contenant un jeton de 256 bits (seule son empreinte est en base), révocation immédiate. Blocage 15 min après 5 échecs (en mémoire : un seul processus). Connexions, échecs et déconnexions journalisés dans l'audit. Créer un compte : `npm run admin:create -- --email … --name "…"` (mot de passe généré, affiché une fois).

### Détail de la phase 0

| # | Tâche | Commit | Preuve |
|---|---|---|---|
| 0.1 | Projet Next.js 16 + dépôt GitHub | `0f24959` | `npm run dev` répond |
| 0.2 | Neon + Drizzle, migrations générées | `61b3a22` | `drizzle/0000_init.sql` (22 tables) |
| 0.3 | Migrations + protections SQL appliquées sur `dev` | `61b3a22` | `npm run db:verify` : UPDATE/DELETE/TRUNCATE `audit_events` refusés |
| 0.4 | `.env.example` + `src/env.ts` | `18813ad` | Aucun secret dans le dépôt ni l'historique |
| 0.5 | Fonctions de sécurité `src/lib/security/` | `4b38fd1` | 24 tests unitaires |
| 0.6 | Journal d'audit chaîné `src/lib/audit/` | `9e9ab91` | Ligne modifiée à la main détectée (`npm run test:db`) |
| 0.7 | Service de statut `src/lib/deliveries/` | `8dd66cc` | `CREATED → DELIVERED` refusé, 81 transitions testées |

## Questions ouvertes

1. **Échec avant d'arriver** : le §5 n'autorise `DELIVERY_FAILED` que depuis `ARRIVED`. Faut-il aussi l'autoriser depuis `PICKED_UP` (ex. « adresse incorrecte ») ?
2. **Région Neon** : le projet est en `aws-us-east-1` (Virginie), loin d'Abidjan. À envisager : recréer en `aws-eu-central-1` (Francfort) avant la mise en production.
3. `docs/mvp.md` prévoit PostgreSQL sur le VPS : la décision d'utiliser **Neon** n'y est pas encore reportée.
4. **Logo** : pas encore de logo (signature texte « Ofika Delivery » en attendant). Couleurs décidées : voir `design-system.md`.

## Reporté aux phases suivantes

- Numérotation des tentatives (`delivery_attempts`) lors d'une nouvelle tentative.
- Prix facturé (`billed_price`) figé au passage à `DELIVERED`.
- Ancrage externe du journal d'audit (détecter la suppression des derniers événements).
- `npx eslint src` ne se termine pas (bloqué > 5 min) : à diagnostiquer.
- Blocage des essais de connexion en mémoire : à passer en base si l'app tourne sur plusieurs processus.
- La fonction Neon `hello` est publique (renvoie seulement un état de santé) : les vraies fonctions devront exiger une authentification.

## Organisation technique

### Git / GitHub
- Dépôt : `chepa-BuildSphere/liv.ofika`. Branche par défaut et de travail : **`develop`**. `main` = production.
- Un commit par tâche, poussé sur `develop`.

### Neon (base de données)
- Projet `ofika-delivery` (`wandering-bar-66611848`), région `aws-us-east-1`.
- Branche **`dev`** : liée au dossier local (`.neon`, `.env.local`), migrations appliquées. On développe et on teste ici.
- Branche **`production`** : vide, **ne pas y toucher** avant la mise en ligne. Ce jour-là : `neon checkout production` puis `npm run db:migrate`.
- Services déclarés dans `neon.ts` : Postgres, Functions (`hello`), Realtime.

### Commandes utiles
| Commande | Rôle |
|---|---|
| `npm run dev` | App en local sur http://localhost:5000 |
| `npm test` | Tests unitaires (sans réseau) |
| `npm run test:db` | Tests sur la base `dev` (transaction annulée, refuse `production`) |
| `npm run db:generate` / `db:migrate` | Créer / appliquer les migrations |
| `npm run db:verify` | Vérifier tables, triggers et protection de l'audit |
| `npm run audit:verify` | Vérifier l'intégrité de la chaîne d'audit |
| `npm run smoke:neon` | Tester Postgres + Function + Realtime (app lancée) |
| `npm run admin:create -- --email … --name "…"` | Créer un admin plateforme (mot de passe affiché une fois) |

### Secrets
- `.env.local` (jamais commité) : variables Neon + `APP_URL` + `ENCRYPTION_KEY`.
- **`ENCRYPTION_KEY` doit être sauvegardée** : la perdre rend illisibles les secrets webhook chiffrés.
