// Constantes métier techniques (clés, couleurs, seuils). Les textes affichés à
// l'écran (labels, boutons, messages) vivent dans src/lib/textes.js — c'est là
// qu'il faut aller pour changer un mot, pas ici.

// Ordre canonique des périodes (utilisé pour le tri et le regroupement partout dans
// l'app) : matin → midi → journee → soir. Ne pas trier alphabétiquement.
// ⚠️ 'gardiennage' n'est PAS une période : c'est une condition activable (comme le
// gel), voir CONDITIONS plus bas. Ne pas la réintroduire ici.
export const PERIODES = ['matin', 'midi', 'journee', 'soir']

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

// Palette période × intensité de récurrence, utilisée côté salarié (TaskItem) et
// employeur (Réglages). La TEINTE encode la période (comme PERIODE_COULEURS
// ci-dessus) ; l'INTENSITÉ (niveau 1 clair → 3 foncé) encode la rareté de la
// récurrence, pour qu'une tâche mensuelle ressorte visuellement parmi les
// quotidiennes de la même période. Contraste vérifié (WCAG) : chaque `texte` sur
// son `fond` dépasse 5.4:1 sur les 12 combinaisons, largement au-dessus du seuil
// AA (4.5:1) pour du texte normal.
export const COULEURS_TACHE = {
  matin: {
    1: { fond: '#E6F1FB', lisere: '#85B7EB', texte: '#0C447C' },
    2: { fond: '#B5D4F4', lisere: '#378ADD', texte: '#0C447C' },
    3: { fond: '#85B7EB', lisere: '#185FA5', texte: '#042C53' },
  },
  midi: {
    1: { fond: '#FAEEDA', lisere: '#FAC775', texte: '#854F0B' },
    2: { fond: '#FAC775', lisere: '#EF9F27', texte: '#633806' },
    3: { fond: '#EF9F27', lisere: '#BA7517', texte: '#412402' },
  },
  journee: {
    1: { fond: '#EAF3DE', lisere: '#97C459', texte: '#3B6D11' },
    2: { fond: '#C0DD97', lisere: '#639922', texte: '#27500A' },
    3: { fond: '#97C459', lisere: '#3B6D11', texte: '#173404' },
  },
  soir: {
    1: { fond: '#FBEAF0', lisere: '#ED93B1', texte: '#72243E' },
    2: { fond: '#F4C0D1', lisere: '#D4537E', texte: '#72243E' },
    3: { fond: '#ED93B1', lisere: '#993556', texte: '#4B1528' },
  },
}

// Rareté de la récurrence -> niveau d'intensité (1 clair, 2 moyen, 3 foncé). Tout
// ce qui n'est pas listé explicitement (quotidienne, tâche ponctuelle sans
// récurrence, conditionnelle avant application de sa règle à part dans
// couleurTache) reste au niveau 1.
export function niveauDeRecurrence(recurrence) {
  if (recurrence === 'hebdo' || recurrence === 'premier_vendredi') return 2
  if (recurrence === 'mensuelle' || recurrence === 'intervalle') return 3
  return 1
}

// Couleur { fond, lisere, texte } d'une tâche = teinte de sa période + intensité
// de la rareté de sa récurrence. Les tâches conditionnelles NE suivent PAS
// l'échelle de rareté (leur fréquence dépend de la météo, pas d'un calendrier) :
// elles restent au niveau 1 de leur période, distinguées par leur emoji de
// condition (☔❄️🌩️🌙) plutôt que par une teinte séparée.
export function couleurTache(periode, recurrence) {
  const niveau = recurrence === 'conditionnelle' ? 1 : niveauDeRecurrence(recurrence)
  return COULEURS_TACHE[periode]?.[niveau]
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

// Alerte visuelle "nouveau/modifié" sur les tâches récurrentes (task_templates).
export const DUREE_FRAICHEUR_HEURES = 48
export const SEUIL_NOUVEAU_MINUTES = 1
