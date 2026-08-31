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
  `task_ponctuelles`, `observations`, `conditions_jour`, `jours_conges`,
  `repos_exceptions`.
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

## 4. Logique de récurrence dupliquée (calendarLogic.js + fonction SQL taches_oubliees)

La fonction SQL `taches_oubliees` (voir `sql/migrations.sql` migration 5, et
`sql/taches_oubliees_tests.sql`) réimplémente en PL/pgSQL la même règle métier que
`src/lib/calendarLogic.js`, pour que le workflow n8n d'alerte "tâches non faites"
s'appuie sur la même logique que l'app (celle-ci reste en JS, rien n'a changé côté
React).

Règle de sûreté : **aucune valeur métier en dur des deux côtés** — tout paramètre
(`intervalle_jours`, `jours_semaine`, `jour_semaine`, `jours_mois`, `condition`,
`centres.jours_repos`...) vit en base et est lu par les deux implémentations ; seule la
STRUCTURE d'une règle (le "comment interpréter `intervalle_jours`") est en dur, identique
des deux côtés par construction. Tant que cette règle tient, les modifications de Frank
via l'écran Réglages — qui passent toutes par des données, jamais par du code — ne
peuvent pas créer d'écart entre JS et SQL.

**Une modification de la STRUCTURE d'une règle** (pas d'une valeur) doit être répercutée
manuellement aux deux endroits. Une requête de contrôle de cohérence est disponible
(`taches_attendues_jour` dans `sql/migrations.sql`, usage documenté dans
`sql/taches_oubliees_tests.sql`) : à relancer ponctuellement, surtout après une modif de
structure, pour confronter visuellement le résultat SQL à l'écran salarié.

Niveau 2 à envisager pour le multi-centres : une source unique de la règle métier
(probablement le SQL, consommé par l'app via RPC) plutôt que deux implémentations
maintenues en parallèle.

## 5. Contrainte `task_templates_recurrence_check` désynchronisée du code

Constaté en écrivant la fonction `taches_oubliees` (point 4) : la migration 2 de
`sql/migrations.sql` (ajout de `'premier_vendredi'` à la liste des valeurs autorisées pour
`recurrence`) n'a jamais été exécutée sur la base réelle. Résultat : impossible de créer
une tâche avec `recurrence='premier_vendredi'` (rejetée par la contrainte), alors que le
JS (`calendarLogic.js`) et l'écran Réglages (`GestionTaches.jsx`) supportent déjà ce type
de récurrence. L'option "Premier vendredi du mois" est donc actuellement invisible côté
usage réel (aucune tâche de ce type n'existe en base) mais inutilisable si on essaie de
s'en servir. À corriger en exécutant la migration 2 quand ce type de récurrence doit
devenir utilisable.

## Angle mort V2 déjà identifié (hors sécurité)

Le rouleau "3×/semaine décalable selon météo" (§4.2b, §6.4) n'est en V1 qu'un réglage
manuel des jours par l'employeur. La vraie règle métier ("faire par beau temps, reporter
si pluie") nécessiterait une logique météo-conditionnelle pilotée par n8n en V2, pas un
simple décalage de jours. Ne pas sur-concevoir cela en V1.
