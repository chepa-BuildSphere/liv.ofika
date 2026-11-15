# MVP 2 — Intégration « plug and play » + IA

> Objectif : qu'un nouveau client se branche **en quelques minutes, sans développement sur mesure**, qu'un développeur intègre Ofika facilement avec son assistant IA, et qu'un agent IA puisse utiliser le système.
> Tout ce bloc repose sur l'**API REST + webhooks + mode test du MVP**. On n'ajoute ici que des couches qui facilitent l'intégration. On ne change pas le cœur.

| Brique | À quoi elle sert | Pour qui |
|---|---|---|
| **1. Assistant « Connecter mon site »** | Brancher un site en quelques clics, sans lire la documentation | Le client non technique |
| **2. Plugin WooCommerce** | Installer, coller la clé, c'est branché | Les boutiques WooCommerce |
| **3. Module Next.js** | Brancher tes propres sites e-commerce clients | Toi |
| **4. SDK + package npm** | Appeler l'API en quelques lignes de JavaScript/TypeScript | Les développeurs |
| **5. Skills pour assistants de code** | L'IA du développeur sait intégrer Ofika correctement | Les développeurs qui codent avec une IA |
| **6. Serveur MCP** | Un agent IA utilise les fonctions d'Ofika | Les entreprises et les développeurs |

---

## 1. Assistant « Connecter mon site » (le vrai plug and play) [Proposition]

Dans l'interface Ofika, un écran guidé :
1. « Quel est votre site ? » → WooCommerce / site Next.js Ofika / autre (API).
2. Ofika crée automatiquement une **clé test** et affiche les instructions **pour cette plateforme seulement**.
3. Le client colle l'URL de son site → Ofika configure le webhook test.
4. Bouton **« Tester la connexion »** → crée une livraison de test, la simule jusqu'à « Livré », et vérifie que le site a bien reçu les webhooks. Chaque étape s'affiche en vert ou en rouge.
5. Tout est vert → bouton **« Passer en production »** → création de la clé live et du webhook live.

## 2. Plugin WooCommerce

- Installation depuis un fichier .zip (puis, plus tard, depuis le répertoire WordPress).
- Réglages : coller la clé API, choisir test ou production. **Le webhook est configuré automatiquement** par le plugin.
- Création automatique d'une livraison Ofika quand une commande passe à un statut choisi (ex. « En cours »). La référence de commande et l'ID WooCommerce sont envoyés dans `reference` et `metadata`.
- À la réception des webhooks, mise à jour automatique de la commande WooCommerce (livré, échec, retour), avec une note de commande : livreur, méthode de preuve, motif d'échec.
- Bouton « Tester la connexion » dans les réglages du plugin.

## 3. Module Next.js pour tes sites e-commerce

- Ta note précise que le système doit pouvoir être réutilisé dans tes futurs sites e-commerce clients.
- Module prêt à copier dans ton modèle de site, basé sur le SDK :
  - une fonction `createDeliveryFromOrder(order)` ;
  - une route `/api/ofika/webhook` qui vérifie la signature et met à jour la commande ;
  - un composant **« Suivi de ma livraison »** pour la page de commande du client **[Proposition]**.
- Variables d'environnement : `OFIKA_API_KEY`, `OFIKA_WEBHOOK_SECRET`. C'est tout.

## 4. SDK JavaScript / TypeScript (package npm)

- Fonctions prêtes à l'emploi : `deliveries.create()`, `deliveries.get()`, `deliveries.list()`, `deliveries.assign()`, `deliveries.cancel()`, `test.simulate()`.
- `webhooks.verify(body, signatureHeader, secret)` : vérifie la signature en une ligne.
- Typage TypeScript complet : statuts, motifs d'échec, contenu des webhooks.
- Gestion automatique de `Idempotency-Key` et des nouvelles tentatives réseau.
- Fonctionne côté serveur (Node.js, Next.js). **Jamais côté navigateur**, car la clé API ne doit pas être exposée.

## 5. Skills pour assistants de code IA

Beaucoup de développeurs codent avec un assistant IA (comme toi). Un **skill** est un dossier d'instructions que le développeur ajoute à son projet. Son assistant IA y trouve alors comment intégrer Ofika **correctement**, sans inventer.

**Skill `ofika-delivery-integration`** (format `SKILL.md`, utilisable notamment par Claude Code) :
- `SKILL.md` : quand l'utiliser, étapes d'intégration dans l'ordre (clé test → création → webhook → vérification de signature → production), règles à ne jamais enfreindre :
  - clé API uniquement côté serveur ;
  - toujours vérifier la signature des webhooks ;
  - toujours utiliser `Idempotency-Key` ;
  - ne jamais marquer une commande « livrée » sans webhook `delivery.delivered`.
- `reference/api.md` : endpoints, champs, erreurs.
- `reference/webhooks.md` : chaque événement avec un exemple de contenu.
- `examples/` : intégration Next.js, Express, PHP.
- `scripts/test-connexion` : script qui crée une livraison de test, la simule et vérifie la réception du webhook.

Distribution :
- téléchargeable depuis la documentation développeur ;
- inclus dans le package npm et dans le module Next.js **[Proposition]** ;
- fichier `llms.txt` à la racine de la documentation, pour les assistants qui lisent la doc en ligne **[Proposition]**.

## 6. Serveur MCP

D'après ta note : *permettre à un agent IA d'utiliser les fonctions du système.*

**Outils exposés** (mêmes fonctions que l'API) :
| Outil | Rôle | Type |
|---|---|---|
| `list_deliveries` | Lister et filtrer les livraisons | Lecture |
| `get_delivery` | Détail + historique d'une livraison | Lecture |
| `courier_summary` | Bilan d'un livreur (pris, livrés, retours, en cours) | Lecture |
| `list_pending_returns` | Retours non réceptionnés | Lecture |
| `daily_report` | Résumé de la journée | Lecture |
| `create_delivery` | Créer une livraison | Écriture |
| `assign_delivery` | Affecter un livreur | Écriture |
| `cancel_delivery` | Annuler (avant prise en charge) | Écriture |

**Règles de sécurité (moindre privilège)** :
- Le serveur MCP utilise **une clé API de l'entreprise**. Il a **exactement les mêmes droits** que cette clé, pas plus.
- **Lecture seule par défaut.** Les outils d'écriture s'activent un par un dans les paramètres de la clé **[Proposition]**.
- **Jamais exposé au MCP** : Forcer Livré, réception des retours, facturation, gestion des clés et des utilisateurs.
- Chaque action de l'IA est journalisée dans l'audit, avec `actor_type = API_KEY`.
- Clé test → l'agent travaille seulement en mode test.

**Deux usages :**
- **Gestion** : un responsable demande à son assistant « Combien de colis Kwamé a-t-il livrés aujourd'hui ? » ou « Crée les livraisons de ce fichier ».
- **Développement** : l'assistant de code du développeur utilise le MCP en **mode test** pour vérifier son intégration en direct.

**[À décider]** : MCP distant (hébergé par Ofika, branché avec une URL et une clé), ou package à installer en local ? Le distant est plus simple pour les clients.

---

## Ordre conseillé dans le MVP 2

1. **SDK npm** : les autres briques s'appuient dessus.
2. **Module Next.js** : pour tes propres clients, tout de suite rentable.
3. **Skills** : peu de travail, gros gain pour les développeurs.
4. **Assistant « Connecter mon site »**.
5. **Plugin WooCommerce**.
6. **Serveur MCP** : lecture seule d'abord.

## Autres plugins

À décider selon la demande réelle : quels autres logiciels ou CMS utilisent tes clients à Abidjan ? **[À décider]**
