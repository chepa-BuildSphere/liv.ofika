# Base de données — Ofika Delivery (MVP)

PostgreSQL + **Drizzle**. Le code est dans `src/db/schema/`. Les protections SQL sont dans `sql/001_audit_append_only.sql`.

## 1. Vue d'ensemble

```
platform_admins                       (toi)
companies ─┬─ users ── user_roles     (admin entreprise, gestionnaire, resp. retours)
           ├─ company_couriers ── couriers   (1 livreur = 1 compte, plusieurs entreprises possibles)
           ├─ deliveries ─┬─ delivery_attempts ─┬─ qr_tokens   (QR + code de remise 4 chiffres)
           │              │                     └─ otp_codes   (option en maintenance)
           │              ├─ manual_overrides   (« Forcer Livré »)
           │              └─ return_receptions  (retour réceptionné)
           ├─ api_keys / idempotency_keys
           ├─ webhook_endpoints ── webhook_deliveries
           ├─ security_alerts
           ├─ billing_setting_changes / monthly_statements
           └─ audit_events  (journal d'audit, ajout seul, chaîné)
sessions · feature_flags
```

## 2. Rôle de chaque fichier

| Fichier | Contenu |
|---|---|
| `enums.ts` | Toutes les listes fixes : rôles, statuts, motifs d'échec, méthodes de preuve… |
| `accounts.ts` | Admins plateforme, entreprises (avec les réglages de facturation), utilisateurs et rôles, livreurs, rattachements livreur ↔ entreprise, sessions |
| `deliveries.ts` | Livraisons, tentatives, « Forcer Livré », réceptions de retour |
| `proofs.ts` | QR + code de remise, OTP, journal d'audit, alertes de sécurité |
| `integration.ts` | Clés API, idempotence, webhooks |
| `billing.ts` | Historique des réglages de facturation, relevés mensuels, interrupteurs |

## 3. Correspondance avec `mvp.md`

| Règle du MVP | Où c'est dans la base |
|---|---|
| Cloisonnement par entreprise | `company_id` sur toutes les données métier. **Chaque requête doit filtrer dessus** |
| Plusieurs rôles par utilisateur | Table `user_roles` |
| Livreur multi-entreprises, employé ou indépendant | `couriers` (compte unique) + `company_couriers` (`employment_type` par entreprise) |
| PIN à 6 chiffres | `couriers.pin_hash` (+ blocage après essais faux) |
| QR valable 3 min, 3 essais | `qr_tokens.expires_at`, `qr_tokens.failed_code_attempts` |
| Code de remise à 4 chiffres | `qr_tokens.handover_code_hash` (créé au scan) |
| Localisation, empreinte, IP du client au scan | `qr_tokens.client_*` |
| Refus si le scan vient du téléphone du livreur | Comparaison `client_device_fingerprint` ↔ `courier_device_fingerprint` |
| Alerte « deuxième téléphone » | Index `(courier_id, client_device_fingerprint)` + table `security_alerts` |
| Tentatives illimitées et numérotées | `delivery_attempts.attempt_number` |
| Forcer Livré (motif obligatoire) | `manual_overrides` + `deliveries.proof_method = MANUAL` |
| Retour réceptionné par un autre que le livreur | `return_receptions.received_by_user_id` (vérifié dans le code) |
| Journal infalsifiable | `audit_events` : ajout seul (trigger SQL) + `prev_hash` / `hash` |
| Consultations du support journalisées | `audit_events` avec `actor_type = PLATFORM_ADMIN`, `event_type = SUPPORT_VIEW` |
| Livré = verrouillé | Trigger SQL `deliveries_locked` |
| 10 F par livraison livrée, prix figé | `companies.price_per_delivery` + `deliveries.billed_price` (figé, protégé par trigger) |
| Bouton facturation ON/OFF par entreprise | `companies.billing_enabled` + historique dans `billing_setting_changes` |
| Relevé de fin de mois | `monthly_statements` |
| OTP en maintenance | `feature_flags.otp_enabled = false` + `companies.otp_enabled` |
| Mode test séparé, jamais facturé | `deliveries.is_test` (fixé à la création, protégé par trigger) + `webhook_endpoints.environment` + `idempotency_keys.environment` |
| Référence et données du site renvoyées dans les webhooks | `deliveries.reference` + `deliveries.metadata` |
| Webhook de test | `webhook_deliveries.event_type = 'webhook.test'` |

## 4. Points d'attention pour le code

- **Ne jamais stocker en clair** : PIN, mots de passe, jetons QR, codes de remise, OTP, clés API → hash uniquement.
- **Exception** : le secret des webhooks doit être relu pour signer. Il est donc **chiffré**, pas haché.
- **Changements de statut** dans une **transaction** qui fait trois choses ensemble : mise à jour de `deliveries`, insertion dans `audit_events`, création du webhook en attente.
- **Mode test** : chaque requête filtre aussi sur `is_test` selon le type de clé (test ou live). Une clé test ne doit jamais voir une livraison réelle.
- **Montants** en entiers (francs CFA), jamais en nombres à virgule.
- **Heure** : toujours celle du serveur (`defaultNow()`), jamais celle envoyée par le téléphone.

## 5. Mise en place

```bash
npm i drizzle-orm pg
npm i -D drizzle-kit @types/pg
# DATABASE_URL=postgres://... dans .env
npx drizzle-kit generate   # crée les migrations dans ./drizzle
npx drizzle-kit migrate    # applique les migrations
psql "$DATABASE_URL" -f sql/001_audit_append_only.sql   # triggers + interrupteur OTP
```
