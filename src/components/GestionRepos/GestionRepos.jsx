import { useEffect, useState } from 'react'
import {
  fetchJoursRepos,
  updateJoursRepos,
  fetchConges,
  insertConge,
  supprimerConge,
  fetchReposExceptions,
  insertReposException,
  supprimerReposException,
} from '../../lib/api'
import { toDateKey } from '../../lib/calendarLogic'
import { T } from '../../lib/textes'
import './GestionRepos.css'

export default function GestionRepos() {
  const [joursRepos, setJoursRepos] = useState([])
  const [conges, setConges] = useState([])
  const [exceptions, setExceptions] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [enregistrementJour, setEnregistrementJour] = useState(false)

  const [nouveauConge, setNouveauConge] = useState({ dateDebut: '', dateFin: '', motif: '' })
  const [ajoutEnCours, setAjoutEnCours] = useState(false)
  const [ajoutErreur, setAjoutErreur] = useState('')

  const [nouvelleException, setNouvelleException] = useState({ date: '', type: 'repos' })
  const [ajoutExceptionEnCours, setAjoutExceptionEnCours] = useState(false)
  const [ajoutExceptionErreur, setAjoutExceptionErreur] = useState('')

  useEffect(() => {
    charger()
  }, [])

  async function charger() {
    setChargement(true)
    setErreur('')
    try {
      const [repos, congesData, exceptionsData] = await Promise.all([
        fetchJoursRepos(),
        fetchConges(),
        fetchReposExceptions(),
      ])
      setJoursRepos(repos)
      setConges(congesData)
      setExceptions(exceptionsData)
    } catch (e) {
      setErreur(e.message)
    } finally {
      setChargement(false)
    }
  }

  async function toggleJour(jourIso) {
    if (enregistrementJour) return
    const avant = joursRepos
    const nouveaux = joursRepos.includes(jourIso)
      ? joursRepos.filter((j) => j !== jourIso)
      : [...joursRepos, jourIso].sort()
    setJoursRepos(nouveaux)
    setEnregistrementJour(true)
    setErreur('')
    try {
      await updateJoursRepos(nouveaux)
    } catch (e) {
      setErreur(e.message)
      setJoursRepos(avant)
    } finally {
      setEnregistrementJour(false)
    }
  }

  async function ajouterConge(e) {
    e.preventDefault()
    setAjoutErreur('')
    if (!nouveauConge.dateDebut || !nouveauConge.dateFin) {
      setAjoutErreur(T.repos.erreurDatesManquantes)
      return
    }
    if (nouveauConge.dateFin < nouveauConge.dateDebut) {
      setAjoutErreur(T.repos.erreurDatesInvalides)
      return
    }
    setAjoutEnCours(true)
    try {
      const cree = await insertConge({
        dateDebut: nouveauConge.dateDebut,
        dateFin: nouveauConge.dateFin,
        motif: nouveauConge.motif.trim(),
      })
      setConges((prev) => [...prev, cree].sort((a, b) => (a.date_debut < b.date_debut ? -1 : 1)))
      setNouveauConge({ dateDebut: '', dateFin: '', motif: '' })
    } catch (e) {
      setAjoutErreur(e.message)
    } finally {
      setAjoutEnCours(false)
    }
  }

  async function retirerConge(conge) {
    const confirme = window.confirm(T.repos.confirmRetraitConge)
    if (!confirme) return
    setErreur('')
    try {
      await supprimerConge(conge.id)
      setConges((prev) => prev.filter((c) => c.id !== conge.id))
    } catch (e) {
      setErreur(e.message)
    }
  }

  async function ajouterException(e) {
    e.preventDefault()
    setAjoutExceptionErreur('')
    if (!nouvelleException.date) {
      setAjoutExceptionErreur(T.repos.erreurDateManquante)
      return
    }
    setAjoutExceptionEnCours(true)
    try {
      const cree = await insertReposException({ jour: nouvelleException.date, type: nouvelleException.type })
      setExceptions((prev) => [...prev, cree].sort((a, b) => (a.jour < b.jour ? -1 : 1)))
      setNouvelleException({ date: '', type: 'repos' })
    } catch (e) {
      setAjoutExceptionErreur(e.message)
    } finally {
      setAjoutExceptionEnCours(false)
    }
  }

  async function retirerException(exception) {
    const confirme = window.confirm(T.repos.confirmRetraitException)
    if (!confirme) return
    setErreur('')
    try {
      await supprimerReposException(exception.id)
      setExceptions((prev) => prev.filter((e) => e.id !== exception.id))
    } catch (e) {
      setErreur(e.message)
    }
  }

  if (chargement) return <p className="repos-chargement">{T.commun.chargement}</p>

  const aujourdhuiKey = toDateKey(new Date())
  const congesAVenir = conges.filter((c) => c.date_fin >= aujourdhuiKey)
  const exceptionsAVenir = exceptions.filter((e) => e.jour >= aujourdhuiKey)

  return (
    <div className="gestion-repos">
      {erreur && <p className="repos-erreur">{erreur}</p>}

      <section className="repos-section">
        <h2 className="repos-section-titre">{T.repos.hebdoTitre}</h2>
        <p className="repos-intro">{T.repos.hebdoIntro}</p>
        <div className="repos-jours-cases">
          {T.jours.abreviations.map((label, index) => {
            const jourIso = index + 1
            return (
              <button
                type="button"
                key={jourIso}
                className={`repos-jour-case ${joursRepos.includes(jourIso) ? 'actif' : ''}`}
                onClick={() => toggleJour(jourIso)}
                disabled={enregistrementJour}
                title={T.jours.noms[index]}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="repos-section">
        <h2 className="repos-section-titre">{T.repos.exceptionAjoutTitre}</h2>
        <p className="repos-intro">{T.repos.exceptionIntro}</p>
        <form className="repos-conge-form" onSubmit={ajouterException}>
          <label className="repos-champ">
            {T.repos.champDate}
            <input
              type="date"
              value={nouvelleException.date}
              onChange={(e) => setNouvelleException((p) => ({ ...p, date: e.target.value }))}
            />
          </label>
          <label className="repos-champ">
            {T.repos.champType}
            <select
              value={nouvelleException.type}
              onChange={(e) => setNouvelleException((p) => ({ ...p, type: e.target.value }))}
            >
              <option value="repos">{T.repos.optionExceptionRepos}</option>
              <option value="travaille">{T.repos.optionExceptionTravaille}</option>
            </select>
          </label>
          {ajoutExceptionErreur && <p className="repos-erreur">{ajoutExceptionErreur}</p>}
          <button type="submit" className="repos-conge-bouton" disabled={ajoutExceptionEnCours}>
            {T.commun.ajouter}
          </button>
        </form>

        {exceptionsAVenir.length === 0 ? (
          <p className="repos-vide">{T.repos.exceptionsVide}</p>
        ) : (
          <ul className="repos-conges-liste">
            {exceptionsAVenir.map((exception) => (
              <li key={exception.id} className="repos-conge-carte">
                <p className="repos-conge-dates">
                  {exception.jour} —{' '}
                  {exception.type === 'repos' ? T.repos.optionExceptionRepos : T.repos.optionExceptionTravaille}
                </p>
                <button
                  type="button"
                  className="repos-conge-retirer"
                  onClick={() => retirerException(exception)}
                >
                  {T.repos.retirerBouton}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="repos-section">
        <h2 className="repos-section-titre">{T.repos.congeAjoutTitre}</h2>
        <form className="repos-conge-form" onSubmit={ajouterConge}>
          <label className="repos-champ">
            {T.repos.champDu}
            <input
              type="date"
              value={nouveauConge.dateDebut}
              onChange={(e) => setNouveauConge((p) => ({ ...p, dateDebut: e.target.value }))}
            />
          </label>
          <label className="repos-champ">
            {T.repos.champAu}
            <input
              type="date"
              value={nouveauConge.dateFin}
              onChange={(e) => setNouveauConge((p) => ({ ...p, dateFin: e.target.value }))}
            />
          </label>
          <label className="repos-champ">
            {T.repos.champMotif}
            <input
              type="text"
              value={nouveauConge.motif}
              onChange={(e) => setNouveauConge((p) => ({ ...p, motif: e.target.value }))}
              placeholder={T.repos.motifPlaceholder}
            />
          </label>
          {ajoutErreur && <p className="repos-erreur">{ajoutErreur}</p>}
          <button type="submit" className="repos-conge-bouton" disabled={ajoutEnCours}>
            {T.commun.ajouter}
          </button>
        </form>
      </section>

      <section className="repos-section">
        <h2 className="repos-section-titre">{T.repos.congesAVenirTitre}</h2>
        {congesAVenir.length === 0 ? (
          <p className="repos-vide">{T.repos.congesVide}</p>
        ) : (
          <ul className="repos-conges-liste">
            {congesAVenir.map((conge) => (
              <li key={conge.id} className="repos-conge-carte">
                <p className="repos-conge-dates">
                  {conge.date_debut} → {conge.date_fin}
                </p>
                {conge.motif && <p className="repos-conge-motif">{conge.motif}</p>}
                <button type="button" className="repos-conge-retirer" onClick={() => retirerConge(conge)}>
                  {T.repos.retirerBouton}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
