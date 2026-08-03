import { useEffect, useState } from 'react'
import {
  fetchTemplatesToutes,
  fetchPonctuellesDuJour,
  fetchCompletionsDuJour,
  fetchConditionsDuJour,
  fetchDernieresCompletionsIntervalleAvant,
  fetchObservationsPourDate,
  fetchJoursRepos,
  fetchConges,
} from '../../lib/api'
import { buildDailyTaskList, toDateKey, typeJourNonTravaille } from '../../lib/calendarLogic'
import { PERIODES, PERIODE_COULEURS } from '../../lib/constants'
import { T } from '../../lib/textes'
import './Historique.css'

export default function Historique() {
  const [dateChoisie, setDateChoisie] = useState(toDateKey(new Date()))
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [taches, setTaches] = useState([])
  const [observations, setObservations] = useState([])
  const [situationJour, setSituationJour] = useState(null)

  useEffect(() => {
    let annule = false
    async function charger() {
      setChargement(true)
      setErreur('')
      try {
        const toutesTemplates = await fetchTemplatesToutes()
        // Un template désactivé n'est retiré que des jours FUTURS (§ gestion des tâches
        // employeur) : pour le présent on applique le filtre actif, mais l'historique des
        // jours passés doit rester fidèle à ce qui était réellement attendu ce jour-là.
        const estAujourdhui = dateChoisie === toDateKey(new Date())
        const templates = estAujourdhui ? toutesTemplates.filter((t) => t.actif) : toutesTemplates
        const templatesIntervalle = templates.filter((t) => t.recurrence === 'intervalle')
        const [ponctuelles, completions, conditions, dernieresCompletions, obs, joursRepos, conges] =
          await Promise.all([
            fetchPonctuellesDuJour(dateChoisie),
            fetchCompletionsDuJour(dateChoisie),
            fetchConditionsDuJour(dateChoisie),
            fetchDernieresCompletionsIntervalleAvant(templatesIntervalle.map((t) => t.id), dateChoisie),
            fetchObservationsPourDate(dateChoisie),
            fetchJoursRepos(),
            fetchConges(),
          ])
        if (annule) return
        const [annee, mois, jour] = dateChoisie.split('-').map(Number)
        const dateObj = new Date(annee, mois - 1, jour)
        // Repos hebdo / congé (§ historique) : personne n'était censé travailler ce
        // jour-là, donc pas de liste de tâches "non réalisées" — juste un rappel de
        // la situation. On construit quand même `taches` à vide plutôt que de ne pas
        // l'appeler, pour garder un seul chemin de code.
        const situation = typeJourNonTravaille(dateObj, joursRepos, conges)
        setSituationJour(situation)
        const liste = situation
          ? []
          : buildDailyTaskList({
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
        <p className="historique-chargement">{T.commun.chargement}</p>
      ) : (
        <>
          {situationJour && (
            <p className="historique-situation">
              {situationJour === 'conge' ? T.historique.jourConge : T.historique.jourRepos}
            </p>
          )}
          {!situationJour && parPeriode.length === 0 && (
            <p className="historique-vide">{T.historique.tachesVide}</p>
          )}
          {!situationJour && parPeriode.map((groupe) => {
            const couleurs = PERIODE_COULEURS[groupe.periode]
            return (
              <section
                key={groupe.periode}
                className="historique-groupe"
                style={{ '--couleur-periode-fond': couleurs?.fond, '--couleur-periode-bordure': couleurs?.bordure }}
              >
                <h3 className="historique-entete">
                  <span className="historique-icone" aria-hidden="true">
                    {T.periodeIcones[groupe.periode]}
                  </span>
                  {T.periodes[groupe.periode]}
                </h3>
                <ul className="historique-liste">
                  {groupe.taches.map((t) => (
                    <li key={`${t.kind}-${t.id}`} className={t.fait ? 'faite' : 'non-faite'}>
                      <span className="historique-marque">{t.fait ? '✓' : '✗'}</span>{' '}
                      {T.conditionEmojis[t.condition] && (
                        <span aria-hidden="true">{T.conditionEmojis[t.condition]} </span>
                      )}
                      {t.libelle}
                      {t.kind === 'ponctuelle' && <span className="historique-badge">{T.badges.ajout}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          <section className="historique-groupe">
            <h3 className="historique-entete">{T.historique.observationsTitre}</h3>
            {observations.length === 0 ? (
              <p className="historique-vide">{T.historique.observationsVide}</p>
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
