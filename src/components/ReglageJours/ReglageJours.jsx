import { useEffect, useState } from 'react'
import { fetchTemplatesAvecJoursSemaine, updateJoursSemaine } from '../../lib/api'
import { JOURS_SEMAINE_LABELS, PERIODE_LABELS, PERIODE_ICONS } from '../../lib/constants'
import './ReglageJours.css'

export default function ReglageJours() {
  const [templates, setTemplates] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [enregistrement, setEnregistrement] = useState(null)

  useEffect(() => {
    fetchTemplatesAvecJoursSemaine()
      .then(setTemplates)
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false))
  }, [])

  async function toggleJour(template, jourIso) {
    const actifs = template.jours_semaine ?? []
    const nouveaux = actifs.includes(jourIso) ? actifs.filter((j) => j !== jourIso) : [...actifs, jourIso].sort()

    setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, jours_semaine: nouveaux } : t)))
    setEnregistrement(template.id)
    setErreur('')
    try {
      await updateJoursSemaine(template.id, nouveaux)
    } catch (e) {
      setErreur(e.message)
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, jours_semaine: actifs } : t)))
    } finally {
      setEnregistrement(null)
    }
  }

  if (chargement) return <p className="reglage-chargement">Chargement…</p>

  return (
    <div className="reglage-jours">
      <p className="reglage-intro">
        Ajuste les jours des tâches à rouleau (ex : carrière) selon la météo. Les changements s'appliquent
        aux prochains jours, pas à l'historique déjà enregistré.
      </p>

      {erreur && <p className="reglage-erreur">{erreur}</p>}

      {templates.length === 0 ? (
        <p className="reglage-vide">Aucune tâche à rouleau configurée.</p>
      ) : (
        templates.map((template) => (
          <div key={template.id} className="reglage-carte">
            <p className="reglage-libelle">{template.libelle}</p>
            <p className="reglage-periode">
              <span aria-hidden="true">{PERIODE_ICONS[template.periode]}</span> {PERIODE_LABELS[template.periode]}
            </p>
            <div className="reglage-jours-cases">
              {JOURS_SEMAINE_LABELS.map((label, index) => {
                const jourIso = index + 1
                const actif = (template.jours_semaine ?? []).includes(jourIso)
                return (
                  <button
                    key={jourIso}
                    className={`reglage-jour-case ${actif ? 'actif' : ''}`}
                    onClick={() => toggleJour(template, jourIso)}
                    disabled={enregistrement === template.id}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
