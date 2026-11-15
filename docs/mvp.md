# MVP — Ofika Delivery · Delivery Management v1

> Le premier produit commercialisable. Simple, robuste et entièrement fonctionnel.
> C'est la version qu'on lance. Le reste (photo/signature, encaissements, SDK, plugins, MCP…) est dans `mvp1.md`, `mvp2.md` et `mvp3.md`.

Légende : **[Proposition]** = ajouté par Claude, à valider. **[À décider]** = question ouverte (voir §12). **[Validé]** = décidé par toi.

### Décisions validées (v2 de ce document)
- **[Validé]** Validation par **QR code, gratuite, par défaut**. **OTP par SMS ou WhatsApp en option** pour renforcer la preuve. **Dans le MVP, l'OTP est en mode maintenance** : il est codé, mais désactivé et affiché « Bientôt disponible ».
- **[Validé]** QR valable **3 minutes** après sa génération par le livreur, **3 essais** maximum.
- **[Validé]** Un livreur peut être **employé ou indépendant**, et peut **travailler pour plusieurs entreprises**.
- **[Validé]** Hébergement : **VPS**. Connexion du livreur : **téléphone + code PIN à 6 chiffres choisi par le livreur** pour accéder à son espace.
- **[Validé]** Confirmation du client : après le scan, la page affiche un **code de remise à 4 chiffres** que le client **dicte au livreur**, sans copier-coller. Au même moment, le serveur enregistre la localisation, l'empreinte de l'appareil et l'adresse IP du client.
- **[Validé]** **Aucune limite** de tentatives de livraison par jour.
- **[Validé]** Intégration facile dès le MVP : **mode test séparé et jamais facturé**, **référence de commande + `metadata`** renvoyées dans chaque webhook, bouton **« Envoyer un webhook de test »** (§9).
- **[Validé]** Modèle commercial : **10 F par livraison livrée**, facturé **en fin de mois**. Un **bouton par entreprise** permet d'activer ou de désactiver la facturation (périodes gratuites), et le prix par livraison est **modifiable par entreprise** (promotions, hausse).
- **[Validé]** Le QR code est **sécurisé, temporaire et lié à la livraison**. Un simple scan ne suffit pas : le client doit confirmer sur une page sécurisée.
- **[Validé]** Un bouton **« Forcer Livré »** existe dans le MVP, avec des garde-fous (§6.6).
- **[Validé]** Chaque consultation des données d'une entreprise par l'admin plateforme est journalisée.
- **[Validé]** Le **gestionnaire peut réceptionner les retours**. On ne réceptionne jamais son propre retour.
- **[Validé]** **Nouvelle tentative le jour même** après un échec.
- **[Validé]** ORM : **Drizzle**.

---

## 1. Le problème à résoudre

Une entreprise (grossiste, marchand, e-commerçant) travaille avec plusieurs livreurs (ex. Kwamé, Kono, Hervé). Chacun part avec plusieurs colis. Aujourd'hui, l'entreprise ne peut pas prouver :

- qu'un colis a bien été remis au destinataire (le client ne peut pas dire « je n'ai rien reçu ») ;
- qu'un livreur a bien livré, ou bien qu'il a rapporté le colis (le livreur ne peut pas dire « j'ai livré » ou « je l'ai rendu » sans trace) ;
- qui avait quel colis, à quel moment, et ce qui s'est passé.

**Objectif du MVP** : appliquer le principe de **non-répudiation** à chaque passage de main du colis, grâce à un échange numérique qui laisse une trace : entreprise → livreur → destinataire, ou livreur → entreprise en cas de retour.

**Principe d'architecture** : le système est **indépendant** du site e-commerce. Il fonctionne seul, via son interface web, ou se branche à n'importe quel site ou logiciel par **API REST + webhooks + clés API**.

---

## 2. Périmètre du MVP

### Inclus

| Bloc | Fonctionnalités |
|---|---|
| **Gestion entreprise** | Création d'entreprise et des utilisateurs · Gestion des livreurs (un livreur peut être rattaché à plusieurs entreprises) · Création manuelle de livraisons · Import CSV/Excel · Affectation manuelle des colis · Suivi des statuts |
| **Livreur (PWA)** | Application web mobile, sans Play Store, utilisable dans Chrome Android · Liste des colis affectés · Prise en charge des colis · **Validation par QR code (par défaut) ou OTP (option)** · Déclaration des échecs · Nouvelle tentative · Déclaration des retours |
| **Destinataire** | Page sécurisée ouverte en scannant le QR, **sans compte et sans application** |
| **Preuves et traçabilité** | Journal d'audit · Horodatage serveur · GPS lors de la validation · Réception physique des retours · Historique consultable · Bordereau PDF · « Forcer Livré » encadré |
| **Intégration** | API REST · Webhooks · Clés API par entreprise · **Mode test séparé (non facturé)** · **Webhook de test** · Documentation développeur |

### Exclu du MVP (voir les fichiers suivants)

Photo et signature à la livraison, niveaux de preuve avancés, encaissements, marchands sous un grossiste, SDK, package npm, plugin WooCommerce, MCP, affectation automatique, suivi GPS en continu.

---

## 3. Les acteurs

| Acteur | Qui c'est | Comment il accède |
|---|---|---|
| **Admin plateforme** | Toi, l'éditeur d'Ofika Delivery | Back-office plateforme |
| **Admin entreprise** | Propriétaire du compte client (grossiste, marchand) | Interface web |
| **Gestionnaire** | Prépare, crée et affecte les livraisons, réceptionne les retours | Interface web |
| **Responsable retours** | Réceptionne physiquement les colis qui reviennent | Interface web, sur mobile ou PC |
| **Livreur** | Kwamé, Kono, Hervé… Employé ou indépendant, une ou plusieurs entreprises | PWA mobile, connexion par code |
| **Destinataire** | Client final, **sans compte** | Scanne le QR du livreur avec son propre téléphone. Option : reçoit un OTP |
| **Système externe** | Site e-commerce du client | Clé API + webhooks |

---

## 4. Matrice des droits et permissions (principe du moindre privilège)

### 4.1 Règles

1. **Refus par défaut** : une action non autorisée explicitement est interdite.
2. **Cloisonnement par entreprise** : un utilisateur ne voit jamais les données d'une autre entreprise. Ce filtre est appliqué **côté serveur** sur chaque requête.
3. **Le livreur ne voit que ses colis affectés**, et seulement les informations utiles à la livraison. S'il travaille pour plusieurs entreprises, il a **un seul compte**, mais chaque entreprise ne voit que ses propres colis et ses propres données sur lui : jamais l'activité du livreur pour une autre entreprise. Dans sa PWA, les colis sont regroupés par entreprise.
4. **Personne ne peut modifier ni supprimer une preuve ou une entrée du journal d'audit**, même un admin. On corrige en ajoutant un nouvel événement, jamais en effaçant.
5. **« Forcer Livré » est réservé à l'admin entreprise**, avec un motif obligatoire. La livraison est marquée **« Livré (forcé) »** partout : interface, historique, webhook, PDF. Une validation forcée n'a jamais la même valeur de preuve qu'une validation du destinataire.
6. **Séparation des rôles** : le livreur qui déclare un retour ne peut pas réceptionner ce retour, même s'il a aussi le rôle Gestionnaire ou Responsable retours. Un utilisateur ne peut pas non plus forcer la validation d'un colis qu'il a lui-même livré.
7. **Clés API** : une clé appartient à une seule entreprise, n'est visible qu'une fois lors de sa création, est stockée hachée et peut être révoquée.
8. **Le destinataire n'a aucun compte**. Son accès se limite à la page de confirmation ouverte par le QR, temporaire et liée à une seule livraison.
9. **Le support plateforme est journalisé** : chaque consultation des données d'une entreprise par l'admin plateforme crée un événement visible par l'admin entreprise.

### 4.2 Matrice

✅ = autorisé · 👁 = lecture seule · 🔸 = limité à son périmètre · ❌ = interdit

| Action | Admin plateforme | Admin entreprise | Gestionnaire | Resp. retours | Livreur | Clé API |
|---|---|---|---|---|---|---|
| Créer / suspendre une entreprise | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Gérer les utilisateurs de l'entreprise | ❌ ¹ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Créer un livreur / le rattacher à son entreprise / le détacher | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Créer / révoquer des clés API | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Configurer les webhooks | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Activer l'option OTP (SMS/WhatsApp) — *en maintenance dans le MVP* | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Voir le compteur de livraisons facturables et le relevé mensuel | ✅ | 👁 | ❌ | ❌ | ❌ | ❌ |
| **Activer / désactiver la facturation** d'une entreprise | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Modifier le prix par livraison** d'une entreprise | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Marquer un relevé mensuel comme payé | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Créer une livraison (manuelle ou CSV) | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Modifier une livraison **avant** sa prise en charge | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Modifier une livraison **après** sa prise en charge | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Annuler une livraison **avant** sa prise en charge | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Affecter / réaffecter un livreur | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Voir les livraisons | 👁 ² | ✅ | ✅ | 🔸 colis en retour | 🔸 ses colis | 🔸 celles de son entreprise |
| Voir le téléphone et l'adresse du destinataire | ❌ | ✅ | ✅ | ❌ | 🔸 ses colis actifs | ✅ |
| Confirmer la prise en charge d'un colis | ❌ | ❌ | ❌ | ❌ | 🔸 ses colis | ❌ |
| Déclarer « Arrivé chez le destinataire » | ❌ | ❌ | ❌ | ❌ | 🔸 ses colis | ❌ |
| Afficher le QR de validation | ❌ | ❌ | ❌ | ❌ | 🔸 ses colis, statut Arrivé | ❌ |
| Saisir le code de remise à 4 chiffres dicté par le client | ❌ | ❌ | ❌ | ❌ | 🔸 ses colis | ❌ |
| Saisir l'OTP (si l'option est active) | ❌ | ❌ | ❌ | ❌ | 🔸 ses colis | ❌ |
| Voir l'OTP, le jeton QR ou le code de remise en clair | ❌ | ❌ | ❌ | ❌ | ❌ ³ | ❌ |
| Déclarer un échec / lancer une nouvelle tentative | ❌ | ❌ | ❌ | ❌ | 🔸 ses colis | ❌ |
| **Forcer Livré** | ❌ | ✅ ⁴ | ❌ | ❌ | ❌ | ❌ |
| Réceptionner un retour | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Consulter le journal d'audit | 👁 ² | 👁 | 👁 | 👁 retours | 🔸 ses actions | 👁 via l'API |
| Modifier / supprimer le journal d'audit | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Générer un bordereau PDF | ❌ | ✅ | ✅ | ❌ | 🔸 ses colis | ✅ |

¹ L'admin plateforme crée seulement le premier admin de l'entreprise.
² Uniquement pour le support. Chaque consultation est journalisée **[Validé]**.
³ Le livreur affiche le QR mais ne connaît pas le jeton : celui-ci est généré et vérifié par le serveur, qui n'en stocke qu'une empreinte (hash). Le code de remise et l'OTP ne s'affichent que sur le téléphone du destinataire. Le livreur ne les connaît que si le client les lui dicte.
⁴ Avec un motif obligatoire. Interdit sur un colis qu'il a livré lui-même (règle 6). Non disponible via l'API.

> Un même utilisateur peut cumuler plusieurs rôles, par exemple Gestionnaire et Responsable retours. La règle 6 s'applique quand même.

---

## 5. Cycle de vie d'un colis (statuts)

```
                ┌──────────── CANCELLED (avant prise en charge)
                │
CREATED ──► ASSIGNED ──► PICKED_UP ──► ARRIVED ──► DELIVERED ✅ (verrouillé)
   ▲            │  ▲          ▲           │            ▲
   │            │  │          │           │            └── forcé par l'admin
   └────────────┘  │          │           ▼                (DELIVERED + mode MANUAL)
            réaffectation     │     DELIVERY_FAILED
                              │           │
                              └───────────┤ nouvelle tentative (même jour)
                                          │
                                          ▼ retour au dépôt
                                     RETURNING ──► RETURN_RECEIVED ✅ (verrouillé)
```

| Statut | Libellé affiché | Qui le déclenche |
|---|---|---|
| `CREATED` | Créée | Gestionnaire, import CSV ou API |
| `ASSIGNED` | Affectée | Gestionnaire ou API |
| `PICKED_UP` | Prise en charge / En cours | Livreur, quand il quitte le dépôt avec le colis, ou lors d'une nouvelle tentative |
| `ARRIVED` | Arrivé chez le destinataire | Livreur |
| `DELIVERED` | Livré | Serveur, après confirmation du destinataire (QR, et OTP si l'option est active) |
| `DELIVERED` + `proof_method = MANUAL` | **Livré (forcé)** | Admin entreprise (§6.6) |
| `DELIVERY_FAILED` | Échec de tentative | Livreur, avec un motif |
| `RETURNING` | Retour en cours | Livreur, quand il choisit « Retour au dépôt » |
| `RETURN_RECEIVED` | Retour réceptionné | Gestionnaire, responsable retours ou admin entreprise |
| `CANCELLED` | Annulée | Gestionnaire ou API, avant prise en charge |

**Seul le serveur fait changer un statut.** Chaque transition est vérifiée : on ne peut pas passer de `CREATED` à `DELIVERED`. Chaque changement crée un événement dans le journal d'audit. Chaque tentative est numérotée (tentative 1, 2…).

**Forcer Livré** est possible depuis `PICKED_UP`, `ARRIVED`, `DELIVERY_FAILED` ou `RETURNING`.

---

## 6. Workflows

### 6.1 Création et affectation

1. Le gestionnaire crée la livraison à la main, par import CSV/Excel ou via l'API.
2. Champs : référence de commande (celle du site e-commerce), **`metadata`** (données libres du site, renvoyées telles quelles dans les webhooks), nom du destinataire, téléphone, adresse ou quartier, description du colis, **prix affiché / montant à encaisser** (information seulement dans le MVP), commentaire, et **mode de preuve** (QR par défaut, ou QR + OTP si l'option est active).
3. Il affecte un livreur → `ASSIGNED`. Le livreur voit le colis dans sa PWA.
4. Un bordereau PDF peut être généré : référence, destinataire, livreur, QR de **référence** du colis pour le retrouver vite au retour. Ce QR n'est **pas** celui de la validation.

### 6.2 Prise en charge

1. Le livreur voit la liste de ses colis affectés.
2. Il confirme la prise en charge de chaque colis, ou de plusieurs à la fois → `PICKED_UP`, avec horodatage serveur.
3. On sait désormais que Kwamé est parti avec 3 colis à telle heure.

### 6.3 Livraison réussie — QR code (par défaut, gratuit)

1. Le livreur arrive chez le client.
2. Il ouvre la livraison dans sa PWA.
3. Il clique sur **« Arrivé chez le destinataire »**. Le serveur enregistre l'heure et le GPS du livreur → `ARRIVED`.
4. Son application affiche un **QR code** généré par le serveur : sécurisé, temporaire et lié à cette livraison (§8.2).
5. Le client scanne ce QR code avec **son propre téléphone**, avec l'appareil photo ou Google Lens.
6. Une **page sécurisée** s'ouvre. **En haut**, elle affiche un **code de remise à 4 chiffres** généré par le serveur. En dessous, elle affiche le nom du marchand, la référence et la description du colis, et le montant.
7. **Au même moment**, le serveur enregistre l'heure serveur, la **localisation du client** (s'il l'autorise), l'**empreinte de son appareil** et son **adresse IP** **[Validé]**.
8. Le client **dicte le code au livreur**. Il n'y a **pas de champ copier-coller** sur la page du client **[Validé]**.
9. Le livreur saisit le code dans sa PWA.
10. Le serveur vérifie :
    - le code est correct et appartient à cette livraison et à ce QR ;
    - il n'a pas expiré (3 minutes après la génération du QR) ni déjà été utilisé ;
    - il reste des essais (3 au maximum) ;
    - l'appareil qui a scanné est **différent** de celui du livreur.
11. Le système enregistre la confirmation et tous les **signaux de preuve** (§8.1).
12. L'événement de validation est **verrouillé**. Le statut devient **« Livré »** → `DELIVERED`, avec `proof_method = QR`.
13. Les deux écrans passent à « Livré ✅ » : celui du livreur, et la page du client (« Merci, votre colis est confirmé »).
14. Le marchand et l'administrateur sont notifiés : webhook et notification dans l'interface.

**Ce que ce flux prouve** : le code part du téléphone du client et doit être saisi sur le téléphone du livreur. Il y a donc eu un échange réel entre deux appareils, au même endroit, au même moment. Le livreur ne peut pas valider seul depuis son application.

### 6.4 Livraison réussie — QR + OTP (option payante, preuve renforcée) — ⏸ MODE MAINTENANCE

> **[Validé]** Dans le MVP, cette option est **codée mais désactivée** par un interrupteur côté serveur. Elle s'affiche « Bientôt disponible » dans les paramètres. Il n'y a donc **aucun fournisseur SMS à brancher pour le lancement**. On l'activera plus tard sans modifier le reste du système.

Fonctionnement prévu, une fois activée par l'entreprise ou choisie pour une livraison :
- étapes 1 à 9 identiques ;
- au moment du scan, un **code OTP** est envoyé par SMS ou WhatsApp au numéro du destinataire. Le client le dicte aussi au livreur, qui le saisit en plus du code de remise ;
- l'OTP prouve que la personne qui confirme a accès au téléphone du destinataire. C'est la preuve la plus forte du MVP ;
- `proof_method = QR_OTP`.

**Cas du client sans smartphone ou sans internet** : une fois l'option active, le livreur pourra basculer sur **« OTP seul »**. Le code sera envoyé par SMS, le client le dictera et le livreur le saisira (`proof_method = OTP`). **Dans le MVP**, l'OTP étant en maintenance, on passe par **« Forcer Livré »** par l'admin entreprise **[Validé]**, ou par un échec si le client refuse.

### 6.5 Échec et nouvelle tentative

Le livreur ouvre la livraison et sélectionne un motif :

- Destinataire absent
- Destinataire injoignable
- Destinataire ayant refusé le colis
- Adresse incorrecte
- Paiement indisponible
- Colis endommagé
- Autre motif (commentaire obligatoire)

Il ajoute éventuellement un commentaire, une photo ou une preuve de tentative. Le système enregistre l'heure serveur et le GPS → `DELIVERY_FAILED`.

Le livreur choisit ensuite :
- **« Nouvelle tentative »** : le colis repasse à `PICKED_UP` (tentative 2…), et il pourra recliquer sur « Arrivé » plus tard dans la journée **[Validé]** ;
- **« Retour au dépôt »** → `RETURNING`.

Un webhook est envoyé à chaque échec. **Aucune limite** au nombre de tentatives par jour **[Validé]**. Chaque tentative reste numérotée et visible dans l'historique.

### 6.6 Forcer Livré [Validé]

Pour les cas réels où le destinataire ne peut pas confirmer : pas de téléphone, plus de batterie, colis remis à un proche, client qui confirme par appel.
1. L'admin entreprise ouvre la livraison et clique sur **« Forcer Livré »**.
2. Il saisit un **motif obligatoire** et peut joindre une pièce (capture d'écran, photo).
3. Le serveur enregistre son identité, l'heure et le motif → `DELIVERED` avec `proof_method = MANUAL`.
4. Le statut est affiché **« Livré (forcé) »**, et le webhook contient `"proof_method": "MANUAL"`.
5. Le tableau de bord compte les livraisons forcées par livreur. Un taux élevé est un signal d'alerte.

### 6.7 Réception d'un retour

Quand le livreur revient à l'entreprise :
1. Le gestionnaire ou le responsable ouvre l'écran **« Réception des retours »**. Il voit les colis en `RETURNING`, regroupés par livreur.
2. Il sélectionne le colis ou scanne le QR de référence du bordereau.
3. Le système affiche le livreur, la livraison et le motif du retour.
4. Il vérifie physiquement le colis.
5. Il confirme la réception, avec un état (« bon état » / « endommagé ») et un commentaire.
6. Le système enregistre l'heure, son identité et éventuellement une photo.
7. Le colis passe à **« Retour réceptionné »** → `RETURN_RECEIVED`. Événement `RETURN_RECEIVED` + webhook.

**Bilan du livreur** : Kwamé a pris 3 colis → 2 `DELIVERED` + 1 `RETURN_RECEIVED`. Tout est soldé.

### 6.8 Facturation de la plateforme [Validé]

**Règles**
- On facture **seulement les livraisons livrées** (`DELIVERED`), **y compris les « Livré (forcé) »**, au même prix que les autres. Les échecs, retours, annulations et **livraisons de test** ne sont pas facturés.
- **Prix par défaut : 10 F par livraison.**
- **Paiement en fin de mois** : un relevé mensuel est créé pour chaque entreprise.

**Réglages par entreprise** (back-office plateforme, toi seul)
| Réglage | Effet |
|---|---|
| **Bouton Facturation ON / OFF** | OFF = période gratuite. Les livraisons livrées sont comptées, mais à 0 F. ON = facturation au prix en vigueur. Tu peux le réactiver à tout moment |
| **Prix par livraison** | Modifiable à tout moment : baisse pour une promotion, ou hausse. 10 F par défaut |

**Fonctionnement**
1. Au moment où une livraison passe à `DELIVERED`, le serveur **fige sur la livraison** le prix en vigueur à cet instant (0 F si la facturation est OFF). Changer le prix plus tard ne modifie donc jamais les livraisons passées **[Proposition]**.
2. Chaque changement du bouton ou du prix est **journalisé** : qui, quand, ancienne valeur, nouvelle valeur.
3. En fin de mois, le relevé de chaque entreprise est créé : nombre de livraisons livrées, détail par prix appliqué, total à payer.
4. L'admin entreprise voit son relevé (lecture seule). Toi, tu le marques **« Payé »** quand tu reçois le paiement.

> Le **paiement** du relevé (Wave, mobile money…) se fait en dehors du système dans le MVP. On enregistre seulement qu'il a été payé.

---

## 7. Cas particuliers

| Cas | Comportement |
|---|---|
| Le QR a expiré (plus de 3 minutes) | Le livreur appuie sur « Nouveau QR ». L'ancien est invalidé. Un compte à rebours est affiché sous le QR |
| Le client scanne une capture d'écran du QR plus tard | Refusé : le jeton a expiré ou a déjà été utilisé |
| Le livreur saisit 3 fois un code de remise faux | Le QR et son code sont bloqués **[Validé]**. Événement `QR_LOCKED`. Le livreur doit générer un nouveau QR, et le client doit le rescanner |
| Le même appareil « client » confirme plusieurs livraisons du même livreur, pour des clients différents | **Alerte** `SUSPICIOUS_DEVICE_REUSE` dans le tableau de bord de l'entreprise. C'est probablement le deuxième téléphone du livreur **[Proposition]** |
| L'appareil qui scanne est celui du livreur | Refusé, avec l'événement `SAME_DEVICE_REJECTED` |
| Le client n'a pas internet | Dans le MVP : échec ou « Forcer Livré ». Plus tard : OTP seul |
| Le client n'a pas reçu l'OTP | (Quand l'OTP sera actif) Bouton « Renvoyer le code », limité à 3 envois |
| Le GPS est refusé ou indisponible | La validation reste possible, mais la preuve est marquée « GPS absent » |
| Le livreur n'a plus de réseau | La PWA affiche « hors ligne ». **La validation exige le réseau**, car le serveur vérifie et horodate |
| Le retour déclaré n'arrive jamais au dépôt | Il reste en `RETURNING`. Tableau de bord : « retours non réceptionnés depuis plus de X heures » par livreur |
| Erreur d'affectation | Réaffectation possible tant que le colis n'est pas `PICKED_UP`. Après, il faut passer par un retour |

---

## 8. Preuves et non-répudiation

### 8.1 Ce qui est enregistré

| Donnée | Pourquoi |
|---|---|
| **Horodatage serveur** | L'heure du téléphone peut être modifiée, pas celle du serveur |
| **Acteur** (utilisateur, rôle, ou clé API) | Savoir qui a agi |
| **Méthode de preuve** (`QR`, `QR_OTP`, `OTP`, `MANUAL`) | Connaître la force de la preuve |
| **GPS du livreur + précision** | À l'arrivée, à la validation et à l'échec |
| **Localisation du client** (s'il l'autorise sur la page), enregistrée au scan **[Validé]** | Comparée à celle du livreur : les deux doivent être proches |
| **Empreinte de l'appareil du client** (navigateur, modèle, écran, langue…), enregistrée au scan **[Validé]** | Doit être **différente** de celle du livreur. Sert aussi à détecter un même appareil réutilisé |
| **Adresse IP du client**, enregistrée au scan **[Validé]** | Contexte en cas de litige |
| **Code de remise** (stocké haché) et nombre d'essais | Prouve l'échange entre le téléphone du client et celui du livreur |
| **Photo** (facultative) | Échec et réception des retours |

### 8.2 Sécurité du QR code

- Le QR contient une URL du type `https://<domaine>/c/<jeton>`. Le jeton est **aléatoire et long** (128 bits), généré par le serveur.
- **Lié à une seule livraison et à la tentative en cours.**
- **Temporaire** : valable **3 minutes** après sa génération par le livreur, **3 essais** maximum **[Validé]**, avec un bouton pour le régénérer.
- **Usage unique** : une fois la confirmation faite, il ne fonctionne plus.
- Stocké **haché** en base, jamais en clair.
- Créé seulement quand la livraison est au statut `ARRIVED`.

### 8.3 Ce que le QR prouve, et ses limites

- **Le QR + code de remise (gratuit)** prouve qu'un **autre téléphone que celui du livreur**, à côté de lui, a scanné le QR, et que le code affiché sur ce téléphone a été transmis au livreur, à telle heure serveur. La localisation, l'empreinte et l'IP de ce téléphone sont conservées.
- **Limite honnête** : un livreur malhonnête avec un deuxième téléphone peut encore scanner son propre QR et taper le code. Ce cas n'est pas bloqué, mais il est **détecté** : son deuxième téléphone réapparaît sur plusieurs livraisons → alerte `SUSPICIOUS_DEVICE_REUSE`. Il est donc risqué pour lui, et visible pour l'entreprise.
- **QR + OTP** (quand il sortira de maintenance) ferme cette faille : il faut avoir accès au téléphone du destinataire.

### 8.4 Sécurité de l'OTP (option)
- 6 chiffres, générés par le serveur avec un générateur aléatoire sûr, stockés **hachés**.
- Validité limitée, tentatives limitées, usage unique.
- Envoyé uniquement au numéro du destinataire enregistré sur la livraison.

### 8.5 Journal d'audit infalsifiable
- Table en **ajout seul** : ni modification, ni suppression, y compris au niveau de la base de données.
- Chaque événement contient l'empreinte (hash) de l'événement précédent. Si une ligne est modifiée en base, la chaîne est cassée et ça se voit **[Proposition]**.

### 8.6 Limite juridique
Ce système apporte une **preuve forte**, mais ne remplace pas un avis juridique sur sa valeur légale en Côte d'Ivoire. C'est à vérifier séparément si tu veux t'en servir en cas de contentieux.

---

## 9. Intégration : API REST + webhooks (les fondations)

Le système est d'abord une API. L'interface web n'est qu'un client de cette API parmi d'autres.

### 9.1 Authentification
- **Une clé API par entreprise**, dans l'en-tête `Authorization: Bearer <clé>`.
- Deux types de clés : **test** (`ofk_test_…`) et **production** (`ofk_live_…`).

### 9.1 bis Mode test [Validé]
Pour qu'un développeur puisse brancher un site **sans risque** :
- Une livraison créée avec une clé **test** est marquée `is_test = true`.
- Les livraisons de test **ne sont jamais facturées**, n'apparaissent pas dans les statistiques, et sont **cachées par défaut** dans l'interface. Un interrupteur « Afficher le mode test » permet de les voir, avec un bandeau « TEST ».
- Elles ne sont **pas envoyées aux livreurs**.
- Pour tester tout le parcours sans livreur, une route **réservée au mode test** fait avancer la livraison : `POST /v1/test/deliveries/{id}/simulate` avec le statut voulu (`ASSIGNED`, `PICKED_UP`, `ARRIVED`, `DELIVERED`, `DELIVERY_FAILED`, `RETURN_RECEIVED`). Les vrais webhooks partent, avec `"livemode": false` **[Proposition]**.
- Les webhooks de test ne partent que vers les URL de webhook configurées en mode **test**.
- Une clé test ne peut **jamais** lire ou modifier une livraison réelle, et inversement.

### 9.2 Endpoints du MVP

| Méthode | Endpoint | Rôle |
|---|---|---|
| `POST` | `/v1/deliveries` | Créer une livraison (avec `reference`, `metadata`, `proof_mode` : `QR` ou `QR_OTP`) |
| `POST` | `/v1/deliveries/import` | Import en lot (CSV) |
| `GET` | `/v1/deliveries` | Lister, avec filtres par statut, livreur et date |
| `GET` | `/v1/deliveries/{id}` | Détail + statut + méthode de preuve |
| `PATCH` | `/v1/deliveries/{id}` | Modifier (avant prise en charge seulement) |
| `POST` | `/v1/deliveries/{id}/assign` | Affecter un livreur |
| `POST` | `/v1/deliveries/{id}/cancel` | Annuler (avant prise en charge seulement) |
| `GET` | `/v1/deliveries/{id}/events` | Historique / journal d'audit |
| `GET` | `/v1/deliveries/{id}/label.pdf` | Bordereau PDF |
| `GET` | `/v1/couriers` | Lister les livreurs |
| `GET` | `/v1/deliveries?reference=CMD-1042` | Retrouver une livraison par la référence de commande du site |
| `POST` | `/v1/test/deliveries/{id}/simulate` | **Clé test uniquement** : simuler un changement de statut |

- « Forcer Livré » **n'est pas exposé dans l'API**, par moindre privilège.
- Un en-tête `Idempotency-Key` sur les `POST` évite de créer deux fois la même livraison **[Proposition]**.

### 9.3 Webhooks

Événements : `delivery.created` · `delivery.assigned` · `delivery.picked_up` · `delivery.arrived` · `delivery.delivered` · `delivery.failed` · `delivery.retry` · `delivery.returning` · `delivery.return_received` · `delivery.cancelled`

Plus `webhook.test`, envoyé par le bouton **« Envoyer un webhook de test »** dans les paramètres **[Validé]**. Le résultat s'affiche immédiatement : code de réponse du site, temps de réponse, erreur éventuelle.

**Contenu de chaque webhook [Validé]** : le site reçoit toujours **sa propre référence de commande** et **ses `metadata`**, pour savoir tout de suite quelle commande mettre à jour.

```json
{
  "id": "evt_9f2c…",
  "type": "delivery.delivered",
  "created_at": "2026-11-15T10:42:07Z",
  "livemode": true,
  "data": {
    "delivery_id": "3b1e…",
    "reference": "CMD-1042",
    "metadata": { "order_id": 1042, "boutique": "sip" },
    "status": "DELIVERED",
    "proof_method": "QR",
    "attempt": 1,
    "courier": { "name": "Kwamé" },
    "failure_reason": null,
    "occurred_at": "2026-11-15T10:42:05Z"
  }
}
```

- `proof_method` vaut `QR`, `QR_OTP`, `OTP` ou `MANUAL` (Livré forcé).
- `failure_reason` est rempli pour `delivery.failed`.
- Chaque envoi est **signé** (HMAC-SHA256 avec un secret propre à l'entreprise). En-tête `X-Ofika-Signature: t=<horodatage>,v1=<signature>`. L'horodatage empêche de rejouer un ancien message **[Proposition]**.
- **Nouvelles tentatives automatiques** si le site ne répond pas, avec un délai croissant.
- Un historique des envois est visible dans l'interface admin.

### 9.4 Documentation développeur
Authentification, **mode test**, chaque endpoint avec un exemple, liste des webhooks avec un exemple de contenu, vérification de la signature (avec un exemple de code prêt à copier), codes d'erreur, et un **guide « Brancher mon site en 15 minutes »** : clé test → créer une livraison → recevoir le webhook → passer en production.

---

## 10. Écrans du MVP

**Interface web (entreprise)**
1. Connexion
2. Tableau de bord : livraisons du jour par statut et par livreur, retours non réceptionnés, livraisons forcées
3. Liste des livraisons + filtres
4. Création d'une livraison / import CSV
5. Détail d'une livraison + historique (timeline) + bouton « Forcer Livré » (admin seulement)
6. Livreurs (liste, création, désactivation, bilan)
7. Réception des retours
8. Paramètres : utilisateurs et rôles, clés API (test / production), webhooks (test / production) + **bouton « Envoyer un webhook de test »**, option OTP (« Bientôt disponible »), interrupteur « Afficher le mode test »
9. Facturation : livraisons facturées du mois en cours + relevés mensuels (lecture seule)

**Back-office plateforme (toi)**
1. Entreprises (création, suspension)
2. **Fiche entreprise → Facturation** : bouton **ON / OFF**, **prix par livraison** modifiable, historique des changements
3. Relevés mensuels de toutes les entreprises, avec un bouton « Marquer comme payé »
4. Interrupteurs de fonctionnalités (ex. OTP)

**PWA livreur**
1. Connexion : téléphone + **code PIN à 6 chiffres choisi par le livreur** **[Validé]** (stocké haché, bloqué après plusieurs essais faux **[Proposition]**)
2. Choix de l'entreprise, si le livreur travaille pour plusieurs entreprises (ou vue regroupée)
3. Mes colis (à prendre en charge / en cours / terminés aujourd'hui)
4. Détail d'un colis : adresse, appel au destinataire, boutons d'action
5. « Arrivé » → **affichage du QR** en plein écran + compte à rebours de 3 minutes + « Nouveau QR » + **champ pour saisir le code à 4 chiffres** dicté par le client
6. Échec : motif, commentaire, photo → « Nouvelle tentative » ou « Retour au dépôt »

**Page destinataire (ouverte par le QR)**
1. **Code de remise à 4 chiffres en haut** (« Donnez ce code au livreur ») → résumé du colis → demande de localisation → passage automatique à « Merci, votre colis est confirmé » quand le livreur a saisi le bon code

---

## 11. Choix techniques

| Besoin | Choix | Statut |
|---|---|---|
| Application web + PWA + API | **Next.js** (un seul projet) | [Proposition] |
| Base de données | **PostgreSQL** | [Proposition] |
| ORM | **Drizzle** | **[Validé]** |
| Génération des QR | Bibliothèque QR côté client (affichage) ; jeton généré côté serveur | [Proposition] |
| Photos | Stockage de fichiers compatible S3, ou disque du VPS | [Proposition] |
| PDF | Génération côté serveur | [Proposition] |
| Tâches en arrière-plan | File de tâches simple (webhooks, nouvelles tentatives, SMS de l'option OTP) | [Proposition] |
| Envoi SMS / WhatsApp | Uniquement pour l'option OTP, **en maintenance dans le MVP**. Le fournisseur sera choisi plus tard | [Validé] |
| Interrupteurs de fonctionnalités | Table `feature_flags` côté serveur (ex. `otp_enabled = false`) | [Proposition] |
| Hébergement | **VPS** | **[Validé]** |

Règle clé : **toute la logique (statuts, jetons QR, OTP, droits) est côté serveur.** La PWA et la page du destinataire ne font qu'afficher et envoyer des actions. On ne leur fait jamais confiance pour l'heure ou pour le résultat d'une vérification.

---

## 12. Questions encore ouvertes

Aucune. Toutes les questions du MVP sont tranchées.

- **[Validé]** Destinataire sans téléphone (tant que l'OTP est en maintenance) : on passe par **« Forcer Livré »** par l'admin entreprise, avec un motif obligatoire (§6.6).

---

## 13. Critères pour dire « le MVP est terminé »

- [ ] Une entreprise peut être créée, avec ses utilisateurs et ses livreurs.
- [ ] Une livraison peut être créée à la main, par CSV et par API.
- [ ] Le livreur voit uniquement ses colis dans la PWA, sur Chrome Android, sans installation obligatoire.
- [ ] Le client scanne le QR, voit un code à 4 chiffres, le dicte au livreur, et la livraison n'est validée **que** quand le livreur saisit ce code. **Le scan seul ne valide rien.**
- [ ] La localisation, l'empreinte de l'appareil et l'IP du client sont enregistrées au scan.
- [ ] Un scan fait depuis le téléphone du livreur est refusé. Un même appareil « client » utilisé sur plusieurs livraisons du même livreur déclenche une alerte.
- [ ] Un QR expiré, déjà utilisé ou appartenant à une autre livraison est refusé (test à faire explicitement).
- [ ] Le QR expire après 3 minutes et se bloque après 3 essais faux.
- [ ] L'option OTP est désactivée par l'interrupteur et s'affiche « Bientôt disponible ».
- [ ] Un livreur rattaché à deux entreprises voit les colis des deux, mais chaque entreprise ne voit que les siens.
- [ ] Le livreur accède à son espace avec son téléphone et son code PIN à 6 chiffres.
- [ ] Seules les livraisons livrées (forcées comprises) sont facturées, au prix figé au moment de la livraison (10 F par défaut).
- [ ] Le bouton Facturation ON/OFF et le prix fonctionnent par entreprise. Changer le prix ne modifie pas les livraisons passées.
- [ ] Le relevé de fin de mois est juste et peut être marqué « Payé ».
- [ ] « Forcer Livré » n'est possible que pour l'admin entreprise, avec un motif, et s'affiche « Livré (forcé) » partout.
- [ ] Un échec permet une nouvelle tentative le jour même, ou un retour réceptionné par un autre utilisateur que le livreur.
- [ ] Chaque action apparaît dans l'historique avec l'heure serveur et l'acteur. Aucune ne peut être modifiée ni supprimée.
- [ ] Les consultations de l'admin plateforme sont journalisées et visibles par l'entreprise.
- [ ] Une entreprise A ne peut jamais voir les données d'une entreprise B (test à faire explicitement).
- [ ] Les webhooks arrivent signés sur un site de test, avec `reference`, `metadata` et `proof_method`, et sont renvoyés en cas d'échec.
- [ ] Une livraison créée avec une clé test n'est jamais facturée, n'est jamais envoyée à un livreur, et une clé test ne voit aucune livraison réelle.
- [ ] La simulation de statut en mode test déclenche les vrais webhooks avec `"livemode": false`.
- [ ] Le bouton « Envoyer un webhook de test » affiche la réponse du site.
- [ ] Le bilan par livreur est juste (colis pris = livrés + retours réceptionnés + en cours).
- [ ] Le bordereau PDF se génère.
- [ ] La documentation API permet à un développeur extérieur de brancher un site sans aide.
