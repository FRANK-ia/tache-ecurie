import { useEffect, useState } from 'react'
import {
  fetchTemplates,
  fetchPonctuellesDuJour,
  fetchCompletionsDuJour,
  fetchConditionsDuJour,
  fetchDernieresCompletionsIntervalleAvant,
  fetchObservationsPourDate,
} from '../../lib/api'
import { buildDailyTaskList, toDateKey } from '../../lib/calendarLogic'
import { PERIODES, PERIODE_LABELS } from '../../lib/constants'
import './Historique.css'

export default function Historique() {
  const [dateChoisie, setDateChoisie] = useState(toDateKey(new Date()))
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [taches, setTaches] = useState([])
  const [observations, setObservations] = useState([])

  useEffect(() => {
    let annule = false
    async function charger() {
      setChargement(true)
      setErreur('')
      try {
        const templates = await fetchTemplates()
        const templatesIntervalle = templates.filter((t) => t.recurrence === 'intervalle')
        const [ponctuelles, completions, conditions, dernieresCompletions, obs] = await Promise.all([
          fetchPonctuellesDuJour(dateChoisie),
          fetchCompletionsDuJour(dateChoisie),
          fetchConditionsDuJour(dateChoisie),
          fetchDernieresCompletionsIntervalleAvant(templatesIntervalle.map((t) => t.id), dateChoisie),
          fetchObservationsPourDate(dateChoisie),
        ])
        if (annule) return
        const [annee, mois, jour] = dateChoisie.split('-').map(Number)
        const dateObj = new Date(annee, mois - 1, jour)
        const liste = buildDailyTaskList({
          templates,
          ponctuelles,
          completions,
          date: dateObj,
          activeConditions: conditions,
          lastCompletionByTemplateId: dernieresCompletions,
        })
        setTaches(liste)
        setObservations(obs)
      } catch (e) {
        if (!annule) setErreur(e.message)
      } finally {
        if (!annule) setChargement(false)
      }
    }
    charger()
    return () => {
      annule = true
    }
  }, [dateChoisie])

  const parPeriode = PERIODES.map((periode) => ({
    periode,
    taches: taches.filter((t) => t.periode === periode),
  })).filter((g) => g.taches.length > 0)

  return (
    <div className="historique">
      <input
        type="date"
        className="historique-date"
        value={dateChoisie}
        max={toDateKey(new Date())}
        onChange={(e) => setDateChoisie(e.target.value)}
      />

      {erreur && <p className="historique-erreur">{erreur}</p>}

      {chargement ? (
        <p className="historique-chargement">Chargement…</p>
      ) : (
        <>
          {parPeriode.length === 0 && <p className="historique-vide">Aucune tâche attendue ce jour-là.</p>}
          {parPeriode.map((groupe) => (
            <section key={groupe.periode} className="historique-groupe">
              <h3 className="historique-entete">{PERIODE_LABELS[groupe.periode]}</h3>
              <ul className="historique-liste">
                {groupe.taches.map((t) => (
                  <li key={`${t.kind}-${t.id}`} className={t.fait ? 'faite' : 'non-faite'}>
                    <span>{t.fait ? '✓' : '—'}</span> {t.libelle}
                    {t.kind === 'ponctuelle' && <span className="historique-badge">ajout</span>}
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <section className="historique-groupe">
            <h3 className="historique-entete">Observations</h3>
            {observations.length === 0 ? (
              <p className="historique-vide">Aucune observation ce jour-là.</p>
            ) : (
              <ul className="historique-liste">
                {observations.map((obs) => (
                  <li key={obs.id}>
                    {obs.employes?.prenom} : {obs.texte}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
