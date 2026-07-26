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

describe('getSaison', () => {
  it('avril à septembre = été', () => {
    expect(getSaison(new Date(2026, 3, 1))).toBe('ete')
    expect(getSaison(new Date(2026, 8, 30))).toBe('ete')
  })
  it('octobre à mars = hiver', () => {
    expect(getSaison(new Date(2026, 9, 1))).toBe('hiver')
    expect(getSaison(new Date(2026, 2, 31))).toBe('hiver')
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
