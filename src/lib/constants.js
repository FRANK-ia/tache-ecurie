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

// Fond de carte : dépend UNIQUEMENT de la période, jamais d'un badge ni d'un état
// (fait/inactif/conditionnel). Toutes les tâches d'une même période ont exactement
// le même fond partout dans l'app. Les badges (BADGE_COULEURS plus bas) sont une
// couche totalement indépendante qui ne touche jamais cette couleur de fond.
export const PERIODE_COULEURS = {
  matin: { fond: '#dbe9f8', bordure: '#4d78b3' },
  midi: { fond: '#fbf0c9', bordure: '#a8790a' },
  journee: { fond: '#dcf0d7', bordure: '#3f7a34' },
  soir: { fond: '#f0e6d2', bordure: '#8f7245' },
}

// Couleur des badges de statut (Nouveau/Modifié/Ajout) — indépendante de
// PERIODE_COULEURS ci-dessus. Un badge est un pastille pleine (texte blanc), donc
// lisible sur n'importe quel fond de période par contraste de clarté, pas de teinte.
export const BADGE_COULEURS = {
  nouveau: 'var(--couleur-nouveau)',
  modifie: 'var(--couleur-modifie)',
  ajout: 'var(--couleur-ajout)',
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
