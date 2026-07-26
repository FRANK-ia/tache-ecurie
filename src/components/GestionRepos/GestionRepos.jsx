import { useEffect, useState } from 'react'
import { fetchJoursRepos, updateJoursRepos, fetchConges, insertConge, supprimerConge } from '../../lib/api'
import { toDateKey } from '../../lib/calendarLogic'
import { JOURS_SEMAINE_LABELS } from '../../lib/constants'
import './GestionRepos.css'

const JOURS_NOMS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

export default function GestionRepos() {
  const [joursRepos, setJoursRepos] = useState([])
  const [conges, setConges] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [enregistrementJour, setEnregistrementJour] = useState(false)

  const [nouveauConge, setNouveauConge] = useState({ dateDebut: '', dateFin: '', motif: '' })
  const [ajoutEnCours, setAjoutEnCours] = useState(false)
  const [ajoutErreur, setAjoutErreur] = useState('')

  useEffect(() => {
    charger()
  }, [])

  async function charger() {
    setChargement(true)
    setErreur('')
    try {
      const [repos, congesData] = await Promise.all([fetchJoursRepos(), fetchConges()])
      setJoursRepos(repos)
      setConges(congesData)
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
      setAjoutErreur('Indique une date de début et une date de fin.')
      return
    }
    if (nouveauConge.dateFin < nouveauConge.dateDebut) {
      setAjoutErreur('La date de fin doit être après la date de début.')
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
    const confirme = window.confirm('Retirer ce congé ?')
    if (!confirme) return
    setErreur('')
    try {
      await supprimerConge(conge.id)
      setConges((prev) => prev.filter((c) => c.id !== conge.id))
    } catch (e) {
      setErreur(e.message)
    }
  }

  if (chargement) return <p className="repos-chargement">Chargement…</p>

  const aujourdhuiKey = toDateKey(new Date())
  const congesAVenir = conges.filter((c) => c.date_fin >= aujourdhuiKey)

  return (
    <div className="gestion-repos">
      {erreur && <p className="repos-erreur">{erreur}</p>}

      <section className="repos-section">
        <h2 className="repos-section-titre">Repos hebdomadaire</h2>
        <p className="repos-intro">Jour(s) où le centre ne fonctionne pas, chaque semaine.</p>
        <div className="repos-jours-cases">
          {JOURS_SEMAINE_LABELS.map((label, index) => {
            const jourIso = index + 1
            return (
              <button
                type="button"
                key={jourIso}
                className={`repos-jour-case ${joursRepos.includes(jourIso) ? 'actif' : ''}`}
                onClick={() => toggleJour(jourIso)}
                disabled={enregistrementJour}
                title={JOURS_NOMS[index]}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      <section className="repos-section">
        <h2 className="repos-section-titre">Ajouter un congé</h2>
        <form className="repos-conge-form" onSubmit={ajouterConge}>
          <label className="repos-champ">
            Du
            <input
              type="date"
              value={nouveauConge.dateDebut}
              onChange={(e) => setNouveauConge((p) => ({ ...p, dateDebut: e.target.value }))}
            />
          </label>
          <label className="repos-champ">
            Au
            <input
              type="date"
              value={nouveauConge.dateFin}
              onChange={(e) => setNouveauConge((p) => ({ ...p, dateFin: e.target.value }))}
            />
          </label>
          <label className="repos-champ">
            Motif (optionnel)
            <input
              type="text"
              value={nouveauConge.motif}
              onChange={(e) => setNouveauConge((p) => ({ ...p, motif: e.target.value }))}
              placeholder="Vacances, fermeture annuelle…"
            />
          </label>
          {ajoutErreur && <p className="repos-erreur">{ajoutErreur}</p>}
          <button type="submit" className="repos-conge-bouton" disabled={ajoutEnCours}>
            Ajouter
          </button>
        </form>
      </section>

      <section className="repos-section">
        <h2 className="repos-section-titre">Congés à venir</h2>
        {congesAVenir.length === 0 ? (
          <p className="repos-vide">Aucun congé prévu.</p>
        ) : (
          <ul className="repos-conges-liste">
            {congesAVenir.map((conge) => (
              <li key={conge.id} className="repos-conge-carte">
                <p className="repos-conge-dates">
                  {conge.date_debut} → {conge.date_fin}
                </p>
                {conge.motif && <p className="repos-conge-motif">{conge.motif}</p>}
                <button type="button" className="repos-conge-retirer" onClick={() => retirerConge(conge)}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
