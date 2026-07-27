// Constantes métier ajustables. Valeurs par défaut à valider avec Frank (voir §11 du brief).

// Ordre canonique des périodes (utilisé pour le tri et le regroupement partout dans
// l'app) : matin → midi → journee → soir. Ne pas trier alphabétiquement.
// ⚠️ 'gardiennage' n'est PAS une période : c'est une condition activable (comme le
// gel), voir CONDITIONS plus bas. Ne pas la réintroduire ici.
export const PERIODES = ['matin', 'midi', 'journee', 'soir']

export const PERIODE_LABELS = {
  matin: 'Matin',
  midi: 'Midi',
  journee: 'Dans la journée',
  soir: 'Soir',
}

// Icônes des en-têtes de période (§7 — regroupement par période). 'journee' regroupe les
// tâches sans horaire fixe (rouleau, herse) : icône neutre, distincte du soleil de midi.
export const PERIODE_ICONS = {
  matin: '🌅',
  midi: '☀️',
  journee: '🌤️',
  soir: '🌇',
}

// Code couleur discret par période (liseré + fond très pâle), partout où les tâches
// sont groupées par période. Teintes volontairement distinctes des autres signaux
// existants (accent vert, danger rouge, météo orange-brun, fraîcheur bleu marine) pour
// qu'ils restent visuellement prioritaires quand ils se superposent.
export const PERIODE_COULEURS = {
  matin: { fond: '#fdf6e3', bordure: '#c99a1e' },
  midi: { fond: '#e6f5f3', bordure: '#3f9c90' },
  journee: { fond: '#f2edfa', bordure: '#8a6bbf' },
  soir: { fond: '#fbebf0', bordure: '#c4718f' },
}

// Horaire du soir affiché (§6.2), selon la saison déterminée par getSaison()
// (changement d'heure européen réel — voir calendarLogic.js).
export const HORAIRE_SOIR = {
  ete: '18h30',
  hiver: '17h30',
}

// Heure (0-23) après laquelle une période est considérée "passée" pour le calcul
// des tâches oubliées côté employeur (§6.3). Hypothèse par défaut à valider.
export const HEURE_FIN_PERIODE = {
  matin: 12,
  midi: 14,
  journee: 24,
  soir: 21,
}

export const CONDITIONS = ['pluie', 'gel', 'grandgel', 'gardiennage']

export const CONDITION_LABELS = {
  pluie: 'Pluie',
  gel: 'Gel',
  grandgel: 'Orage',
  gardiennage: 'Gardiennage',
}

// Emoji préfixé devant le libellé des tâches conditionnelles (dérivé de
// task_templates.condition, jamais saisi dans le libellé stocké en base).
export const CONDITION_EMOJIS = {
  pluie: '☔',
  gel: '❄️',
  grandgel: '🌩️',
  gardiennage: '🌙',
}

export const JOURS_SEMAINE_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

// Alerte visuelle "nouveau/modifié" sur les tâches récurrentes (task_templates).
export const DUREE_FRAICHEUR_HEURES = 48
export const SEUIL_NOUVEAU_MINUTES = 1
