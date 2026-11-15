# MVP 1 — Delivery Trust Engine complet + encaissements

> À faire **après** le lancement du MVP, quand il tourne chez de vrais clients.
> Objectif : renforcer les preuves et gérer l'argent encaissé par les livreurs.

## 1. QR code inversé

> Le QR affiché par le livreur et scanné par le client est passé dans le **MVP**, comme méthode par défaut.

Reste à faire ici, d'après ta note :
- **Option B** : c'est le livreur qui scanne un QR code présenté par le destinataire, reçu au moment de la commande, par exemple sur la page de confirmation du site e-commerce.
- QR qui change automatiquement toutes les X secondes à l'écran **[Proposition]**.

## 2. Photo et signature

- Photo du colis remis, et/ou signature du destinataire à l'écran.
- **Facultative ou obligatoire selon le niveau de preuve choisi** (voir §3).

## 3. Niveaux de preuve configurables

Le MVP a déjà deux niveaux : **QR (gratuit)** et **QR + OTP (option)**. On ajoute ici la photo et la signature. Chaque entreprise, voire chaque livraison, choisit son niveau **[Proposition, à valider]** :

| Niveau | Preuves exigées |
|---|---|
| Standard (MVP) | QR + confirmation du client + GPS + horodatage |
| Renforcé (codé dans le MVP, en maintenance) | Standard + OTP |
| Renforcé + photo | Renforcé + photo |
| Maximal | Renforcé + photo + signature |

## 4. Gestion des encaissements (paiement à la livraison)

C'est le bloc « Gestion des encaissements » de ton schéma, et le « prix affiché » de ta description.
- Montant à encaisser sur chaque livraison (déjà présent comme information dans le MVP).
- Le livreur déclare le montant encaissé et le mode de paiement lors de la validation.
- **Rapprochement** au retour du livreur : montant attendu, montant déclaré, montant remis à l'entreprise, avec les écarts.
- Le motif d'échec « Paiement indisponible » est relié à ce module.
- Nouveaux événements : `PAYMENT_COLLECTED`, `CASH_HANDED_OVER`.

**[Validé]** Paiement à la livraison par **Wave**, **mobile money** ou **espèces**.
**[À décider]** : simple déclaration par le livreur, ou intégration avec Wave / mobile money pour vérifier automatiquement le paiement ?

## 4 bis. OTP — sortie du mode maintenance
- Choix d'un fournisseur SMS/WhatsApp en Côte d'Ivoire, puis activation de l'interrupteur `otp_enabled`.
- Facturation des envois à l'entreprise cliente **[À décider]**.

## 5. Notifications enrichies

- Option OTP par **WhatsApp** en plus du SMS, si ce n'est pas déjà fait dans le MVP.
- Notification au destinataire : « votre colis est en route ».
- Notification à l'admin ou au support quand une livraison demande une action (ta note : « l'administrateur doit peut-être valider la commande »).

## 6. Commentaires et litiges

- Fil de commentaires sur chaque livraison (entreprise ↔ livreur).
- Ouverture d'un **litige** (« je n'ai pas reçu ») avec, joint automatiquement, le dossier de preuves de la livraison.
- Export PDF du **dossier de preuve** d'une livraison : chronologie, GPS, preuves, chaîne d'audit.

## 7. Mode hors ligne partiel de la PWA

- Consultation des colis et préparation des déclarations d'échec sans réseau, puis envoi au retour du réseau.
- La **validation (QR ou OTP) reste en ligne**, car c'est la vérification par le serveur qui donne sa valeur à la preuve.
