// Constantes métier ajustables. Valeurs par défaut à valider avec Frank (voir §11 du brief).

// Ordre canonique des périodes (utilisé pour le tri et le regroupement partout dans
// l'app) : matin → midi → journee → soir → gardiennage. Ne pas trier alphabétiquement.
export const PERIODES = ['matin', 'midi', 'journee', 'soir', 'gardiennage']

export const PERIODE_LABELS = {
  matin: 'Matin',
  midi: 'Midi',
  journee: 'Dans la journée',
  soir: 'Soir',
  gardiennage: 'Gardiennage',
}

// Icônes des en-têtes de période (§7 — regroupement par période). 'journee' regroupe les
// tâches sans horaire fixe (rouleau, herse) : icône neutre, distincte du soleil de midi.
export const PERIODE_ICONS = {
  matin: '🌅',
  midi: '☀️',
  journee: '🌤️',
  soir: '🌇',
  gardiennage: '🌙',
}

// Détermine la saison utilisée pour l'horaire du soir affiché (§6.2).
// Hypothèse par défaut : avril à septembre = été, reste = hiver. À confirmer.
export const MOIS_DEBUT_ETE = 4
export const MOIS_FIN_ETE = 9

export const HORAIRE_SOIR = {
  ete: '19h00',
  hiver: '17h00',
}

// Heure (0-23) après laquelle une période est considérée "passée" pour le calcul
// des tâches oubliées côté employeur (§6.3). Hypothèse par défaut à valider.
export const HEURE_FIN_PERIODE = {
  matin: 12,
  midi: 14,
  journee: 24,
  soir: 21,
  gardiennage: 24,
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
