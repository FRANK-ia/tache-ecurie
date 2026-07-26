// Constantes métier ajustables. Valeurs par défaut à valider avec Frank (voir §11 du brief).

export const PERIODES = ['matin', 'midi', 'soir', 'gardiennage']

export const PERIODE_LABELS = {
  matin: 'Matin',
  midi: 'Midi',
  soir: 'Soir',
  gardiennage: 'Gardiennage',
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

export const JOURS_SEMAINE_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
