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
