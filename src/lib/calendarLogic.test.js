import { describe, it, expect } from 'vitest'
import {
  isoDayOfWeek,
  isFirstFridayOfMonth,
  toDateKey,
  daysBetweenDateKeys,
  getSaison,
  isTemplateExpected,
  getTasksForDay,
  isTaskDone,
  buildDailyTaskList,
  getTachesOubliees,
  statutFraicheur,
  estJourNonTravaille,
  typeJourNonTravaille,
  joursDansPlage,
  formatHeureCourte,
} from './calendarLogic'

describe('isoDayOfWeek', () => {
  it('lundi 2026-07-20 -> 1', () => {
    expect(isoDayOfWeek(new Date(2026, 6, 20))).toBe(1)
  })
  it('dimanche 2026-07-26 -> 7', () => {
    expect(isoDayOfWeek(new Date(2026, 6, 26))).toBe(7)
  })
})

describe('isFirstFridayOfMonth', () => {
  it('détecte le premier vendredi', () => {
    expect(isFirstFridayOfMonth(new Date(2026, 6, 3))).toBe(true) // vendredi 3 juillet 2026
  })
  it('rejette un vendredi plus tardif', () => {
    expect(isFirstFridayOfMonth(new Date(2026, 6, 10))).toBe(false)
  })
  it('rejette un autre jour de la semaine', () => {
    expect(isFirstFridayOfMonth(new Date(2026, 6, 1))).toBe(false)
  })
})

describe('toDateKey / daysBetweenDateKeys', () => {
  it('formate correctement', () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('calcule un écart de jours', () => {
    expect(daysBetweenDateKeys('2026-07-01', '2026-07-16')).toBe(15)
  })
})

describe('estJourNonTravaille', () => {
  it('jour de repos hebdo (dimanche par défaut)', () => {
    const dimanche = new Date(2026, 6, 26)
    expect(estJourNonTravaille(dimanche, [7], [])).toBe(true)
  })

  it("jour hors repos hebdo et hors congé -> travaillé", () => {
    const lundi = new Date(2026, 6, 20)
    expect(estJourNonTravaille(lundi, [7], [])).toBe(false)
  })

  it('repos hebdo déplacé au lundi (réglage employeur)', () => {
    const lundi = new Date(2026, 6, 20)
    const dimanche = new Date(2026, 6, 26)
    expect(estJourNonTravaille(lundi, [1], [])).toBe(true)
    expect(estJourNonTravaille(dimanche, [1], [])).toBe(false)
  })

  it('jour compris dans une plage de congés', () => {
    const conges = [{ date_debut: '2026-08-01', date_fin: '2026-08-15' }]
    expect(estJourNonTravaille(new Date(2026, 7, 10), [7], conges)).toBe(true)
    expect(estJourNonTravaille(new Date(2026, 7, 1), [7], conges)).toBe(true)
    expect(estJourNonTravaille(new Date(2026, 7, 15), [7], conges)).toBe(true)
  })

  it('jour hors plage de congés (bornes exclues de justesse)', () => {
    const conges = [{ date_debut: '2026-08-01', date_fin: '2026-08-15' }]
    expect(estJourNonTravaille(new Date(2026, 6, 31), [], conges)).toBe(false)
    expect(estJourNonTravaille(new Date(2026, 7, 16), [], conges)).toBe(false)
  })

  it('aucun repos ni congé configuré -> toujours travaillé', () => {
    expect(estJourNonTravaille(new Date(2026, 6, 26), [], [])).toBe(false)
  })
})

describe('typeJourNonTravaille (§ historique : repos vs congé)', () => {
  it('jour travaillé -> null', () => {
    expect(typeJourNonTravaille(new Date(2026, 6, 20), [7], [])).toBe(null)
  })

  it('repos hebdo seul -> "repos"', () => {
    expect(typeJourNonTravaille(new Date(2026, 6, 26), [7], [])).toBe('repos')
  })

  it('congé seul -> "conge"', () => {
    const conges = [{ date_debut: '2026-08-01', date_fin: '2026-08-15' }]
    expect(typeJourNonTravaille(new Date(2026, 7, 10), [], conges)).toBe('conge')
  })

  it('jour à la fois repos hebdo et dans une plage de congés -> "conge" prioritaire', () => {
    const dimanche = new Date(2026, 7, 9)
    const conges = [{ date_debut: '2026-08-01', date_fin: '2026-08-15' }]
    expect(typeJourNonTravaille(dimanche, [7], conges)).toBe('conge')
  })
})

describe('typeJourNonTravaille — exceptions ponctuelles (repos_exceptions), ordre strict', () => {
  // Semaine du décalage dimanche <-> jeudi de la consigne : dimanche 2026-08-09
  // (repos hebdo) forcé travaillé, jeudi 2026-08-13 (normalement travaillé) forcé repos.
  const dimanche = new Date(2026, 7, 9)
  const jeudi = new Date(2026, 7, 13)
  const dimancheSuivant = new Date(2026, 7, 16)

  it("1. exception 'travaille' un dimanche de repos hebdo -> TRAVAILLÉ, prime sur tout", () => {
    const exceptions = [{ jour: '2026-08-09', type: 'travaille' }]
    const conges = [{ date_debut: '2026-08-01', date_fin: '2026-08-15' }] // même si aussi en congé
    expect(typeJourNonTravaille(dimanche, [7], conges, exceptions)).toBe(null)
  })

  it("2. exception 'repos' un jeudi normalement travaillé -> REPOS", () => {
    const exceptions = [{ jour: '2026-08-13', type: 'repos' }]
    expect(typeJourNonTravaille(jeudi, [7], [], exceptions)).toBe('repos')
  })

  it('3. pas d\'exception ce jour-là -> congé toujours pris en compte', () => {
    const exceptions = [{ jour: '2026-08-13', type: 'repos' }] // vise un autre jour
    const conges = [{ date_debut: '2026-08-01', date_fin: '2026-08-15' }]
    expect(typeJourNonTravaille(dimanche, [], conges, exceptions)).toBe('conge')
  })

  it('4. pas d\'exception ni de congé ce jour-là -> repos hebdo toujours pris en compte', () => {
    const exceptions = [{ jour: '2026-08-13', type: 'repos' }] // vise un autre jour
    expect(typeJourNonTravaille(dimanche, [7], [], exceptions)).toBe('repos')
  })

  it('5. aucune règle ne matche -> TRAVAILLÉ', () => {
    const exceptions = [{ jour: '2026-08-13', type: 'repos' }] // vise un autre jour
    expect(typeJourNonTravaille(dimanche, [1], [], exceptions)).toBe(null)
  })

  it('la règle permanente (repos hebdo dimanche) reste intacte les autres semaines', () => {
    const exceptions = [{ jour: '2026-08-09', type: 'travaille' }] // ne vise que ce dimanche-là
    expect(typeJourNonTravaille(dimancheSuivant, [7], [], exceptions)).toBe('repos')
  })
})

describe('getSaison (bascule sur le vrai changement d\'heure européen)', () => {
  // 2026 : dernier dimanche de mars = 29/03, dernier dimanche d'octobre = 25/10.
  it('bascule de printemps 2026 (29 mars)', () => {
    expect(getSaison(new Date(2026, 2, 28))).toBe('hiver') // veille
    expect(getSaison(new Date(2026, 2, 29))).toBe('ete') // jour de bascule
    expect(getSaison(new Date(2026, 2, 30))).toBe('ete') // lendemain
  })

  it('bascule d\'automne 2026 (25 octobre)', () => {
    expect(getSaison(new Date(2026, 9, 24))).toBe('ete') // veille
    expect(getSaison(new Date(2026, 9, 25))).toBe('hiver') // jour de bascule
    expect(getSaison(new Date(2026, 9, 26))).toBe('hiver') // lendemain
  })

  it('en plein été / plein hiver 2026', () => {
    expect(getSaison(new Date(2026, 6, 15))).toBe('ete') // juillet
    expect(getSaison(new Date(2026, 0, 15))).toBe('hiver') // janvier
    expect(getSaison(new Date(2026, 11, 15))).toBe('hiver') // décembre
  })

  // 2027 : dernier dimanche de mars = 28/03, dernier dimanche d'octobre = 31/10 —
  // année différente avec un cas limite (le 31 octobre est lui-même un dimanche),
  // pour vérifier que le calcul est bien dynamique et pas une date codée en dur.
  it('bascule de printemps 2027 (28 mars) — année différente', () => {
    expect(getSaison(new Date(2027, 2, 27))).toBe('hiver')
    expect(getSaison(new Date(2027, 2, 28))).toBe('ete')
  })

  it('bascule d\'automne 2027 (31 octobre, cas limite fin de mois)', () => {
    expect(getSaison(new Date(2027, 9, 30))).toBe('ete')
    expect(getSaison(new Date(2027, 9, 31))).toBe('hiver')
    expect(getSaison(new Date(2027, 10, 1))).toBe('hiver')
  })
})

describe('isTemplateExpected', () => {
  it('quotidienne toujours vraie', () => {
    expect(isTemplateExpected({ recurrence: 'quotidienne' }, new Date())).toBe(true)
  })

  it('hebdo simple (jour_semaine)', () => {
    const t = { recurrence: 'hebdo', jour_semaine: 5 } // vendredi
    expect(isTemplateExpected(t, new Date(2026, 6, 3))).toBe(true) // vendredi 3 juillet 2026
    expect(isTemplateExpected(t, new Date(2026, 6, 4))).toBe(false)
  })

  it('hebdo rouleau (jours_semaine prioritaire sur jour_semaine)', () => {
    const t = { recurrence: 'hebdo', jour_semaine: 5, jours_semaine: [1, 3] }
    expect(isTemplateExpected(t, new Date(2026, 6, 20))).toBe(true) // lundi
    expect(isTemplateExpected(t, new Date(2026, 6, 3))).toBe(false) // vendredi, pas dans jours_semaine
  })

  it('mensuelle (jours_mois)', () => {
    const t = { recurrence: 'mensuelle', jours_mois: [1, 15] }
    expect(isTemplateExpected(t, new Date(2026, 6, 1))).toBe(true)
    expect(isTemplateExpected(t, new Date(2026, 6, 15))).toBe(true)
    expect(isTemplateExpected(t, new Date(2026, 6, 16))).toBe(false)
  })

  it('premier_vendredi', () => {
    const t = { recurrence: 'premier_vendredi' }
    expect(isTemplateExpected(t, new Date(2026, 6, 3))).toBe(true)
    expect(isTemplateExpected(t, new Date(2026, 6, 10))).toBe(false)
  })

  it('conditionnelle', () => {
    const t = { recurrence: 'conditionnelle', condition: 'pluie' }
    expect(isTemplateExpected(t, new Date(), ['pluie'])).toBe(true)
    expect(isTemplateExpected(t, new Date(), ['gel'])).toBe(false)
    expect(isTemplateExpected(t, new Date(), [])).toBe(false)
  })

  describe('intervalle (herse carrière)', () => {
    const t = { recurrence: 'intervalle', intervalle_jours: 15 }

    it('jamais faite -> attendue', () => {
      expect(isTemplateExpected(t, new Date(2026, 6, 20), [], null)).toBe(true)
    })

    it('faite il y a moins de 15 jours -> pas attendue', () => {
      expect(isTemplateExpected(t, new Date(2026, 6, 10), [], '2026-07-01')).toBe(false)
    })

    it('faite il y a exactement 15 jours -> attendue', () => {
      expect(isTemplateExpected(t, new Date(2026, 6, 16), [], '2026-07-01')).toBe(true)
    })

    it('faite il y a plus de 15 jours -> attendue', () => {
      expect(isTemplateExpected(t, new Date(2026, 6, 20), [], '2026-07-01')).toBe(true)
    })
  })
})

describe('getTasksForDay', () => {
  it('filtre plusieurs templates hétérogènes pour une date donnée', () => {
    const templates = [
      { id: 1, recurrence: 'quotidienne' },
      { id: 2, recurrence: 'hebdo', jour_semaine: 5 },
      { id: 3, recurrence: 'conditionnelle', condition: 'gel' },
      { id: 4, recurrence: 'intervalle', intervalle_jours: 15 },
    ]
    const vendredi = new Date(2026, 6, 3)
    const result = getTasksForDay(templates, vendredi, ['gel'], { 4: '2026-06-01' })
    expect(result.map((t) => t.id)).toEqual([1, 2, 3, 4])
  })
})

describe('isTaskDone / buildDailyTaskList', () => {
  it('reconnaît une completion par template_id ou ponctuelle_id', () => {
    const completions = [{ template_id: 't1' }, { ponctuelle_id: 'p1' }]
    expect(isTaskDone({ kind: 'template', id: 't1' }, completions)).toBe(true)
    expect(isTaskDone({ kind: 'template', id: 't2' }, completions)).toBe(false)
    expect(isTaskDone({ kind: 'ponctuelle', id: 'p1' }, completions)).toBe(true)
  })

  it('assemble et trie templates + ponctuelles par ordre, avec état fait', () => {
    const templates = [
      { id: 't1', recurrence: 'quotidienne', libelle: 'Nourrir', periode: 'matin', ordre: 2 },
      { id: 't2', recurrence: 'quotidienne', libelle: 'Curer', periode: 'matin', ordre: 1 },
    ]
    const ponctuelles = [{ id: 'p1', libelle: 'Vétérinaire', periode: 'matin' }]
    const completions = [{ template_id: 't2' }]

    const result = buildDailyTaskList({
      templates,
      ponctuelles,
      completions,
      date: new Date(),
    })

    expect(result.map((t) => t.id)).toEqual(['t2', 't1', 'p1'])
    expect(result.find((t) => t.id === 't2').fait).toBe(true)
    expect(result.find((t) => t.id === 't1').fait).toBe(false)
    expect(result.find((t) => t.id === 'p1').kind).toBe('ponctuelle')
  })

  it("respecte l'ordre opérationnel exact du matin même si des tâches d'autres " +
    "périodes ont un ordre qui s'entrelace (écran salarié)", () => {
    const sequenceMatin = [
      '4x4',
      'chiennes',
      'tableau',
      'box',
      'parc du bas',
      'foin/filets',
      'parcs',
      'matelas',
      'renfermer chiennes',
    ]
    const templatesMatin = sequenceMatin.map((libelle, index) => ({
      id: `matin-${index}`,
      recurrence: 'quotidienne',
      libelle,
      periode: 'matin',
      ordre: index + 1,
    }))
    // Tâches d'autres périodes avec des valeurs d'ordre qui s'entrelacent avec celles du matin.
    const templatesAutres = [
      { id: 'soir-1', recurrence: 'quotidienne', libelle: 'Fermer', periode: 'soir', ordre: 1 },
      { id: 'soir-2', recurrence: 'quotidienne', libelle: 'Éteindre', periode: 'soir', ordre: 4 },
      { id: 'midi-1', recurrence: 'quotidienne', libelle: 'Vérifier eau', periode: 'midi', ordre: 2 },
    ]

    const result = buildDailyTaskList({
      templates: [...templatesMatin, ...templatesAutres],
      date: new Date(),
    })

    const libellesMatin = result.filter((t) => t.periode === 'matin').map((t) => t.libelle)
    expect(libellesMatin).toEqual(sequenceMatin)
  })

  it('trie une période par heure croissante (tâches avec heure), puis par ordre pour celles sans (§ mécanisme 1)', () => {
    const templates = [
      { id: 'sans-1', recurrence: 'quotidienne', libelle: 'Sans heure A', periode: 'matin', ordre: 1 },
      { id: 'avec-20h30', recurrence: 'conditionnelle', condition: 'gardiennage', libelle: 'Dernière du soir', periode: 'matin', heure: '20:30:00', ordre: 99 },
      { id: 'sans-2', recurrence: 'quotidienne', libelle: 'Sans heure B', periode: 'matin', ordre: 2 },
      { id: 'avec-7h30', recurrence: 'conditionnelle', condition: 'gardiennage', libelle: 'Nourrir chiens', periode: 'matin', heure: '07:30:00', ordre: 50 },
    ]
    const result = buildDailyTaskList({
      templates,
      date: new Date(),
      activeConditions: ['gardiennage'],
    })
    expect(result.map((t) => t.libelle)).toEqual([
      'Nourrir chiens', // heure la plus tôt
      'Dernière du soir', // heure la plus tardive
      'Sans heure A', // pas d'heure -> ordre
      'Sans heure B',
    ])
  })

  it("une tâche écurie sans `heure` n'affiche rien (heureAffichee null) — pas de régression", () => {
    const templates = [{ id: 't1', recurrence: 'quotidienne', libelle: 'Nourrir', periode: 'matin', ordre: 1 }]
    const result = buildDailyTaskList({ templates, date: new Date() })
    expect(result[0].heureAffichee).toBe(null)
    expect(result[0].categorie).toBe('ecurie')
  })

  it('jour extérieur : heure_exterieur remplace heure si renseignée (§ mécanisme 2)', () => {
    const templates = [
      {
        id: 't1',
        recurrence: 'conditionnelle',
        condition: 'gardiennage',
        categorie: 'maison',
        libelle: 'Nourrir chiens',
        periode: 'matin',
        heure: '07:30:00',
        heure_exterieur: '05:30:00',
        ordre: 1,
      },
    ]
    const normal = buildDailyTaskList({ templates, date: new Date(), activeConditions: ['gardiennage'] })
    expect(normal[0].heureAffichee).toBe('07:30:00')

    const exterieur = buildDailyTaskList({
      templates,
      date: new Date(),
      activeConditions: ['gardiennage'],
      jourExterieur: true,
    })
    expect(exterieur[0].heureAffichee).toBe('05:30:00')
    expect(exterieur[0].categorie).toBe('maison')
  })

  it("jour extérieur mais heure_exterieur absente -> reste sur `heure`", () => {
    const templates = [
      { id: 't1', recurrence: 'quotidienne', libelle: 'Nourrir', periode: 'matin', heure: '08:00:00', ordre: 1 },
    ]
    const result = buildDailyTaskList({ templates, date: new Date(), jourExterieur: true })
    expect(result[0].heureAffichee).toBe('08:00:00')
  })
})

describe('formatHeureCourte', () => {
  it('minutes rondes -> "7h"', () => {
    expect(formatHeureCourte('07:00:00')).toBe('7h')
  })
  it('minutes non rondes -> "7h30"', () => {
    expect(formatHeureCourte('07:30:00')).toBe('7h30')
  })
  it('heure sur 2 chiffres sans zéro superflu -> "18h"', () => {
    expect(formatHeureCourte('18:00:00')).toBe('18h')
  })
  it('null/undefined -> null (pas d\'affichage)', () => {
    expect(formatHeureCourte(null)).toBe(null)
    expect(formatHeureCourte(undefined)).toBe(null)
  })
})

describe('joursDansPlage', () => {
  it('liste tous les jours inclus, bornes comprises', () => {
    expect(joursDansPlage('2026-09-01', '2026-09-05')).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ])
  })
  it('une seule date si début = fin', () => {
    expect(joursDansPlage('2026-09-01', '2026-09-01')).toEqual(['2026-09-01'])
  })
  it('traverse un changement de mois sans erreur', () => {
    expect(joursDansPlage('2026-08-30', '2026-09-02')).toEqual([
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
    ])
  })
})

describe('statutFraicheur', () => {
  const maintenant = new Date(2026, 6, 26, 12, 0, 0)

  it('pas de modifie_le -> null', () => {
    expect(statutFraicheur({}, maintenant)).toBe(null)
  })

  it('créée il y a moins de 48h et jamais modifiée depuis -> nouveau', () => {
    const creeLe = new Date(2026, 6, 25, 10, 0, 0).toISOString()
    expect(statutFraicheur({ cree_le: creeLe, modifie_le: creeLe }, maintenant)).toBe('nouveau')
  })

  it('modifiée il y a moins de 48h, longtemps après sa création -> modifie', () => {
    const creeLe = new Date(2026, 5, 1, 10, 0, 0).toISOString()
    const modifieLe = new Date(2026, 6, 25, 10, 0, 0).toISOString()
    expect(statutFraicheur({ cree_le: creeLe, modifie_le: modifieLe }, maintenant)).toBe('modifie')
  })

  it('modifiée il y a plus de 48h -> null (le style redevient normal)', () => {
    const modifieLe = new Date(2026, 6, 20, 10, 0, 0).toISOString()
    expect(statutFraicheur({ cree_le: modifieLe, modifie_le: modifieLe }, maintenant)).toBe(null)
  })

  it('exactement à la limite des 48h -> null (borne exclusive)', () => {
    const modifieLe = new Date(maintenant.getTime() - 48 * 60 * 60 * 1000).toISOString()
    expect(statutFraicheur({ cree_le: modifieLe, modifie_le: modifieLe }, maintenant)).toBe(null)
  })

  it('écart cree_le/modifie_le de 2 minutes -> modifie, pas nouveau', () => {
    const creeLe = new Date(2026, 6, 25, 10, 0, 0).toISOString()
    const modifieLe = new Date(2026, 6, 25, 10, 2, 0).toISOString()
    expect(statutFraicheur({ cree_le: creeLe, modifie_le: modifieLe }, maintenant)).toBe('modifie')
  })
})

describe('getTachesOubliees', () => {
  it('retient les tâches non faites dont la période est passée', () => {
    const list = [
      { id: 1, periode: 'matin', fait: false },
      { id: 2, periode: 'matin', fait: true },
      { id: 3, periode: 'soir', fait: false },
    ]
    const midi = new Date(2026, 6, 20, 13, 0)
    const result = getTachesOubliees(list, midi)
    expect(result.map((t) => t.id)).toEqual([1])
  })

  it('une tâche "journee" (rouleau, herse) n\'est jamais en retard à midi', () => {
    const list = [{ id: 1, periode: 'journee', fait: false }]
    const midi = new Date(2026, 6, 20, 13, 0)
    expect(getTachesOubliees(list, midi)).toEqual([])
  })

  it('une tâche "journee" reste tolérée même tard le soir (échéance = fin de journée)', () => {
    const list = [{ id: 1, periode: 'journee', fait: false }]
    const tresTard = new Date(2026, 6, 20, 23, 30)
    expect(getTachesOubliees(list, tresTard)).toEqual([])
  })
})
