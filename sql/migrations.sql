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
