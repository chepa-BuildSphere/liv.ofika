# Tarification Dynamique & Console Super Admin (`platform_settings`)

**Date de mise à jour** : 18/11/2026

## 1. Architecture Base de Données
- **Table `platform_settings`** (`src/db/schema/billing.ts`, migration `drizzle/0005_platform_settings.sql`) :
  - `key` (`text`, PK) : ex. `default_price_per_delivery`
  - `value` (`text`, non null) : montant entier en F CFA (initialisé à `200` depuis le tarif existant en base `dev`)
  - `updated_by_admin_id` (`uuid`, FK vers `platform_admins.id`)
  - `updated_at` (`timestamp with time zone`)

## 2. Service Métier & Cache Next.js 16
- **`getPlatformPricePerDelivery(db)`** (`src/lib/billing/billing.ts`) :
  - Lit `platform_settings` (`key = 'default_price_per_delivery'`), avec repli sur la dernière entreprise modifiée (`companies.price_per_delivery`) puis `DEFAULT_PRICE_PER_DELIVERY` (`10`).
- **`setPlatformPricePerDelivery(db, admin, rawPrice, opts)`** (`src/lib/billing/billing.ts`) :
  - Vérifie la permission `billing.setPrice` de l'admin plateforme.
  - Met à jour `platform_settings` et enregistre `PLATFORM_PRICE_CHANGED` dans `audit_events`.
  - Si `applyToExistingCompanies: true`, met à jour `companies.price_per_delivery` pour les entreprises existantes, historise dans `billing_setting_changes` et journalise `BILLING_SETTING_CHANGED`.
- **`getCachedPlatformPrice()`** (`src/lib/billing/public-price.ts`) :
  - Utilise `'use cache'`, `cacheLife('minutes')` et `cacheTag('platform-pricing')`.
  - Invalidé immédiatement via `updateTag('platform-pricing')` et `revalidatePath('/')` dans `src/app/admin/(backoffice)/companies/actions.ts`.

## 3. Points d'entrée UI
- **Page d'accueil (`/`) & Inscription (`/register`)** : `src/app/page.tsx`, `src/app/minimalist-home-client.tsx`, `src/app/inscription/page.tsx`, `src/app/inscription/company-register-form.tsx`.
- **Console Super Admin (`/admin`, `/admin/facturation`, `/admin/companies/[id]`)** : composant `src/app/admin/(backoffice)/platform-price-card.tsx` et case de synchronisation dans `billing-section.tsx`.

## 4. Normalisation TLS PostgreSQL (`sslmode=verify-full`)
- `normalizePgConnectionString` dans `src/db/index.ts` convertit automatiquement `sslmode=require|prefer|verify-ca` en `sslmode=verify-full` afin d'éviter l'avertissement `pg-connection-string` intercepté en `Console Error` par Next.js 16.4.6 (Turbopack).
