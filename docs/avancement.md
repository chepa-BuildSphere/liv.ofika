# Avancement du projet

> Mis à jour le 15/11/2026. À relire en début de session.
> Le découpage des tâches est dans `taches-mvp.md`.

## Où on en est

| Phase | État |
|---|---|
| **Phase 0 — Fondations** | ✅ Terminée (0.1 → 0.7) |
| Phase 1 — Comptes et droits | 🔄 En cours : 1.1 et 1.2 faites → prochaine **tâche 1.3** (connexion des utilisateurs d'entreprise + sessions) |

### Détail de la phase 1

| # | Tâche | Preuve |
|---|---|---|
| 1.1 | Connexion admin plateforme + back-office `/admin` | 7 tests base (`npm run test:db`) + test navigateur : redirection sans session, mauvais mot de passe refusé, connexion, déconnexion |
| 1.2 | Création entreprise + premier admin, lien d'activation | 7 tests base + test navigateur : création, lien affiché, activation, lien réutilisé refusé, « Activé » au tableau de bord |

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
4. **Identité visuelle** : aucune couleur ni logo défini (gris neutres + vert/orange/rouge pour les états). À fournir ou à créer.

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
