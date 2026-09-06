// ============================================================================
// TOUS LES TEXTES AFFICHÉS DANS L'APP — modifiables ici sans toucher au code.
// ============================================================================
//
// ⚠️ Pour Frank : pour changer un mot affiché à l'écran, modifie UNIQUEMENT le
// texte entre guillemets, À DROITE des deux-points (:). Ne touche JAMAIS :
//   - les noms à GAUCHE des deux-points (ex. `titreChoix`) — ce sont des noms
//     techniques utilisés par le code, pas du texte affiché ;
//   - la ponctuation de structure (virgules, accolades { }, guillemets).
//
// Certains textes contiennent un mot entre accolades, ex. "Bonjour {prenom}".
// C'est un EMPLACEMENT que le code remplace automatiquement par une vraie
// valeur (le prénom de la personne, un nombre de jours...). Tu peux changer
// les mots autour, mais garde le mot entre accolades tel quel (ex. {prenom},
// {n}, {jours}, {condition}, {total}, {faites}, {saison}, {horaire}).
//
// Après modification : commit → Vercel redéploie tout seul, aucune autre
// étape nécessaire.
//
// Ce fichier ne contient QUE du texte d'affichage. Il ne contient PAS :
//   - les données métier (libellés de tâches, prénoms, motifs de congé...) :
//     elles vivent dans Supabase, pas ici ;
//   - les couleurs et durées techniques (PERIODE_COULEURS, HORAIRE_SOIR,
//     DUREE_FRAICHEUR_HEURES...) : elles restent dans src/lib/constants.js.
//
// ============================================================================

/**
 * Remplace les emplacements {xxx} d'un texte par de vraies valeurs.
 * Exemple : formatTexte('Bonjour {prenom}', { prenom: 'Julie' }) -> 'Bonjour Julie'
 */
export function formatTexte(gabarit, valeurs) {
  return Object.entries(valeurs).reduce(
    (texte, [cle, valeur]) => texte.replaceAll(`{${cle}}`, valeur),
    gabarit
  )
}

export const T = {
  // ---- Mots réutilisés à plusieurs endroits de l'app ----
  commun: {
    chargement: 'Chargement…',
    deconnexion: '· quitter',
    ajouter: 'Ajouter',
    annuler: 'Annuler',
    enregistrer: 'Enregistrer',
    // Partagé par les deux sens de commentaires (salarié→Laetitia et Laetitia→salarié) :
    // même bouton, même effet (passe en lu, quitte la vue active).
    marquerLu: 'Marquer comme lu',
    // Photo optionnelle jointe à un commentaire — partagé par les deux sens.
    ajouterPhoto: '📷 Ajouter une photo',
    retirerPhoto: '✕ Retirer la photo',
    envoiPhotoEnCours: 'Envoi de la photo…',
    erreurPhoto: 'Photo non envoyée, réessaie.',
  },

  // ---- Labels par clé technique (période, condition, rôle, jour, famille) ----
  // La clé à gauche (ex. 'matin', 'pluie', 'employeur') est utilisée par le
  // code et NE DOIT PAS changer. Seul le mot à droite est affiché à l'écran.
  periodes: {
    matin: 'Matin',
    midi: 'Midi',
    journee: 'Dans la journée',
    soir: 'Soir',
  },
  periodeIcones: {
    matin: '🌅',
    midi: '☀️',
    journee: '🌤️',
    soir: '🌇',
  },
  conditions: {
    pluie: 'Pluie',
    gel: 'Gel',
    grandgel: 'Orage',
    gardiennage: 'Gardiennage',
  },
  conditionEmojis: {
    pluie: '☔',
    gel: '❄️',
    grandgel: '🌩️',
    gardiennage: '🌙',
  },
  roles: {
    employeur: 'Employeur',
    salarie: 'Salarié',
  },
  familles: {
    quotidienne: 'Quotidienne',
    hebdo: 'Hebdomadaire',
    mensuelle: 'Mensuelle',
    conditionnelle: 'Conditionnelle',
    intervalle: 'Intervalle',
    premier_vendredi: 'Premier vendredi du mois',
  },
  saisons: {
    ete: 'été',
    hiver: 'hiver',
  },
  jours: {
    // Lettre affichée sur les cases de sélection de jour (Réglages, Repos).
    abreviations: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
    // Nom complet affiché dans les menus déroulants (Réglages).
    noms: ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'],
  },

  // ---- Badges (Nouveau / Modifié / Ajout) ----
  badges: {
    nouveau: 'Nouveau',
    modifie: 'Modifié',
    ajout: 'ajout',
  },

  // ---- Écran de connexion ----
  login: {
    titreChoix: 'Qui es-tu ?',
    retour: '← Retour',
    bonjour: 'Bonjour',
    sousTitre: 'Entre ton code à 4 chiffres',
    effacer: '⌫',
    codeIncorrect: 'Code incorrect. Réessaie.',
  },

  // ---- Écran salarié ----
  salarie: {
    saisonPrefixe: 'Saison {saison} — soir {horaire}',
    compteur: '{faites}/{total} faites',
    chargementTaches: 'Chargement des tâches…',
    jourRepos: "Jour de repos — aucune tâche aujourd'hui.",
    tacheListeVide: "Aucune tâche prévue aujourd'hui.",
    observationLabel: 'Observation pour Laetitia',
    observationPlaceholder: 'Un cheval boiteux, du matériel cassé…',
    observationBouton: 'Envoyer',
    observationEnvoyee: 'Envoyé ✓',
    commentairesTitre: 'Message de Laetitia',
  },

  // ---- Écran employeur — onglets ----
  employeurOnglets: {
    jour: "Aujourd'hui",
    historique: 'Historique',
    reglages: 'Réglages',
    comptes: 'Comptes',
    repos: 'Repos',
  },

  // ---- Écran employeur — onglet "Aujourd'hui" ----
  employeur: {
    conditionsTitre: 'Conditions du jour',
    ponctuelleTitre: 'Ajouter une tâche ponctuelle',
    ponctuellePlaceholder: 'Libellé de la tâche',
    oublieesTitre: 'Tâches oubliées',
    oublieesVide: 'Rien à signaler.',
    observationsTitre: 'Observations reçues',
    observationsVide: 'Aucune observation non lue.',
    commentaireTitre: 'Commentaire pour le salarié',
    commentairePlaceholder: 'Une consigne, un rappel…',
    gardiennagePlageTitre: 'Gardiennage sur plusieurs jours',
    gardiennagePlageIntro:
      'Active ou retire le gardiennage sur une période complète, sans repasser jour par jour.',
    activerPlageBouton: 'Activer sur cette période',
    desactiverPlageBouton: 'Désactiver sur cette période',
    confirmDesactivationPlage: 'Retirer le gardiennage sur cette période ?',
    erreurPlageDatesManquantes: 'Indique une date de début et une date de fin.',
    erreurPlageDatesInvalides: 'La date de fin doit être après la date de début.',
    plageAppliquee: 'Fait ✓',
  },

  // ---- Historique ----
  historique: {
    tachesVide: 'Aucune tâche attendue ce jour-là.',
    jourRepos: 'Repos',
    jourConge: 'Congés',
    observationsTitre: 'Observations',
    observationsVide: 'Aucune observation ce jour-là.',
  },

  // ---- Réglages (gestion des tâches récurrentes) ----
  reglages: {
    intro:
      "Modifie le libellé, la période ou les jours d'une tâche récurrente. Désactiver une tâche " +
      "la retire du planning des prochains jours sans toucher à l'historique déjà enregistré — " +
      "elle n'est jamais supprimée.",
    ouvrirAjout: '+ Ajouter une tâche récurrente',
    fermerAjout: '− Fermer',
    // Titre du groupe "Intervalle" dans le classement par famille (§4) — générique,
    // "X" n'est pas remplacé par un vrai nombre (le groupe peut contenir plusieurs
    // tâches avec des intervalles différents). Rien à voir avec intervalleSuffixe
    // plus bas, qui affiche le VRAI nombre de jours d'une tâche précise.
    familleIntervalleTitre: 'Intervalle (tous les X jours)',
    champLibelle: 'Libellé',
    champPeriode: 'Période',
    champRecurrence: 'Récurrence',
    champTypeJour: 'Type de jour',
    optionJourUnique: 'Un jour fixe chaque semaine',
    optionRouleau: 'Plusieurs jours (rouleau, modifiable ensuite)',
    champJour: 'Jour',
    champJoursMois: 'Jours du mois (ex : 1, 15)',
    placeholderJoursMois: '1, 15',
    champCondition: 'Condition',
    champIntervalle: 'Tous les combien de jours',
    erreurRouleauVide: 'Sélectionne au moins un jour pour une tâche à rouleau.',
    erreurJoursMoisInvalides: 'Indique au moins un jour du mois valide (1 à 31), séparés par des virgules.',
    erreurIntervalleInvalide: 'Le nombre de jours doit être un entier positif.',
    creerBouton: 'Créer la tâche',
    vide: 'Aucune tâche récurrente configurée.',
    confirmDesactivation:
      "Cette tâche n'apparaîtra plus les prochains jours. L'historique est conservé. Continuer ?",
    desactiverBouton: 'Désactiver',
    reactiverBouton: 'Réactiver',
    statutInactif: "Désactivée — n'apparaît plus dans le planning.",
    intervalleSuffixe: '(tous les {n} jours)',
    moisSuffixe: '(les {jours} du mois)',
    familleConditionnelleTitre: 'Conditionnelle — {condition}',
    supprimerBouton: 'Supprimer',
    confirmSuppressionSimple: 'Supprimer définitivement cette tâche ? Cette action est irréversible.',
    confirmSuppressionArchive:
      'Cette tâche a un historique : elle sera archivée (masquée) plutôt que supprimée, ' +
      'pour préserver les données passées. Continuer ?',
    monterBouton: '▲',
    descendreBouton: '▼',
    modifierRecurrenceBouton: 'Modifier la récurrence',
  },

  // ---- Comptes (renommer / changer le PIN) ----
  comptes: {
    intro:
      "Renomme un compte (le nom affiché sur l'écran de connexion) ou change son code PIN à 4 " +
      'chiffres. Laisse le champ code vide pour ne pas le changer.',
    champNom: 'Nom affiché',
    champPin: 'Nouveau code PIN (4 chiffres)',
    pinPlaceholder: '••••',
    erreurPrenomVide: 'Le prénom ne peut pas être vide.',
    erreurPinInvalide: 'Le code doit contenir exactement 4 chiffres.',
    enregistrerBouton: 'Enregistrer',
    succes: 'Enregistré ✓',
  },

  // ---- Repos (repos hebdo + congés + exceptions ponctuelles) ----
  repos: {
    hebdoTitre: 'Repos hebdomadaire',
    hebdoIntro: 'Jour(s) où le centre ne fonctionne pas, chaque semaine.',
    congeAjoutTitre: 'Ajouter un congé',
    champDu: 'Du',
    champAu: 'Au',
    champMotif: 'Motif (optionnel)',
    motifPlaceholder: 'Vacances, fermeture annuelle…',
    erreurDatesManquantes: 'Indique une date de début et une date de fin.',
    erreurDatesInvalides: 'La date de fin doit être après la date de début.',
    congesAVenirTitre: 'Congés à venir',
    congesVide: 'Aucun congé prévu.',
    confirmRetraitConge: 'Retirer ce congé ?',
    retirerBouton: 'Retirer',
    exceptionAjoutTitre: 'Exception ponctuelle',
    exceptionIntro:
      'Décale le repos pour un jour précis, sans toucher à la règle du repos hebdomadaire ' +
      '(ex : le salarié travaille ce dimanche et prend son repos le jeudi à la place).',
    champDate: 'Date',
    champType: 'Ce jour-là',
    optionExceptionRepos: 'Repos',
    optionExceptionTravaille: 'Travaillé',
    erreurDateManquante: 'Indique une date.',
    exceptionsAVenirTitre: 'Exceptions à venir',
    exceptionsVide: 'Aucune exception prévue.',
    confirmRetraitException: 'Retirer cette exception ? Le jour reprendra la règle habituelle.',
  },

  // ---- Jours "extérieur" (horaires alternatifs des tâches concernées) ----
  exterieur: {
    hebdoTitre: 'Jours extérieur',
    hebdoIntro:
      "Jour(s) où le travail se fait à l'extérieur, chaque semaine — change l'horaire affiché " +
      'des tâches concernées (pas leur contenu).',
    exceptionAjoutTitre: 'Exception ponctuelle',
    exceptionIntro:
      'Force un jour précis en extérieur ou intérieur, sans toucher à la règle hebdomadaire.',
    champDate: 'Date',
    champType: 'Ce jour-là',
    optionExterieur: 'Extérieur',
    optionInterieur: 'Intérieur',
    erreurDateManquante: 'Indique une date.',
    exceptionsAVenirTitre: 'Exceptions à venir',
    exceptionsVide: 'Aucune exception prévue.',
    confirmRetraitException: 'Retirer cette exception ? Le jour reprendra la règle habituelle.',
    retirerBouton: 'Retirer',
  },

  // ---- Sens des commentaires (Historique) ----
  directions: {
    salarie_vers_employeur: 'Laetitia',
    employeur_vers_salarie: 'Salarié',
  },
}
