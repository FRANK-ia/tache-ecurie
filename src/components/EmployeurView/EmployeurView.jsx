import { useEffect, useMemo, useState } from 'react'
import {
  fetchTemplates,
  fetchPonctuellesDuJour,
  fetchCompletionsDuJour,
  fetchConditionsDuJour,
  fetchDernieresCompletionsIntervalle,
  fetchJoursRepos,
  fetchConges,
  activerCondition,
  desactiverCondition,
  insertPonctuelle,
  fetchObservationsNonLues,
  marquerObservationLue,
} from '../../lib/api'
import { buildDailyTaskList, toDateKey, getTachesOubliees, estJourNonTravaille } from '../../lib/calendarLogic'
import { CONDITIONS, PERIODES } from '../../lib/constants'
import { T } from '../../lib/textes'
import Historique from '../Historique/Historique'
import GestionTaches from '../GestionTaches/GestionTaches'
import GestionComptes from '../GestionComptes/GestionComptes'
import GestionRepos from '../GestionRepos/GestionRepos'
import './EmployeurView.css'

export default function EmployeurView({ employe, onDeconnexion }) {
  const [onglet, setOnglet] = useState('jour')
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [conditionsActives, setConditionsActives] = useState([])
  const [tachesOubliees, setTachesOubliees] = useState([])
  const [observations, setObservations] = useState([])
  const [nouvellePonctuelle, setNouvellePonctuelle] = useState({ libelle: '', periode: 'matin' })
  const [enCours, setEnCours] = useState(false)

  const aujourdhui = useMemo(() => new Date(), [])
  const jourKey = toDateKey(aujourdhui)

  async function charger() {
    setChargement(true)
    setErreur('')
    try {
      const [templates, joursRepos, conges] = await Promise.all([
        fetchTemplates(),
        fetchJoursRepos(),
        fetchConges(),
      ])
      const templatesIntervalle = templates.filter((t) => t.recurrence === 'intervalle')
      const [ponctuelles, completions, conditions, dernieresCompletions, obs] = await Promise.all([
        fetchPonctuellesDuJour(jourKey),
        fetchCompletionsDuJour(jourKey),
        fetchConditionsDuJour(jourKey),
        fetchDernieresCompletionsIntervalle(templatesIntervalle.map((t) => t.id)),
        fetchObservationsNonLues(),
      ])
      const liste = buildDailyTaskList({
        templates,
        ponctuelles,
        completions,
        date: aujourdhui,
        activeConditions: conditions,
        lastCompletionByTemplateId: dernieresCompletions,
      })
      setConditionsActives(conditions)
      // Pas d'oubliées un jour de repos/congé — personne n'est censé être sur place.
      setTachesOubliees(estJourNonTravaille(aujourdhui, joursRepos, conges) ? [] : getTachesOubliees(liste))
      setObservations(obs)
    } catch (e) {
      setErreur(e.message)
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleCondition(condition) {
    if (enCours) return
    setEnCours(true)
    setErreur('')
    const active = conditionsActives.includes(condition)
    try {
      if (active) {
        await desactiverCondition(jourKey, condition)
        setConditionsActives((prev) => prev.filter((c) => c !== condition))
      } else {
        await activerCondition(jourKey, condition)
        setConditionsActives((prev) => [...prev, condition])
      }
    } catch (e) {
      setErreur(e.message)
    } finally {
      setEnCours(false)
    }
  }

  async function ajouterPonctuelle(e) {
    e.preventDefault()
    if (!nouvellePonctuelle.libelle.trim()) return
    setEnCours(true)
    setErreur('')
    try {
      await insertPonctuelle({
        libelle: nouvellePonctuelle.libelle.trim(),
        periode: nouvellePonctuelle.periode,
        jour: jourKey,
        creePar: employe.id,
      })
      setNouvellePonctuelle({ libelle: '', periode: 'matin' })
      await charger()
    } catch (e) {
      setErreur(e.message)
    } finally {
      setEnCours(false)
    }
  }

  async function marquerLue(id) {
    setEnCours(true)
    try {
      await marquerObservationLue(id)
      setObservations((prev) => prev.filter((o) => o.id !== id))
    } catch (e) {
      setErreur(e.message)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="employeur-screen">
      <header className="employeur-entete">
        <p className="employeur-date">
          {aujourdhui.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <button className="employeur-deconnexion" onClick={onDeconnexion}>
          {employe.prenom} {T.commun.deconnexion}
        </button>
      </header>

      <nav className="employeur-onglets">
        <button className={onglet === 'jour' ? 'actif' : ''} onClick={() => setOnglet('jour')}>
          {T.employeurOnglets.jour}
        </button>
        <button className={onglet === 'historique' ? 'actif' : ''} onClick={() => setOnglet('historique')}>
          {T.employeurOnglets.historique}
        </button>
        <button className={onglet === 'reglages' ? 'actif' : ''} onClick={() => setOnglet('reglages')}>
          {T.employeurOnglets.reglages}
        </button>
        <button className={onglet === 'comptes' ? 'actif' : ''} onClick={() => setOnglet('comptes')}>
          {T.employeurOnglets.comptes}
        </button>
        <button className={onglet === 'repos' ? 'actif' : ''} onClick={() => setOnglet('repos')}>
          {T.employeurOnglets.repos}
        </button>
      </nav>

      {erreur && <p className="employeur-erreur">{erreur}</p>}

      {onglet === 'jour' &&
        (chargement ? (
          <p className="employeur-chargement">{T.commun.chargement}</p>
        ) : (
          <div className="employeur-contenu">
            <section className="employeur-section">
              <h2 className="employeur-section-titre">{T.employeur.conditionsTitre}</h2>
              <div className="employeur-conditions">
                {CONDITIONS.map((condition) => (
                  <button
                    key={condition}
                    className={`employeur-condition-bouton ${conditionsActives.includes(condition) ? 'active' : ''}`}
                    onClick={() => toggleCondition(condition)}
                    disabled={enCours}
                  >
                    {T.conditions[condition]}
                  </button>
                ))}
              </div>
            </section>

            <section className="employeur-section">
              <h2 className="employeur-section-titre">{T.employeur.ponctuelleTitre}</h2>
              <form className="employeur-ponctuelle-form" onSubmit={ajouterPonctuelle}>
                <input
                  type="text"
                  placeholder={T.employeur.ponctuellePlaceholder}
                  value={nouvellePonctuelle.libelle}
                  onChange={(e) => setNouvellePonctuelle((p) => ({ ...p, libelle: e.target.value }))}
                  className="employeur-ponctuelle-champ"
                />
                <select
                  value={nouvellePonctuelle.periode}
                  onChange={(e) => setNouvellePonctuelle((p) => ({ ...p, periode: e.target.value }))}
                  className="employeur-ponctuelle-select"
                >
                  {PERIODES.map((p) => (
                    <option key={p} value={p}>
                      {T.periodes[p]}
                    </option>
                  ))}
                </select>
                <button type="submit" className="employeur-ponctuelle-bouton" disabled={enCours || !nouvellePonctuelle.libelle.trim()}>
                  {T.commun.ajouter}
                </button>
              </form>
            </section>

            <section className="employeur-section">
              <h2 className="employeur-section-titre">{T.employeur.oublieesTitre}</h2>
              {tachesOubliees.length === 0 ? (
                <p className="employeur-vide">{T.employeur.oublieesVide}</p>
              ) : (
                <ul className="employeur-liste">
                  {tachesOubliees.map((t) => (
                    <li key={`${t.kind}-${t.id}`}>{t.libelle}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="employeur-section">
              <h2 className="employeur-section-titre">{T.employeur.observationsTitre}</h2>
              {observations.length === 0 ? (
                <p className="employeur-vide">{T.employeur.observationsVide}</p>
              ) : (
                <ul className="employeur-observations-liste">
                  {observations.map((obs) => (
                    <li key={obs.id} className="employeur-observation">
                      <p className="employeur-observation-texte">{obs.texte}</p>
                      <p className="employeur-observation-meta">
                        {obs.employes?.prenom} · {new Date(obs.cree_le).toLocaleString('fr-FR')}
                      </p>
                      <button className="employeur-observation-lu" onClick={() => marquerLue(obs.id)} disabled={enCours}>
                        {T.employeur.marquerLu}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ))}

      {onglet === 'historique' && <Historique />}
      {onglet === 'reglages' && <GestionTaches />}
      {onglet === 'comptes' && <GestionComptes />}
      {onglet === 'repos' && <GestionRepos />}
    </div>
  )
}
