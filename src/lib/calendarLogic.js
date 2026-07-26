// Logique calendaire pure — voir brief §4. Aucune de ces fonctions ne touche
// au réseau ou à l'horloge système directement (la date est toujours un paramètre),
// ce qui les rend testables en isolation.

import {
  MOIS_DEBUT_ETE,
  MOIS_FIN_ETE,
  HEURE_FIN_PERIODE,
  DUREE_FRAICHEUR_HEURES,
  SEUIL_NOUVEAU_MINUTES,
} from './constants'

/** 1 = lundi ... 7 = dimanche (contrairement à Date#getDay qui donne 0 = dimanche). */
export function isoDayOfWeek(date) {
  const jsDay = date.getDay()
  return jsDay === 0 ? 7 : jsDay
}

/** Vrai si `date` tombe un vendredi dans les 7 premiers jours du mois. */
export function isFirstFridayOfMonth(date) {
  return date.getDay() === 5 && date.getDate() <= 7
}

/** Formate une date locale en 'YYYY-MM-DD' (clé utilisée pour `task_completions.jour`). */
export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Vrai si `date` est un jour non travaillé pour le centre : repos hebdomadaire fixe
 * (`joursRepos`, tableau ISO 1=lundi..7=dimanche, ex {7} pour dimanche) OU compris dans
 * une plage de `conges` ({ date_debut, date_fin } au format 'YYYY-MM-DD').
 * V1 mono-salarié : un jour non travaillé = écran vide côté salarié, pas de gestion de
 * remplaçant, aucune completion fantôme générée.
 */
export function estJourNonTravaille(date, joursRepos = [], conges = []) {
  if (joursRepos.includes(isoDayOfWeek(date))) return true
  const jour = toDateKey(date)
  return conges.some((c) => jour >= c.date_debut && jour <= c.date_fin)
}

/** Nombre de jours entre deux clés 'YYYY-MM-DD' (b - a), en ignorant l'heure. */
export function daysBetweenDateKeys(aKey, bKey) {
  const a = new Date(`${aKey}T00:00:00Z`)
  const b = new Date(`${bKey}T00:00:00Z`)
  return Math.round((b - a) / 86400000)
}

export function getSaison(date) {
  const mois = date.getMonth() + 1
  return mois >= MOIS_DEBUT_ETE && mois <= MOIS_FIN_ETE ? 'ete' : 'hiver'
}

/**
 * Détermine si un template de tâche est attendu à la date donnée.
 *
 * @param {object} template - ligne de `task_templates`.
 * @param {Date} date - jour évalué.
 * @param {string[]} activeConditions - conditions actives ce jour (pluie, gel, ...).
 * @param {string|null} derniereCompletion - clé 'YYYY-MM-DD' de la dernière completion
 *   connue pour ce template (uniquement utile pour recurrence='intervalle').
 */
export function isTemplateExpected(template, date, activeConditions = [], derniereCompletion = null) {
  switch (template.recurrence) {
    case 'quotidienne':
      return true

    case 'hebdo': {
      const iso = isoDayOfWeek(date)
      if (Array.isArray(template.jours_semaine) && template.jours_semaine.length > 0) {
        return template.jours_semaine.includes(iso)
      }
      return template.jour_semaine === iso
    }

    case 'mensuelle':
      return Array.isArray(template.jours_mois) && template.jours_mois.includes(date.getDate())

    case 'premier_vendredi':
      return isFirstFridayOfMonth(date)

    case 'conditionnelle':
      return activeConditions.includes(template.condition)

    case 'intervalle': {
      // Cas particulier (§4.2c) : "absence de completion = à faire" ne s'applique PAS ici.
      // On regarde la DERNIÈRE completion connue, pas celle du jour.
      if (!derniereCompletion) return true
      const ecart = daysBetweenDateKeys(derniereCompletion, toDateKey(date))
      return ecart >= template.intervalle_jours
    }

    default:
      return false
  }
}

/**
 * Filtre une liste de templates pour ne garder que ceux attendus à la date donnée.
 *
 * @param {object[]} templates
 * @param {Date} date
 * @param {string[]} activeConditions
 * @param {Record<string, string>} lastCompletionByTemplateId - map template_id -> 'YYYY-MM-DD'
 *   (uniquement nécessaire pour les templates recurrence='intervalle').
 */
export function getTasksForDay(templates, date, activeConditions = [], lastCompletionByTemplateId = {}) {
  return templates.filter((t) =>
    isTemplateExpected(t, date, activeConditions, lastCompletionByTemplateId[t.id] ?? null)
  )
}

/**
 * Alerte "nouveau/modifié" (§ task_templates.cree_le / modifie_le) : 'nouveau' si créé
 * il y a moins de 48h ET jamais modifié depuis (modifie_le ≈ cree_le, écart < 1 min),
 * 'modifie' si modifié il y a moins de 48h, sinon null (pas de mise en évidence).
 */
export function statutFraicheur(template, maintenant = new Date()) {
  if (!template?.modifie_le) return null
  const modifie = new Date(template.modifie_le)
  const heuresEcoulees = (maintenant - modifie) / (1000 * 60 * 60)
  if (heuresEcoulees >= DUREE_FRAICHEUR_HEURES) return null
  if (!template.cree_le) return 'modifie'
  const cree = new Date(template.cree_le)
  const ecartCreationMinutes = Math.abs(modifie - cree) / (1000 * 60)
  return ecartCreationMinutes < SEUIL_NOUVEAU_MINUTES ? 'nouveau' : 'modifie'
}

/** Une tâche (template ou ponctuelle) est faite aujourd'hui si une completion existe. */
export function isTaskDone(task, completions) {
  return completions.some((c) =>
    task.kind === 'ponctuelle' ? c.ponctuelle_id === task.id : c.template_id === task.id
  )
}

/**
 * Assemble templates attendus + tâches ponctuelles du jour en une liste unique,
 * enrichie de l'état "fait/pas fait", groupée par période puis triée par `ordre`.
 */
export function buildDailyTaskList({
  templates,
  ponctuelles = [],
  completions = [],
  date,
  activeConditions = [],
  lastCompletionByTemplateId = {},
}) {
  const templatesAttendus = getTasksForDay(templates, date, activeConditions, lastCompletionByTemplateId).map(
    (t) => ({
      id: t.id,
      kind: 'template',
      libelle: t.libelle,
      periode: t.periode,
      ordre: t.ordre ?? 0,
      condition: t.condition ?? null,
      fraicheur: statutFraicheur(t),
    })
  )

  const ponctuellesDuJour = ponctuelles.map((p) => ({
    id: p.id,
    kind: 'ponctuelle',
    libelle: p.libelle,
    periode: p.periode,
    ordre: Number.POSITIVE_INFINITY,
    condition: null,
  }))

  const toutes = [...templatesAttendus, ...ponctuellesDuJour].sort((a, b) => a.ordre - b.ordre)

  return toutes.map((task) => ({ ...task, fait: isTaskDone(task, completions) }))
}

/** Tâches attendues aujourd'hui, dont la période est passée, sans completion (§6.3). */
export function getTachesOubliees(dailyTaskList, now = new Date()) {
  const heureActuelle = now.getHours()
  return dailyTaskList.filter((task) => {
    if (task.fait) return false
    const heureFin = HEURE_FIN_PERIODE[task.periode] ?? 24
    return heureActuelle >= heureFin
  })
}
