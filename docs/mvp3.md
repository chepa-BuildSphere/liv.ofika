# MVP 3 — Plateforme : multi-niveaux, IA et automatisation

> Objectif : passer d'un outil de gestion à une plateforme.
> À ne lancer que si les MVP précédents sont utilisés et que les clients demandent ces fonctions.

## 1. MCP (agent IA)

> **Avancé dans `mvp2.md` §6.** Reste ici, si le besoin apparaît : un agent IA qui propose des affectations ou détecte des anomalies, avec validation humaine.

## 2. Structure grossiste → marchands

C'est le cas de ta description : un grossiste vend à des marchands qui vendent à leurs clients.
- Une entreprise « grossiste » peut avoir des **sous-comptes marchands**.
- Chaque marchand ne voit que ses livraisons. Le grossiste voit l'ensemble.
- La matrice des permissions est étendue avec le rôle « Marchand ».

**[À décider]** : est-ce le grossiste qui livre pour le marchand, ou le marchand qui utilise ses propres livreurs ?

## 3. Livreurs partagés entre entreprises

> Passé dans le **MVP** (un livreur peut travailler pour plusieurs entreprises, avec un seul compte).
> Reste ici : un annuaire de livreurs indépendants disponibles, que les entreprises pourraient solliciter **[Proposition]**.

## 4. Affectation assistée ou automatique

- Suggestion de livreur selon la zone (quartiers d'Abidjan) et la charge de travail.
- Regroupement des colis par zone pour une même tournée.

## 5. Suivi et statistiques

- Position du livreur pendant la tournée (avec son consentement, et seulement pendant les heures de service) **[À décider]**.
- Statistiques : taux de réussite par livreur et par zone, motifs d'échec les plus fréquents, délais.

## 6. Application native (si nécessaire)

- Seulement si la PWA montre des limites réelles sur le terrain (scan, mode hors ligne, notifications).
