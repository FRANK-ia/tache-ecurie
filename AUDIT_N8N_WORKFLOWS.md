# Audit critique — 3 workflows n8n écurie (2026-09-05)

Audit mené sur l'instance n8n Hostinger réelle (lecture des workflows + historique
d'exécution réel, pas de supposition). Deux failles **bloquantes** ont été trouvées
**déjà actives en production**, pas seulement des risques théoriques — voir §1 et §2.

Rien n'a été corrigé dans n8n. Toutes les corrections proposées attendent validation
de Frank avant application (via le MCP n8n).

---

## Constat le plus important : le filet de sécurité est cassé

Les 4 workflows pointent vers un workflow "⚠️ Gestionnaire d'erreurs — Alerte mail"
(`GpHUYM009SJL4Xpl`) censé envoyer un mail à `iasolutions.frank@gmail.com` à chaque
erreur. **Ce gestionnaire échoue à 100% (3 tentatives réelles, 3 échecs)** — voir §2.
Concrètement : **aucune des failles listées plus bas n'a généré la moindre alerte
visible pour Frank.** Tout ce qui suit a été découvert en lisant l'historique
d'exécution n8n directement, pas via une notification reçue.

---

## 🔴 BLOQUANT

### 1. Purge des photos (workflow 1) : bloquée en production depuis 3 jours, et le restera indéfiniment

**Workflow :** Écurie — Purge photos commentaires lus (`5vwr7Vq48PsPCB7s`)

**Preuve :** les 3 dernières exécutions cron (03h, les 2026-09-03, 09-04, 09-05) sont
toutes en erreur. Les 2 exécutions précédentes (09-01, 09-02) avaient réussi.

**Cause racine (confirmée, pas supposée) :** le node "Vider image_path" a un champ
`fieldsUi.fieldValues: [{ fieldId: "image_path" }]` **sans valeur associée**. Résultat
observé en base : au lieu de mettre `image_path` à `NULL` après une purge réussie, il
le met à `''` (chaîne vide). Or le filtre de lecture du lendemain
(`image_path=not.is.null`) considère `''` comme "non null" — la ligne est donc
resélectionnée le jour suivant. Le node "Supprimer fichier bucket" tente alors un
`DELETE .../commentaires-photos/` (chemin vide) → Supabase Storage répond 404
(`NoSuchKey`) → le node HTTP lève une erreur (aucun "Continue On Fail" configuré) →
**toute l'exécution s'arrête net**, y compris pour les autres photos du même lot qui,
elles, étaient légitimement à purger.

**Vérifié en base (lecture seule) :** 1 ligne avec `image_path=''` (le poison), 1 vraie
photo actuellement bloquée derrière elle et qui ne sera jamais purgée tant que ça dure.

**Mécanisme auto-aggravant :** ce bug se regénère lui-même. Chaque purge qui *réussit*
crée la ligne poison du lendemain (`''` au lieu de `NULL`), qui bloque alors *toutes*
les purges suivantes. Corriger uniquement la ligne actuelle sans corriger le node ne
fait que repousser le blocage de quelques jours.

**Correction proposée (double, pas l'une sans l'autre) :**
1. **Immédiat (données) :** mettre `image_path` à `NULL` sur la ligne actuellement
   coincée (`observations.id = '4ed72fc8-87b1-48c4-9490-e64decb8bcf9'`, message "Aaaa",
   aucune vraie photo n'y était attachée — rien à supprimer côté Storage).
2. **Structurel (workflow) :**
   - Corriger le node "Vider image_path" pour qu'il pousse explicitement `null` (pas un
     champ vide) sur `image_path`.
   - Ajouter "Continue On Fail" sur "Supprimer fichier bucket" (un item en échec —
     fichier déjà supprimé, chemin invalide — ne doit jamais bloquer les suivants).
   - Optionnel mais robuste : durcir le filtre de lecture en excluant aussi la chaîne
     vide (`image_path=not.is.null&image_path=neq.`), en plus du null, en ceinture.

---

### 2. Le gestionnaire d'erreurs échoue systématiquement (0 alerte reçue, jamais)

**Workflow :** ⚠️ Gestionnaire d'erreurs — Alerte mail (`GpHUYM009SJL4Xpl`)

**Preuve :** 3 exécutions dans toute l'historique du workflow (déclenchées par les 3
échecs du §1), **3 échecs**. Aucune exécution réussie n'existe dans l'historique de ce
workflow.

**Cause racine :** le node "Formater alerte" est en mode `runOnceForEachItem` mais
`return`e `[{ json: {...} }]` (un tableau) au lieu de `{ json: {...} }` (l'objet
attendu dans ce mode précis). n8n rejette systématiquement ce format
(`"A 'json' property isn't an object"`) — **ce n'est pas intermittent, ça casse à
chaque déclenchement**, quel que soit le workflow ou l'erreur d'origine.

**Impact :** ce gestionnaire est branché sur les 4 workflows métier. Tant qu'il est
cassé, **toute erreur silencieuse dans n'importe lequel des 4 workflows passe
inaperçue** — y compris celles listées en §7 et §10 plus bas, qui elles-mêmes ne
lèvent une exception que dans certains cas.

**Correction proposée :** dans le node "Formater alerte", soit repasser le mode à
"Run Once for All Items" (le `return [{ json: {...} }]` actuel devient alors correct),
soit garder `runOnceForEachItem` et changer le `return` en `return { json: { html,
sujet } };` (sans le tableau).

**À faire tout de suite après correction :** déclencher une erreur volontaire (ex.
exécuter manuellement le workflow 1 sans corriger le point 1) pour confirmer que le
mail arrive réellement — ce diagnostic ne peut être vérifié qu'en conditions réelles.

---

## 🟠 IMPORTANT

### 3. Aucune tolérance aux erreurs partielles dans le lot de purge (workflow 1)

Même une fois le §1 corrigé, le node "Supprimer fichier bucket" n'a toujours pas de
"Continue On Fail". N'importe quel item isolé en échec (fichier supprimé manuellement
entre-temps, corruption d'un chemin, latence Storage) bloquera de nouveau *tout* le lot
du jour, y compris les photos derrière lui qui n'ont rien à voir. C'est le même
mécanisme que le §1, pas seulement sa conséquence actuelle — la case à cocher
"Continue On Fail" doit être ajoutée indépendamment du fix du §1.

### 4. Fuseau horaire : le seuil de purge n'est pas calé sur minuit Paris

**Workflow :** Purge photos (`5vwr7Vq48PsPCB7s`)

Le filtre `lu_le=lt.{{ $today.toFormat('yyyy-MM-dd') }}` compare une colonne
`timestamptz` (`lu_le`) à une chaîne de date nue. PostgREST/Postgres caste cette chaîne
en `timestamptz` en l'interprétant à **minuit UTC**, pas minuit Paris. Paris étant en
avance sur UTC (+1h hiver, +2h été), le seuil réel appliqué est décalé de 1 à 2h **plus
tôt** que ce que "aujourd'hui minuit à Paris" signifie réellement.

**Conséquence concrète :** une photo lue entre minuit et ~1h-2h du matin (heure de
Paris) peut se retrouver purgée le jour même de sa lecture au lieu du lendemain — la
fenêtre de grâce prévue ("purger le lendemain de la lecture") peut tomber à quasiment
zéro pour les lectures juste après minuit. Le reste de la journée n'est pas affecté
(l'écart ne joue que dans cette fenêtre étroite).

**Correction proposée :** construire le seuil explicitement en Europe/Paris plutôt que
de laisser PostgREST caster une date nue, par exemple en envoyant l'instant ISO complet
avec l'offset Paris (`{{ $today.setZone('Europe/Paris').startOf('day').toUTC().toISO()
}}`) plutôt qu'une simple date `yyyy-MM-dd`.

*Point positif à noter (pas un bug) :* le workflow météo (§3a), lui, gère bien le
fuseau — il passe explicitement `timezone=Europe/Paris` à Open-Meteo, ce qui rend
l'indice [1] ("demain") cohérent avec le calendrier Paris quelle que soit l'heure
d'exécution. Bon réflexe, à généraliser au §4 ci-dessus.

### 5. Le clic sur les boutons météo n'est jamais "répondu" côté Telegram

**Workflow :** Écurie — Météo : réception clic (`lRuYLl7dRf8hb7nK`)

Aucun node "Answer Callback Query". Conséquence vérifiée par lecture du flux : le petit
indicateur de chargement du bouton Telegram peut rester actif côté client, et surtout,
**rien ne modifie le message original après la décision** — les boutons "Oui"/"Non"
restent cliquables indéfiniment. Il est possible de cliquer "Oui" puis "Non" (ou
plusieurs fois) sur le même message, des jours plus tard. Grâce à la contrainte
`UNIQUE (centre_id, jour, condition)` déjà en place et à `Prefer:
resolution=merge-duplicates`, ça reste **sans danger côté données** (pas de doublon),
mais c'est trompeur : rien à l'écran n'indique qu'une décision a déjà été prise.

**Correction proposée :** ajouter un node Telegram "Answer Callback Query" juste après
le décodage (avant l'insert Supabase, pour que le bouton réagisse vite quel que soit le
temps de réponse de Supabase), et éditer le message original
(`editMessageReplyMarkup`/`editMessageText`) pour retirer les boutons ou afficher la
décision prise ("✅ Activé" / "Ignoré").

### 6. Aucun contrôle sur qui peut activer une condition météo

**Workflow :** Écurie — Météo : réception clic (`lRuYLl7dRf8hb7nK`)

N'importe quel membre du groupe Telegram peut cliquer "Oui" et activer une condition —
y compris le salarié. Côté app web, ce geste est structurellement réservé au rôle
employeur (`EmployeurView.jsx`, `toggleCondition`). Le canal Telegram contourne
totalement cette séparation de rôles. Ce n'est pas forcément un problème si le groupe
Telegram est restreint à Frank/Laetitia, mais **c'est une décision qui n'a jamais été
formalisée** — à trancher explicitement plutôt que laissée par défaut.

**Options (à choisir, pas à deviner) :** (a) filtrer `callback_query.from.id` contre
l'identifiant Telegram de Laetitia dans le node "Décoder le clic" ; (b) accepter
explicitement que tout membre du groupe peut valider — et documenter ce choix.

### 7. Échec silencieux si Open-Meteo renvoie une forme de réponse inattendue

**Workflow :** Écurie — Météo : proposition (`FEeJAMg6CwnkPiQ3`)

Le garde `if (!d || !d.time || d.time.length < 2) return [];` avale l'anomalie sans
lever d'exception — donc sans passer par le gestionnaire d'erreurs (même une fois le
§2 corrigé, celui-ci ne se déclenche que sur une vraie erreur n8n). Si Open-Meteo change
un jour la forme de sa réponse ou renvoie des données partielles, **personne n'est
prévenu** : pas de message Telegram (normal, silence voulu si pas de condition), mais
pas de mail non plus (anormal, on ne sait pas distinguer "rien à signaler" de "la
source de données a un problème").

**Correction proposée :** remplacer le `return []` de ce cas précis par un
`throw new Error(...)` explicite, pour qu'il remonte au gestionnaire d'erreurs (une
fois le §2 réparé).

### 8. La proposition météo est envoyée même les jours de repos/congé

**Workflow :** Écurie — Météo : proposition (`FEeJAMg6CwnkPiQ3`)

Confirmé : aucun appel à `est_jour_non_travaille` avant l'envoi. Sans conséquence sur
les tâches réellement affichées le lendemain (`taches_attendues_jour` neutralise déjà
tout jour non travaillé, quelles que soient les conditions actives), mais ça génère une
notification inutile un jour où personne ne travaille, et peut laisser une ligne
`conditions_jour` "active" pour un jour de repos — ce qui peut brouiller la lecture de
l'historique météo plus tard sans qu'il y ait de vrai enjeu métier.

**Correction proposée (confort, pas urgent) :** interroger
`est_jour_non_travaille(centre, demain)` avant l'envoi Telegram et sauter la
proposition si le jour est déjà non travaillé.

### 9. URL Supabase et identifiants dupliqués en dur, sur plusieurs workflows

L'URL du projet Supabase (`urkmgwpagljdnwgfbqlp.supabase.co`) apparaît en dur dans
**3 endroits distincts** (workflow 1 : suppression Storage ; workflow 2 : appel RPC ;
workflow 3b : insertion `conditions_jour`), en plus des credentials elles-mêmes. Le
`chatId` Telegram (`-5371089174`) apparaît dans 2 workflows. Pour la réplication
(modèle B), un seul de ces endroits oublié lors du provisioning d'un nouveau centre
laisse un workflow pointer vers l'ancienne instance — voir checklist plus bas.

---

## 🟡 MINEUR

### 10. Aucun retry sur les appels réseau (Open-Meteo, Supabase REST)

Un simple blip réseau fait échouer tout le run, sans qu'aucun mécanisme de retry natif
n8n ("Retry on Fail") ne soit activé nulle part. Peu coûteux à ajouter, réduit le bruit
une fois le §2 corrigé (moins de mails pour de simples blips transitoires).

### 11. Double déclenchement du cron météo → double message, sans risque de données

Si le cron 18h se déclenche deux fois (redémarrage n8n, etc.), deux messages Telegram
distincts sont envoyés, chacun avec ses propres boutons. Grâce à la contrainte unique
déjà en place sur `conditions_jour`, cliquer "Oui" sur les deux ne crée aucun doublon en
base — juste un peu de bruit dans le groupe.

### 12. Alerte "tâches non faites" sans déduplication

Un second déclenchement (manuel ou replay) du workflow 2 renverrait un second message
Telegram identique. Acceptable pour un mono-centre à faible volume ; à garder en tête
si le volume ou la fréquence des déclenchements augmente.

### 13. `callback_data` théoriquement falsifiable — risque réel très faible

Rien ne vérifie que le `callback_query` reçu provient bien d'un vrai clic sur le vrai
message envoyé. En théorie, quelqu'un avec accès à l'API du bot pourrait forger un
callback arbitraire. En pratique : il faut déjà être dans le groupe (accès au bot
limité), et la contrainte `CHECK` sur `conditions_jour.condition` bloque toute valeur
hors énum (`pluie`/`gel`/`grandgel`/`gardiennage`). Risque très faible dans un groupe
privé restreint — mentionné pour être complet, pas pour être alarmiste.

### 14. Couplage par nom de node (workflow 2)

Le node "Y a-t-il des oublis" référence `$('Période matin')` / `$('Période soir')` par
nom littéral. Renommer l'un de ces deux nodes un jour cassera cette référence
silencieusement (erreur seulement visible à l'exécution suivante).

### 15. Seuils météo à borne stricte

`tmin < -1` exclut exactement -1.0°C de la catégorie "gel" (borne stricte, pas `<=`).
Micro-détail, vraisemblablement volontaire vu la mention "seuils validés par Frank"
dans le code — signalé pour mémoire seulement, aucune action proposée.

---

## Checklist de provisioning — nouveau centre (modèle B, mono-centre indépendant)

### A. Supabase
- [ ] Nouveau projet Supabase (région UE).
- [ ] Rejouer le schéma complet : tables + contraintes + trigger `lu_le` + fonctions
      SQL (`est_jour_non_travaille`, `taches_attendues_jour`, `taches_oubliees`) — voir
      `sql/migrations.sql`. **Vérifier d'abord que la migration 2
      (`recurrence` incluant `'premier_vendredi'`) a bien été appliquée sur l'instance
      source avant de dupliquer** (constaté non appliquée sur Mirabeau au moment de cet
      audit — voir `TODO_AVANT_REPLICATION.md` point 5).
- [ ] Bucket Storage privé `commentaires-photos` + les 2 policies RLS `anon`
      (INSERT/SELECT restreintes à ce bucket) + `file_size_limit`/`allowed_mime_types`
      — **ces policies ont été créées à la main sur Mirabeau pendant cette session et
      ne sont pas encore dans `sql/migrations.sql`** : à y ajouter avant tout nouveau
      provisioning, sinon la fonctionnalité photo silencieusement cassée sur le
      prochain centre (échec anon sur upload/URL signée, cf audit précédent).
- [ ] Ligne `centres` avec un **nouvel** UUID (jamais réutiliser
      `00000000-0000-0000-0000-000000000001`), `jours_repos` par défaut.
- [ ] Lignes `employes` (rôles, PIN) pour ce centre.
- [ ] Récupérer l'URL du projet + la clé anon.

### B. App web (Vercel)
- [ ] Nouveau projet Vercel avec `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
      pointant vers le nouveau projet Supabase.
- [ ] `CENTRE_ID` en dur dans `src/supabaseClient.js` : remplacer par le nouvel UUID
      (rappel : c'est une dette déjà documentée, `TODO_AVANT_REPLICATION.md` point 3).

### C. Telegram
- [ ] Nouveau bot via BotFather (token dédié — **un Telegram Trigger = un webhook = un
      bot**, ne peut pas être partagé entre deux centres, déjà documenté par Frank).
- [ ] Nouveau groupe Telegram, bot ajouté en administrateur.
- [ ] Récupérer le `chat_id` du nouveau groupe (entier négatif).
- [ ] Nouvelle credential Telegram API dans n8n.

### D. n8n — dupliquer les 4 workflows
- [ ] Dupliquer les 4 workflows (Purge, Alerte tâches, Météo-proposition,
      Météo-réception) — **après**, pas avant, avoir corrigé les §1 et §2 ci-dessus,
      sinon les bugs se répliquent aussi sur le nouveau centre.
- [ ] Dans **chaque** copie, remplacer :
  - [ ] L'URL Supabase (`urkmgwpagljdnwgfbqlp.supabase.co`) — présente en dur à
        **3 endroits distincts** (workflow 1, 2, 3b) : chercher/remplacer partout, ne
        pas s'arrêter au premier trouvé.
  - [ ] `p_centre` / `centre_id` (workflow 2 et 3b) : nouvel UUID centre.
  - [ ] `chatId` Telegram (workflow 2 et 3a) : nouveau `chat_id`.
  - [ ] Coordonnées GPS Open-Meteo (workflow 3a) : latitude/longitude du nouveau site.
  - [ ] Nom de l'écurie dans les textes de message ("Écurie Mirabeau" → nom réel,
        présent dans le Code node du workflow 2 et le node Telegram du workflow 3a).
  - [ ] Toutes les credentials (Supabase API, Supabase Storage service_role, Supabase
        REST custom auth, Telegram API) : recréées et réassignées, **jamais
        partagées** entre deux centres.
  - [ ] Horaires de cron (11h/19h/18h/3h) : à confirmer, peuvent différer selon le
        rythme de travail du nouveau centre.
- [ ] Décider : le gestionnaire d'erreurs reste-t-il **unique et centralisé** (un seul
      mail vers Frank pour tous ses clients) ou **dupliqué par centre** ? Ce n'est pas
      un bug, mais une décision de provisioning à trancher consciemment.
- [ ] Activer les 4 workflows.

### E. Vérification finale avant mise en prod du nouveau centre
- [ ] Déclencher manuellement chacun des 4 workflows une fois, vérifier que chaque
      message Telegram arrive dans le **bon** groupe (pas dans l'ancien).
- [ ] Vérifier explicitement qu'**aucun** message n'atterrit dans le groupe Mirabeau
      existant (test croisé, pas juste "ça a marché quelque part").
- [ ] Provoquer une erreur volontaire et confirmer la réception du mail d'alerte —
      seule façon de vérifier que le gestionnaire d'erreurs fonctionne réellement pour
      ce centre.
