import { useEffect, useState } from 'react'
import { fetchTemplatesToutes, updateTemplate } from '../../lib/api'
import { PERIODES, PERIODE_LABELS, PERIODE_ICONS, CONDITION_LABELS, JOURS_SEMAINE_LABELS } from '../../lib/constants'
import './GestionTaches.css'

const RECURRENCE_LABELS = {
  quotidienne: 'Quotidienne',
  hebdo: 'Hebdomadaire',
  mensuelle: 'Mensuelle',
  conditionnelle: 'Conditionnelle',
  intervalle: 'Intervalle',
  premier_vendredi: 'Premier vendredi du mois',
}

export default function GestionTaches() {
  const [templates, setTemplates] = useState([])
  const [libelles, setLibelles] = useState({})
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [enregistrement, setEnregistrement] = useState(null)

  useEffect(() => {
    charger()
  }, [])

  async function charger() {
    setChargement(true)
    setErreur('')
    try {
      const data = await fetchTemplatesToutes()
      setTemplates(data)
      setLibelles(Object.fromEntries(data.map((t) => [t.id, t.libelle])))
    } catch (e) {
      setErreur(e.message)
    } finally {
      setChargement(false)
    }
  }

  /** Écriture optimiste générique — un seul chemin d'écriture (jamais de suppression). */
  async function appliquer(template, champs) {
    setEnregistrement(template.id)
    setErreur('')
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, ...champs } : t)))
    try {
      await updateTemplate(template.id, champs)
    } catch (e) {
      setErreur(e.message)
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? template : t)))
      setLibelles((prev) => ({ ...prev, [template.id]: template.libelle }))
    } finally {
      setEnregistrement(null)
    }
  }

  function validerLibelle(template) {
    const valeur = (libelles[template.id] ?? '').trim()
    if (!valeur || valeur === template.libelle) {
      setLibelles((prev) => ({ ...prev, [template.id]: template.libelle }))
      return
    }
    appliquer(template, { libelle: valeur })
  }

  function demanderDesactivation(template) {
    const confirme = window.confirm(
      "Cette tâche n'apparaîtra plus les prochains jours. L'historique est conservé. Continuer ?"
    )
    if (confirme) appliquer(template, { actif: false })
  }

  if (chargement) return <p className="gestion-chargement">Chargement…</p>

  const parPeriode = PERIODES.map((periode) => ({
    periode,
    templates: templates.filter((t) => t.periode === periode),
  })).filter((g) => g.templates.length > 0)

  return (
    <div className="gestion-taches">
      <p className="gestion-intro">
        Modifie le libellé, la période ou les jours d'une tâche récurrente. Désactiver une tâche
        la retire du planning des prochains jours sans toucher à l'historique déjà enregistré —
        elle n'est jamais supprimée.
      </p>

      {erreur && <p className="gestion-erreur">{erreur}</p>}

      {parPeriode.length === 0 && <p className="gestion-vide">Aucune tâche récurrente configurée.</p>}

      {parPeriode.map((groupe) => (
        <section key={groupe.periode} className="gestion-groupe">
          <h2 className="gestion-groupe-entete">
            <span aria-hidden="true">{PERIODE_ICONS[groupe.periode]}</span> {PERIODE_LABELS[groupe.periode]}
          </h2>

          {groupe.templates.map((template) => {
            const enCours = enregistrement === template.id
            const aJoursMultiples = template.jours_semaine !== null && template.jours_semaine !== undefined

            return (
              <div key={template.id} className={`gestion-carte ${template.actif ? '' : 'inactif'}`}>
                <div className="gestion-carte-entete">
                  <input
                    type="text"
                    className="gestion-libelle-champ"
                    value={libelles[template.id] ?? ''}
                    onChange={(e) => setLibelles((prev) => ({ ...prev, [template.id]: e.target.value }))}
                    onBlur={() => validerLibelle(template)}
                    disabled={enCours}
                  />
                  <button
                    type="button"
                    className={`gestion-actif-bouton ${template.actif ? '' : 'inactif'}`}
                    onClick={() =>
                      template.actif ? demanderDesactivation(template) : appliquer(template, { actif: true })
                    }
                    disabled={enCours}
                  >
                    {template.actif ? 'Désactiver' : 'Réactiver'}
                  </button>
                </div>

                {!template.actif && (
                  <p className="gestion-statut">Désactivée — n'apparaît plus dans le planning.</p>
                )}

                <label className="gestion-champ">
                  Période
                  <select
                    value={template.periode}
                    onChange={(e) => appliquer(template, { periode: e.target.value })}
                    disabled={enCours}
                  >
                    {PERIODES.map((p) => (
                      <option key={p} value={p}>
                        {PERIODE_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="gestion-recurrence">
                  Récurrence : {RECURRENCE_LABELS[template.recurrence] ?? template.recurrence}
                  {template.recurrence === 'intervalle' && ` (tous les ${template.intervalle_jours} jours)`}
                  {template.recurrence === 'mensuelle' &&
                    template.jours_mois &&
                    ` (les ${template.jours_mois.join(', ')} du mois)`}
                  {template.recurrence === 'conditionnelle' &&
                    ` (si ${CONDITION_LABELS[template.condition] ?? template.condition})`}
                </p>

                {template.recurrence === 'hebdo' && (
                  <div className="gestion-jours-cases">
                    {JOURS_SEMAINE_LABELS.map((label, index) => {
                      const jourIso = index + 1
                      const actif = aJoursMultiples
                        ? (template.jours_semaine ?? []).includes(jourIso)
                        : template.jour_semaine === jourIso
                      return (
                        <button
                          type="button"
                          key={jourIso}
                          className={`gestion-jour-case ${actif ? 'actif' : ''}`}
                          onClick={() =>
                            aJoursMultiples
                              ? appliquer(template, {
                                  jours_semaine: (template.jours_semaine ?? []).includes(jourIso)
                                    ? template.jours_semaine.filter((j) => j !== jourIso)
                                    : [...(template.jours_semaine ?? []), jourIso].sort(),
                                })
                              : appliquer(template, { jour_semaine: jourIso })
                          }
                          disabled={enCours}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </section>
      ))}
    </div>
  )
}
