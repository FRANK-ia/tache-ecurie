import { useEffect, useMemo, useState } from 'react'
import {
  fetchTemplates,
  fetchPonctuellesDuJour,
  fetchCompletionsDuJour,
  fetchConditionsDuJour,
  fetchDernieresCompletionsIntervalle,
  fetchJoursRepos,
  fetchConges,
  fetchReposExceptions,
  estJourExterieur,
  cocherTache,
  decocherTache,
  insertObservation,
  fetchObservationsNonLues,
  marquerObservationLue,
  uploaderPhotoObservation,
} from '../../lib/api'
import { buildDailyTaskList, toDateKey, getSaison, estJourNonTravaille } from '../../lib/calendarLogic'
import { comprimerImage } from '../../lib/image'
import { HORAIRE_SOIR } from '../../lib/constants'
import { T, formatTexte } from '../../lib/textes'
import TaskList from '../TaskList/TaskList'
import PhotoPicker from '../PhotoPicker/PhotoPicker'
import PhotoAffichee from '../PhotoAffichee/PhotoAffichee'
import './SalarieView.css'

export default function SalarieView({ employe, onDeconnexion }) {
  const [taches, setTaches] = useState([])
  const [repos, setRepos] = useState(false)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [enCours, setEnCours] = useState(false)
  const [observation, setObservation] = useState('')
  const [observationEnvoyee, setObservationEnvoyee] = useState(false)
  const [photo, setPhoto] = useState(null)
  const [envoiPhotoEnCours, setEnvoiPhotoEnCours] = useState(false)
  const [erreurPhoto, setErreurPhoto] = useState('')
  const [commentaires, setCommentaires] = useState([])

  const aujourdhui = useMemo(() => new Date(), [])
  const jourKey = toDateKey(aujourdhui)
  const saison = getSaison(aujourdhui)

  async function charger() {
    setChargement(true)
    setErreur('')
    try {
      const [joursRepos, conges, exceptions, commentairesEmployeur] = await Promise.all([
        fetchJoursRepos(),
        fetchConges(),
        fetchReposExceptions(),
        fetchObservationsNonLues('employeur_vers_salarie'),
      ])
      // Les commentaires de Laetitia sont indépendants du statut travaillé/repos du
      // jour (un mot peut arriver même un jour de repos) : chargés dans tous les cas.
      setCommentaires(commentairesEmployeur)
      if (estJourNonTravaille(aujourdhui, joursRepos, conges, exceptions)) {
        setRepos(true)
        setTaches([])
        return
      }
      setRepos(false)

      const templates = await fetchTemplates()
      const templatesIntervalle = templates.filter((t) => t.recurrence === 'intervalle')
      const [ponctuelles, completions, conditions, dernieresCompletions, exterieur] = await Promise.all([
        fetchPonctuellesDuJour(jourKey),
        fetchCompletionsDuJour(jourKey),
        fetchConditionsDuJour(jourKey),
        fetchDernieresCompletionsIntervalle(templatesIntervalle.map((t) => t.id)),
        estJourExterieur(jourKey),
      ])
      const liste = buildDailyTaskList({
        templates,
        ponctuelles,
        completions,
        date: aujourdhui,
        activeConditions: conditions,
        lastCompletionByTemplateId: dernieresCompletions,
        jourExterieur: exterieur,
      })
      setTaches(liste)
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

  async function toggle(tache) {
    if (enCours) return
    setEnCours(true)
    setErreur('')
    const nouvelEtat = !tache.fait
    setTaches((prev) => prev.map((t) => (t.id === tache.id && t.kind === tache.kind ? { ...t, fait: nouvelEtat } : t)))

    try {
      if (nouvelEtat) {
        await cocherTache({
          templateId: tache.kind === 'template' ? tache.id : null,
          ponctuelleId: tache.kind === 'ponctuelle' ? tache.id : null,
          jour: jourKey,
          employeId: employe.id,
        })
      } else {
        await decocherTache({
          templateId: tache.kind === 'template' ? tache.id : null,
          ponctuelleId: tache.kind === 'ponctuelle' ? tache.id : null,
          jour: jourKey,
        })
      }
    } catch (e) {
      // rollback en cas d'échec réseau
      setTaches((prev) => prev.map((t) => (t.id === tache.id && t.kind === tache.kind ? { ...t, fait: tache.fait } : t)))
      setErreur(e.message)
    } finally {
      setEnCours(false)
    }
  }

  async function marquerCommentaireLu(id) {
    setEnCours(true)
    try {
      await marquerObservationLue(id)
      setCommentaires((prev) => prev.filter((c) => c.id !== id))
    } catch (e) {
      setErreur(e.message)
    } finally {
      setEnCours(false)
    }
  }

  async function envoyerObservation(e) {
    e.preventDefault()
    if (!observation.trim()) return
    setEnCours(true)
    setErreurPhoto('')

    // Dégradation gracieuse (§ terrain) : un échec d'upload photo ne doit jamais
    // empêcher le texte de partir. On tente la photo AVANT l'insert, et l'insert a
    // toujours lieu ensuite, avec le chemin si l'upload a réussi, sans sinon.
    let imagePath = null
    if (photo) {
      setEnvoiPhotoEnCours(true)
      try {
        const compressee = await comprimerImage(photo)
        imagePath = await uploaderPhotoObservation(compressee)
      } catch {
        setErreurPhoto(T.commun.erreurPhoto)
      } finally {
        setEnvoiPhotoEnCours(false)
      }
    }

    try {
      await insertObservation({ employeId: employe.id, texte: observation.trim(), jour: jourKey, imagePath })
      setObservation('')
      setPhoto(null)
      setObservationEnvoyee(true)
      setTimeout(() => setObservationEnvoyee(false), 3000)
    } catch (e) {
      setErreur(e.message)
    } finally {
      setEnCours(false)
    }
  }

  const total = taches.length
  const faites = taches.filter((t) => t.fait).length

  return (
    <div className="salarie-screen">
      <header className="salarie-entete">
        <div>
          <p className="salarie-date">
            {aujourdhui.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <p className="salarie-saison">
            {formatTexte(T.salarie.saisonPrefixe, { saison: T.saisons[saison], horaire: HORAIRE_SOIR[saison] })}
          </p>
        </div>
        <button className="salarie-deconnexion" onClick={onDeconnexion}>
          {employe.prenom} {T.commun.deconnexion}
        </button>
      </header>

      {!repos && total > 0 && (
        <p className="salarie-compteur">{formatTexte(T.salarie.compteur, { faites, total })}</p>
      )}

      {erreur && <p className="salarie-erreur">{erreur}</p>}

      {!chargement && commentaires.length > 0 && (
        <section className="salarie-commentaires">
          <h2 className="salarie-commentaires-titre">{T.salarie.commentairesTitre}</h2>
          <ul className="salarie-commentaires-liste">
            {commentaires.map((c) => (
              <li key={c.id} className="salarie-commentaire">
                <p className="salarie-commentaire-texte">{c.texte}</p>
                <p className="salarie-commentaire-meta">{new Date(c.cree_le).toLocaleString('fr-FR')}</p>
                <PhotoAffichee cheminImage={c.image_path} />
                <button
                  type="button"
                  className="salarie-commentaire-lu"
                  onClick={() => marquerCommentaireLu(c.id)}
                  disabled={enCours}
                >
                  {T.commun.marquerLu}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {chargement ? (
        <p className="salarie-chargement">{T.salarie.chargementTaches}</p>
      ) : repos ? (
        <p className="salarie-repos">{T.salarie.jourRepos}</p>
      ) : (
        <>
          <TaskList taches={taches} onToggle={toggle} disabled={enCours} />

          <form className="salarie-observations" onSubmit={envoyerObservation}>
            <label htmlFor="observation" className="salarie-observations-label">
              {T.salarie.observationLabel}
            </label>
            <textarea
              id="observation"
              className="salarie-observations-champ"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder={T.salarie.observationPlaceholder}
              rows={3}
            />
            <PhotoPicker value={photo} onChange={setPhoto} disabled={enCours} />
            {erreurPhoto && <p className="salarie-erreur-photo">{erreurPhoto}</p>}
            <button type="submit" className="salarie-observations-bouton" disabled={enCours || !observation.trim()}>
              {envoiPhotoEnCours
                ? T.commun.envoiPhotoEnCours
                : observationEnvoyee
                  ? T.salarie.observationEnvoyee
                  : T.salarie.observationBouton}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
