# Cahier de Recette : Ofika Delivery

## Informations générales

| Élément | Valeur |
| :--- | :--- |
| Plateforme | Ofika Delivery, gestion des livraisons B2B avec preuve certifiée (Abidjan) |
| Environnement | Développement & Recette (poste local / base Neon Cloud PostgreSQL) |
| URL principale | http://localhost:5000 (redirections canoniques anglaises actives) |
| Version testée | **MVP Complet — Phases 0 à 8 + Auto-inscription directe & Landing SEO** |
| Périmètre couvert | **End-to-End complet** : Landing page SEO (`/`), Auto-inscription entreprise (`/register`), Connexion business (`/login`), Back-office super admin (`/admin`), Équipe & rôles, Livreurs & Premier accès PIN (`/courier/first-access`), PWA Livreur (`/courier`), Livraisons manuelles & Import CSV, Bordereau PDF avec QR, Prise en charge lot, Arrivée GPS certifiée, QR code bilatéral 3 min (`/c/[token]`) avec code secret 4 chiffres, Déclaration d'échec & Réception des retours dépôt (`/dashboard/retours`), Forcer Livré avec motif, Facturation 10 F CFA & Relevé mensuel (`/dashboard/facturation`), Clés API test/live & Webhooks HMAC (`/dashboard/webhooks`). |

## Consignes aux testeurs

- Suivre les étapes dans l'ordre, sans en sauter. Cocher [ ] OK si le résultat observé correspond au résultat attendu, [ ] KO s'il ne correspond pas (et consigner le bug), [ ] NA si le test ne s'applique pas ou ne peut pas être exécuté.
- Comptes partagés : ne jamais modifier le mot de passe ni l'e-mail du compte admin plateforme, ni le désactiver. Les tests qui désactivent un compte ou provoquent un blocage se font avec les comptes créés par le testeur pendant la recette.
- Exécuter les modules dans l'ordre : chaque module s'appuie sur les comptes et données créés dans les précédents.
- La base est hébergée sur Neon Cloud : une page peut mettre jusqu'à 3 à 5 secondes à répondre lors du réveil du compute. Une lenteur seule n'est pas un KO, sauf au-delà de 15 secondes.
- Légende des priorités : **P1** critique (bloque la mise en service), **P2** important, **P3** mineur.
- Aucun test n'a d'effet réel (pas d'e-mail ni de SMS envoyé par la plateforme). Le bouton « Envoyer par WhatsApp » ouvre WhatsApp mais n'envoie rien tant qu'on n'appuie pas sur Envoyer dans WhatsApp.

**Procédure obligatoire en cas de bug :**

> Si une étape échoue ou présente une anomalie :
> 1. Faire une capture d'écran nette de l'écran ou de l'erreur.
> 2. Noter la référence exacte du test (ex. : Module 1 - Test 1.2).
> 3. Consigner l'incident dans le document de suivi BUGS_ET_AMELIORATIONS avec la capture.

## Répertoire des comptes de test prêts à l'emploi

Ces comptes ont été pré-configurés sur la base de test Neon pour permettre une recette immédiate :

| Profil | Nom / Fonction | E-mail / Identifiant | Mot de passe / PIN | Téléphone | Rôle & Espace |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Super Admin Plateforme | `admin.recette@ofika.test` | `i_QzPH8yeKc2GVCs_H92l4VI` | Aucun | Back-office plateforme (`/admin/login`) |
| 2 | Awa Touré, Admin Entreprise (« Test E2E (dev) ») | `awa.e2e@ofika.test` | `Ofika-Test-2026!` | +225 07 01 02 03 04 | Admin entreprise (`/login` ou `/connexion`) |
| 3 | Koffi N'Goran, Gestionnaire (« Test E2E (dev) ») | `kofi.e2e@ofika.test` | `Ofika-Test-2026!` | +225 07 05 06 07 08 | Gestionnaire et Resp. retours (`/login`) |
| 4 | Kwamé Test, Livreur salarié rattaché | `07 11 22 33 44` | PIN : `123456` | +225 07 11 22 33 44 | PWA Livreur (`/courier` ou `/livreur`) |
| 5 | Aya Traoré (À créer au Module 5) | `aya.recette@ofika.test` | `Aya-Recette-2026` | Aucun | Responsable retours (Module 5) |
| 6 | Moussa Diallo (À créer au Module 2) | `moussa.recette@ofika.test` | `Moussa-Recette-2026` | +225 01 01 01 01 01 | Admin 2nde entreprise (Test cloisonnement) |
| 7 | Marcelle Bamba (À tester au Module 11) | `marcelle.cocody@ofika.test` | `Marcelle-Cocody-2026` | +225 07 88 88 88 88 | Auto-inscription entreprise (`/register`) |

Préparation avant la recette : le responsable démarre l'application (npm run dev), vérifie que http://localhost:5000/admin/login s'ouvre, et remet aux testeurs l'e-mail et le mot de passe du compte 1. Les comptes 2 à 5 n'existent pas encore : ils sont créés par les tests eux-mêmes. Si la recette est rejouée, ajouter un suffixe aux e-mails (awa.recette2@ofika.test…), car un e-mail ne peut servir qu'une fois.

## Module 1 : Connexion au back-office plateforme

Pré-requis du module : navigateur Chrome sur ordinateur, aucune session ouverte (fenêtre de navigation privée conseillée). Compte 1 du répertoire.

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.1 | P1 | Accès au back-office refusé sans connexion | 1. Ouvrir une fenêtre de navigation privée. 2. Aller sur http://localhost:5000/admin. | La page bascule sur http://localhost:5000/admin/login. Elle affiche « Ofika Delivery », le titre « Back-office plateforme » et « Accès réservé à l'éditeur. ». Aucun chiffre ni aucune entreprise n'est visible. | [ ] OK [ ] KO [ ] NA |
| 1.2 | P1 | Connexion avec un mauvais mot de passe | 1. Aller sur http://localhost:5000/admin/login. 2. Saisir l'e-mail du compte 1 dans « E-mail ». 3. Saisir Mauvais-Mot-2026 dans « Mot de passe ». 4. Cliquer sur « Se connecter ». | Le message « E-mail ou mot de passe incorrect. » apparaît sur fond rouge pâle. L'e-mail saisi reste dans le champ. L'adresse reste /admin/login. | [ ] OK [ ] KO [ ] NA |
| 1.3 | P2 | Un e-mail inconnu donne le même message | 1. Sur /admin/login, saisir personne.inconnue@ofika.test dans « E-mail ». 2. Saisir Mauvais-Mot-2026 dans « Mot de passe ». 3. Cliquer sur « Se connecter ». | Exactement le même message « E-mail ou mot de passe incorrect. » qu'au test 1.2 : rien n'indique que l'e-mail n'existe pas. | [ ] OK [ ] KO [ ] NA |
| 1.4 | P1 | Connexion réussie | 1. Sur /admin/login, saisir l'e-mail du compte 1. 2. Saisir son mot de passe. 3. Cliquer sur « Se connecter ». | L'adresse devient http://localhost:5000/admin. L'en-tête affiche « Back-office plateforme », « Ofika Delivery » et le bouton « Se déconnecter ». La page affiche « Bonjour » suivi du nom du compte, les cartes « Entreprises », « Livreurs », « Livraisons » et le bouton orange « Nouvelle entreprise ». | [ ] OK [ ] KO [ ] NA |
| 1.5 | P2 | Déjà connecté : la page de connexion renvoie au back-office | 1. Rester connecté après le test 1.4. 2. Aller sur http://localhost:5000/admin/login. | La page bascule d'elle-même sur http://localhost:5000/admin sans redemander le mot de passe. | [ ] OK [ ] KO [ ] NA |
| 1.6 | P2 | Déconnexion et retour arrière | 1. Sur /admin, cliquer sur « Se déconnecter ». 2. Cliquer sur le bouton « Précédent » du navigateur. 3. Recharger la page (touche F5). | Après l'étape 1, l'adresse est /admin/login. Après l'étape 3, la page reste ou revient sur /admin/login : le tableau de bord ne se réaffiche pas. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 2 : Création d'une entreprise cliente

Pré-requis du module : être connecté au back-office avec le compte 1 (test 1.4).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2.1 | P2 | Ouvrir le formulaire de création | 1. Aller sur http://localhost:5000/admin. 2. Cliquer sur « Nouvelle entreprise ». | L'adresse devient /admin/companies/new. Titre « Nouvelle entreprise ». Deux blocs : « Entreprise » (champs « Nom de l'entreprise », « Téléphone (facultatif) ») et « Premier admin de l'entreprise » (champs « Nom complet », « E-mail (identifiant de connexion) », « Téléphone WhatsApp (facultatif) »). Texte « Facturation par défaut : activée, 10 F CFA par livraison. Modifiable plus tard. » | [ ] OK [ ] KO [ ] NA |
| 2.2 | P2 | Saisies invalides refusées | 1. Saisir A dans « Nom de l'entreprise ». 2. Saisir 12 dans « Téléphone (facultatif) ». 3. Saisir B dans « Nom complet ». 4. Saisir awa@pas-valide dans « E-mail (identifiant de connexion) ». 5. Cliquer sur « Créer l'entreprise et générer le lien ». | Sous chaque champ fautif, en rouge : « Entre 2 et 100 caractères. » (nom de l'entreprise et nom complet), « Numéro invalide (ex. +225 07 00 00 00 00). » (téléphone), « E-mail invalide. ». Les valeurs saisies restent dans les champs. Aucune entreprise n'est créée (à vérifier au test 2.5). | [ ] OK [ ] KO [ ] NA |
| 2.3 | P1 | Créer « Boutique Awa Recette » et son admin | 1. Remplacer les valeurs : « Nom de l'entreprise » = Boutique Awa Recette, « Téléphone (facultatif) » = +225 27 22 00 00 00, « Nom complet » = Awa Koné, « E-mail (identifiant de connexion) » = awa.recette@ofika.test, « Téléphone WhatsApp (facultatif) » = +225 07 07 07 07 07. 2. Cliquer sur « Créer l'entreprise et générer le lien ». | Le texte « L'entreprise Boutique Awa Recette est créée. Envoyez le lien ci-dessous à son admin : il y choisira son mot de passe. » s'affiche. Un encadré vert « Lien d'activation pour Awa Koné » montre un lien qui commence par http://localhost:5000/activer/, la mention « Valable jusqu'au » suivie d'une date 2 jours plus tard, et « une seule fois. Il ne sera plus affiché : envoyez-le maintenant. ». | [ ] OK [ ] KO [ ] NA |
| 2.4 | P2 | Copier le lien et préparer l'envoi WhatsApp | 1. Cliquer sur « Copier le lien ». 2. Coller (Ctrl+V) dans le Bloc-notes et enregistrer ce lien sous le nom « lien-awa ». 3. Cliquer sur « Envoyer par WhatsApp ». | Après l'étape 1, le bouton affiche « Copié » pendant 2 secondes. Le lien collé est identique à celui de l'encadré. L'étape 3 ouvre WhatsApp (ou wa.me) avec le numéro 2250707070707 et un message qui commence par « Bonjour Awa Koné, voici votre lien pour activer votre compte Ofika Delivery ». Ne pas envoyer le message. | [ ] OK [ ] KO [ ] NA |
| 2.5 | P2 | L'entreprise apparaît au tableau de bord | 1. Sous l'encadré du lien, cliquer sur « Retour au tableau de bord ». 2. Regarder la carte « Entreprises » et le tableau. | La carte « Entreprises » a augmenté de 1. Le tableau contient la ligne « Boutique Awa Recette » avec « En attente d'activation » dans la colonne « Admin » et « 10 F CFA / livraison » dans « Facturation ». Aucune entreprise nommée « A » (test 2.2) n'existe. | [ ] OK [ ] KO [ ] NA |
| 2.6 | P1 | Un e-mail ne sert qu'une fois | 1. Cliquer sur « Nouvelle entreprise ». 2. Saisir Autre Boutique dans « Nom de l'entreprise », Test Doublon dans « Nom complet », awa.recette@ofika.test dans « E-mail (identifiant de connexion) ». 3. Cliquer sur « Créer l'entreprise et générer le lien ». | Sous le champ e-mail : « Cet e-mail est déjà utilisé par un autre compte. ». Aucune entreprise « Autre Boutique » n'apparaît au tableau de bord. | [ ] OK [ ] KO [ ] NA |
| 2.7 | P1 | Un nom contenant du code s'affiche tel quel | 1. Cliquer sur « Nouvelle entreprise ». 2. Saisir « <b>Test Code</b> » dans « Nom de l'entreprise », Code Test dans « Nom complet », code.recette@ofika.test dans l'e-mail. 3. Cliquer sur « Créer l'entreprise et générer le lien ». 4. Cliquer sur « Retour au tableau de bord ». | Le tableau de bord affiche le nom littéralement, avec les signes inférieur et supérieur visibles et sans mise en gras. Aucune fenêtre ni aucun comportement inattendu. | [ ] OK [ ] KO [ ] NA |
| 2.8 | P1 | Créer une seconde entreprise « Maquis Moussa Recette » | 1. Cliquer sur « Nouvelle entreprise ». 2. Saisir Maquis Moussa Recette, puis Moussa Diallo, moussa.recette@ofika.test et +225 01 01 01 01 01 dans les champs de l'admin. 3. Cliquer sur « Créer l'entreprise et générer le lien ». 4. Copier le lien avec « Copier le lien » et l'enregistrer sous le nom « lien-moussa ». 5. Ouvrir le lien dans une autre fenêtre privée et choisir Moussa-Recette-2026 dans « Mot de passe » et « Confirmer le mot de passe », puis cliquer sur « Activer mon compte ». | L'entreprise est créée (même message qu'au test 2.3). Après l'étape 5 : « Votre compte est activé. ». Cette seconde entreprise sert au Module 6 (cloisonnement). | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 3 : Activation du compte de l'admin entreprise

Pré-requis du module : le lien « lien-awa » enregistré au test 2.4, une nouvelle fenêtre de navigation privée (rôle : Awa Koné, qui reçoit le lien).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 3.1 | P1 | La page du lien présente la bonne personne | 1. Ouvrir le fichier « lien-awa » et copier le lien. 2. Le coller dans la barre d'adresse de la fenêtre privée et valider. | Titre « Activer mon compte ». Texte « Bonjour Awa Koné, choisissez votre mot de passe pour accéder à l'espace de Boutique Awa Recette. » et « Identifiant : awa.recette@ofika.test ». Deux champs « Mot de passe » (aide « Au moins 10 caractères. ») et « Confirmer le mot de passe ». | [ ] OK [ ] KO [ ] NA |
| 3.2 | P2 | Mot de passe trop court | 1. Saisir Court123 dans les deux champs. 2. Cliquer sur « Activer mon compte ». | Le compte n'est pas activé : le navigateur signale que le texte doit contenir au moins 10 caractères, ou la page affiche « Le mot de passe doit faire au moins 10 caractères. ». | [ ] OK [ ] KO [ ] NA |
| 3.3 | P2 | Les deux saisies doivent être identiques | 1. Saisir Awa-Recette-2026 dans « Mot de passe ». 2. Saisir Awa-Recette-2027 dans « Confirmer le mot de passe ». 3. Cliquer sur « Activer mon compte ». | Message rouge « Les deux mots de passe ne sont pas identiques. ». Le compte n'est pas activé. | [ ] OK [ ] KO [ ] NA |
| 3.4 | P1 | Activation réussie | 1. Saisir Awa-Recette-2026 dans les deux champs. 2. Cliquer sur « Activer mon compte ». | Encadré vert « Votre compte est activé. » puis « Vous vous connecterez avec awa.recette@ofika.test et le mot de passe que vous venez de choisir. » et un bouton orange « Se connecter ». | [ ] OK [ ] KO [ ] NA |
| 3.5 | P1 | Le lien ne sert qu'une fois | 1. Rester sur la page du lien après le test 3.4. 2. Recharger la page (F5). | Message « Ce lien a déjà été utilisé : votre compte est activé. ». Aucun formulaire de mot de passe n'est proposé. | [ ] OK [ ] KO [ ] NA |
| 3.6 | P2 | Un lien inventé est refusé | 1. Ouvrir une nouvelle fenêtre privée. 2. Aller sur http://localhost:5000/activer/lien-invente-123. | Message « Ce lien n'est pas valide. Il a peut-être été remplacé par un lien plus récent. » puis « Demandez un nouveau lien à la personne qui vous a invité. ». | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 4 : Connexion à l'espace entreprise

Pré-requis du module : compte 2 activé (test 3.4). Fenêtre de navigation privée.

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 4.1 | P2 | Espace refusé sans connexion | 1. Ouvrir une nouvelle fenêtre privée. 2. Aller sur http://localhost:5000/espace. | L'adresse devient http://localhost:5000/connexion. Titre « Connexion à votre espace ». | [ ] OK [ ] KO [ ] NA |
| 4.2 | P1 | Connexion de l'admin entreprise | 1. Sur /connexion, saisir awa.recette@ofika.test dans « E-mail ». 2. Saisir Awa-Recette-2026 dans « Mot de passe ». 3. Cliquer sur « Se connecter ». | L'adresse devient /espace. L'en-tête affiche « Ofika Delivery », « Boutique Awa Recette », le lien « Équipe », « Awa Koné » et « Se déconnecter ». Texte « Vous êtes connecté à l'espace de Boutique Awa Recette en tant que Admin entreprise. ». | [ ] OK [ ] KO [ ] NA |
| 4.3 | P2 | Mauvais mot de passe | 1. Se déconnecter. 2. Sur /connexion, saisir awa.recette@ofika.test et Faux-Mot-2026. 3. Cliquer sur « Se connecter ». | Message « E-mail ou mot de passe incorrect. ». L'adresse reste /connexion. | [ ] OK [ ] KO [ ] NA |
| 4.4 | P1 | Un compte invité mais pas encore activé ne peut pas se connecter | 1. Sur /connexion, saisir code.recette@ofika.test (créé au test 2.7, jamais activé). 2. Saisir Nimporte-Quoi-2026. 3. Cliquer sur « Se connecter ». | Message « E-mail ou mot de passe incorrect. ». Aucun accès à /espace. | [ ] OK [ ] KO [ ] NA |
| 4.5 | P2 | Blocage après 5 essais faux | 1. Sur /connexion, saisir moussa.recette@ofika.test et Faux-Mot-2026. 2. Cliquer 5 fois sur « Se connecter » (en attendant la réponse à chaque fois). 3. Saisir le bon mot de passe Moussa-Recette-2026. 4. Cliquer sur « Se connecter ». | Aux étapes 2, message « E-mail ou mot de passe incorrect. ». À l'étape 4, message « Trop d'essais. Réessayez dans 15 minutes. » malgré le bon mot de passe. Attendre 15 minutes (ou que le responsable redémarre l'application) avant le Module 6. | [ ] OK [ ] KO [ ] NA |
| 4.6 | P2 | Déconnexion | 1. Se connecter avec le compte 2. 2. Cliquer sur « Se déconnecter ». 3. Aller sur http://localhost:5000/espace. | Après l'étape 2, l'adresse est /connexion. À l'étape 3, la page revient sur /connexion. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 5 : Gestion de l'équipe et rôles multiples

Pré-requis du module : être connecté à l'espace entreprise avec le compte 2 (Awa Koné, admin entreprise).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 5.1 | P2 | Ouvrir la page Équipe | 1. Rester sur /espace après la connexion du compte 2. 2. Cliquer sur « Équipe » dans l'en-tête. | Adresse /espace/equipe. Titre « Équipe » et « Invitez vos collègues et choisissez leurs rôles. Une personne peut cumuler plusieurs rôles. ». La liste contient « Awa Koné (vous) », l'étiquette « Admin entreprise » et le statut « Actif ». | [ ] OK [ ] KO [ ] NA |
| 5.2 | P2 | Invitation sans rôle refusée | 1. Cliquer sur « Inviter un utilisateur ». 2. Saisir Kofi Yao dans « Nom complet » et kofi.recette@ofika.test dans « E-mail (identifiant) ». 3. Ne cocher aucun rôle. 4. Cliquer sur « Inviter et générer le lien ». | Message rouge « Choisissez au moins un rôle. ». Les champs gardent leurs valeurs. Kofi n'apparaît pas dans la liste. | [ ] OK [ ] KO [ ] NA |
| 5.3 | P1 | Inviter Kofi comme gestionnaire ET responsable retours | 1. Cocher « Gestionnaire » et « Responsable retours ». 2. Saisir +225 05 05 05 05 05 dans « Téléphone WhatsApp (facultatif) ». 3. Cliquer sur « Inviter et générer le lien ». 4. Copier le lien avec « Copier le lien » et l'enregistrer sous « lien-kofi ». 5. Dans une autre fenêtre privée, ouvrir « lien-kofi », saisir Kofi-Recette-2026 dans les deux champs et cliquer sur « Activer mon compte ». | Après l'étape 3 : « Kofi Yao est invité. Envoyez-lui ce lien : il y choisira son mot de passe. » et l'encadré du lien. Dans la liste : Kofi Yao avec les deux étiquettes « Gestionnaire » et « Responsable retours ». Après l'étape 5 : « Votre compte est activé. ». | [ ] OK [ ] KO [ ] NA |
| 5.4 | P2 | Inviter Aya comme responsable retours | 1. Cliquer sur « Inviter une autre personne ». 2. Saisir Aya Traoré et aya.recette@ofika.test. 3. Cocher « Responsable retours ». 4. Cliquer sur « Inviter et générer le lien ». 5. Activer le compte avec le lien (mot de passe Aya-Recette-2026), comme au test 5.3. | Aya Traoré apparaît avec l'étiquette « Responsable retours ». Après activation et rechargement de /espace/equipe, son statut passe de « Invitation envoyée : lien valable jusqu'au … » à « Actif ». | [ ] OK [ ] KO [ ] NA |
| 5.5 | P2 | Modifier les rôles d'un membre | 1. Sur la ligne de Kofi Yao, cliquer sur « Modifier les rôles ». 2. Décocher « Responsable retours ». 3. Cliquer sur « Enregistrer ». 4. Attendre 5 secondes. 5. Cliquer de nouveau sur « Modifier les rôles » de Kofi. | Après l'étape 4, Kofi n'a plus que l'étiquette « Gestionnaire ». À l'étape 5, l'éditeur « Rôles de Kofi Yao » s'ouvre avec seulement « Gestionnaire » coché. Cliquer sur « Annuler », puis recocher « Responsable retours » et enregistrer pour revenir à l'état du test 5.3. | [ ] OK [ ] KO [ ] NA |
| 5.6 | P1 | Le dernier admin ne peut pas perdre son rôle | 1. Sur la ligne « Awa Koné (vous) », cliquer sur « Modifier les rôles ». 2. Décocher « Admin entreprise » et cocher « Gestionnaire ». 3. Cliquer sur « Enregistrer ». | Message rouge « L'entreprise doit garder au moins un admin actif. ». Awa garde l'étiquette « Admin entreprise ». | [ ] OK [ ] KO [ ] NA |
| 5.7 | P2 | On ne peut pas se désactiver soi-même | 1. Rester sur /espace/equipe. 2. Regarder les boutons de la ligne « Awa Koné (vous) ». | Aucun bouton « Désactiver » sur sa propre ligne (seul « Modifier les rôles » est présent). | [ ] OK [ ] KO [ ] NA |
| 5.8 | P1 | Désactiver coupe l'accès immédiatement | 1. Dans une autre fenêtre privée, se connecter sur /connexion avec aya.recette@ofika.test et Aya-Recette-2026 et rester sur /espace. 2. Revenir à la fenêtre d'Awa, sur la ligne d'Aya Traoré cliquer sur « Désactiver ». 3. Confirmer la fenêtre « Désactiver Aya Traoré ? Ses sessions seront coupées immédiatement. ». 4. Dans la fenêtre d'Aya, recharger /espace (F5). | Après l'étape 3, Aya affiche le statut « Désactivé » et un bouton « Réactiver ». À l'étape 4, la fenêtre d'Aya bascule sur /connexion. Une nouvelle connexion d'Aya donne « E-mail ou mot de passe incorrect. ». | [ ] OK [ ] KO [ ] NA |
| 5.9 | P2 | Réactiver rend l'accès | 1. Sur la ligne d'Aya Traoré, cliquer sur « Réactiver ». 2. Dans la fenêtre d'Aya, se connecter avec aya.recette@ofika.test et Aya-Recette-2026. | Aya repasse à « Actif ». Sa connexion mène à /espace avec « en tant que Responsable retours ». | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 6 : Droits par rôle et cloisonnement entre entreprises

Pré-requis du module : comptes 2, 3, 4 et 5 activés. Une fenêtre de navigation privée par compte. Au moins 15 minutes après le test 4.5 (blocage du compte 5).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 6.1 | P1 | Le gestionnaire n'a pas accès à l'équipe | 1. Se connecter sur /connexion avec kofi.recette@ofika.test et Kofi-Recette-2026. 2. Vérifier l'en-tête. 3. Aller sur http://localhost:5000/espace/equipe. | À l'étape 2, pas de lien « Équipe » dans l'en-tête. À l'étape 3, message « La gestion de l'équipe est réservée à l'admin de l'entreprise. » et aucune liste de membres. Le texte d'accueil dit « en tant que Gestionnaire et Responsable retours ». | [ ] OK [ ] KO [ ] NA |
| 6.2 | P1 | Le responsable retours n'a pas accès à l'équipe | 1. Se connecter avec aya.recette@ofika.test et Aya-Recette-2026. 2. Aller sur http://localhost:5000/espace/equipe. | Message « La gestion de l'équipe est réservée à l'admin de l'entreprise. ». Aucun nom de collègue affiché. | [ ] OK [ ] KO [ ] NA |
| 6.3 | P1 | Une entreprise ne voit pas l'équipe d'une autre | 1. Se connecter avec moussa.recette@ofika.test et Moussa-Recette-2026. 2. Cliquer sur « Équipe ». | L'en-tête affiche « Maquis Moussa Recette ». La liste ne contient que « Moussa Diallo (vous) » : aucun nom de Boutique Awa Recette (Awa, Kofi, Aya). | [ ] OK [ ] KO [ ] NA |
| 6.4 | P2 | Un compte d'une autre entreprise ne peut pas être invité deux fois | 1. Toujours connecté en Moussa, cliquer sur « Inviter un utilisateur ». 2. Saisir Kofi Yao et kofi.recette@ofika.test, cocher « Gestionnaire ». 3. Cliquer sur « Inviter et générer le lien ». | Message sous l'e-mail « Cet e-mail est déjà utilisé par un autre compte. ». Kofi n'est pas ajouté chez Maquis Moussa Recette et reste dans Boutique Awa Recette. | [ ] OK [ ] KO [ ] NA |
| 6.5 | P1 | Un compte entreprise n'ouvre pas le back-office | 1. Dans une fenêtre privée, se connecter sur /connexion avec awa.recette@ofika.test et Awa-Recette-2026. 2. Dans la même fenêtre, aller sur http://localhost:5000/admin. | La page bascule sur /admin/login (« Back-office plateforme »). Aucun tableau de bord ni aucune entreprise n'est visible. | [ ] OK [ ] KO [ ] NA |
| 6.6 | P2 | Le compte admin plateforme n'ouvre pas l'espace entreprise | 1. Dans une nouvelle fenêtre privée, se connecter sur /admin/login avec le compte 1. 2. Dans la même fenêtre, aller sur http://localhost:5000/espace. | La page bascule sur /connexion : la session du back-office ne donne pas accès à l'espace d'une entreprise. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 7 : Consultations du support visibles par l'entreprise

Pré-requis du module : compte 1 (back-office) et comptes 2, 3, 4 et 5 (espace entreprise).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 7.1 | P1 | La consultation de la fiche est enregistrée et visible | 1. Dans le back-office (compte 1), cliquer sur « Boutique Awa Recette » au tableau de bord. 2. Noter l'heure affichée par l'ordinateur. 3. Dans la fenêtre d'Awa (compte 2), recharger /espace. | Sur la fiche : la mention « Consultation support enregistrée et visible par l'entreprise. ». Chez Awa, la section « Consultations du support Ofika » contient une ligne avec le nom du compte 1, « Fiche de l'entreprise et liste des utilisateurs » et l'heure notée à l'étape 2 (à 1 minute près). | [ ] OK [ ] KO [ ] NA |
| 7.2 | P3 | Pas de doublon en rechargeant la fiche | 1. Dans le back-office, recharger la fiche de Boutique Awa Recette 3 fois (F5). 2. Chez Awa, recharger /espace. | Toujours une seule nouvelle ligne pour ces consultations (les rechargements dans les 5 minutes ne sont pas comptés). | [ ] OK [ ] KO [ ] NA |
| 7.3 | P2 | Le gestionnaire voit les consultations, le responsable retours non | 1. Recharger /espace dans la fenêtre de Kofi (compte 3). 2. Recharger /espace dans la fenêtre d'Aya (compte 4). | Kofi voit la section « Consultations du support Ofika » avec la ligne du test 7.1. Aya ne voit pas cette section. | [ ] OK [ ] KO [ ] NA |
| 7.4 | P2 | L'autre entreprise ne voit pas ces consultations | 1. Dans la fenêtre de Moussa (compte 5), aller sur /espace. 2. Recharger la page (F5). | Section « Consultations du support Ofika » avec « Aucune consultation pour l'instant. » (aucune fiche de Maquis Moussa Recette n'a été ouverte), et aucune ligne concernant Boutique Awa Recette. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 8 : Parcours de bout en bout

Pré-requis du module : compte 1 connecté au back-office. Ces parcours rejouent la chaîne complète avec de nouvelles personnes.

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 8.1 | P1 | De la création de l'entreprise à la première connexion de son admin | 1. Étape jouée par l'admin plateforme : sur /admin, cliquer sur « Nouvelle entreprise », créer Pressing Fatou Recette avec l'admin Fatou Bamba, fatou.recette@ofika.test. 2. Copier le lien. 3. Étape jouée par Fatou : ouvrir le lien en fenêtre privée, choisir Fatou-Recette-2026, cliquer sur « Activer mon compte » puis sur « Se connecter ». 4. Se connecter avec fatou.recette@ofika.test et Fatou-Recette-2026. | Fatou arrive sur /espace avec « Pressing Fatou Recette » dans l'en-tête et « en tant que Admin entreprise ». Au tableau de bord du back-office, la ligne Pressing Fatou Recette passe de « En attente d'activation » à « Activé » après rechargement. | [ ] OK [ ] KO [ ] NA |
| 8.2 | P1 | Lien perdu : l'ancien lien est refusé, le nouveau fonctionne | 1. Étape jouée par l'admin plateforme : créer Atelier Ibrahim Recette avec l'admin Ibrahim Koffi, ibrahim.recette@ofika.test, copier le lien sous « lien-ibrahim-1 ». 2. Ouvrir la fiche « Atelier Ibrahim Recette » et cliquer sur « Générer un nouveau lien ». 3. Copier ce nouveau lien sous « lien-ibrahim-2 ». 4. Étape jouée par Ibrahim : ouvrir « lien-ibrahim-1 ». 5. Ouvrir « lien-ibrahim-2 » et activer avec Ibrahim-Recette-2026. | À l'étape 2, l'encadré du nouveau lien s'affiche et la mention « L'ancien lien ne fonctionnera plus. » est visible avant le clic. À l'étape 4 : « Ce lien n'est pas valide. Il a peut-être été remplacé par un lien plus récent. ». À l'étape 5 : « Votre compte est activé. ». Sur la fiche, Ibrahim affiche « Compte activé le » et la date du jour. | [ ] OK [ ] KO [ ] NA |
| 8.3 | P1 | L'admin entreprise constitue son équipe, l'équipe se connecte | 1. Étape jouée par Fatou (compte du test 8.1) : inviter Serge Kouassi, serge.recette@ofika.test, avec « Gestionnaire » et « Responsable retours ». 2. Étape jouée par Serge : activer le compte avec le lien (Serge-Recette-2026) puis se connecter. 3. Étape jouée par Fatou : sur /espace/equipe, désactiver Serge. 4. Étape jouée par Serge : recharger /espace. | Après l'étape 2, Serge voit « Pressing Fatou Recette » et « en tant que Gestionnaire et Responsable retours ». Après l'étape 4, Serge est renvoyé sur /connexion. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 9 : Affichage mobile et utilisation au clavier

Pré-requis du module : un téléphone Android avec Chrome sur le même réseau Wi-Fi que l'ordinateur du responsable (adresse à fournir par le responsable, de la forme http://192.168.x.x:5000), ou Chrome sur ordinateur en mode appareil mobile (touche F12 puis icône téléphone, largeur 375 px).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 9.1 | P2 | Connexion sur un écran de téléphone | 1. Ouvrir /connexion en largeur 375 px. 2. Se connecter avec awa.recette@ofika.test et Awa-Recette-2026. | Les champs et le bouton « Se connecter » occupent toute la largeur, sans défilement horizontal. Le clavier du téléphone ne zoome pas la page en touchant un champ. | [ ] OK [ ] KO [ ] NA |
| 9.2 | P3 | Page Équipe sur téléphone | 1. Passer le navigateur en largeur 375 px. 2. Ouvrir /espace/equipe connecté avec le compte 2. | Les lignes de membres passent sur plusieurs lignes ; les boutons « Modifier les rôles », « Nouveau lien », « Désactiver » restent lisibles et cliquables, sans texte coupé ni défilement horizontal. | [ ] OK [ ] KO [ ] NA |
| 9.3 | P3 | Formulaire de connexion au clavier seul | 1. Sur /admin/login, cliquer dans la barre d'adresse puis appuyer sur Tab jusqu'au champ « E-mail ». 2. Saisir l'e-mail, Tab, saisir le mot de passe, Tab, puis Entrée. | L'ordre de passage est « E-mail », « Mot de passe », « Se connecter ». Le champ actif est entouré d'orange. Entrée envoie le formulaire. | [ ] OK [ ] KO [ ] NA |
| 9.4 | P3 | Couleurs de la marque | 1. Ouvrir /connexion. 2. Se connecter avec le compte 2 et regarder /espace. 3. Ouvrir /admin dans la fenêtre du compte 1. | Fond blanc, textes noirs, boutons d'action principaux orange (« Se connecter », « Nouvelle entreprise », « Activer mon compte ») avec texte blanc lisible ; le mot « Delivery » de la signature est orange. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 10 : Landing Page Vitrine, SEO et Navigation Publique

Pré-requis du module : navigateur Chrome sur ordinateur et smartphone (ou simulateur 375 px). Aucune session active.

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 10.1 | P1 | Affichage de la page d'accueil vitrine | 1. Ouvrir une fenêtre de navigation privée. 2. Aller sur http://localhost:5000/. | La page d'accueil s'affiche rapidement avec le titre percutant sur la fin des palabres de livraison, l'illustration animée du colis scellé SHA-256 à Cocody, la section fonctionnement en 3 étapes, la tarification transparente, le comparatif terrain et l'accordéon FAQ. | [ ] OK [ ] KO [ ] NA |
| 10.2 | P1 | Ancres de navigation rapide | 1. Cliquer sur le lien « Fonctionnement » dans l'en-tête. 2. Cliquer sur le lien « Tarifs (10 F CFA) ». | L'écran défile en douceur vers `#how-it-works` (explications en 3 étapes) puis vers `#pricing` (carte tarifaire). | [ ] OK [ ] KO [ ] NA |
| 10.3 | P1 | Redirections canoniques 308 (SEO anglais) | 1. Saisir manuellement http://localhost:5000/inscription dans la barre d'adresse. 2. Saisir http://localhost:5000/connexion. 3. Saisir http://localhost:5000/livreur. 4. Saisir http://localhost:5000/espace. | Les requêtes sont redirigées automatiquement en code 308 vers les URL anglaises canoniques respectives : `/register`, `/login`, `/courier` et `/dashboard`. | [ ] OK [ ] KO [ ] NA |
| 10.4 | P2 | Carte tarifaire épurée sans bordure agressive | 1. Descendre sur la section `#pricing`. 2. Observer le cadre de l'offre « Formule Unique Business ». | La carte est sur fond blanc avec un contour subtil et ombre adoucie (`shadow-xl`), sans aucune bordure noire épaisse. Le tarif affiche « 10 F CFA / livraison livrée », 0 F abonnement et gratuit sur échecs/retours. | [ ] OK [ ] KO [ ] NA |
| 10.5 | P2 | Accordéon FAQ interactif | 1. Descendre sur la section « Questions fréquentes ». 2. Cliquer sur la question « Comment ça protège le livreur sur sa moto à Abidjan ? ». 3. Cliquer sur « Si le client refuse le colis ou n'a pas l'argent… ». | L'accordéon se déplie et se replie de manière fluide. Les explications concrètes sur la protection du livreur et la procédure de retour s'affichent lisiblement. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 11 : Auto-inscription Entreprise Directe en Libre-Service

Pré-requis du module : fenêtre de navigation privée sans session ouverte. Compte 8 du répertoire (Marcelle Bamba).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 11.1 | P1 | Accès au formulaire d'inscription | 1. Depuis la page d'accueil `/`, cliquer sur le bouton orange « Créer mon compte entreprise ». | L'adresse devient http://localhost:5000/register. Titre « Inscription Entreprise ». Le formulaire comporte : nom de l'entreprise, téléphone WhatsApp, nom complet de l'administrateur, e-mail de connexion, mot de passe et confirmation. | [ ] OK [ ] KO [ ] NA |
| 11.2 | P2 | Contrôle des saisies invalides | 1. Laisser tous les champs vides et cliquer sur « Créer mon compte et démarrer ». 2. Saisir un e-mail erroné (ex: `marcelle@test`). 3. Saisir un mot de passe de 6 caractères. | Les erreurs s'affichent sous chaque champ : nom requis, email valide requis, mot de passe d'au moins 10 caractères requis. Aucun compte n'est créé. | [ ] OK [ ] KO [ ] NA |
| 11.3 | P1 | Création réussie et connexion directe | 1. Saisir : Entreprise = « Super Marché Cocody », Téléphone = `+225 07 88 88 88 88`, Nom admin = « Marcelle Bamba », E-mail = `marcelle.cocody@ofika.test`, Mot de passe = `Marcelle-Cocody-2026`, Confirmation = `Marcelle-Cocody-2026`. 2. Cliquer sur « Créer mon compte et démarrer ». | L'inscription réussit instantanément sans carte bancaire. La page bascule directement sur http://localhost:5000/dashboard avec l'en-tête « Super Marché Cocody » et le rôle « Admin entreprise ». | [ ] OK [ ] KO [ ] NA |
| 11.4 | P1 | Rejet d'un e-mail déjà existant | 1. Se déconnecter. 2. Retourner sur `/register`. 3. Tenter de recréer une entreprise avec le même e-mail `marcelle.cocody@ofika.test`. | Message d'erreur clair : « Cet e-mail est déjà utilisé par un autre compte. Connectez-vous ou utilisez un autre e-mail. ». Aucun doublon n'est créé en base. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 12 : Gestion des Livreurs & Premier Accès PIN PWA

Pré-requis du module : être connecté à l'espace entreprise avec le compte 2 (Awa Koné). Téléphone mobile ou simulateur Chrome.

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 12.1 | P1 | Ajouter un coursier salarié et un indépendant | 1. Sur `/dashboard`, cliquer sur « Livreurs ». 2. Cliquer sur « Ajouter un livreur ». 3. Saisir « Kouassi Paul », téléphone `+225 07 10 10 10 10`, type « Salarié ». 4. Répéter l'opération pour « Diallo Sekou », téléphone `+225 05 20 20 20 20`, type « Indépendant ». | Les deux livreurs apparaissent dans la liste avec le statut « En attente du premier accès » et un bouton orange « Code d'accès ». | [ ] OK [ ] KO [ ] NA |
| 12.2 | P1 | Générer le code d'activation initial | 1. Sur la ligne de Kouassi Paul, cliquer sur « Code d'accès ». 2. Noter le code à 6 chiffres affiché et copier le lien d'accès. | Un encadré affiche un code temporaire valable 48h ainsi que le lien direct vers `/courier/first-access`. Bouton « Copier » et option d'envoi WhatsApp présents. | [ ] OK [ ] KO [ ] NA |
| 12.3 | P1 | Premier accès du livreur et choix du PIN | 1. Ouvrir une nouvelle fenêtre privée (vue smartphone). 2. Aller sur `/courier/first-access`. 3. Saisir le téléphone `07 10 10 10 10` et le code temporaire. 4. Saisir le code PIN `123456` dans les deux champs PIN et confirmer. | Message vert « Votre code PIN est configuré avec succès ! ». Bouton invitant à se connecter à l'espace livreur. | [ ] OK [ ] KO [ ] NA |
| 12.4 | P1 | Connexion PWA livreur avec téléphone + PIN | 1. Aller sur http://localhost:5000/courier/login. 2. Saisir le téléphone `07 10 10 10 10` et le code PIN `123456`. 3. Valider. | La page bascule sur `/courier`. Titre « Espace Livreur », nom « Kouassi Paul », badge de statut réseau « En ligne », onglets « À prendre en charge » et « En tournée ». | [ ] OK [ ] KO [ ] NA |
| 12.5 | P2 | Blocage de sécurité après 5 mauvais PIN | 1. Se déconnecter de l'espace livreur. 2. Sur `/courier/login`, saisir le téléphone et un faux PIN 5 fois de suite. | Au 5e essai erroné, le compte livreur est verrouillé pendant 15 minutes avec le message « Compte temporairement bloqué pour votre sécurité suite à plusieurs tentatives erronées. ». | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 13 : Création de Livraison, Import CSV & Bordereau PDF

Pré-requis du module : être connecté à l'espace entreprise avec le compte 2 (Awa Koné).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 13.1 | P1 | Créer une livraison manuelle avec affectation | 1. Sur `/dashboard`, cliquer sur « Livraisons ». 2. Cliquer sur « Nouvelle livraison ». 3. Remplir : Référence = `CMD-REC-001`, Destinataire = `Aïcha Koné`, Téléphone = `+225 07 01 02 03 04`, Commune = `Cocody`, Adresse = `Rue des Ambassades`, Montant COD = `18500`, Livreur = « Kouassi Paul ». 4. Valider. | La livraison est créée au statut `ASSIGNED` (Affectée). Elle apparaît dans le tableau avec le nom du livreur affecté, le montant COD de 18 500 F CFA et un badge jaune « Affectée ». | [ ] OK [ ] KO [ ] NA |
| 13.2 | P1 | Import groupé par fichier CSV | 1. Sur `/dashboard/livraisons`, cliquer sur « Importer un fichier CSV ». 2. Coller un bloc de 5 lignes au format `Référence;Destinataire;Téléphone;Adresse;Commune;Montant`. 3. Cliquer sur « Importer les livraisons ». | Le rapport d'importation confirme « 5 livraisons importées avec succès ». Les 5 courses apparaissent instantanément dans la liste au statut `CREATED`. | [ ] OK [ ] KO [ ] NA |
| 13.3 | P2 | Génération du bordereau officiel PDF avec QR | 1. Ouvrir la fiche de la commande `CMD-REC-001`. 2. Cliquer sur le bouton « Télécharger le bordereau PDF ». | Le fichier PDF est généré et téléchargé. Il contient les informations du destinataire, le montant à encaisser (18 500 F CFA), les mentions légales Ofika et le QR code officiel de référence scellé. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 14 : Tournée Livreur, Arrivée GPS & Validation Bilatérale QR Code

Pré-requis du module : commande `CMD-REC-001` affectée à Kouassi Paul (Module 13). Fenêtre mobile livreur (compte 6) et seconde fenêtre mobile client destinataire.

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 14.1 | P1 | Prise en charge des colis au dépôt | 1. Dans la session livreur `/courier`, onglet « À prendre en charge ». 2. Cocher la commande `CMD-REC-001`. 3. Cliquer sur « Confirmer la prise en charge (1 colis) ». | Le colis bascule dans l'onglet « En tournée » au statut `PICKED_UP`. Côté entreprise (`/dashboard`), le statut passe immédiatement à « En tournée ». | [ ] OK [ ] KO [ ] NA |
| 14.2 | P1 | Relevé de position « Arrivé chez le destinataire » | 1. Sur la carte du colis dans `/courier`, cliquer sur le bouton « Arrivé chez le destinataire ». 2. Autoriser la géolocalisation dans le navigateur. | Le bouton bascule en « Arrivé certifié GPS ». L'heure et les coordonnées GPS sont enregistrées avec précision. Le bouton « Générer le QR de remise » devient actif. | [ ] OK [ ] KO [ ] NA |
| 14.3 | P1 | Génération du QR code 3 minutes | 1. Cliquer sur « Générer le QR de remise ». | Un QR code haute visibilité s'affiche avec un compte à rebours de 3 minutes (180 secondes) et la consigne : « Faites scanner ce QR code au client avec son téléphone ». | [ ] OK [ ] KO [ ] NA |
| 14.4 | P1 | Scan client et affichage du code secret 4 chiffres | 1. Dans une fenêtre privée séparée (ou avec un autre téléphone simulant le client), ouvrir l'URL du QR code `/c/[token]`. | La page client s'affiche sans connexion requise. Elle récapitule l'expéditeur « Boutique Awa Recette » et affiche en grand le **Code secret de remise à 4 chiffres** (ex: `7429`) avec le message : « Dictez ce code à votre livreur pour sceller la réception ». | [ ] OK [ ] KO [ ] NA |
| 14.5 | P1 | Validation de la livraison par le livreur | 1. Dans l'écran du livreur, saisir le code à 4 chiffres dicté par le client. 2. Cliquer sur « Valider la livraison ». | Écran vert de confirmation immédiate : « Livraison certifiée avec succès ! ». Le colis disparaît de la tournée active. Côté entreprise, le statut passe à `DELIVERED` avec la mention « Preuve QR Code certifiée » et le prix unitaire figé à 10 F CFA. | [ ] OK [ ] KO [ ] NA |
| 14.6 | P1 | Règle anti-fraude : refus du même appareil | 1. Tenter d'ouvrir l'URL du QR code client `/c/[token]` dans le même navigateur / même profil que le livreur. | Le système bloque la tentative avec l'erreur `SAME_DEVICE_REJECTED` : « Impossible de valider la livraison sur le même appareil que le livreur ». Une alerte de sécurité `SUSPICIOUS_DEVICE_REUSE` est émise côté tableau de bord. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 15 : Déclaration d'Échec, Réception Retours Dépôt & Forcer Livré

Pré-requis du module : créer une nouvelle livraison `CMD-REC-002`, affectée et prise en charge par Kouassi Paul.

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 15.1 | P1 | Déclaration d'échec de livraison sur le terrain | 1. Dans l'espace livreur `/courier`, ouvrir la course `CMD-REC-002`. 2. Cliquer sur « Signaler un échec ». 3. Choisir le motif « Client absent / injoignable ». 4. Choisir l'issue « Retour au dépôt ». 5. Valider. | La livraison passe au statut `RETURNING` (En retour). Le numéro de téléphone du client est automatiquement masqué sur l'écran du livreur pour préserver la vie privée. | [ ] OK [ ] KO [ ] NA |
| 15.2 | P1 | Réception physique au magasin par scan QR | 1. Connecté en tant que responsable retours (compte 3 ou 4), aller sur `/dashboard/retours`. 2. Sélectionner « Kouassi Paul ». 3. Scanner le QR code du colis avec la caméra ou saisir la référence `CMD-REC-002`. 4. Cliquer sur « Confirmer la réception ». | La livraison passe au statut définitif `RETURN_RECEIVED`. Le livreur est libéré de sa charge pour ce colis. La tournée est soldée. | [ ] OK [ ] KO [ ] NA |
| 15.3 | P2 | Procédure exceptionnelle « Forcer Livré » | 1. Créer une course `CMD-REC-003`, prise en charge par un livreur dont le téléphone tombe en panne de batterie. 2. En tant qu'admin entreprise, ouvrir la fiche de la course. 3. Cliquer sur « Forcer Livré ». 4. Saisir le motif obligatoire « Téléphone livreur déchargé, confirmation téléphonique du client obtenue ». 5. Confirmer. | La course passe au statut `DELIVERED` avec la mention visible « Livré (manuel / forcé) ». Le motif et l'identité de l'administrateur sont inscrits dans la chaîne d'audit infalsifiable. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 16 : Facturation 10 F CFA & Pilotage Super Admin

Pré-requis du module : livraisons exécutées aux modules 14 et 15. Compte 1 (Super Admin) et compte 2 (Admin entreprise).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 16.1 | P1 | Compteur facturable côté entreprise | 1. Connecté avec Awa Koné (compte 2), aller sur `/dashboard/facturation`. 2. Observer le récapitulatif du mois en cours. | Le compteur affiche : livraisons livrées avec succès facturées à 10 F CFA l'unité. Les colis retournés ou échoués sont comptabilisés à 0 F CFA (gratuit). | [ ] OK [ ] KO [ ] NA |
| 16.2 | P1 | Pilotage Super Admin : modification du prix et période gratuite | 1. Dans le back-office `/admin`, ouvrir la fiche de « Boutique Awa Recette ». 2. Section Facturation : cliquer sur « Passer en période gratuite (OFF) ». 3. Modifier le prix par livraison à `8 F CFA`. | La facturation passe en statut OFF (0 F par livraison). L'historique des modifications consigne la date, l'ancien et le nouveau tarif. Tout est scellé dans l'audit. | [ ] OK [ ] KO [ ] NA |
| 16.3 | P2 | Relevé mensuel officiel et marquage « Payé » | 1. Dans le back-office, aller sur `/admin/facturation`. 2. Cliquer sur « Générer le relevé ». 3. Cliquer sur « Marquer comme payé ». | Le relevé mensuel passe au statut vert « Payé » avec la date et l'heure du paiement. Tout recalcul ultérieur de ce relevé est verrouillé. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 17 : Clés API Développeur & Webhooks en Temps Réel

Pré-requis du module : être connecté avec un compte administrateur entreprise (`/dashboard`).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 17.1 | P2 | Générer des clés API Test et Production | 1. Sur `/dashboard`, cliquer sur « Clés API ». 2. Cliquer sur « Créer une clé API ». 3. Choisir l'environnement « Test » puis créer. 4. Copier la clé générée. | La clé commençant par `ofk_test_` s'affiche en clair une seule fois avec un bouton Copier. Après rechargement, seul le préfixe masqué reste visible. | [ ] OK [ ] KO [ ] NA |
| 17.2 | P2 | Configuration d'un webhook et envoi d'un événement test | 1. Aller sur `/dashboard/webhooks`. 2. Cliquer sur « Ajouter un endpoint ». 3. Saisir l'URL `https://webhook.site/test` et sélectionner les événements de livraison. 4. Cliquer sur « Envoyer un webhook de test ». | Le secret `whsec_…` est généré. Le test envoie immédiatement une charge utile signée HMAC-SHA256 avec affichage du code HTTP retourné et de la latence en millisecondes. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 18 : Niveaux de Preuve Configurables & Preuves Visuelles (MVP 1)

Pré-requis du module : être connecté avec un compte entreprise (`/espace/livraisons`) et disposer d'un compte coursier rattaché sur PWA (`/livreur`).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 18.1 | P1 | Sélection du niveau de preuve à la création d'un colis | 1. Aller sur `/espace/livraisons`. 2. Ouvrir le formulaire de création manuelle. 3. Dérouler le champ « Niveau de preuve demandé ». | Les options suivantes sont proposées : Standard (QR + code), Renforcé (QR + OTP), Renforcé + Photo (`QR_PHOTO`), Maximal (`QR_PHOTO_SIGNATURE`), QR Inversé (`REVERSE_QR`). Sélectionner `QR_PHOTO` et créer le colis. | [ ] OK [ ] KO [ ] NA |
| 18.2 | P1 | Blocage de validation sans photo obligatoire sur PWA Livreur | 1. Sur la PWA livreur `/livreur`, prendre en charge le colis créé en 18.1. 2. Déclarer « Arrivé ». 3. Tenter de valider la remise par code à 4 chiffres sans joindre de photo. | La validation est bloquée : un message clair avertit le coursier que la photo du colis remis est obligatoire pour ce niveau de preuve. | [ ] OK [ ] KO [ ] NA |
| 18.3 | P1 | Validation réussie avec compression photo & affichage entreprise | 1. Cliquer sur « Prendre la photo du colis », sélectionner une image de test. 2. Observer la compression automatique. 3. Saisir le code à 4 chiffres et valider. 4. Côté entreprise, ouvrir la fiche `/espace/livraisons/[id]`. | La livraison passe à « Livré ». La photo compressée s'affiche distinctement dans la section « Preuves de Remise Certifiées » avec horodatage et niveau `QR_PHOTO`. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 19 : QR Inversé (Validation avec QR Destinataire - MVP 1)

Pré-requis du module : livraison créée avec le mode de preuve `REVERSE_QR`.

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 19.1 | P1 | Génération et affichage du QR Destinataire | 1. Créer une livraison avec mode « QR Inversé ». 2. Ouvrir le lien de suivi destinataire `/c/[token]`. | Un QR code sécurisé s'affiche pour le client avec la mention « Présentez ce QR au livreur à la réception de votre commande ». | [ ] OK [ ] KO [ ] NA |
| 19.2 | P1 | Scan / saisie du QR destinataire par le livreur sur la PWA | 1. Sur `/livreur`, ouvrir le colis. 2. Basculer sur l'onglet « 2. QR Destinataire (Inversé) ». 3. Saisir ou scanner la charge utile `OFIKA-REV:[REF]:[TOKEN]`. 4. Valider la remise. | La remise est instantanément certifiée et la livraison bascule au statut « Livré » avec la méthode `REVERSE_QR`. | [ ] OK [ ] KO [ ] NA |
| 19.3 | P1 | Détection d'altération et protection anti-fraude | 1. Tenter de valider avec une charge altérée (ex. modifier un caractère du jeton ou une référence discordante). | Le système rejette la validation avec une alerte explicite : format invalide ou référence discordante. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 20 : Encaissements COD & Rapprochement de Caisse Dépôt (MVP 1)

Pré-requis du module : être connecté avec un compte Admin ou Gestionnaire sur `/espace/encaissements`.

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 20.1 | P1 | Déclaration de paiement COD lors de la remise | 1. Lors de la livraison d'un colis avec COD (ex : 25 000 F CFA), sélectionner le mode de règlement (Espèces, Wave, Orange Money) et saisir le montant perçu. 2. Valider la remise. | L'événement d'audit `PAYMENT_COLLECTED` est scellé dans le journal avec le mode et le montant perçu. | [ ] OK [ ] KO [ ] NA |
| 20.2 | P1 | Suivi du solde espèces en poche par livreur | 1. Accéder à l'espace `/espace/encaissements`. 2. Consulter la carte du livreur ayant effectué la livraison en espèces. | Le solde « Espèces en poche » reflète exactement la somme collectée en attente de versement au dépôt. | [ ] OK [ ] KO [ ] NA |
| 20.3 | P1 | Rapprochement de caisse et validation du versement physique | 1. Cliquer sur « Enregistrer une remise ». 2. Indiquer le montant remis physiquement par le livreur au caissier/gestionnaire (ex : 25 000 F). 3. Valider. | Le versement est enregistré avec l'écart constaté (0 F en cas d'exactitude). Le solde en poche du livreur est réinitialisé à 0 F. L'événement d'audit `CASH_HANDED_OVER` est scellé. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 21 : Fil de Discussion & Gestion des Litiges (MVP 1)

Pré-requis du module : livraison existante dans l'espace entreprise (`/espace/livraisons/[id]`).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 21.1 | P2 | Ajout d'un commentaire opérationnel sur une livraison | 1. Sur la page détail de la livraison, section « Commentaires & Échanges », saisir « Colis fragile, remis en mains propres au bureau 204. » 2. Cliquer sur « Envoyer ». | Le message apparaît instantanément dans le fil avec l'auteur, le rôle, la date et l'heure. Toute balise HTML ou script XSS est automatiquement neutralisé. | [ ] OK [ ] KO [ ] NA |
| 21.2 | P1 | Déclaration et ouverture d'un litige client | 1. Dans la section « Gestion des Litiges », cliquer sur « Déclarer un litige ». 2. Choisir le motif (ex : `PACKAGE_DAMAGED` ou `PAYMENT_DISCREPANCY`), saisir les détails et confirmer. | Le litige passe au statut « OPEN » avec badge d'alerte rouge. La livraison est marquée en litige actif. L'événement `DISPUTE_OPENED` est loggé dans l'audit. | [ ] OK [ ] KO [ ] NA |
| 21.3 | P1 | Résolution d'un litige depuis le tableau de bord `/espace/litiges` | 1. Aller sur le menu « Litiges » (`/espace/litiges`). 2. Sélectionner le litige ouvert. 3. Saisir les notes de résolution (ex : « Colis remplacé le lendemain avec accord client ») et cliquer sur « Marquer comme résolu ». | Le litige bascule au statut vert « RESOLVED », avec consignation de l'auteur de la clôture et archivage des notes. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Module 22 : Dossier de Preuve PDF Cryptographique & Certificat de Non-Répudiation (MVP 1)

Pré-requis du module : livraison au statut « Livré » (`DELIVERED`).

| N° | Priorité | Intitulé du Test | Scénario pas-à-pas | Résultat attendu | Validation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 22.1 | P1 | Téléchargement du Dossier de Preuve PDF officiel | 1. Ouvrir une livraison livrée sur `/espace/livraisons/[id]`. 2. Cliquer sur le bouton « Télécharger le Dossier de Preuve (PDF) ». | Le fichier `preuve-[reference].pdf` se télécharge automatiquement avec les en-têtes officiels (`application/pdf`). | [ ] OK [ ] KO [ ] NA |
| 22.2 | P1 | Vérification de la valeur probante et non-répudiation (Loi n° 2013-450) | 1. Ouvrir le document PDF téléchargé dans Acrobat Reader ou le navigateur. 2. Vérifier les sections : En-tête officiel, Identités, Géolocalisation GPS & IP, Détails d'encaissement COD, et la section « JOURNAL D'AUDIT CERTIFIE (CHAINE DE HASH SHA-256) ». | Le document PDF 1.4 A4 reproduit l'historique chronologique infalsifiable des événements horodatés en UTC avec leurs empreintes SHA-256 respectives et la mention légale de conformité. | [ ] OK [ ] KO [ ] NA |

| Nom du Testeur | Date | Commentaires & Remarques |
| :--- | :--- | :--- |
| | | |
| **Décision finale :** | [ ] **Conforme** | [ ] **Non Conforme** |

## Matrice de couverture globale (22 Modules — MVP & MVP 1)

| Module | Tests | dont P1 | Périmètre fonctionnel couvert |
| :--- | :--- | :--- | :--- |
| Module 1 : Connexion au back-office plateforme | 6 | 3 | Accès protégé, sécurité mots de passe, sessions, déconnexion |
| Module 2 : Création d'une entreprise cliente (Admin) | 8 | 4 | Formulaire back-office, validation, lien d'activation, unicité |
| Module 3 : Activation du compte admin entreprise | 6 | 3 | Page de lien à usage unique, définition mot de passe |
| Module 4 : Connexion à l'espace entreprise | 6 | 2 | Authentification entreprise, erreurs, verrouillage 5 essais |
| Module 5 : Gestion de l'équipe et rôles multiples | 9 | 3 | Rôles cumulés, modifications, désactivation et réactivation |
| Module 6 : Droits par rôle et cloisonnement multi-tenant | 6 | 4 | Isolation stricte des données entre boutiques A et B |
| Module 7 : Consultations du support visibles par l'entreprise | 4 | 1 | Traçabilité et transparence des accès super-admin |
| Module 8 : Parcours de bout en bout (Back-office) | 3 | 3 | Création, remplacement de lien, activation complète |
| Module 9 : Affichage mobile et utilisation au clavier | 4 | 0 | Responsive mobile 375 px, navigation clavier Tab/Entrée |
| **Module 10 : Landing Page Vitrine & Navigation SEO** | **5** | **3** | **Hero, 3 étapes, tarifs sans bord noir, FAQ, URL anglaises** |
| **Module 11 : Auto-inscription Entreprise Directe** | **4** | **3** | **Self-service `/register`, validations, rôle admin direct** |
| **Module 12 : Gestion des Livreurs & Premier Accès PIN** | **5** | **4** | **Création coursiers, code 48h, PIN 6 chiffres, PWA `/courier`** |
| **Module 13 : Livraisons, Import CSV & Bordereau PDF** | **3** | **2** | **Création unitaire, import 10 lignes, PDF officiel avec QR** |
| **Module 14 : Tournée Livreur, GPS & QR Code 3 min** | **6** | **5** | **Prise en charge lot, GPS certifié, code 4 chiffres, anti-triche** |
| **Module 15 : Échecs, Retours Dépôt & Forcer Livré** | **3** | **2** | **Déclaration échec, masquage téléphone, scan retour, décharge** |
| **Module 16 : Facturation 10 F CFA & Pilotage Super Admin** | **3** | **2** | **Compteur facturable, gratuité retours, ON/OFF, relevé payé** |
| **Module 17 : Clés API Développeur & Webhooks** | **2** | **0** | **Clés test/live, webhooks HMAC, test d'envoi en direct** |
| **Module 18 : Niveaux de Preuve Configurables (MVP 1)** | **3** | **3** | **Standard, Renforcé OTP, Photo, Signature, validation stricte** |
| **Module 19 : QR Inversé Destinataire (MVP 1)** | **3** | **3** | **QR client `/c/[token]`, scan livreur, signature cryptographique** |
| **Module 20 : Encaissements COD & Rapprochement (MVP 1)** | **3** | **3** | **Paiements à la livraison, espèces en poche, versement dépôt** |
| **Module 21 : Commentaires & Litiges (MVP 1)** | **3** | **2** | **Fil entreprise-livreur, ouverture litige, résolution manager** |
| **Module 22 : Dossier de Preuve PDF Cryptographique (MVP 1)**| **2** | **2** | **Certificat de non-répudiation, SHA-256 scellé, loi 2013-450** |
| **TOTAL GÉNÉRAL** | **93 tests** | **57 tests P1** | **Couverture intégrale MVP & MVP 1 d'Ofika Delivery de bout en bout** |

## Annexe : Recommandations pour la mise en production

- **Environnement de Staging** : Prévoir un déploiement sur une URL de recette (ex: `https://staging.ofika.ci`) connectée à une branche dédiée de base de données Neon pour exécuter ce cahier avec les livreurs et commerçants pilotes.
- **Réseau & Données Mobiles** : Vérifier la réactivité de l'espace livreur sur les réseaux 3G/4G locaux (Orange, MTN, Moov) lors des tournées à Abidjan.
- **Déclaration ARTCI & Mentions Légales** : Formaliser la politique de confidentialité relative aux données de géolocalisation et numéros de téléphone conformément à la loi ivoirienne n° 2013-450.
