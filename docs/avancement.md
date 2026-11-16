# Avancement du projet

> Mis à jour le 16/11/2026. À relire en début de session.
> Le découpage des tâches est dans `taches-mvp.md`.

## Où on en est

| Phase | État |
|---|---|
| **Phase 0 — Fondations** | ✅ Terminée (0.1 → 0.7) |
| **Phase 1 — Comptes et droits** | ✅ Terminée (1.1 → 1.7) |
| **Phase 2 — Livreurs** | ✅ Terminée (2.1 → 2.5) |
| **Phase 3 — Livraisons (côté entreprise)** | ✅ Terminée (3.1 → 3.7) |
| **Phase 4 — PWA livreur et validation** | ✅ Terminée (4.1 → 4.12) |
| **Phase 5 — Échecs, retours, Forcer Livré** | ✅ Terminée (5.1 → 5.6) |
| **Phase 6 — API et webhooks** | ✅ Terminée (6.1 → 6.10) |
| **Phase 7 — Facturation** | ✅ Terminée (7.1 → 7.4) |
| **Phase 8 — Tableau de bord et finitions** | ✅ Terminée (8.1 → 8.3) |
| Phase 9 — Tests et mise en ligne | 🔄 Prochaine **tâche 9.1** (passage de toute la checklist mvp.md §13) |

### Détail de la phase 8

| # | Tâche | Preuve |
|---|---|---|
| 8.1 | Tableau de bord entreprise (`/espace`) : livraisons du jour par statut et par livreur, retours non réceptionnés, livraisons forcées, alertes sécurité | Test base (`dashboard.db.test.ts` : calcul précis de `total`, `inTransit`, `deliveredTotal`, `deliveredQr`, `deliveredForced`, `failed`, `returning`, retours non réceptionnés avec calcul des heures écoulées `hoursElapsed`, livraisons forcées avec motif obligatoire, résolution des alertes `SUSPICIOUS_DEVICE_REUSE` avec audit et exclusion inter-entreprises) + test unitaire (`dashboard.test.ts`) + UI `/espace` complète |
| 8.2 | Option OTP visible mais « Bientôt disponible » (`otp_enabled = false`, impossible de l'activer) | Écran `/espace/parametres` avec carte détaillée et commutateur inactif grisé, rejet serveur strict `attemptToggleOtpAction` et garde `proofMode = "QR_OTP"` désactivé dans les formulaires et la validation |
| 8.3 | Notifications dans l'interface (livré, échec, retour, forcé, alertes) | Test base (`getRecentNotifications` extrayant les événements d'audit en temps réel `DELIVERY_DELIVERED`, `DELIVERY_FORCED_DELIVERED`, `DELIVERY_FAILED`, `DELIVERY_RETURNING`, `DELIVERY_RETURN_RECEIVED`, `SUSPICIOUS_DEVICE_REUSE`) + test unitaire (`notifications.test.ts`) + composant `NotificationBell` interactif intégré au header de `/espace/layout.tsx` |

**Fin de phase 8 (8.1 → 8.3)** : `src/lib/dashboard/dashboard.ts`, `src/lib/dashboard/dashboard.test.ts`, `src/lib/dashboard/dashboard.db.test.ts`, `src/lib/notifications/notifications.ts`, `src/lib/notifications/notifications.test.ts`, refonte du tableau de bord `/espace/page.tsx` (`security-alert-card.tsx`), création de `/espace/parametres/page.tsx`, ajout de `NotificationBell` dans `/espace/layout.tsx` et mise à jour des actions dans `/espace/actions.ts`.

### Détail de la phase 7

| # | Tâche | Preuve |
|---|---|---|
| 7.1 | Back-office : bouton **Facturation ON/OFF** + **prix par livraison** par entreprise (`/admin/companies/[id]`) | Test base (`toggleCompanyBilling` active/désactive la facturation, `setCompanyDeliveryPrice` met à jour le prix unitaire en F CFA, historisation dans `billing_setting_changes` et journalisation `BILLING_SETTINGS_UPDATED` dans `audit_events`) + composant `CompanyBillingSection` |
| 7.2 | Calcul du relevé mensuel (livrées, forcées comprises, au prix figé `billed_price`, exclusion mode test) | Test base (`computeCompanyPeriodBilling` et `generateMonthlyStatement` : calcul rigoureux sur livraisons `DELIVERED` avec `proofMethod` `QR` ou `MANUAL`, ventilation par tarif unitaire, gestion compte gratuit à 0 F, exclusion stricte `is_test = true` conformément au trigger SQL `forbid_test_billing`) |
| 7.3 | Écran « Facturation » côté entreprise (lecture seule, réservé `COMPANY_ADMIN`) (`/espace/facturation`) | Test base (`getCompanyBillingOverview` avec période courante, détail des prix figés, liste des relevés et historique des réglages) + UI `/espace/facturation` avec badge ON/OFF, garde `billing.viewStatements` et lien dans le menu de navigation |
| 7.4 | « Marquer comme payé » (admin plateforme, passage à `PAID` avec `paidAt`, blocage de tout recalcul ultérieur) (`/admin/facturation` et `/admin/companies/[id]`) | Test base (`markCompanyStatementPaid` passe le statut à `PAID` avec horodatage, bloque la régénération d'un relevé déjà payé) + page globale `/admin/facturation` + composant `MarkPaidButton` |

**Fin de phase 7 (7.1 → 7.4)** : `src/lib/billing/billing.ts`, `src/lib/billing/billing.db.test.ts`, page `/espace/facturation` (`page.tsx`), back-office `/admin/facturation` (`page.tsx`, `actions.ts`, `mark-paid-button.tsx`), intégration dans `/admin/companies/[id]/page.tsx` (`billing-section.tsx`, `actions.ts`), et mise à jour de la navigation dans `src/app/espace/layout.tsx`.

### Détail de la phase 6

| # | Tâche | Preuve |
|---|---|---|
| 6.1 | Création, liste et révocation des clés API **test et production** (montrées une seule fois) (`/espace/cles-api`) | 2 tests base (`createApiKey`, `listApiKeys`, `revokeApiKey`, `authenticateApiKey` : clés `ofk_test_…` / `ofk_live_…` hachées SHA-256 uniquement, révocation immédiate, refus entreprise suspendue, cloisonnement et accès `COMPANY_ADMIN`) + 2 tests unitaires (`validateCreateApiKeyInput`, `extractBearerToken`) + UI `/espace/cles-api` |
| 6.2 | Authentification API + endpoints REST de §9.2 (`reference`, `metadata`, CSV, événements, PDF, livreurs) (`/v1/*`) | Test base (`v1-api.db.test.ts` couvrant les endpoints `POST /v1/deliveries`, `POST /v1/deliveries/import`, `GET /v1/deliveries`, `GET /v1/deliveries/{id}`, `PATCH /v1/deliveries/{id}`, `POST /v1/deliveries/{id}/assign`, `POST /v1/deliveries/{id}/cancel`, `GET /v1/deliveries/{id}/events`, `GET /v1/deliveries/{id}/label.pdf`, `GET /v1/couriers`) + test unitaire (`serializeV1Delivery`) |
| 6.3 | **Mode test** : `is_test` selon la clé, livraisons cachées par défaut, jamais envoyées aux livreurs, jamais facturées (`billedPrice = null` conformément au trigger `forbid_test_billing`) | Test base (`v1-api.db.test.ts` : cloisonnement strict TEST ↔ LIVE, même référence autorisée, `listDeliveries` cachée par défaut / visible avec `includeTest`, absente de `listCourierDeliveries` et `getCourierSummaries`) + interrupteur « Afficher le mode test » et badge `TEST` sur `/espace/livraisons` et `/espace/livraisons/[id]` |
| 6.4 | Route `POST /v1/test/deliveries/{id}/simulate` (clé test uniquement) | Test base (`v1-api.db.test.ts` : simulation `ASSIGNED → DELIVERED` avec `billed_price = null`, audit `API_KEY` et refus `403` avec clé `LIVE`) via `simulateTestDeliveryStatus` |
| 6.5 | En-tête `Idempotency-Key` sur les `POST` | Test base (`v1-api.db.test.ts` : relecture idempotente `replayed: true` sans double création, rejet `409 IDEMPOTENCY_KEY_CONFLICT` si le corps change) + test unitaire (`computeIdempotencyRequestHash`) |
| 6.6 | Configuration des webhooks **test et production** (URL, événements, secret) (`/espace/webhooks`) | Test base (`webhooks.db.test.ts` : endpoints `TEST` / `LIVE` séparés, secret `whsec_…` chiffré AES-256-GCM) + 2 tests unitaires (`validateWebhookEndpointInput` anti-SSRF) + UI `/espace/webhooks` |
| 6.7 | File d'envoi signée HMAC-SHA256 (`X-Ofika-Signature`), payload standard (`reference`, `metadata`, `livemode`…) et nouvelles tentatives à délai croissant | Test base (`webhooks.db.test.ts` : déclenchement automatique sur cycle de vie, vérification `verifyWebhookSignature`, backoff `60s → 300s → 1800s → 7200s → FAILED`) + 2 tests unitaires (`signWebhookPayload`, `computeNextRetryAt`) |
| 6.8 | Bouton **« Envoyer un webhook de test »** avec affichage immédiat du code HTTP, latence et erreur (`/espace/webhooks`) | Test base (`webhooks.db.test.ts` : `sendTestWebhook` sur `webhook.test`) + action `sendTestWebhookAction` |
| 6.9 | Historique des envois + bouton « Renvoyer » (`/espace/webhooks`) | Test base (`webhooks.db.test.ts` : `listWebhookDeliveries`, `retryWebhookDelivery`, cloisonnement inter-entreprises et accès admin) + UI `/espace/webhooks` |
| 6.10 | Documentation développeur + guide « Brancher mon site en 15 minutes » (`/espace/documentation`) | Test unitaire (`webhooks.test.ts` : 4 étapes quickstart, 11 endpoints `/v1`, vérification HMAC, codes d'erreur) + `src/lib/api-keys/developer-docs.ts` + UI `/espace/documentation` |

**Fin de phase 6 (6.1 → 6.10)** : `src/lib/webhooks/webhook-types.ts`, `src/lib/webhooks/webhooks.ts`, branchement dans `src/lib/deliveries/deliveries.ts`, `src/lib/deliveries/csv-import.ts` et `src/lib/deliveries/status.ts`, UI `/espace/webhooks` (`page.tsx`, `actions.ts`, `webhooks-client.tsx`), documentation `/espace/documentation` (`src/lib/api-keys/developer-docs.ts` et `src/app/espace/documentation/page.tsx`) et liens dans `src/app/espace/layout.tsx` et `src/app/espace/page.tsx`.

### Détail de la phase 5

| # | Tâche | Preuve |
|---|---|---|
| 5.1 | Déclaration d'échec avec motif, commentaire obligatoire si `Autre`, photo et GPS (`/livreur`) | `src/lib/deliveries/transitions.ts`, `src/lib/deliveries/failure-return.ts`, `src/app/livreur/actions.ts`, `src/app/livreur/courier-deliveries-client.tsx` |
| 5.2 | Choix « Nouvelle tentative » ou « Retour au dépôt » après échec (`/livreur`) | `src/lib/deliveries/failure-return.ts`, `src/lib/deliveries/deliveries.ts`, `src/app/livreur/actions.ts`, `src/app/livreur/courier-deliveries-client.tsx` |
| 5.3 | Écran « Réception des retours » regroupé par livreur + scan du QR de référence (`/espace/retours`) | 1 test base (`listReturningDeliveriesGroupedByCourier`) + 1 test unitaire (`matchReturningDeliveryByScan` via `OFIKA-REF:<ref>:<id>` ou référence) + UI `/espace/retours` (`BarcodeDetector` + recherche) |
| 5.4 | Confirmation de réception (état, commentaire, photo) avec refus si livreur lui-même (règle 6) | 2 tests base (`receiveDeliveryReturn` → `RETURN_RECEIVED` + `return_receptions`, blocage règle 6 et hors statut `RETURNING`, historique et timeline `DELIVERY_RETURN_RECEIVED`) + 2 tests unitaires (`validateReturnReceptionInput`, `describeDeliveryEvent`) |
| 5.5 | « Forcer Livré » (admin entreprise, motif obligatoire, refus si livré par soi-même) (`/espace/livraisons/[id]`) | 2 tests base (`forceDeliverDelivery` → `DELIVERED` avec `proofMethod = "MANUAL"`, libellé « Livré (forcé) », `billedPrice` figé, révocation du QR actif, refus non-admin / avant prise en charge / règle 6) + 1 test unitaire (`validateForceDeliveredInput`) + composant `ForceDeliveredForm` |
| 5.6 | Bilan par livreur (`Colis pris = livrés + retours + en cours`) (`/espace/livreurs`) | 1 test base (`getCourierSummaries` vérifiant `pickedUpTotal = delivered + returnReceived + inProgress`, `forcedDelivered`, `isSettled`, exclusion `isTest`, refus `RETURNS_OFFICER`) + tableau et résumé sur `/espace/livreurs` |

**Fin de phase 5 (5.1 → 5.6)** : ajout de `src/lib/deliveries/return-scan.ts`, `src/lib/media/safe-url.ts`, `src/lib/media/compress-image.ts`, extension de `src/lib/deliveries/failure-return.ts`, `src/lib/deliveries/deliveries.ts`, `src/lib/deliveries/transitions.ts` et `src/lib/deliveries/errors.ts`, création de l'espace `/espace/retours` (`page.tsx`, `actions.ts`, `returns-client.tsx`), intégration du formulaire `ForceDeliveredForm` et des blocs de preuve manuelle / réception retour dans `/espace/livraisons/[id]/page.tsx` (+ `forceDeliverAction` dans `actions.ts`), navigation dans `src/app/espace/layout.tsx` et `src/app/espace/page.tsx`, ainsi que du bilan par livreur dans `/espace/livreurs/page.tsx`.

### Détail de la phase 4

| # | Tâche | Preuve |
|---|---|---|
| 4.1 | PWA installable (manifest, icônes, Chrome Android sans installation obligatoire) | 2 tests unitaires (`PWA_MANIFEST` `/livreur` `standalone`, `generateSolidBrandPng(192)` signature PNG + `IHDR`), routes `/manifest.webmanifest`, `/icons/pwa-192.png`, `/icons/pwa-512.png`, `public/icons/pwa-icon.svg`, `public/sw.js` et composant `PwaStatus` (`beforeinstallprompt` + alerte hors ligne) |
| 4.2 | « Mes colis » regroupés par entreprise + masquage contact en retour (`/livreur`) | `listCourierDeliveries` masque `recipientPhone` selon `delivery.viewRecipientContact` (`RETURNING` → `null`, vérifié en base) + sélecteur par entreprise et séparation *À prendre en charge* / *En tournée* avec lien `tel:` dans `CourierDeliveriesClient` |
| 4.3 | Prise en charge d'un colis ou d'un lot (`PICKED_UP` + heure serveur) | 2 tests base (`confirmCourierPickup` unitaire + lot avec `pickedUpAt` serveur et audit `COURIER` ; refus autre livreur / détaché / non `ASSIGNED` sans mutation partielle) + `confirmPickupAction` et sélection unitaire/multiple sur `/livreur` |
| 4.4 | « Arrivé chez le destinataire » + GPS et tentative numérotée (`/livreur`) | 2 tests base (`declareCourierArrived` passe à `ARRIVED`, incrémente `currentAttempt`, crée la ligne `delivery_attempts` avec GPS ou `gpsMissing: true`, enchaîne tentative 1 `FAILED` → tentative 2 `IN_PROGRESS` ; refus autre livreur / détaché / statut non `PICKED_UP`) + 2 tests unitaires (`normalizeGpsCoords`, `describeDeliveryEvent`) |
| 4.5 | Génération du QR 3 min + révocation sur « Nouveau QR » (`/livreur`) | 2 tests base (`issueDeliveryQrToken` génère un jeton 128 bits stocké haché SHA-256 avec `courierDeviceFingerprint`, révoque immédiatement l'ancien jeton `ACTIVE` → `REVOKED` et écrit `QR_GENERATED` ; refus avant `ARRIVED`, autre livreur et livreur détaché) + 2 tests unitaires (`buildClientConfirmUrl`, `describeDeliveryEvent`) + compte à rebours `MM:SS` dans `DeliveryQrPanel` |
| 4.6 → 4.12 | Page client `/c/[token]`, refus même appareil, 3 essais / `QR_LOCKED`, `DELIVERED` + prix figé, rafraîchissement auto, `SUSPICIOUS_DEVICE_REUSE` & mode hors ligne | 3 tests base (`scanDeliveryQrToken`, `verifyDeliveryHandoverCode`, `getPublicQrStatus` : scan client avec GPS/IP/empreinte et code 4 chiffres HMAC → `DELIVERED` avec `proofMethod = "QR"`, `billedPrice` figé ON `10`/OFF `0` et verrouillage ; refus `SAME_DEVICE_REJECTED`, verrouillage `QR_LOCKED` au 3e faux code, rejet QR expiré ; alerte `SUSPICIOUS_DEVICE_REUSE` dans `security_alerts`) + 1 test unitaire (`describeDeliveryEvent` pour 5 événements QR/sécurité) + UI `/c/[token]` + blocage hors ligne `useIsOnline()` |

**Validation QR complète & garde-fous (4.5–4.12)** : service `src/lib/deliveries/qr-token.ts` (`issueDeliveryQrToken`, `getPublicQrStatus`, `scanDeliveryQrToken`, `verifyDeliveryHandoverCode`), calcul du prix figé `billedPrice` au passage `DELIVERED` dans `src/lib/deliveries/status.ts`, page client `src/app/c/[token]/page.tsx` (+ `client-confirm-view.tsx`, `actions.ts`, `status/route.ts` avec polling 2 s et interdiction du copier-coller), saisie du code 4 chiffres + bannière **« Livré ✅ »** et blocage des actions hors ligne (`useIsOnline()` dans `src/app/livreur/pwa-status.tsx`) sur `/livreur`.

**Arrivée & tentatives (4.4)** : `changeDeliveryStatus` (`src/lib/deliveries/status.ts`) incrémente `deliveries.currentAttempt` et crée automatiquement la tentative dans `delivery_attempts` au passage `ARRIVED` (puis met à jour `outcome = "DELIVERED"` ou `"FAILED"`). `normalizeGpsCoords` et `declareCourierArrived` dans `src/lib/deliveries/deliveries.ts` valident ou marquent explicitement `gpsMissing: true` sans bloquer la course ; côté PWA (`src/app/livreur/actions.ts` et `src/app/livreur/courier-deliveries-client.tsx`), le bouton **« Arrivé chez le destinataire »** interroge `navigator.geolocation.getCurrentPosition` avant d'envoyer `declareArrivedAction`.

**PWA & prise en charge (4.1–4.3)** : configuration PWA dans `src/lib/pwa/pwa-config.ts`, `src/app/manifest.ts`, routes PNG `src/app/icons/pwa-192.png/route.ts` et `src/app/icons/pwa-512.png/route.ts`, Service Worker `public/sw.js` et enregistrement/alerte réseau dans `src/app/livreur/pwa-status.tsx` intégré à `src/app/livreur/layout.tsx`. Côté livraisons, `listCourierDeliveries` masque le numéro destinataire dès que le colis n'est plus actif et `confirmCourierPickup` valide la prise en charge atomique d'un ou plusieurs colis dans `src/lib/deliveries/deliveries.ts` + `src/app/livreur/actions.ts` et `src/app/livreur/courier-deliveries-client.tsx` (avec correction des liens `/livreur/premier-acces` sur `src/app/page.tsx`).

### Détail de la phase 3

| # | Tâche | Preuve |
|---|---|---|
| 3.1 | Créer une livraison à la main (`/espace/livraisons`) | 4 tests base (création `CREATED` par admin et gestionnaire + événement `DELIVERY_CREATED` et chaîne d'audit valide, doublon de référence refusé dans l'entreprise et autorisé ailleurs, cloisonnement `listDeliveries`, refus `RETURNS_OFFICER`) + 5 tests unitaires de validation |

| 3.2 | Import CSV/Excel avec rapport d'erreurs ligne par ligne (`/espace/livraisons`) | 6 tests base (100 lignes valides importées `CREATED` + 4 lignes fausses signalées avec n° de ligne exact + 101 événements audit chaînés, cloisonnement et refus `RETURNS_OFFICER`) + 4 tests unitaires (`;`, `,`, `\t`, BOM, guillemets, colonnes manquantes, montants formatés, doublons internes) |

| 3.3 | Liste + filtres (statut, livreur, date, référence) (`/espace/livraisons`) | 7 tests base (filtre par statut, par livreur ou `UNASSIGNED` avec `courierName`, par jour ou plage `from`/`to`, par référence, combinaison et cloisonnement) + 2 tests unitaires de normalisation des filtres |

| 3.4 | Modifier / annuler avant prise en charge (`/espace/livraisons`) | 9 tests base (`updateDelivery` et `cancelDelivery` possibles en `CREATED` et `ASSIGNED` avec audit `DELIVERY_UPDATED` / `DELIVERY_CANCELLED`, doublon refusé, refus `AFTER_PICKUP` dès `PICKED_UP` / `ARRIVED` / `DELIVERED` / `CANCELLED`, cloisonnement `NOT_FOUND` et refus `RETURNS_OFFICER`) |

| 3.5 | Affecter / réaffecter un livreur (`/espace/livraisons` et `/livreur`) | 12 tests base (`assignCourier` affectation `ASSIGNED`, réaffectation avec `previousCourierId`, désaffectation `CREATED`, `listCourierDeliveries` ne montre les colis qu'au livreur affecté et disparaît au détachement, refus livreur autre entreprise / détaché / `AFTER_PICKUP` / `RETURNS_OFFICER` / `NOT_FOUND`) |

| 3.6 | Détail d'une livraison + timeline de l'historique (`/espace/livraisons/[id]`) | 2 tests base (`getDeliveryDetail` timeline chronologique complète avec résolution des noms d'acteurs, diff des champs modifiés et GPS ; cloisonnement inter-entreprises `NOT_FOUND` et restriction `RETURNS_OFFICER` aux retours avec téléphone masqué) + 5 tests unitaires (`describeDeliveryEvent`) |

| 3.7 | Bordereau PDF avec QR de référence (`/espace/livraisons/[id]/bordereau.pdf`) | 2 tests base (`generateDeliveryLabelPdf` : génération PDF 1.4 par admin/gestionnaire avec `OFIKA-REF:<ref>:<id>`, refus `NOT_FOUND` autre entreprise/UUID invalide et `FORBIDDEN` pour `RETURNS_OFFICER`) + 2 tests unitaires (encodeur/décodeur QR `encodeQrMatrix`/`parseReferenceQrPayload` et rendu `renderDeliveryLabelPdf` incluant `Livré (forcé)`) |

**Bordereau PDF & QR de référence (3.7)** : encodeur matriciel QR ISO/IEC 18004 sans dépendance externe (`src/lib/qr/qr-matrix.ts` : `buildReferenceQrPayload`, `parseReferenceQrPayload`, `encodeQrMatrix`, `renderQrSvg`), générateur PDF 1.4 A4 autonome avec encodage WinAnsi (`src/lib/deliveries/label-pdf.ts` : `renderDeliveryLabelPdf`), service `generateDeliveryLabelPdf` dans `src/lib/deliveries/deliveries.ts` (garde `delivery.generatePdf`, statut centralisé dans `src/lib/deliveries/transitions.ts`), route HTTP GET `/espace/livraisons/[id]/bordereau.pdf` (`src/app/espace/livraisons/[id]/bordereau.pdf/route.ts`) et boutons d'ouverture depuis `/espace/livraisons` et `/espace/livraisons/[id]`.

**Détail & timeline (3.6)** : `describeDeliveryEvent` et `getDeliveryDetail` dans `src/lib/deliveries/deliveries.ts`, liens depuis `/espace/livraisons` (`src/app/espace/livraisons/page.tsx`) et page dédiée `src/app/espace/livraisons/[id]/page.tsx` avec fiche complète, `<DeliveryRowActions />` avant prise en charge et `<ol aria-label="Timeline de la livraison">` filtrée par `audit.view` avec masquage du téléphone selon `delivery.viewRecipientContact`. Page d'accueil `/` (`src/app/page.tsx`, `src/app/minimalist-home-client.tsx`) refondue selon `skills/minimalist-skill` avec la police Poppins (`src/app/layout.tsx`, `src/app/globals.css`).

**Affectation & vue livreur (3.5)** : `assignCourier` et `listCourierDeliveries` dans `src/lib/deliveries/deliveries.ts`, sélecteur en ligne dans `src/app/espace/livraisons/delivery-row-actions.tsx` et affichage des colis regroupés par entreprise sur `/livreur` (`src/app/livreur/page.tsx`). Contrôle `delivery.assignCourier` (admin et gestionnaire, avant `PICKED_UP` seulement) et vérifie que le livreur est actif et rattaché à l'entreprise ; côté livreur, `listCourierDeliveries` filtre via `courierActor` et `courier.companies`. Pool `pg` (`src/db/index.ts`) renforcé (`keepAlive: true` + écoute `error` sur connexions actives).

**Modification & annulation (3.4)** : `updateDelivery` et `cancelDelivery` dans `src/lib/deliveries/deliveries.ts` + actions en ligne `DeliveryRowActions` sur `/espace/livraisons` (`src/app/espace/livraisons/delivery-row-actions.tsx`). Contrôlent `delivery.editBeforePickup` / `delivery.cancelBeforePickup` (admin et gestionnaire, statuts `CREATED` et `ASSIGNED` uniquement), préservent `metadata` lorsque non fourni par le formulaire, journalisent `DELIVERY_UPDATED` (avant/après) et passent par `changeDeliveryStatus(..., "CANCELLED")`.

**Liste & filtres (3.3)** : `normalizeDeliveryFilters` et `listDeliveries` enrichi (`leftJoin` sur `couriers` pour exposer `courierName` / `courierPhone`) dans `src/lib/deliveries/deliveries.ts`, et barre de filtres GET sur `/espace/livraisons` (statut, livreur / « Non affectée », date, référence, bouton « Réinitialiser »).

**Import CSV/Excel (3.2)** : `src/lib/deliveries/csv-import.ts` + `import-deliveries-form.tsx`. Supporte fichiers CSV (`;`, `,`) et copier-coller direct depuis Excel (`\t`), BOM UTF-8, guillemets RFC 4180, en-têtes FR/EN tolérants aux accents et modèle CSV téléchargeable. Insertion par lot via `tenantScope.insertMany` (`src/lib/tenant/scope.ts`) et chaînage d'audit groupé `logEvents` (`src/lib/audit/index.ts`), avec rapport d'erreurs ligne par ligne (champs invalides, doublons internes ou déjà présents en base).

**Création manuelle (3.1)** : `src/lib/deliveries/deliveries.ts` (`createDelivery`, `listDeliveries`, `validateDeliveryInput`) et `/espace/livraisons`. Réservée à l'admin entreprise et au gestionnaire (`delivery.create`). Normalise le téléphone destinataire (`normalizePhone`), impose un montant entier positif/nul en F CFA, refuse `QR_OTP` tant que l'option est en maintenance dans le MVP, vérifie l'unicité de `reference` dans l'entreprise (hors mode test) et journalise `DELIVERY_CREATED` dans la même transaction.

### Détail de la phase 2

| # | Tâche | Preuve |
|---|---|---|
| 2.1 | Ajouter / rattacher un livreur (`/espace/livreurs`) | 6 tests base (même téléphone écrit autrement = 1 livreur rattaché à 2 entreprises, type de contrat par entreprise, doublon refusé, rattachement après détachement, validations, droits) + 18 tests de numéros + navigateur |

| 2.2 | Premier accès : code d'accès (option B) + PIN 6 chiffres | 7 tests base (PIN haché scrypt, code à usage unique, 5 faux = code annulé, expiré, remplacé, PIN facile refusé sans consommer le code, autre entreprise / resp. retours refusés) + 12 tests du PIN + navigateur mobile |

| 2.3 | Connexion livreur `/livreur/connexion` → `/livreur` | 7 tests base (connexion, 5 PIN faux = bloqué 15 min en base, compteur remis à zéro, numéro inconnu / sans PIN / désactivé = même message, déconnexion, entreprise détachée ou suspendue retirée, sessions cloisonnées) + navigateur mobile |

| 2.4 | Empreinte de l'appareil du livreur à la connexion | 8 tests base (empreinte enregistrée dans `sessions.device_fingerprint` et dans l'audit `COURIER_LOGIN`, renvoyée par la session, distincte d'un appareil à l'autre) + 6 tests unitaires (SHA-256 déterministe, portrait = paysage, langue normalisée, parsing défensif) |

| 2.5 | Détacher un livreur + rapprochement règle 6 | 9 tests base (`detachCourier` passe `attached = false`, journalise `COURIER_DETACHED`, révoque les codes en attente, retire immédiatement l'entreprise de la session livreur et bloque `courierActor`, refus si déjà détaché / autre entreprise / resp. retours ; règle 6 : `CompanyUserIdentity.courierId` chargé à la connexion par téléphone et bloquant `forceDelivered` / `return.receive` sur ses propres colis) |

**Détachement & règle 6 (2.5)** : `detachCourier` dans `src/lib/couriers/couriers.ts` + bouton avec confirmation sur `/espace/livreurs` (`src/app/espace/livreurs/detach-courier-button.tsx`). Désactive `company_couriers`, révoque les codes d'accès non utilisés émis par cette entreprise et journalise `COURIER_DETACHED`. Côté session livreur (`getCourierBySession`) et droits (`courierActor` dans `src/lib/auth/permissions.ts`), l'entreprise détachée disparaît immédiatement sans couper ses autres entreprises. Règle 6 bouclée : `loadIdentity` (`src/lib/auth/company-user.ts`) rapproche l'utilisateur et le compte livreur ayant le même numéro normalisé pour remplir `CompanyUserIdentity.courierId`.

**Empreinte d'appareil (2.4)** : `src/lib/security/device-fingerprint.ts` + `src/lib/device-signals-client.ts`. À la connexion (`/livreur/connexion`), le navigateur envoie les signaux de l'appareil (User-Agent, plateforme, écran normalisé portrait/paysage, langue, fuseau horaire, cœurs, points tactiles), complétés par les en-têtes HTTP (`User-Agent`, `Sec-CH-UA-*`, `Accept-Language`). Le serveur calcule une empreinte SHA-256 déterministe et l'enregistre dans `sessions.device_fingerprint` et dans l'événement d'audit `COURIER_LOGIN`. Exposée sur `CourierIdentity.deviceFingerprint` pour la génération et le contrôle du QR en phase 4.

**Connexion livreur (2.3)** : `src/lib/auth/courier.ts`. Téléphone (toute écriture) + PIN. Blocage stocké en base (`pin_failed_attempts`, `pin_locked_until`) : survit au redémarrage. Session 14 jours, cookie `ofika_livreur`. L'accueil `/livreur` liste les entreprises où il est rattaché et actif (colis en phase 3). Point mineur noté : le message « compte bloqué » n'apparaît que pour un numéro existant (permet de deviner qu'un numéro est livreur après 5 essais).

**Premier accès (2.2)** : décision de l'utilisateur = **option B, code d'accès** (pas de SMS). L'entreprise obtient un code à 6 chiffres (48 h, usage unique, empreinte HMAC dans `courier_access_codes`, migration 0003) à l'ajout du livreur ou via « Nouveau code d'accès ». Le livreur va sur `/livreur/premier-acces` : téléphone + code + PIN (×2). PIN refusé s'il est trop facile (000000, 123456, 121212…). **Risque connu** : le code passant par l'entreprise, quelqu'un de l'entreprise pourrait choisir le PIN à la place du livreur et voir les colis de ses autres entreprises. **Parade** : un code n'est générable que tant que le livreur n'a pas de PIN ; ensuite plus aucune entreprise ne peut en générer. « PIN oublié » à traiter à part (vérification d'identité à définir, idéalement par SMS).

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
