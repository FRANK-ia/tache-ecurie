// Couche d'accès aux données Supabase. Toute la logique métier pure vit dans
// calendarLogic.js — ce fichier ne fait que lire/écrire les tables décrites au §3 du brief.

import { supabase, CENTRE_ID } from '../supabaseClient'

function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
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

// ---- Templates de tâches ----

export async function fetchTemplates() {
  const res = await supabase.from('task_templates').select('*').eq('centre_id', CENTRE_ID).order('ordre')
  return unwrap(res)
}

export async function fetchTemplatesAvecJoursSemaine() {
  const res = await supabase
    .from('task_templates')
    .select('*')
    .eq('centre_id', CENTRE_ID)
    .not('jours_semaine', 'is', null)
    .order('ordre')
  return unwrap(res)
}

export async function updateJoursSemaine(templateId, joursSemaine) {
  const res = await supabase
    .from('task_templates')
    .update({ jours_semaine: joursSemaine })
    .eq('id', templateId)
  return unwrap(res)
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

export async function insertPonctuelle({ libelle, periode, jour, employeId }) {
  const res = await supabase
    .from('task_ponctuelles')
    .insert({ centre_id: CENTRE_ID, libelle, periode, jour, employe_id: employeId })
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

export async function insertObservation({ employeId, texte }) {
  const res = await supabase
    .from('observations')
    .insert({ centre_id: CENTRE_ID, employe_id: employeId, texte, lu: false })
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
    .order('created_at', { ascending: false })
  return unwrap(res)
}

export async function marquerObservationLue(id) {
  const res = await supabase.from('observations').update({ lu: true }).eq('id', id)
  return unwrap(res)
}

/** Observations créées un jour donné ('YYYY-MM-DD'), pour l'historique (§6.3). */
export async function fetchObservationsPourDate(jour) {
  const debut = `${jour}T00:00:00`
  const finExclusive = new Date(new Date(`${jour}T00:00:00`).getTime() + 86400000).toISOString()
  const res = await supabase
    .from('observations')
    .select('*, employes(prenom)')
    .eq('centre_id', CENTRE_ID)
    .gte('created_at', debut)
    .lt('created_at', finExclusive)
    .order('created_at', { ascending: false })
  return unwrap(res)
}
