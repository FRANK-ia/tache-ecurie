-- Migrations à exécuter sur Supabase par Frank (voir brief §5.1 et §11).
-- ⚠️ Vérifier les noms de contraintes existants avant d'exécuter (ils peuvent différer
-- selon comment le schéma a été créé) — ajuster si besoin.

-- 1. Colonne PIN salarié (§5.1) — PIN de départ à changer avant la mise en prod réelle.
alter table employes add column if not exists pin text check (pin ~ '^[0-9]{4}$');
update employes set pin='1234' where role='employeur';
update employes set pin='0000' where role='salarie';

-- 2. Autoriser la valeur 'premier_vendredi' dans task_templates.recurrence (§4.2a, validé
-- avec Frank : nouveau type de récurrence dédié plutôt qu'un marqueur sur 'mensuelle').
-- Le nom de contrainte ci-dessous suit la convention par défaut Postgres
-- (<table>_<colonne>_check) ; à adapter si votre schéma utilise un autre nom.
alter table task_templates drop constraint if exists task_templates_recurrence_check;
alter table task_templates add constraint task_templates_recurrence_check
  check (recurrence in ('quotidienne', 'hebdo', 'mensuelle', 'conditionnelle', 'intervalle', 'premier_vendredi'));

-- 3. Renomme le libellé de la tâche "rouleau" existante et ajoute la tâche "herse" (ajustement
-- demandé par Frank sur l'écran Réglages). Ces libellés sont lus tels quels par le front,
-- donc ce changement se fait en base et pas dans le code.
--
-- ⚠️ Vérifier AVANT d'exécuter l'UPDATE qu'une seule ligne correspond (sinon adapter le WHERE) :
--   select id, libelle from task_templates
--   where centre_id = '00000000-0000-0000-0000-000000000001'
--     and recurrence = 'hebdo' and jours_semaine is not null;
update task_templates
set libelle = 'Passer le rouleau dans la grande carrière'
where centre_id = '00000000-0000-0000-0000-000000000001'
  and recurrence = 'hebdo'
  and jours_semaine is not null;

-- Nouvelle tâche herse : même principe que le rouleau (jours modifiables depuis Réglages).
-- Période mise à 'soir' par défaut faute de période précise (à ajuster si besoin — voir
-- HEURE_FIN_PERIODE dans src/lib/constants.js si ce choix doit changer le calcul des
-- "tâches oubliées"). Aucun jour coché au départ : à définir depuis l'écran Réglages.
insert into task_templates (centre_id, libelle, periode, ordre, recurrence, jours_semaine)
values (
  '00000000-0000-0000-0000-000000000001',
  'Passage de la Herse dans la carrière du bas',
  'soir',
  (select coalesce(max(ordre), 0) + 1 from task_templates where centre_id = '00000000-0000-0000-0000-000000000001'),
  'hebdo',
  '{}'
);

-- 4. Colonne actif sur task_templates (écran de gestion des tâches employeur). Une tâche
-- qu'on ne veut plus = actif=false, jamais un DELETE (les task_completions passées
-- référencent le template). Toutes les tâches existantes démarrent actives.
alter table task_templates add column if not exists actif boolean not null default true;

-- ⚠️ CONSTAT (pas une nouvelle migration, juste un signalement) : au moment d'écrire la
-- migration 5 ci-dessous, la migration 2 plus haut (ajout de 'premier_vendredi' à la
-- contrainte recurrence) s'est révélée PAS ENCORE EXÉCUTÉE sur la base réelle — un INSERT
-- avec recurrence='premier_vendredi' est aujourd'hui rejeté par task_templates_recurrence_check.
-- Concrètement : l'option "Premier vendredi du mois" visible dans Réglages (GestionTaches.jsx)
-- ne peut pas être enregistrée tant que la migration 2 n'a pas tourné. Frank : à exécuter
-- si ce type de récurrence doit devenir utilisable.

-- 5. Fonction SQL taches_oubliees() pour l'alerte n8n "tâches non faites" (brief
-- Claude.ai, cadrée par Frank). Reproduit FIDÈLEMENT src/lib/calendarLogic.js
-- (isTemplateExpected, typeJourNonTravaille, isFirstFridayOfMonth, isTaskDone) — c'est
-- la SOURCE DE VÉRITÉ, toute divergence future = bug d'alerte. AUCUNE valeur métier en
-- dur ici : intervalle_jours, jours_semaine, jour_semaine, jours_mois, condition,
-- jours_repos... tout est lu depuis les tables, comme le fait le JS. Seule la STRUCTURE
-- de chaque règle (le "comment interpréter intervalle_jours") est en dur, identique des
-- deux côtés par construction — voir TODO_AVANT_REPLICATION.md pour la règle de sûreté
-- complète sur cette duplication contrôlée.

-- 5a. est_jour_non_travaille (déjà en base) : mise à jour pour intégrer repos_exceptions
-- (table créée APRÈS cette fonction — elle ne la connaissait pas encore). Même ordre
-- strict que typeJourNonTravaille (calendarLogic.js) : exception 'travaille' > exception
-- 'repos' > congé > repos hebdo fixe > travaillé. Signature INCHANGÉE (p_centre, p_jour)
-- -> boolean, donc aucun appelant existant n'est cassé par ce remplacement.
create or replace function public.est_jour_non_travaille(p_centre uuid, p_jour date)
returns boolean
language plpgsql
stable
set search_path = public, pg_temp
as $function$
declare
  v_iso smallint := extract(isodow from p_jour);
  v_repos smallint[];
  v_exception_type text;
begin
  -- 1-2. Exception ponctuelle pour CE jour précis : prime sur tout le reste.
  -- (cree_le desc : filet de sécurité si jamais deux exceptions visaient le même jour —
  -- cas normalement empêché côté appli, mais aucune contrainte unique en base à ce jour.)
  select type into v_exception_type
  from repos_exceptions
  where centre_id = p_centre and jour = p_jour
  order by cree_le desc
  limit 1;

  if v_exception_type = 'travaille' then
    return false;
  elsif v_exception_type = 'repos' then
    return true;
  end if;

  -- 3. Congé couvrant ce jour.
  if exists (
    select 1 from jours_conges
    where centre_id = p_centre and p_jour between date_debut and date_fin
  ) then
    return true;
  end if;

  -- 4. Repos hebdomadaire fixe.
  select jours_repos into v_repos from centres where id = p_centre;
  if v_repos is not null and v_iso = any(v_repos) then
    return true;
  end if;

  -- 5. Sinon travaillé.
  return false;
end;
$function$;

-- 5b. taches_attendues_jour : fonction de BASE qui porte TOUTE la logique d'"attendu"
-- (une seule fois, en SQL) + le statut "fait" de chaque tâche. taches_oubliees (5c)
-- n'est qu'un filtre par-dessus — donc pas de risque de divergence ENTRE les deux
-- fonctions SQL elles-mêmes. Sert aussi de garde-fou 2 (contrôle de cohérence manuel,
-- voir sql/taches_oubliees_tests.sql) : Frank peut la lancer pour un jour/période donnés
-- et confronter visuellement le résultat à l'écran salarié du jour.
create or replace function public.taches_attendues_jour(
  p_centre uuid,
  p_jour date,
  p_periode text
)
returns table (
  tache_id uuid,
  libelle text,
  kind text,
  recurrence text,
  fait boolean
)
language plpgsql
stable
set search_path = public, pg_temp
as $function$
declare
  v_iso smallint := extract(isodow from p_jour);       -- 1=lundi..7=dimanche
  v_dow smallint := extract(dow from p_jour);           -- 0=dimanche..6=samedi (= JS Date#getDay())
  v_jour_mois smallint := extract(day from p_jour);
begin
  -- Aucune tâche "attendue" un jour non travaillé (repos/congé/exception) : même règle
  -- que le JS (estJourNonTravaille -> écran salarié vide, aucune tâche affichée).
  if public.est_jour_non_travaille(p_centre, p_jour) then
    return;
  end if;

  return query
  -- Templates récurrents actifs, attendus ce jour selon leur récurrence (reproduit
  -- isTemplateExpected de calendarLogic.js, cas par cas, dans le même ordre).
  select
    t.id,
    t.libelle,
    'template'::text,
    t.recurrence,
    exists (
      select 1 from task_completions tc
      where tc.template_id = t.id and tc.jour = p_jour
    )
  from task_templates t
  left join lateral (
    select max(tc2.jour) as derniere
    from task_completions tc2
    where tc2.template_id = t.id
  ) dc on true
  where t.centre_id = p_centre
    and t.actif = true
    and t.periode = p_periode
    and case t.recurrence
      when 'quotidienne' then true
      when 'hebdo' then
        case
          when coalesce(array_length(t.jours_semaine, 1), 0) > 0 then v_iso = any(t.jours_semaine)
          else t.jour_semaine = v_iso
        end
      when 'mensuelle' then t.jours_mois is not null and v_jour_mois = any(t.jours_mois)
      when 'premier_vendredi' then v_dow = 5 and v_jour_mois <= 7
      when 'conditionnelle' then exists (
        select 1 from conditions_jour cj
        where cj.centre_id = p_centre and cj.jour = p_jour and cj.condition = t.condition
      )
      -- Intervalle (§4.2c) : c'est la DERNIÈRE completion connue qui compte (max(jour),
      -- toutes dates confondues), PAS "absence de completion du jour = à faire". Aucune
      -- completion jamais enregistrée -> toujours attendue (comportement JS explicite).
      when 'intervalle' then dc.derniere is null or (p_jour - dc.derniere) >= t.intervalle_jours
      else false
    end

  union all

  -- Tâches ponctuelles de ce jour et cette période (recurrence toujours null : elles ne
  -- suivent aucune règle de récurrence, comme dans buildDailyTaskList).
  select
    p.id,
    p.libelle,
    'ponctuelle'::text,
    null::text,
    exists (
      select 1 from task_completions tc3
      where tc3.ponctuelle_id = p.id and tc3.jour = p_jour
    )
  from task_ponctuelles p
  where p.centre_id = p_centre
    and p.jour = p_jour
    and p.periode = p_periode;
end;
$function$;

-- 5c. taches_oubliees : ce que n8n appellera pour l'alerte. Simple filtre "not fait" sur
-- 5b — une seule définition de "attendu" existe en SQL, les deux fonctions ne peuvent
-- donc pas diverger entre elles.
create or replace function public.taches_oubliees(
  p_centre uuid,
  p_jour date,
  p_periode text
)
returns table (
  tache_id uuid,
  libelle text,
  kind text,
  recurrence text
)
language sql
stable
set search_path = public, pg_temp
as $function$
  select tache_id, libelle, kind, recurrence
  from public.taches_attendues_jour(p_centre, p_jour, p_periode)
  where not fait;
$function$;
