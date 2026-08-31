-- Requêtes de vérification pour la fonction taches_oubliees() (voir sql/migrations.sql,
-- migration 5). Pur lecture seule — rien de ce qui suit n'écrit en base, sauf le TEST D
-- qui utilise BEGIN/ROLLBACK explicite (rien n'est jamais conservé, vérifié).
--
-- CENTRE_ID = '00000000-0000-0000-0000-000000000001' (constante unique de l'app, voir
-- src/supabaseClient.js). Remplacer si un jour multi-centre (Niveau 2, voir TODO).

-- ============================================================================
-- GARDE-FOU 2 — requête de contrôle de cohérence (à relancer ponctuellement,
-- notamment après une modif importante des tâches récurrentes)
-- ============================================================================
-- Comment l'utiliser (2 lignes) :
--   1. Change la date/période ci-dessous pour "aujourd'hui" et la période que le
--      salarié est en train de voir (ou vient de terminer).
--   2. Compare visuellement la colonne `fait` de chaque ligne à ce que montre l'écran
--      salarié à cet instant (case cochée = fait doit être true) : un écart = bug à
--      investiguer (calendarLogic.js vs cette fonction SQL).
select *
from taches_attendues_jour(
  '00000000-0000-0000-0000-000000000001',
  current_date,   -- <- ajuster si besoin
  'matin'         -- <- 'matin' / 'midi' / 'journee' / 'soir'
)
order by kind, recurrence, libelle;

-- Variante : uniquement ce que l'alerte n8n enverrait (mêmes lignes, sans les "fait=true").
select *
from taches_oubliees('00000000-0000-0000-0000-000000000001', current_date, 'matin');


-- ============================================================================
-- TESTS DE VALIDATION (déjà exécutés par Claude Code le 2026-08-31, résultats en
-- commentaire — à relancer par Frank pour vérifier soi-même avant branchement n8n)
-- ============================================================================

-- TEST A — jour normal avec un oubli réel.
-- Résultat obtenu : 1 ligne ("Mettre 2 carrés foin au 2 gris soir si tonneaux bleu
-- vide", quotidienne) sur 8 tâches attendues ce soir-là — cohérent avec les
-- task_completions réelles de ce jour.
select * from taches_oubliees('00000000-0000-0000-0000-000000000001', '2026-08-28', 'soir');

-- TEST B — jour de repos/congé -> vide (aucune alerte).
-- Résultat obtenu : 0 ligne. (Un vrai congé existe sur 2026-08-31 dans les données
-- actuelles ; remplacer par une autre date si ce congé a été retiré depuis.)
select * from taches_oubliees('00000000-0000-0000-0000-000000000001', '2026-08-31', 'matin');

-- TEST C — conditionnelle non active -> non attendue (donc jamais "oubliée").
-- Résultat obtenu : 0 ligne conditionnelle le 2026-08-20 en 'matin' (seul 'gardiennage'
-- était actif ce jour-là, aucun template 'matin' n'est conditionné par gardiennage) ;
-- et >=1 ligne conditionnelle en 'journee' (où se trouvent les templates 'gardiennage').
select 'matin (pluie/gel/grandgel) -> attendu 0 ligne conditionnelle' as verif, count(*)
from taches_attendues_jour('00000000-0000-0000-0000-000000000001', '2026-08-20', 'matin') t
join task_templates tt on tt.id = t.tache_id and tt.recurrence = 'conditionnelle'
union all
select 'journee (gardiennage) -> attendu >=1 ligne conditionnelle', count(*)
from taches_attendues_jour('00000000-0000-0000-0000-000000000001', '2026-08-20', 'journee') t
join task_templates tt on tt.id = t.tache_id and tt.recurrence = 'conditionnelle';

-- TEST D — intervalle échue / pas échue / jamais faite. Aucun template recurrence=
-- 'intervalle' n'existe encore en prod (0 ligne) : test avec données SYNTHÉTIQUES,
-- annulées par ROLLBACK (rien n'est jamais écrit pour de vrai — vérifié après coup :
-- 0 ligne restante en base une fois la transaction annulée).
-- Résultat obtenu :
--   "TEST intervalle echue"          fait=false (20j >= 15j -> attendue, pas faite -> oubliée)
--   "TEST intervalle jamais faite"   fait=false (aucune completion -> toujours attendue)
--   "TEST intervalle pas echue"      absente    (5j < 15j -> pas encore due, normal)
begin;

insert into task_templates (id, centre_id, libelle, periode, recurrence, intervalle_jours, actif)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'TEST intervalle echue', 'matin', 'intervalle', 15, true),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'TEST intervalle pas echue', 'matin', 'intervalle', 15, true),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', 'TEST intervalle jamais faite', 'matin', 'intervalle', 15, true);

insert into task_completions (centre_id, template_id, jour)
values ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', date '2026-08-25' - 20);

insert into task_completions (centre_id, template_id, jour)
values ('00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', date '2026-08-25' - 5);

select libelle, fait
from taches_attendues_jour('00000000-0000-0000-0000-000000000001', '2026-08-25', 'matin')
where tache_id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
order by libelle;

rollback;

-- BONUS — formule "premier vendredi du mois" vérifiée indépendamment (aucun template
-- recurrence='premier_vendredi' n'est stockable actuellement, voir ⚠️ CONSTAT dans
-- migrations.sql juste avant la migration 5 : la contrainte recurrence n'a pas encore
-- été mise à jour). Vérifie juste que la formule de date est correcte.
-- Résultat obtenu : seul 2026-08-07 (1er vendredi d'août) ressort vrai parmi les 4
-- vendredis du mois.
select d::date as jour, (extract(dow from d) = 5 and extract(day from d) <= 7) as est_premier_vendredi
from generate_series('2026-08-01'::date, '2026-08-31'::date, interval '1 day') d
where extract(dow from d) = 5;
