import { useEffect, useState } from 'react'
import { fetchTemplatesToutes, updateTemplate, insertTemplate } from '../../lib/api'
import {
  PERIODES,
  PERIODE_LABELS,
  CONDITIONS,
  CONDITION_LABELS,
  CONDITION_EMOJIS,
  JOURS_SEMAINE_LABELS,
} from '../../lib/constants'
import './GestionTaches.css'

/** Fait grandir la textarea pour toujours montrer le texte entier (§ libellés longs). */
function autoResize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const RECURRENCE_LABELS = {
  quotidienne: 'Quotidienne',
  hebdo: 'Hebdomadaire',
  mensuelle: 'Mensuelle',
  conditionnelle: 'Conditionnelle',
  intervalle: 'Intervalle',
  premier_vendredi: 'Premier vendredi du mois',
}

const RECURRENCE_ICONS = {
  quotidienne: '📅',
  hebdo: '🗓️',
  mensuelle: '🗓️',
  premier_vendredi: '🗓️',
  intervalle: '⏱️',
}

// Classement "par famille" (§4) : chaque type de récurrence est une famille, et la
// récurrence conditionnelle est elle-même éclatée en une sous-famille par condition
// (pluie, gel, orage, gardiennage) plutôt que groupée en bloc.
const FAMILLES = [
  { cle: 'quotidienne', titre: 'Quotidienne', icone: RECURRENCE_ICONS.quotidienne },
  { cle: 'hebdo', titre: 'Hebdomadaire', icone: RECURRENCE_ICONS.hebdo },
  { cle: 'mensuelle', titre: 'Mensuelle', icone: RECURRENCE_ICONS.mensuelle },
  { cle: 'premier_vendredi', titre: 'Premier vendredi du mois', icone: RECURRENCE_ICONS.premier_vendredi },
  { cle: 'intervalle', titre: 'Intervalle (tous les X jours)', icone: RECURRENCE_ICONS.intervalle },
  ...CONDITIONS.map((condition) => ({
    cle: `conditionnelle:${condition}`,
    titre: `Conditionnelle — ${CONDITION_LABELS[condition]}`,
    icone: CONDITION_EMOJIS[condition],
  })),
]

function familleDe(template) {
  return template.recurrence === 'conditionnelle' ? `conditionnelle:${template.condition}` : template.recurrence
}

const NOUVELLE_TACHE_VIDE = {
  libelle: '',
  periode: 'matin',
  recurrence: 'quotidienne',
  modeHebdo: 'unique',
  jourUnique: 1,
  joursRouleau: [],
  joursMoisTexte: '',
  condition: 'pluie',
  intervalleJours: 15,
}

export default function GestionTaches() {
  const [templates, setTemplates] = useState([])
  const [libelles, setLibelles] = useState({})
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState('')
  const [enregistrement, setEnregistrement] = useState(null)

  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [nouvelleTache, setNouvelleTache] = useState(NOUVELLE_TACHE_VIDE)
  const [ajoutEnCours, setAjoutEnCours] = useState(false)
  const [ajoutErreur, setAjoutErreur] = useState('')

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

  async function ajouterTache(e) {
    e.preventDefault()
    const libelle = nouvelleTache.libelle.trim()
    if (!libelle) return
    setAjoutErreur('')

    // ordre = dernier de SA période + 1, pour que la tâche apparaisse en fin de sa
    // période (jamais en tête par défaut à cause d'un ordre 0/null).
    const ordreMaxDeLaPeriode = Math.max(
      0,
      ...templates.filter((t) => t.periode === nouvelleTache.periode).map((t) => t.ordre ?? 0)
    )
    const champs = {
      libelle,
      periode: nouvelleTache.periode,
      recurrence: nouvelleTache.recurrence,
      ordre: ordreMaxDeLaPeriode + 1,
      jour_semaine: null,
      jours_semaine: null,
      jours_mois: null,
      condition: null,
      intervalle_jours: null,
    }

    if (nouvelleTache.recurrence === 'hebdo') {
      if (nouvelleTache.modeHebdo === 'unique') {
        champs.jour_semaine = nouvelleTache.jourUnique
      } else if (nouvelleTache.joursRouleau.length === 0) {
        setAjoutErreur('Sélectionne au moins un jour pour une tâche à rouleau.')
        return
      } else {
        champs.jours_semaine = nouvelleTache.joursRouleau
      }
    } else if (nouvelleTache.recurrence === 'mensuelle') {
      const jours = nouvelleTache.joursMoisTexte
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31)
      if (jours.length === 0) {
        setAjoutErreur('Indique au moins un jour du mois valide (1 à 31), séparés par des virgules.')
        return
      }
      champs.jours_mois = jours
    } else if (nouvelleTache.recurrence === 'conditionnelle') {
      champs.condition = nouvelleTache.condition
    } else if (nouvelleTache.recurrence === 'intervalle') {
      const n = parseInt(nouvelleTache.intervalleJours, 10)
      if (!Number.isInteger(n) || n < 1) {
        setAjoutErreur('Le nombre de jours doit être un entier positif.')
        return
      }
      champs.intervalle_jours = n
    }

    setAjoutEnCours(true)
    try {
      const cree = await insertTemplate(champs)
      setTemplates((prev) => [...prev, cree])
      setLibelles((prev) => ({ ...prev, [cree.id]: cree.libelle }))
      setNouvelleTache(NOUVELLE_TACHE_VIDE)
      setAjoutOuvert(false)
    } catch (e) {
      setAjoutErreur(e.message)
    } finally {
      setAjoutEnCours(false)
    }
  }

  function toggleJourRouleau(jourIso) {
    setNouvelleTache((prev) => ({
      ...prev,
      joursRouleau: prev.joursRouleau.includes(jourIso)
        ? prev.joursRouleau.filter((j) => j !== jourIso)
        : [...prev.joursRouleau, jourIso].sort(),
    }))
  }

  if (chargement) return <p className="gestion-chargement">Chargement…</p>

  const parFamille = FAMILLES.map((f) => ({
    ...f,
    templates: templates.filter((t) => familleDe(t) === f.cle),
  })).filter((g) => g.templates.length > 0)

  return (
    <div className="gestion-taches">
      <p className="gestion-intro">
        Modifie le libellé, la période ou les jours d'une tâche récurrente. Désactiver une tâche
        la retire du planning des prochains jours sans toucher à l'historique déjà enregistré —
        elle n'est jamais supprimée.
      </p>

      {erreur && <p className="gestion-erreur">{erreur}</p>}

      <div className="gestion-ajout">
        <button type="button" className="gestion-ajout-bouton" onClick={() => setAjoutOuvert((v) => !v)}>
          {ajoutOuvert ? '− Fermer' : '+ Ajouter une tâche récurrente'}
        </button>

        {ajoutOuvert && (
          <form className="gestion-ajout-form" onSubmit={ajouterTache}>
            <label className="gestion-champ">
              Libellé
              <textarea
                ref={autoResize}
                rows={2}
                value={nouvelleTache.libelle}
                onChange={(e) => {
                  autoResize(e.target)
                  setNouvelleTache((prev) => ({ ...prev, libelle: e.target.value }))
                }}
                required
              />
            </label>

            <label className="gestion-champ">
              Période
              <select
                value={nouvelleTache.periode}
                onChange={(e) => setNouvelleTache((prev) => ({ ...prev, periode: e.target.value }))}
              >
                {PERIODES.map((p) => (
                  <option key={p} value={p}>
                    {PERIODE_LABELS[p]}
                  </option>
                ))}
              </select>
            </label>

            <label className="gestion-champ">
              Récurrence
              <select
                value={nouvelleTache.recurrence}
                onChange={(e) => setNouvelleTache((prev) => ({ ...prev, recurrence: e.target.value }))}
              >
                {Object.keys(RECURRENCE_LABELS).map((r) => (
                  <option key={r} value={r}>
                    {RECURRENCE_LABELS[r]}
                  </option>
                ))}
              </select>
            </label>

            {nouvelleTache.recurrence === 'hebdo' && (
              <>
                <label className="gestion-champ">
                  Type de jour
                  <select
                    value={nouvelleTache.modeHebdo}
                    onChange={(e) => setNouvelleTache((prev) => ({ ...prev, modeHebdo: e.target.value }))}
                  >
                    <option value="unique">Un jour fixe chaque semaine</option>
                    <option value="rouleau">Plusieurs jours (rouleau, modifiable ensuite)</option>
                  </select>
                </label>

                {nouvelleTache.modeHebdo === 'unique' ? (
                  <label className="gestion-champ">
                    Jour
                    <select
                      value={nouvelleTache.jourUnique}
                      onChange={(e) =>
                        setNouvelleTache((prev) => ({ ...prev, jourUnique: Number(e.target.value) }))
                      }
                    >
                      {JOURS_SEMAINE_LABELS.map((label, index) => (
                        <option key={index + 1} value={index + 1}>
                          {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][index]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="gestion-jours-cases">
                    {JOURS_SEMAINE_LABELS.map((label, index) => {
                      const jourIso = index + 1
                      return (
                        <button
                          type="button"
                          key={jourIso}
                          className={`gestion-jour-case ${nouvelleTache.joursRouleau.includes(jourIso) ? 'actif' : ''}`}
                          onClick={() => toggleJourRouleau(jourIso)}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {nouvelleTache.recurrence === 'mensuelle' && (
              <label className="gestion-champ">
                Jours du mois (ex : 1, 15)
                <input
                  type="text"
                  value={nouvelleTache.joursMoisTexte}
                  onChange={(e) => setNouvelleTache((prev) => ({ ...prev, joursMoisTexte: e.target.value }))}
                  placeholder="1, 15"
                />
              </label>
            )}

            {nouvelleTache.recurrence === 'conditionnelle' && (
              <label className="gestion-champ">
                Condition
                <select
                  value={nouvelleTache.condition}
                  onChange={(e) => setNouvelleTache((prev) => ({ ...prev, condition: e.target.value }))}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {CONDITION_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {nouvelleTache.recurrence === 'intervalle' && (
              <label className="gestion-champ">
                Tous les combien de jours
                <input
                  type="number"
                  min="1"
                  value={nouvelleTache.intervalleJours}
                  onChange={(e) => setNouvelleTache((prev) => ({ ...prev, intervalleJours: e.target.value }))}
                />
              </label>
            )}

            {ajoutErreur && <p className="gestion-erreur">{ajoutErreur}</p>}

            <button type="submit" className="gestion-ajout-valider" disabled={ajoutEnCours || !nouvelleTache.libelle.trim()}>
              Créer la tâche
            </button>
          </form>
        )}
      </div>

      {parFamille.length === 0 && <p className="gestion-vide">Aucune tâche récurrente configurée.</p>}

      {parFamille.map((groupe) => (
        <section key={groupe.cle} className="gestion-groupe">
          <h2 className="gestion-groupe-entete">
            <span aria-hidden="true">{groupe.icone}</span> {groupe.titre}
          </h2>

          {groupe.templates.map((template) => {
            const enCours = enregistrement === template.id
            const aJoursMultiples = template.jours_semaine !== null && template.jours_semaine !== undefined

            return (
              <div key={template.id} className={`gestion-carte ${template.actif ? '' : 'inactif'}`}>
                <div className="gestion-carte-entete">
                  <textarea
                    ref={autoResize}
                    rows={2}
                    className="gestion-libelle-champ"
                    value={libelles[template.id] ?? ''}
                    onChange={(e) => {
                      autoResize(e.target)
                      setLibelles((prev) => ({ ...prev, [template.id]: e.target.value }))
                    }}
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
