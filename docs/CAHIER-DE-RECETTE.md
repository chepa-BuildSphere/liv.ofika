# Cahier de Recette : Ofika Delivery

## Informations générales

| Élément | Valeur |
| :--- | :--- |
| Plateforme | Ofika Delivery, gestion des livraisons avec preuve de livraison (Abidjan) |
| Environnement | Développement (poste du responsable, base Neon branche dev) |
| URL | http://localhost:5000 (pas encore d'URL de staging) |
| Version testée | Phase 1 « Comptes et droits », commit aa74036 (branche develop) |
| Périmètre | Back-office plateforme, création d'entreprise, activation de compte, connexion à l'espace entreprise, équipe et rôles, droits et cloisonnement entre entreprises, consultations du support. Hors périmètre : livraisons, livreurs, QR, API, facturation (phases suivantes). |

## Consignes aux testeurs

- Suivre les étapes dans l'ordre, sans en sauter. Cocher [ ] OK si le résultat observé correspond au résultat attendu, [ ] KO s'il ne correspond pas (et consigner le bug), [ ] NA si le test ne s'applique pas ou ne peut pas être exécuté.
- Comptes partagés : ne jamais modifier le mot de passe ni l'e-mail du compte admin plateforme, ni le désactiver. Les tests qui désactivent un compte ou provoquent un blocage se font avec les comptes créés par le testeur pendant la recette.
- Exécuter les modules dans l'ordre : chaque module s'appuie sur les comptes créés dans les précédents.
- La base est hébergée loin d'Abidjan : une page peut mettre jusqu'à 5 secondes à répondre. Une lenteur seule n'est pas un KO, sauf au-delà de 15 secondes.
- Légende des priorités : **P1** critique (bloque la mise en service), **P2** important, **P3** mineur.
- Aucun test n'a d'effet réel (pas d'e-mail ni de SMS envoyé par la plateforme). Le bouton « Envoyer par WhatsApp » ouvre WhatsApp mais n'envoie rien tant qu'on n'appuie pas sur Envoyer dans WhatsApp.

**Procédure obligatoire en cas de bug :**

> Si une étape échoue ou présente une anomalie :
> 1. Faire une capture d'écran nette de l'écran ou de l'erreur.
> 2. Noter la référence exacte du test (ex. : Module 1 - Test 1.2).
> 3. Consigner l'incident dans le document de suivi BUGS_ET_AMELIORATIONS avec la capture.

## Répertoire des comptes de test

| Profil | Nom / Fonction | E-mail de connexion | Mot de passe de test | Téléphone | Rôle |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Admin plateforme de recette | À FOURNIR | À FOURNIR | Aucun | Back-office plateforme (créé par le responsable avec npm run admin:create) |
| 2 | Awa Koné, gérante de « Boutique Awa Recette » | awa.recette@ofika.test | choisi au test 3.4 : Awa-Recette-2026 | +225 07 07 07 07 07 | Admin entreprise (créé au Module 2) |
| 3 | Kofi Yao, gestionnaire chez « Boutique Awa Recette » | kofi.recette@ofika.test | choisi au test 5.3 : Kofi-Recette-2026 | +225 05 05 05 05 05 | Gestionnaire et Responsable retours (créé au Module 5) |
| 4 | Aya Traoré, responsable retours chez « Boutique Awa Recette » | aya.recette@ofika.test | choisi au test 5.4 : Aya-Recette-2026 | Aucun | Responsable retours (créé au Module 5) |
| 5 | Moussa Diallo, gérant de « Maquis Moussa Recette » | moussa.recette@ofika.test | choisi au test 2.8 : Moussa-Recette-2026 | +225 01 01 01 01 01 | Admin entreprise d'une seconde entreprise (créé au Module 2) |

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

## Matrice de couverture

| Module | Tests | dont P1 | Fonctionnalités couvertes |
| :--- | :--- | :--- | :--- |
| Module 1 : Connexion au back-office plateforme | 6 | 3 | Accès protégé, erreurs, connexion, déconnexion |
| Module 2 : Création d'une entreprise cliente | 8 | 4 | Formulaire, validations, lien d'activation, doublon d'e-mail, saisie de code |
| Module 3 : Activation du compte de l'admin entreprise | 6 | 3 | Page du lien, mot de passe, usage unique, lien invalide |
| Module 4 : Connexion à l'espace entreprise | 6 | 2 | Connexion, erreurs, compte non activé, blocage, déconnexion |
| Module 5 : Gestion de l'équipe et rôles multiples | 9 | 3 | Invitation, rôles cumulés, modification, dernier admin, désactivation |
| Module 6 : Droits par rôle et cloisonnement entre entreprises | 6 | 4 | Matrice des droits, isolation A / B, séparation back-office / espace |
| Module 7 : Consultations du support visibles par l'entreprise | 4 | 1 | Journalisation, anti-doublon, visibilité par rôle et par entreprise |
| Module 8 : Parcours de bout en bout | 3 | 3 | Création à connexion, lien remplacé, équipe complète |
| Module 9 : Affichage mobile et utilisation au clavier | 4 | 0 | Téléphone 375 px, clavier, couleurs |

## Annexe : Écarts et recommandations sectorielles

- Mot de passe oublié : absent. Un SaaS B2B l'attend pour éviter que chaque oubli passe par le support ; sans lui, l'admin plateforme ou l'admin entreprise doit régénérer un accès. La table des liens prévoit déjà l'usage « réinitialisation ».
- Suspension d'une entreprise : la règle existe dans le code (connexion refusée, sessions coupées) mais aucun écran ne permet de suspendre. Sans écran, un client qui ne paie pas ou qui fraude ne peut pas être coupé sans intervention technique.
- Envoi automatique des liens : les liens d'activation sont copiés ou partagés par WhatsApp à la main. Risque d'erreur de destinataire ; un envoi par e-mail ou SMS depuis la plateforme est à prévoir.
- Journal d'audit complet : seules les consultations du support sont visibles par l'entreprise. Le secteur de la livraison avec preuve attend un historique consultable par livraison (prévu avec les livraisons).
- Données personnelles (Côte d'Ivoire, loi n° 2013-450, ARTCI) : pas encore de mentions d'information ni de procédure d'accès ou de suppression des données des utilisateurs. À prévoir avant la mise en service, avec la déclaration auprès de l'ARTCI.
- Blocage des essais de connexion conservé en mémoire : il disparaît au redémarrage du serveur. À rendre durable avant la production.
- Environnement : pas d'URL de staging. Les testeurs dépendent du poste du responsable ; prévoir un staging accessible pour la recette des phases suivantes.
