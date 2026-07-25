# À faire avant toute réplication multi-centre

La V1 est volontairement mono-centre et légère sur la sécurité (voir brief §8). Avant de
vendre/déployer ce produit pour un deuxième centre client, il faut impérativement traiter
les points suivants.

## 1. Activer RLS (Row Level Security) sur toutes les tables

Actuellement, l'anon key Supabase donne accès à toutes les lignes de toutes les tables,
filtrées uniquement côté client par `centre_id`. Rien n'empêche techniquement un client
modifié (ou une requête directe à l'API Supabase) de lire ou écrire les données d'un autre
centre.

À faire :
- Activer RLS sur `centres`, `employes`, `task_templates`, `task_completions`,
  `task_ponctuelles`, `observations`, `conditions_jour`.
- Écrire des policies restreignant chaque opération (`select`/`insert`/`update`/`delete`)
  au `centre_id` de l'utilisateur authentifié (via `auth.uid()` une fois le point 2 fait).

**Sans ça : fuite de données entre centres clients = faute RGPD.**

## 2. Migrer l'authentification PIN vers Supabase Auth

Le PIN à 4 chiffres (§5) est un contrôle d'usage terrain, pas une sécurité réelle : pas de
hash, vérifiable par force brute triviale (10 000 combinaisons), pas de lien avec l'identité
réseau de l'utilisateur.

À faire :
- Ajouter une colonne `employes.auth_uid` (référence vers `auth.users`).
- Basculer vers Supabase Auth : email/mot de passe ou magic link.
- Les policies RLS du point 1 s'appuieront sur `auth.uid()` pour retrouver le `centre_id`
  de l'utilisateur connecté.
- Le PIN peut être conservé en complément (déverrouillage rapide sur un poste partagé) mais
  ne doit plus être le seul rempart.

## 3. Gestion des centres

Actuellement `CENTRE_ID` est une constante en dur dans `src/supabaseClient.js`.

À faire :
- Table/écran d'administration pour créer et gérer plusieurs centres.
- Sélection du centre à la connexion (ou déduite de l'utilisateur authentifié).
- Adapter tous les appels dans `src/lib/api.js` pour utiliser le centre courant au lieu de
  la constante fixe.

## Angle mort V2 déjà identifié (hors sécurité)

Le rouleau "3×/semaine décalable selon météo" (§4.2b, §6.4) n'est en V1 qu'un réglage
manuel des jours par l'employeur. La vraie règle métier ("faire par beau temps, reporter
si pluie") nécessiterait une logique météo-conditionnelle pilotée par n8n en V2, pas un
simple décalage de jours. Ne pas sur-concevoir cela en V1.
