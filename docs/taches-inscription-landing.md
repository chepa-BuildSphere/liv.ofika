# Découpage : Inscription Directe Business & Refonte Page d'Accueil

Ce document formalise les tâches et micro-tâches pour répondre aux exigences de la demande `/goal` :
1. Permettre aux entreprises clientes de s'inscrire directement en ligne (self-service signup) et d'obtenir un compte Administrateur Entreprise immédiatement opérationnel.
2. Expliquer clairement le fonctionnement du service, les étapes pour l'obtenir et la tarification transparente sur la page d'accueil (`/`).

---

## Phase A — Service Métier d'Auto-Inscription (`src/lib/companies/register-company.ts`)
- [x] **Tâche A.1** : Définition des types et validation stricte des données (`validateRegisterCompany`) : nom de l'entreprise, téléphone, nom de l'admin, email unique, téléphone mobile, mot de passe (min 10 caractères avec confirmation).
- [x] **Tâche A.2** : Implémentation de la fonction atomique `registerCompanyWithAdmin(db, input, meta)` :
  - Génération d'un slug unique d'entreprise.
  - Insertion de l'entreprise avec statut `ACTIVE` et tarif par défaut (10 F CFA / livraison livrée).
  - Hachage sécurisé du mot de passe avec `hashSecret`.
  - Insertion de l'administrateur avec `isActive: true` et `activatedAt: now`.
  - Attribution du rôle `COMPANY_ADMIN` dans `userRoles`.
  - Émission des événements d'audit cryptographiques `COMPANY_REGISTERED` et `USER_REGISTERED`.
  - Création de la session d'authentification pour connexion immédiate.
- [x] **Tâche A.3** : Tests unitaires complets (`src/lib/companies/register-company.test.ts`) vérifiant validations, unicité email, création de session et audit.

---

## Phase B — Formulaire & Page d'Inscription Business (`src/app/inscription/`)
- [x] **Tâche B.1** : Action serveur `registerCompanyAction` dans `src/app/inscription/actions.ts` posant le cookie de session et redirigeant vers `/espace`.
- [x] **Tâche B.2** : Composant interactif `CompanyRegisterForm` (`src/app/inscription/company-register-form.tsx`) avec les standards du design system (icônes vectorielles, focus rings orange `#C2410C`, bascules mot de passe, messages d'erreurs clairs).
- [x] **Tâche B.3** : Page d'inscription `/inscription/page.tsx` responsive, avec réassurance B2B, garanties de sécurité et liens d'accès.
- [x] **Tâche B.4** : Mise à jour de la page de connexion `/connexion/page.tsx` pour lier directement vers `/inscription` (« Créer un compte entreprise »).

---

## Phase C — Refonte et Enrichissement de la Page d'Accueil (`src/app/page.tsx`)
- [x] **Tâche C.1** : **Hero Section enrichie** :
  - Titre percutant axé sur la fin des contestations de livraison en Côte d'Ivoire / Afrique de l'Ouest.
  - Badges de réassurance (Sans engagement, 10 F CFA / livraison, démarrage en 2 minutes).
  - Double CTA : « Créer mon compte entreprise » (vers `/inscription`) et « Accès livreur terrain ».
- [x] **Tâche C.2** : **Section "Comment ça marche" (Les 3 étapes)** :
  1. *Création & Affectation* : Saisie ou import CSV des commandes, affectation aux livreurs.
  2. *Tournée & Arrivée GPS* : Application mobile pour les livreurs, horodatage et GPS lors de l'arrivée.
  3. *Validation bilatérale infalsifiable* : Scan du QR code par le client + code secret à 4 chiffres dicté au livreur.
- [x] **Tâche C.3** : **Section Tarifs Transparente & Sans Surprise** :
  - 10 F CFA par livraison réussie (les échecs et retours sont gratuits).
  - 0 F d'abonnement, 0 F de frais cachés.
  - Facturation mensuelle officielle téléchargeable.
  - Période d'essai et mode test inclus pour les développeurs / intégrateurs.
- [x] **Tâche C.4** : **Section Cas d'Usage & Comparatif** :
  - E-commerçants, Grossistes & Boutiques physiques d'Abidjan.
  - Comparatif avant / après : fini le « J'ai rien reçu » ou « J'ai déjà livré ».
- [x] **Tâche C.5** : **FAQ & CTA Final d'engagement** :
  - Questions fréquentes : installation d'application ? livreurs indépendants ? connexion au site e-commerce ?
  - Grand bandeau final invitant à créer son compte en 2 minutes.

---

## Phase D — Validation, Contrôles & Tests Globaux
- [x] **Tâche D.1** : Vérification TypeScript stricte (`npx tsc --noEmit`) ➜ 0 erreur.
- [x] **Tâche D.2** : Vérification du cloisonnement multi-tenant (`tenant-guard.test.ts`) ➜ 5 tests passés.
- [x] **Tâche D.3** : Exécution de l'ensemble de la suite de tests unitaires et intégration (`npx vitest run`) ➜ 16 fichiers, 269 tests passés.
- [x] **Tâche D.4** : Mise à jour des documents d'avancement et rapport complet pour l'utilisateur.
