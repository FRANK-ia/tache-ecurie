// Couche d'accès aux données Supabase. Toute la logique métier pure vit dans
// calendarLogic.js — ce fichier ne fait que lire/écrire les tables décrites au §3 du brief.

import { supabase, CENTRE_ID } from '../supabaseClient'
import { PERIODES } from './constants'

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

/**
 * Tri centralisé des templates : période (rang explicite matin→midi→journee→soir,
 * jamais alphabétique) puis `ordre` numérique croissant à l'intérieur.
 * `ordre` est la séquence de travail opérationnelle définie à l'insertion en base —
 * ne jamais la retrier autrement (alphabétique, id, date...).
 */
function trierParPeriodeEtOrdre(templates) {
  return [...templates].sort((a, b) => {
    const rangA = PERIODES.indexOf(a.periode)
    const rangB = PERIODES.indexOf(b.periode)
    if (rangA !== rangB) return (rangA === -1 ? PERIODES.length : rangA) - (rangB === -1 ? PERIODES.length : rangB)
    return (a.ordre ?? 0) - (b.ordre ?? 0)
  })
}

// ---- Employés / connexion PIN (§5 — pas de sécurité forte, contrôle d'usage) ----

export async function fetchEmployes() {
  const res = await supabase
    .from('employes')
    .select('id, prenom, role')
    .eq('centre_id', CENTRE_ID)
    .order('prenom')
  return unwrap(res)
}

/** Retourne l'employé si le PIN correspond, sinon null. */
export async function verifierPin(employeId, pin) {
  const res = await supabase
    .from('employes')
    .select('id, prenom, role')
    .eq('centre_id', CENTRE_ID)
    .eq('id', employeId)
    .eq('pin', pin)
    .maybeSingle()
  return unwrap(res)
}

/** Écriture sur un compte (prénom affiché sur l'écran de connexion, PIN). */
export async function updateEmploye(employeId, champs) {
  const res = await supabase.from('employes').update(champs).eq('id', employeId)
  return unwrap(res)
}

// ---- Templates de tâches ----

/** Templates actifs uniquement — pour tout calcul des tâches du jour courant (salarié, oubliées). */
export async function fetchTemplates() {
  const res = await supabase
    .from('task_templates')
    .select('*')
    .eq('centre_id', CENTRE_ID)
    .eq('actif', true)
    .order('ordre')
  return trierParPeriodeEtOrdre(unwrap(res))
}

/** Tous les templates (actifs et inactifs) — pour l'historique et l'écran de gestion employeur. */
export async function fetchTemplatesToutes() {
  const res = await supabase.from('task_templates').select('*').eq('centre_id', CENTRE_ID).order('ordre')
  return trierParPeriodeEtOrdre(unwrap(res))
}

/**
 * Écriture générique sur un template (libellé, période, jours, récurrence, actif...).
 * Point d'entrée principal en écriture sur task_templates — pour toute modification qui
 * n'est PAS une suppression (voir supprimerTemplateSiPossible plus bas pour ce cas précis :
 * un template avec historique ne doit jamais être DELETE, seulement désactivé).
 */
export async function updateTemplate(templateId, champs) {
  const res = await supabase.from('task_templates').update(champs).eq('id', templateId)
  return unwrap(res)
}

/** Crée une nouvelle tâche récurrente (toujours actif=true à la création). */
export async function insertTemplate(champs) {
  const res = await supabase
    .from('task_templates')
    .insert({ centre_id: CENTRE_ID, actif: true, ...champs })
    .select()
    .single()
  return unwrap(res)
}

/** Nombre de completions déjà enregistrées pour ce template (toutes dates confondues). */
export async function compterCompletions(templateId) {
  const { count, error } = await supabase
    .from('task_completions')
    .select('*', { count: 'exact', head: true })
    .eq('template_id', templateId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Supprime ou archive un template selon son historique : DELETE réel si aucune
 * completion n'existe (rien à préserver), sinon actif=false (désactivation) pour ne
 * jamais casser les task_completions passées qui référencent ce template. Retourne
 * 'supprime' ou 'archive' pour que l'écran affiche le bon message à l'utilisateur.
 */
export async function supprimerTemplateSiPossible(templateId) {
  const nbCompletions = await compterCompletions(templateId)
  if (nbCompletions > 0) {
    await updateTemplate(templateId, { actif: false })
    return 'archive'
  }
  const res = await supabase.from('task_templates').delete().eq('id', templateId)
  unwrap(res)
  return 'supprime'
}

/**
 * Dernière completion connue (jour le plus récent) pour chaque template dont
 * la recurrence='intervalle', nécessaire à isTemplateExpected (§4.2c).
 * Retourne une map { [template_id]: 'YYYY-MM-DD' }.
 */
export async function fetchDernieresCompletionsIntervalle(templateIds) {
  if (templateIds.length === 0) return {}
  const res = await supabase
    .from('task_completions')
    .select('template_id, jour')
    .in('template_id', templateIds)
    .order('jour', { ascending: false })
  const rows = unwrap(res)
  const map = {}
  for (const row of rows) {
    if (!(row.template_id in map)) map[row.template_id] = row.jour
  }
  return map
}

/** Variante utilisée par l'historique : ne considère que les completions antérieures ou égales à `jour`. */
export async function fetchDernieresCompletionsIntervalleAvant(templateIds, jour) {
  if (templateIds.length === 0) return {}
  const res = await supabase
    .from('task_completions')
    .select('template_id, jour')
    .in('template_id', templateIds)
    .lte('jour', jour)
    .order('jour', { ascending: false })
  const rows = unwrap(res)
  const map = {}
  for (const row of rows) {
    if (!(row.template_id in map)) map[row.template_id] = row.jour
  }
  return map
}

// ---- Tâches ponctuelles ----

export async function fetchPonctuellesDuJour(jour) {
  const res = await supabase.from('task_ponctuelles').select('*').eq('centre_id', CENTRE_ID).eq('jour', jour)
  return unwrap(res)
}

export async function insertPonctuelle({ libelle, periode, jour, creePar }) {
  const res = await supabase
    .from('task_ponctuelles')
    .insert({ centre_id: CENTRE_ID, libelle, periode, jour, cree_par: creePar })
    .select()
    .single()
  return unwrap(res)
}

// ---- Completions ----

export async function fetchCompletionsDuJour(jour) {
  const res = await supabase
    .from('task_completions')
    .select('*')
    .eq('centre_id', CENTRE_ID)
    .eq('jour', jour)
  return unwrap(res)
}

export async function cocherTache({ templateId = null, ponctuelleId = null, jour, employeId }) {
  const res = await supabase
    .from('task_completions')
    .insert({
      centre_id: CENTRE_ID,
      template_id: templateId,
      ponctuelle_id: ponctuelleId,
      jour,
      employe_id: employeId,
    })
    .select()
    .single()
  return unwrap(res)
}

export async function decocherTache({ templateId = null, ponctuelleId = null, jour }) {
  let query = supabase.from('task_completions').delete().eq('centre_id', CENTRE_ID).eq('jour', jour)
  query = templateId ? query.eq('template_id', templateId) : query.eq('ponctuelle_id', ponctuelleId)
  const res = await query
  return unwrap(res)
}

// ---- Conditions du jour (météo / gardiennage) ----

export async function fetchConditionsDuJour(jour) {
  const res = await supabase.from('conditions_jour').select('condition').eq('centre_id', CENTRE_ID).eq('jour', jour)
  return unwrap(res).map((r) => r.condition)
}

export async function activerCondition(jour, condition) {
  const res = await supabase
    .from('conditions_jour')
    .insert({ centre_id: CENTRE_ID, jour, condition, source: 'manuel' })
    .select()
    .single()
  return unwrap(res)
}

export async function desactiverCondition(jour, condition) {
  const res = await supabase
    .from('conditions_jour')
    .delete()
    .eq('centre_id', CENTRE_ID)
    .eq('jour', jour)
    .eq('condition', condition)
  return unwrap(res)
}

// ---- Observations ----

export async function insertObservation({ employeId, texte, jour }) {
  const res = await supabase
    .from('observations')
    .insert({ centre_id: CENTRE_ID, employe_id: employeId, texte, jour, lu: false })
    .select()
    .single()
  return unwrap(res)
}

export async function fetchObservationsNonLues() {
  const res = await supabase
    .from('observations')
    .select('*, employes(prenom)')
    .eq('centre_id', CENTRE_ID)
    .eq('lu', false)
    .order('cree_le', { ascending: false })
  return unwrap(res)
}

export async function marquerObservationLue(id) {
  const res = await supabase.from('observations').update({ lu: true }).eq('id', id)
  return unwrap(res)
}

/** Observations créées un jour donné ('YYYY-MM-DD'), pour l'historique (§6.3). */
export async function fetchObservationsPourDate(jour) {
  const res = await supabase
    .from('observations')
    .select('*, employes(prenom)')
    .eq('centre_id', CENTRE_ID)
    .eq('jour', jour)
    .order('cree_le', { ascending: false })
  return unwrap(res)
}

// ---- Jours non travaillés (repos hebdomadaire + congés) ----

/** Jours de repos hebdo du centre (tableau ISO, 1=lundi..7=dimanche). */
export async function fetchJoursRepos() {
  const res = await supabase.from('centres').select('jours_repos').eq('id', CENTRE_ID).single()
  return unwrap(res).jours_repos ?? []
}

export async function updateJoursRepos(joursRepos) {
  const res = await supabase.from('centres').update({ jours_repos: joursRepos }).eq('id', CENTRE_ID)
  return unwrap(res)
}

/** Toutes les plages de congés du centre — le filtrage passé/à venir se fait côté appelant. */
export async function fetchConges() {
  const res = await supabase.from('jours_conges').select('*').eq('centre_id', CENTRE_ID).order('date_debut')
  return unwrap(res)
}

export async function insertConge({ dateDebut, dateFin, motif }) {
  const res = await supabase
    .from('jours_conges')
    .insert({ centre_id: CENTRE_ID, date_debut: dateDebut, date_fin: dateFin, motif: motif || null })
    .select()
    .single()
  return unwrap(res)
}

/**
 * Seul DELETE de toute l'app : les congés sont un réglage ponctuel, pas une donnée
 * d'historique métier référencée ailleurs (contrairement à task_templates/task_completions).
 */
export async function supprimerConge(id) {
  const res = await supabase.from('jours_conges').delete().eq('id', id)
  return unwrap(res)
}
