import { useEffect, useMemo, useState } from 'react'
import {
  fetchTemplates,
  fetchPonctuellesDuJour,
  fetchCompletionsDuJour,
  fetchConditionsDuJour,
  fetchDernieresCompletionsIntervalle,
  activerCondition,
  desactiverCondition,
  insertPonctuelle,
  fetchObservationsNonLues,
  marquerObservationLue,
} from '../../lib/api'
import { buildDailyTaskList, toDateKey, getTachesOubliees } from '../../lib/calendarLogic'
import { CONDITIONS, CONDITION_LABELS, PERIODES, PERIODE_LABELS } from '../../lib/constants'
import Historique from '../Historique/Historique'
import GestionTaches from '../GestionTaches/GestionTaches'
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
      const templates = await fetchTemplates()
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
      setTachesOubliees(getTachesOubliees(liste))
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
          {employe.prenom} · quitter
        </button>
      </header>

      <nav className="employeur-onglets">
        <button className={onglet === 'jour' ? 'actif' : ''} onClick={() => setOnglet('jour')}>
          Aujourd'hui
        </button>
        <button className={onglet === 'historique' ? 'actif' : ''} onClick={() => setOnglet('historique')}>
          Historique
        </button>
        <button className={onglet === 'reglages' ? 'actif' : ''} onClick={() => setOnglet('reglages')}>
          Réglages
        </button>
      </nav>

      {erreur && <p className="employeur-erreur">{erreur}</p>}

      {onglet === 'jour' &&
        (chargement ? (
          <p className="employeur-chargement">Chargement…</p>
        ) : (
          <div className="employeur-contenu">
            <section className="employeur-section">
              <h2 className="employeur-section-titre">Conditions du jour</h2>
              <div className="employeur-conditions">
                {CONDITIONS.map((condition) => (
                  <button
                    key={condition}
                    className={`employeur-condition-bouton ${conditionsActives.includes(condition) ? 'active' : ''}`}
                    onClick={() => toggleCondition(condition)}
                    disabled={enCours}
                  >
                    {CONDITION_LABELS[condition]}
                  </button>
                ))}
              </div>
            </section>

            <section className="employeur-section">
              <h2 className="employeur-section-titre">Ajouter une tâche ponctuelle</h2>
              <form className="employeur-ponctuelle-form" onSubmit={ajouterPonctuelle}>
                <input
                  type="text"
                  placeholder="Libellé de la tâche"
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
                      {PERIODE_LABELS[p]}
                    </option>
                  ))}
                </select>
                <button type="submit" className="employeur-ponctuelle-bouton" disabled={enCours || !nouvellePonctuelle.libelle.trim()}>
                  Ajouter
                </button>
              </form>
            </section>

            <section className="employeur-section">
              <h2 className="employeur-section-titre">Tâches oubliées</h2>
              {tachesOubliees.length === 0 ? (
                <p className="employeur-vide">Rien à signaler.</p>
              ) : (
                <ul className="employeur-liste">
                  {tachesOubliees.map((t) => (
                    <li key={`${t.kind}-${t.id}`}>{t.libelle}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="employeur-section">
              <h2 className="employeur-section-titre">Observations reçues</h2>
              {observations.length === 0 ? (
                <p className="employeur-vide">Aucune observation non lue.</p>
              ) : (
                <ul className="employeur-observations-liste">
                  {observations.map((obs) => (
                    <li key={obs.id} className="employeur-observation">
                      <p className="employeur-observation-texte">{obs.texte}</p>
                      <p className="employeur-observation-meta">
                        {obs.employes?.prenom} · {new Date(obs.cree_le).toLocaleString('fr-FR')}
                      </p>
                      <button className="employeur-observation-lu" onClick={() => marquerLue(obs.id)} disabled={enCours}>
                        Marquer comme lu
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
    </div>
  )
}
