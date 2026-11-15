# Rapport d'audit : Ofika Delivery (phase 1, comptes et droits)

Date : 15/11/2026. Rédigé pour la recette de la phase 1 (tâches 1.1 à 1.7 de docs/taches-mvp.md).

## 1. Hypothèses retenues

- Environnement testé : développement local (http://localhost:5000), base Neon branche « dev ». Aucune URL de staging n'existe encore.
- Le compte admin plateforme de la recette est celui créé par le responsable avec npm run admin:create : son e-mail et son mot de passe sont à fournir aux testeurs (non lus par l'audit).
- Les testeurs créent eux-mêmes les entreprises et comptes de recette (Module 2), car aucune donnée de recette n'existe en base hormis les traces de tests automatiques (« Test E2E (dev) »).
- Les livraisons, livreurs, clés API et webhooks ne sont pas encore développés : hors périmètre, listés en annexe.

## 2. Fiche de contexte

| Axe | Constat | Statut | Source |
| :--- | :--- | :--- | :--- |
| Nature du projet | Plateforme web de gestion des livraisons avec preuve de livraison, multi-entreprises | Déduit | README.md, docs/mvp.md |
| Secteur et sous-secteur | Transport / livraison (dernier kilomètre) + SaaS B2B multi-entreprises | Déduit | docs/mvp.md §2 et §4 |
| Confiance sur le secteur | Élevé | | Indices : statuts de colis (src/lib/deliveries/transitions.ts), QR et code de remise (proofs.ts), rôles Livreur / Resp. retours, cloisonnement par entreprise, clés API et webhooks |
| Vision et objectif métier | Prouver chaque livraison à Abidjan (QR + code dicté), sans application à installer | Déduit | docs/mvp.md |
| Utilisateurs cibles | Admin plateforme (éditeur), admin entreprise, gestionnaire, responsable retours, livreur, destinataire | Déduit | docs/mvp.md §3 |
| Conformité applicable | Côte d'Ivoire, loi n° 2013-450 (données personnelles, ARTCI) ; traçabilité des accès support (règle 9) | Déduit | docs/mvp.md §4.1 |
| Environnements et URL | Local http://localhost:5000 uniquement ; base Neon branche dev | Déduit | package.json, docs/avancement.md |
| Stade du projet | MVP en construction : phases 0 et 1 terminées | Déduit | docs/avancement.md |
| Identité visuelle | Fond blanc, texte noir, actions orange #C2410C ; pas de logo (signature texte « Ofika Delivery ») | Déduit | docs/design-system.md |

## 3. Stack et arborescence

Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS 4, PostgreSQL Neon + Drizzle. Sessions en base, cookies ofika_admin (back-office) et ofika_session (espace entreprise).

## 4. Modules et fonctionnalités

| Module | Fonctionnalités | Rôles | Sources |
| :--- | :--- | :--- | :--- |
| Connexion back-office | Connexion, erreur, blocage 15 min après 5 échecs, déconnexion, redirection | Admin plateforme | /admin/login, src/app/admin/login, src/lib/auth/platform-admin.ts, login-throttle.ts |
| Entreprises | Tableau de bord, création entreprise + premier admin, lien d'activation 48 h, fiche, nouveau lien | Admin plateforme | /admin, /admin/companies/new, /admin/companies/[id], src/lib/companies/create-company.ts |
| Activation | Page du lien, choix du mot de passe (10 caractères min.), usage unique, lien remplacé | Utilisateur invité | /activer/[jeton], src/lib/auth/activation.ts |
| Connexion entreprise | Connexion, erreurs, blocage, déconnexion, compte non activé refusé | Utilisateurs d'entreprise | /connexion, /espace, src/lib/auth/company-user.ts |
| Équipe | Invitation avec rôles cumulables, modification des rôles, désactivation / réactivation, nouveau lien, dernier admin protégé | Admin entreprise | /espace/equipe, src/lib/team/team.ts |
| Droits et cloisonnement | Matrice §4.2, entreprise A / B isolées | Tous | src/lib/auth/permissions.ts, src/lib/tenant/scope.ts |
| Support | Consultation de la fiche entreprise journalisée, visible dans l'espace entreprise | Admin plateforme, admin entreprise, gestionnaire | src/lib/support/support-view.ts, src/app/espace/support-views.tsx |

## 5. Rôles et permissions (phase 1)

| Rôle | Peut faire | Ne doit pas pouvoir faire |
| :--- | :--- | :--- |
| Admin plateforme | Créer une entreprise et son premier admin, voir les fiches (journalisé) | Ouvrir l'espace entreprise avec son compte, gérer l'équipe d'une entreprise |
| Admin entreprise | Inviter, modifier les rôles, désactiver / réactiver, voir les consultations du support | Se désactiver, retirer le dernier admin, voir une autre entreprise, ouvrir /admin |
| Gestionnaire | Se connecter, voir les consultations du support | Ouvrir l'équipe (message de refus) |
| Responsable retours | Se connecter | Voir l'équipe, voir les consultations du support |

## 6. Comptes de test détectés

| Profil | E-mail | Mot de passe | Rôle | Source |
| :--- | :--- | :--- | :--- | :--- |
| Admin plateforme | À FOURNIR | À FOURNIR | Back-office | npm run admin:create (responsable) |
| Admins, gestionnaires, resp. retours | Créés pendant la recette (Modules 2 et 5) | Choisis par le testeur | Espace entreprise | Préparation avant la recette |

## 7. Profil sectoriel

| Fonctionnalité standard | État | Remarque |
| :--- | :--- | :--- |
| Création d'organisation, invitation, rôles d'équipe | Présente | Phase 1 |
| Isolation des données entre organisations | Présente | Risque P1 du profil SaaS B2B |
| Journal d'audit | Présent (technique) | Consultations du support visibles ; journal complet non affiché |
| Mot de passe oublié | Absente | Annexe |
| Suspension d'entreprise | Absente de l'interface | Logique présente, pas d'écran : annexe |
| Livraisons, livreurs, preuve, API, webhooks, facturation | Absents | Phases 2 à 7 |

Parcours retenus : création d'entreprise jusqu'à la connexion de l'admin ; constitution d'une équipe multi-rôles ; consultation support visible par l'entreprise. Risques P1 : accès sans droit, fuite entre entreprises, lien d'activation réutilisable.

## 8. Cas limites et points de vigilance

| Point | Où | Priorité |
| :--- | :--- | :--- |
| Blocage en mémoire : repart à zéro au redémarrage du serveur | src/lib/auth/login-throttle.ts | P2 |
| Lien d'activation affiché une seule fois | Création entreprise, invitation | P1 |
| Expiration 48 h difficile à tester en séance | /activer | P3 |
| Base Neon en us-east-1 : lenteur possible (plusieurs secondes) | Toutes les pages | P3 |

## 9. Zones d'ombre et questions

1. E-mail et mot de passe du compte admin plateforme de recette : à fournir par le responsable.
2. Une URL de staging accessible aux testeurs est-elle prévue ? Sinon, la recette se fait sur le poste du responsable.

## 10. Plan du cahier

| Module de recette | Tests | Dont P1 |
| :--- | :--- | :--- |
| 1 Connexion au back-office | 6 | 3 |
| 2 Création d'une entreprise | 8 | 3 |
| 3 Activation du compte | 6 | 3 |
| 4 Connexion à l'espace entreprise | 6 | 2 |
| 5 Gestion de l'équipe | 9 | 3 |
| 6 Droits et cloisonnement | 6 | 4 |
| 7 Consultations du support | 4 | 1 |
| 8 Parcours de bout en bout | 3 | 3 |
| 9 Affichage mobile et clavier | 4 | 0 |
