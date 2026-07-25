# Tâches écurie

Web-app mobile-first de gestion des tâches récurrentes d'une structure équestre.
Deux rôles : **salarié** (coche les tâches du jour) et **employeur** (gère les conditions,
les tâches ponctuelles, l'historique et les réglages).

V1 mono-centre : un seul centre (`centre_id` fixé dans `src/supabaseClient.js`), mais le
schéma Supabase est déjà multi-tenant-ready.

## Stack

- React + Vite (JavaScript, pas de TypeScript)
- `@supabase/supabase-js` pour l'accès aux données
- CSS simple (pas de librairie UI lourde)
- Déploiement Vercel

## Installation

```bash
npm install
cp .env.example .env.local
# renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local
npm run dev
```

## Tests

Les fonctions pures de logique calendaire (`src/lib/calendarLogic.js`) sont couvertes par
des tests unitaires :

```bash
npm test
```

## Build

```bash
npm run build
```

### ⚠️ Déploiement Vercel — commande de build spécifique

Un problème de permissions connu sur Vercel/Linux avec ce setup impose d'utiliser,
**en commande de build dans les réglages du projet Vercel** :

```
node node_modules/vite/bin/vite.js build
```

(et **pas** `npm run build`). Penser à renseigner `VITE_SUPABASE_URL` et
`VITE_SUPABASE_ANON_KEY` dans les variables d'environnement du projet Vercel.

## Migrations Supabase requises

Voir [sql/migrations.sql](sql/migrations.sql) — à faire exécuter par Frank sur le projet
Supabase avant la mise en service :

1. Colonne `pin` sur `employes` (PIN de départ à changer avant la prod réelle).
2. Élargissement de la contrainte `recurrence` sur `task_templates` pour autoriser la
   valeur `premier_vendredi` (tâche mensuelle "1er vendredi du mois").

## Structure du projet

```
src/
  supabaseClient.js       Client Supabase + CENTRE_ID (V1 mono-centre)
  lib/
    calendarLogic.js      Fonctions pures de logique calendaire (§4 du brief), testées
    calendarLogic.test.js
    constants.js          Constantes ajustables (périodes, saisons, horaires, conditions)
    api.js                Toutes les requêtes Supabase (lecture/écriture)
    session.js            Session employé en sessionStorage (pas de token, pas de localStorage)
  components/
    Login/                Sélection employé + saisie PIN
    SalarieView/           Écran salarié : liste des tâches du jour + observations
    EmployeurView/         Écran employeur : conditions, ponctuelles, tâches oubliées,
                           observations, onglets Historique / Réglages
    TaskList/              Liste de tâches groupée par période (TaskList + TaskItem)
    Historique/            Vue historique par date choisie
    ReglageJours/          Réglage des jours d'une tâche à rouleau (jours_semaine)
```

## Logique métier — récurrences (§4 et §12 du brief)

Toute la logique de "quelles tâches sont attendues aujourd'hui" vit dans
`src/lib/calendarLogic.js`, en fonctions pures testables (aucun accès réseau, la date est
toujours passée en paramètre) :

| Cas | `recurrence` | champ utilisé |
|-----|-----------|---------------|
| Quotidienne | `quotidienne` | — |
| Hebdo simple (ex : mardi/vendredi) | `hebdo` | `jour_semaine` |
| Rouleau 3×/semaine (modifiable par l'employeur, §6.4) | `hebdo` | `jours_semaine` (prioritaire sur `jour_semaine`) |
| Mensuel (ex : 1er et 15) | `mensuelle` | `jours_mois` |
| 1er vendredi du mois | `premier_vendredi` | — |
| Tous les 15 jours (herse carrière) | `intervalle` | `intervalle_jours` + dernière completion |
| Conditionnelle (pluie/gel/grand gel/gardiennage) | `conditionnelle` | `condition` |

Le cas `intervalle` est le seul qui déroge au principe "absence de completion = à faire" :
il regarde la **dernière** completion connue, pas celle du jour même.

## Authentification PIN — ce n'est PAS de la sécurité forte

L'écran de connexion (§5) utilise un code PIN à 4 chiffres par employé, vérifié côté
client contre la table `employes`. C'est un **contrôle d'usage terrain** (éviter un coche
accidentel, savoir qui a coché), pas un mécanisme de sécurité. Voir
[TODO_AVANT_REPLICATION.md](TODO_AVANT_REPLICATION.md) pour la migration vers Supabase Auth
nécessaire avant tout déploiement multi-centre réel.

## RGPD

- Les prénoms de salariés sont des données personnelles RH — le projet Supabase doit être
  hébergé en région **UE**.
- Aucune donnée identifiante n'est loguée en console en production.
- Aucun export de la base vers un service tiers ou une IA externe.
- Finalité du traitement : gestion interne des tâches d'une structure équestre.

## Points à valider avec Frank avant mise en prod (§11 du brief)

- Les PIN réels (ne pas laisser `0000`/`1234`).
- Le nom du centre et les prénoms réels des employés (à saisir par Frank).
- Les jours par défaut du rouleau carrière et l'ergonomie de l'écran de réglage (§6.4).
- Les horaires exacts été/hiver et les heures de fin de période utilisées pour "tâches
  oubliées" — valeurs par défaut ajustables dans `src/lib/constants.js`.
