# Découpage du MVP en tâches

> Une tâche = un petit morceau qu'on code, qu'on teste et qu'on **valide** avant de passer à la suivante.
> On suit l'ordre : chaque phase s'appuie sur la précédente.
> Référence : `mvp.md` (le quoi) et `base-de-donnees.md` (la structure).

---

## Phase 0 — Fondations

| # | Tâche | Validée quand… |
|---|---|---|
| 0.1 | Créer le projet Next.js (TypeScript) + dépôt GitHub | Le projet démarre en local |
| 0.2 | Installer PostgreSQL en local + Drizzle, copier `src/db/schema/` | `drizzle-kit generate` produit les migrations sans erreur |
| 0.3 | Appliquer les migrations + `sql/001_audit_append_only.sql` | Un `UPDATE audit_events` est refusé par la base |
| 0.4 | Fichier `.env.example` (DATABASE_URL, clé de chiffrement, URL publique) | Aucun secret dans le dépôt |
| 0.5 | Fonctions utilitaires : hachage (PIN, codes, jetons), génération aléatoire sûre, chiffrement du secret webhook | Tests unitaires verts |
| 0.6 | Service **journal d'audit** : `logEvent()` avec chaînage `prev_hash` → `hash` + fonction de vérification de la chaîne | Modifier une ligne à la main → la vérification détecte la rupture |
| 0.7 | Service **changement de statut** : table des transitions autorisées (§5) + transaction (statut + audit) | `CREATED → DELIVERED` est refusé |

## Phase 1 — Comptes et droits

| # | Tâche | Validée quand… |
|---|---|---|
| 1.1 | Connexion admin plateforme + back-office minimal | Tu te connectes |
| 1.2 | Création d'une entreprise + de son premier admin | L'admin entreprise reçoit ses accès |
| 1.3 | Connexion des utilisateurs d'entreprise + sessions | Connexion et déconnexion OK |
| 1.4 | Gestion des utilisateurs et rôles multiples (admin entreprise) | Un utilisateur peut être gestionnaire + resp. retours |
| 1.5 | **Contrôle des droits côté serveur** : un garde unique qui applique la matrice §4.2 | Chaque ligne de la matrice a un test |
| 1.6 | **Cloisonnement** : filtre `company_id` obligatoire | Test : l'entreprise A ne voit rien de l'entreprise B |
| 1.7 | Journalisation des consultations du support (`SUPPORT_VIEW`) | Visible par l'admin entreprise |

## Phase 2 — Livreurs

| # | Tâche | Validée quand… |
|---|---|---|
| 2.1 | Créer un livreur / le rattacher à une entreprise (employé ou indépendant) | Un même téléphone = un seul livreur, rattachable à 2 entreprises |
| 2.2 | Premier accès : le livreur choisit son **PIN à 6 chiffres** | PIN stocké haché |
| 2.3 | Connexion PWA : téléphone + PIN, blocage après essais faux | Connexion OK, blocage OK |
| 2.4 | Enregistrement de l'empreinte de l'appareil du livreur à la connexion | Visible en base |
| 2.5 | Détacher un livreur | Il ne voit plus les colis de cette entreprise |

## Phase 3 — Livraisons (côté entreprise)

| # | Tâche | Validée quand… |
|---|---|---|
| 3.1 | Créer une livraison à la main | Statut `CREATED` + événement d'audit |
| 3.2 | Import CSV/Excel avec rapport d'erreurs ligne par ligne | 100 lignes importées, lignes fausses signalées |
| 3.3 | Liste + filtres (statut, livreur, date) | Filtres OK |
| 3.4 | Modifier / annuler (seulement avant prise en charge) | Refus après `PICKED_UP` |
| 3.5 | Affecter / réaffecter un livreur | `ASSIGNED`, le livreur voit le colis |
| 3.6 | Détail d'une livraison + **timeline** de l'historique | Tous les événements affichés |
| 3.7 | Bordereau PDF (avec QR de **référence**) | Le PDF se génère |

## Phase 4 — PWA livreur et validation (le cœur)

| # | Tâche | Validée quand… |
|---|---|---|
| 4.1 | PWA installable (manifest, icônes), utilisable dans Chrome Android | Fonctionne sans installation |
| 4.2 | « Mes colis », regroupés par entreprise | Le livreur ne voit que ses colis |
| 4.3 | Prise en charge (un colis ou plusieurs) | `PICKED_UP` + heure serveur |
| 4.4 | « Arrivé chez le destinataire » + GPS | `ARRIVED`, tentative créée et numérotée |
| 4.5 | Génération du **QR** (jeton haché, 3 min, compte à rebours, bouton « Nouveau QR ») | L'ancien QR est invalidé |
| 4.6 | **Page client** `/c/<jeton>` : génère le code à 4 chiffres, l'affiche en haut, enregistre localisation, empreinte et IP | Les données sont en base |
| 4.7 | Refus si l'appareil qui scanne est celui du livreur | Événement `SAME_DEVICE_REJECTED` |
| 4.8 | **Saisie du code** par le livreur : vérifications (bon code, 3 min, 3 essais, usage unique) | 3 codes faux → `QR_LOCKED` |
| 4.9 | Validation → `DELIVERED`, `proof_method = QR`, **prix figé**, verrouillage | Plus aucune modification possible |
| 4.10 | Mise à jour automatique des deux écrans (« Livré ✅ ») | Le client et le livreur voient la confirmation |
| 4.11 | Alerte `SUSPICIOUS_DEVICE_REUSE` | Même appareil sur 2 livraisons du même livreur → alerte |
| 4.12 | Affichage « hors ligne » clair dans la PWA | La validation est bloquée sans réseau |

## Phase 5 — Échecs, retours, Forcer Livré

| # | Tâche | Validée quand… |
|---|---|---|
| 5.1 | Déclaration d'échec : motif, commentaire (obligatoire si « Autre »), photo, GPS | `DELIVERY_FAILED` |
| 5.2 | Choix « Nouvelle tentative » (→ `PICKED_UP`) ou « Retour au dépôt » (→ `RETURNING`) | Tentatives illimitées |
| 5.3 | Écran « Réception des retours » regroupé par livreur + scan du QR de référence | Liste juste |
| 5.4 | Confirmation de réception (état, commentaire, photo) | `RETURN_RECEIVED`. Refusé si c'est le livreur lui-même |
| 5.5 | **Forcer Livré** (admin entreprise, motif obligatoire) | Affiché « Livré (forcé) » partout. Refusé pour un colis qu'il a livré lui-même |
| 5.6 | Bilan par livreur | Colis pris = livrés + retours + en cours |

## Phase 6 — API et webhooks

| # | Tâche | Validée quand… |
|---|---|---|
| 6.1 | Création, liste et révocation des clés API **test et production** (montrées une seule fois) | Une clé révoquée est refusée |
| 6.2 | Authentification API + endpoints de §9.2 (avec `reference` et `metadata`) | Tous testés |
| 6.3 | **Mode test** : `is_test` selon la clé, livraisons cachées par défaut, jamais envoyées aux livreurs, jamais facturées | Une clé test ne voit aucune livraison réelle, et inversement |
| 6.4 | Route `POST /v1/test/deliveries/{id}/simulate` (clé test uniquement) | Refusée avec une clé live |
| 6.5 | `Idempotency-Key` sur les `POST` | Deux envois identiques = une seule livraison |
| 6.6 | Configuration des webhooks **test et production** (URL, événements, secret) | Enregistrée |
| 6.7 | File d'envoi : contenu standard (`reference`, `metadata`, `livemode`…), signature HMAC avec horodatage, nouvelles tentatives avec délai croissant | Un site de test reçoit des webhooks signés et retrouve sa commande |
| 6.8 | Bouton **« Envoyer un webhook de test »** avec affichage de la réponse | Code de réponse et erreur visibles |
| 6.9 | Historique des envois + bouton « Renvoyer » | Visible par l'admin entreprise |
| 6.10 | Documentation développeur + guide « Brancher mon site en 15 minutes » | Un développeur extérieur branche un site sans aide |

## Phase 7 — Facturation

| # | Tâche | Validée quand… |
|---|---|---|
| 7.1 | Back-office : bouton **Facturation ON/OFF** + **prix par livraison** par entreprise | Chaque changement est historisé |
| 7.2 | Calcul du relevé mensuel (livrées, forcées comprises, au prix figé) | Le total est juste sur un jeu de test |
| 7.3 | Écran « Facturation » côté entreprise (lecture seule) | L'admin entreprise voit son relevé |
| 7.4 | « Marquer comme payé » (admin plateforme) | Le statut passe à `PAID` |

## Phase 8 — Tableau de bord et finitions

| # | Tâche | Validée quand… |
|---|---|---|
| 8.1 | Tableau de bord : livraisons du jour, par livreur, retours non réceptionnés, forcées, alertes | Chiffres justes |
| 8.2 | Option OTP visible mais « Bientôt disponible » (`otp_enabled = false`) | Impossible de l'activer |
| 8.3 | Notifications dans l'interface (livré, échec, retour) | Reçues par l'admin et le marchand |

## Phase 9 — Tests et mise en ligne

| # | Tâche | Validée quand… |
|---|---|---|
| 9.1 | Passer **toute la checklist** de `mvp.md` §13 | Toutes les cases cochées |
| 9.2 | Test terrain avec un vrai livreur sur un vrai téléphone Android | Une tournée complète sans blocage |
| 9.3 | Déploiement sur le **VPS** (HTTPS obligatoire pour le GPS et la PWA) + sauvegardes de la base | En ligne, sauvegarde testée |
