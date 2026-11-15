# Ofika Delivery

Système autonome de gestion des livraisons, avec preuve de livraison (Abidjan).
Utilisable seul, ou branché à n'importe quel site ou logiciel via API REST + webhooks.

## Organisation du dossier

```
ofika-delivery/
├── README.md                     ← ce fichier
├── docs/
│   ├── mvp.md                    ← LE MVP à lancer (tout est décidé)
│   ├── mvp1.md                   ← Évolution 1 : preuves avancées, encaissements, OTP
│   ├── mvp2.md                   ← Évolution 2 : plug and play, SDK, WooCommerce, skills IA, serveur MCP
│   ├── mvp3.md                   ← Évolution 3 : grossiste → marchands, automatisation
│   ├── base-de-donnees.md        ← Explication du schéma de la base
│   └── taches-mvp.md             ← Découpage du MVP en tâches, dans l'ordre
├── src/db/schema/                ← Schéma Drizzle (PostgreSQL)
│   ├── enums.ts
│   ├── accounts.ts
│   ├── deliveries.ts
│   ├── proofs.ts
│   ├── integration.ts
│   ├── billing.ts
│   └── index.ts
├── sql/
│   └── 001_audit_append_only.sql ← Protections : journal en ajout seul, livraison verrouillée
└── drizzle.config.ts
```

## Par où commencer
1. Lire `docs/avancement.md` : où on en est, commandes utiles, questions ouvertes.
2. Lire `docs/mvp.md` (le quoi) et suivre `docs/taches-mvp.md` (l'ordre des tâches).

## Stack
Next.js (web + PWA + API) · PostgreSQL (Neon) · Drizzle · hébergement VPS.
