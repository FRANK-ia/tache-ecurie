import { useEffect, useState } from 'react'
import {
  fetchTemplatesToutes,
  updateTemplate,
  insertTemplate,
  compterCompletions,
  supprimerTemplateSiPossible,
} from '../../lib/api'
import { statutFraicheur } from '../../lib/calendarLogic'
import { PERIODES, BADGE_COULEURS, CONDITIONS, couleurTache } from '../../lib/constants'
import { T, formatTexte } from '../../lib/textes'
import './GestionTaches.css'

/** Fait grandir la textarea pour toujours montrer le texte entier (§ libellés longs). */
function autoResize(el) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const RECURRENCE_ICONS = {
  quotidienne: '📅',
  hebdo: '🗓️',
  mensuelle: '🗓️',
  premier_vendredi: '🗓️',
  intervalle: '⏱️',
}

// Une entrée par type de récurrence (la conditionnelle éclatée par condition —
// pluie, gel, orage, gardiennage) : sert de lookup icône+titre pour le badge de
// récurrence affiché sur chaque carte (voir FAMILLES_PAR_CLE plus bas). Ne pilote
// plus le regroupement de l'écran, qui se fait par période (voir parPeriode).
const FAMILLES = [
  { cle: 'quotidienne', titre: T.familles.quotidienne, icone: RECURRENCE_ICONS.quotidienne },
  { cle: 'hebdo', titre: T.familles.hebdo, icone: RECURRENCE_ICONS.hebdo },
  { cle: 'mensuelle', titre: T.familles.mensuelle, icone: RECURRENCE_ICONS.mensuelle },
  { cle: 'premier_vendredi', titre: T.familles.premier_vendredi, icone: RECURRENCE_ICONS.premier_vendredi },
  { cle: 'intervalle', titre: T.reglages.familleIntervalleTitre, icone: RECURRENCE_ICONS.intervalle },
  ...CONDITIONS.map((condition) => ({
    cle: `conditionnelle:${condition}`,
    titre: formatTexte(T.reglages.familleConditionnelleTitre, { condition: T.conditions[condition] }),
    icone: T.conditionEmojis[condition],
  })),
]

function familleDe(template) {
  return template.recurrence === 'conditionnelle' ? `conditionnelle:${template.condition}` : template.recurrence
}

// Réglages groupe désormais par PÉRIODE (voir parPeriode plus bas) pour coller à
// l'affichage salarié. FAMILLES sert uniquement à ce lookup icône+titre affiché en
// badge sur chaque carte, pour que le type de récurrence reste visible malgré le
// changement de regroupement.
const FAMILLES_PAR_CLE = Object.fromEntries(FAMILLES.map((f) => [f.cle, f]))

const RECURRENCE_VIDE = {
  recurrence: 'quotidienne',
  modeHebdo: 'unique',
  jourUnique: 1,
  joursRouleau: [],
  joursMoisTexte: '',
  condition: 'pluie',
  intervalleJours: 15,
}

const NOUVELLE_TACHE_VIDE = {
  libelle: '',
  periode: 'matin',
  ...RECURRENCE_VIDE,
}

/**
 * Déduit un brouillon éditable {recurrence, modeHebdo, jourUnique, joursRouleau,
 * joursMoisTexte, condition, intervalleJours} à partir des colonnes réelles d'un
 * template existant — pour pré-remplir l'éditeur de récurrence avec ses valeurs
 * actuelles (§ AJOUT 3).
 */
function brouillonDepuisTemplate(template) {
  const modeHebdo = template.jours_semaine !== null && template.jours_semaine !== undefined ? 'rouleau' : 'unique'
  return {
    recurrence: template.recurrence,
    modeHebdo,
    jourUnique: template.jour_semaine ?? 1,
    joursRouleau: template.jours_semaine ?? [],
    joursMoisTexte: (template.jours_mois ?? []).join(', '),
    condition: template.condition ?? 'pluie',
    intervalleJours: template.intervalle_jours ?? 15,
  }
}

/**
 * Traduit un brouillon de récurrence en colonnes task_templates, en remettant à null
 * tous les champs des AUTRES types de récurrence (§ AJOUT 3 : ne pas laisser de champs
 * orphelins incohérents en changeant de récurrence). Renvoie { champs } ou { erreur }.
 * Partagé entre la création d'une tâche et l'édition de la récurrence d'une tâche
 * existante — même logique, même validation, à un seul endroit.
 */
function construireChampsRecurrence(brouillon) {
  const champs = {
    recurrence: brouillon.recurrence,
    jour_semaine: null,
    jours_semaine: null,
    jours_mois: null,
    condition: null,
    intervalle_jours: null,
  }

  if (brouillon.recurrence === 'hebdo') {
    if (brouillon.modeHebdo === 'unique') {
      champs.jour_semaine = brouillon.jourUnique
    } else if (brouillon.joursRouleau.length === 0) {
      return { erreur: T.reglages.erreurRouleauVide }
    } else {
      champs.jours_semaine = brouillon.joursRouleau
    }
  } else if (brouillon.recurrence === 'mensuelle') {
    const jours = brouillon.joursMoisTexte
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 31)
    if (jours.length === 0) return { erreur: T.reglages.erreurJoursMoisInvalides }
    champs.jours_mois = jours
  } else if (brouillon.recurrence === 'conditionnelle') {
    champs.condition = brouillon.condition
  } else if (brouillon.recurrence === 'intervalle') {
    const n = parseInt(brouillon.intervalleJours, 10)
    if (!Number.isInteger(n) || n < 1) return { erreur: T.reglages.erreurIntervalleInvalide }
    champs.intervalle_jours = n
  }

  return { champs }
}

/** Éditeur de récurrence — identique pour la création d'une tâche et la modification
 * de la récurrence d'une tâche existante (§ AJOUT 3), seule la valeur pré-remplie change. */
function ChampsRecurrence({ valeur, onChange }) {
  return (
    <>
      <label className="gestion-champ">
        {T.reglages.champRecurrence}
        <select value={valeur.recurrence} onChange={(e) => onChange({ recurrence: e.target.value })}>
          {Object.keys(T.familles).map((r) => (
            <option key={r} value={r}>
              {T.familles[r]}
            </option>
          ))}
        </select>
      </label>

      {valeur.recurrence === 'hebdo' && (
        <>
          <label className="gestion-champ">
            {T.reglages.champTypeJour}
            <select value={valeur.modeHebdo} onChange={(e) => onChange({ modeHebdo: e.target.value })}>
              <option value="unique">{T.reglages.optionJourUnique}</option>
              <option value="rouleau">{T.reglages.optionRouleau}</option>
            </select>
          </label>

          {valeur.modeHebdo === 'unique' ? (
            <label className="gestion-champ">
              {T.reglages.champJour}
              <select
                value={valeur.jourUnique}
                onChange={(e) => onChange({ jourUnique: Number(e.target.value) })}
              >
                {T.jours.noms.map((nom, index) => (
                  <option key={index + 1} value={index + 1}>
                    {nom}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="gestion-jours-cases">
              {T.jours.abreviations.map((label, index) => {
                const jourIso = index + 1
                return (
                  <button
                    type="button"
                    key={jourIso}
                    className={`gestion-jour-case ${valeur.joursRouleau.includes(jourIso) ? 'actif' : ''}`}
                    onClick={() =>
                      onChange({
                        joursRouleau: valeur.joursRouleau.includes(jourIso)
                          ? valeur.joursRouleau.filter((j) => j !== jourIso)
                          : [...valeur.joursRouleau, jourIso].sort(),
                      })
                    }
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {valeur.recurrence === 'mensuelle' && (
        <label className="gestion-champ">
          {T.reglages.champJoursMois}
          <input
            type="text"
            value={valeur.joursMoisTexte}
            onChange={(e) => onChange({ joursMoisTexte: e.target.value })}
            placeholder={T.reglages.placeholderJoursMois}
          />
        </label>
      )}

      {valeur.recurrence === 'conditionnelle' && (
        <label className="gestion-champ">
          {T.reglages.champCondition}
          <select value={valeur.condition} onChange={(e) => onChange({ condition: e.target.value })}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {T.conditions[c]}
              </option>
            ))}
          </select>
        </label>
      )}

      {valeur.recurrence === 'intervalle' && (
        <label className="gestion-champ">
          {T.reglages.champIntervalle}
          <input
            type="number"
            min="1"
            value={valeur.intervalleJours}
            onChange={(e) => onChange({ intervalleJours: e.target.value })}
          />
        </label>
      )}
    </>
  )
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

  // Édition de la récurrence d'une tâche existante (§ AJOUT 3) — un seul brouillon
  // ouvert à la fois, identifié par l'id du template en cours d'édition.
  const [recurrenceEnEdition, setRecurrenceEnEdition] = useState(null)
  const [brouillonRecurrence, setBrouillonRecurrence] = useState(null)
  const [recurrenceErreur, setRecurrenceErreur] = useState('')

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

  /** Écriture optimiste générique (pas de suppression ici, voir demanderSuppression). */
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
    const confirme = window.confirm(T.reglages.confirmDesactivation)
    if (confirme) appliquer(template, { actif: false })
  }

  /** Suppression intelligente (§ AJOUT 1) : DELETE réel si aucun historique, sinon
   * archivage (actif=false) pour ne jamais casser les completions passées. Le message
   * de confirmation reflète déjà le sort de la tâche, choisi selon son historique. */
  async function demanderSuppression(template) {
    setErreur('')
    try {
      const nbCompletions = await compterCompletions(template.id)
      const confirme = window.confirm(
        nbCompletions > 0 ? T.reglages.confirmSuppressionArchive : T.reglages.confirmSuppressionSimple
      )
      if (!confirme) return

      setEnregistrement(template.id)
      const resultat = await supprimerTemplateSiPossible(template.id)
      if (resultat === 'supprime') {
        setTemplates((prev) => prev.filter((t) => t.id !== template.id))
        setLibelles((prev) => {
          const copie = { ...prev }
          delete copie[template.id]
          return copie
        })
      } else {
        setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, actif: false } : t)))
      }
    } catch (e) {
      setErreur(e.message)
    } finally {
      setEnregistrement(null)
    }
  }

  async function ajouterTache(e) {
    e.preventDefault()
    const libelle = nouvelleTache.libelle.trim()
    if (!libelle) return
    setAjoutErreur('')

    const resultat = construireChampsRecurrence(nouvelleTache)
    if (resultat.erreur) {
      setAjoutErreur(resultat.erreur)
      return
    }

    // ordre = dernier de SA période + 1, pour que la tâche apparaisse en fin de sa
    // période (jamais en tête par défaut à cause d'un ordre 0/null).
    const ordreMaxDeLaPeriode = Math.max(
      0,
      ...templates.filter((t) => t.periode === nouvelleTache.periode).map((t) => t.ordre ?? 0)
    )
    const champs = {
      libelle,
      periode: nouvelleTache.periode,
      ordre: ordreMaxDeLaPeriode + 1,
      ...resultat.champs,
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

  function ouvrirEditionRecurrence(template) {
    setRecurrenceEnEdition(template.id)
    setBrouillonRecurrence(brouillonDepuisTemplate(template))
    setRecurrenceErreur('')
  }

  function annulerEditionRecurrence() {
    setRecurrenceEnEdition(null)
    setBrouillonRecurrence(null)
    setRecurrenceErreur('')
  }

  async function validerRecurrence(template) {
    const resultat = construireChampsRecurrence(brouillonRecurrence)
    if (resultat.erreur) {
      setRecurrenceErreur(resultat.erreur)
      return
    }
    await appliquer(template, resultat.champs)
    setRecurrenceEnEdition(null)
    setBrouillonRecurrence(null)
    setRecurrenceErreur('')
  }

  /** Monter/descendre (§ AJOUT 2) : échange `ordre` avec le voisin de la MÊME PÉRIODE
   * — c'est désormais aussi le périmètre affiché à l'écran (Réglages est groupé par
   * période, comme la vue salarié), donc l'échange reste cohérent partout : plus
   * d'écart entre le périmètre de déplacement et le périmètre affiché.
   * Persisté immédiatement en base. */
  async function deplacer(template, direction) {
    const siblings = templates
      .filter((t) => t.periode === template.periode)
      .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
    const index = siblings.findIndex((t) => t.id === template.id)
    const voisinIndex = direction === 'haut' ? index - 1 : index + 1
    if (voisinIndex < 0 || voisinIndex >= siblings.length) return
    const voisin = siblings[voisinIndex]

    const ordreTemplate = template.ordre
    const ordreVoisin = voisin.ordre
    setEnregistrement(template.id)
    setErreur('')
    setTemplates((prev) =>
      prev.map((t) => {
        if (t.id === template.id) return { ...t, ordre: ordreVoisin }
        if (t.id === voisin.id) return { ...t, ordre: ordreTemplate }
        return t
      })
    )
    try {
      await Promise.all([
        updateTemplate(template.id, { ordre: ordreVoisin }),
        updateTemplate(voisin.id, { ordre: ordreTemplate }),
      ])
    } catch (e) {
      setErreur(e.message)
      setTemplates((prev) =>
        prev.map((t) => {
          if (t.id === template.id) return { ...t, ordre: ordreTemplate }
          if (t.id === voisin.id) return { ...t, ordre: ordreVoisin }
          return t
        })
      )
    } finally {
      setEnregistrement(null)
    }
  }

  if (chargement) return <p className="gestion-chargement">{T.commun.chargement}</p>

  // Regroupement par PÉRIODE (matin/midi/journee/soir), trié par `ordre` — même
  // structure que ce que voit le salarié (calendarLogic.js), pour que Réglages et
  // l'écran salarié montrent la même chose et que le périmètre de `deplacer()`
  // (ci-dessus) coïncide avec le périmètre affiché. Le tri explicite ici est ce qui
  // rend le déplacement ▲▼ visible immédiatement : un simple `filter` aurait gardé
  // l'ordre d'insertion du tableau `templates`, pas l'ordre à jour du champ `ordre`.
  // L'information de récurrence (quotidienne/hebdo/conditionnelle...) ne disparaît
  // pas : elle reste affichée par tâche via le badge `FAMILLES_PAR_CLE` plus bas.
  const parPeriode = PERIODES.map((p) => ({
    cle: p,
    titre: T.periodes[p],
    icone: T.periodeIcones[p],
    templates: templates.filter((t) => t.periode === p).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)),
  })).filter((g) => g.templates.length > 0)

  return (
    <div className="gestion-taches">
      <p className="gestion-intro">{T.reglages.intro}</p>

      {erreur && <p className="gestion-erreur">{erreur}</p>}

      <div className="gestion-ajout">
        <button type="button" className="gestion-ajout-bouton" onClick={() => setAjoutOuvert((v) => !v)}>
          {ajoutOuvert ? T.reglages.fermerAjout : T.reglages.ouvrirAjout}
        </button>

        {ajoutOuvert && (
          <form className="gestion-ajout-form" onSubmit={ajouterTache}>
            <label className="gestion-champ">
              {T.reglages.champLibelle}
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
              {T.reglages.champPeriode}
              <select
                value={nouvelleTache.periode}
                onChange={(e) => setNouvelleTache((prev) => ({ ...prev, periode: e.target.value }))}
              >
                {PERIODES.map((p) => (
                  <option key={p} value={p}>
                    {T.periodes[p]}
                  </option>
                ))}
              </select>
            </label>

            <ChampsRecurrence
              valeur={nouvelleTache}
              onChange={(patch) => setNouvelleTache((prev) => ({ ...prev, ...patch }))}
            />

            {ajoutErreur && <p className="gestion-erreur">{ajoutErreur}</p>}

            <button type="submit" className="gestion-ajout-valider" disabled={ajoutEnCours || !nouvelleTache.libelle.trim()}>
              {T.reglages.creerBouton}
            </button>
          </form>
        )}
      </div>

      {parPeriode.length === 0 && <p className="gestion-vide">{T.reglages.vide}</p>}

      {parPeriode.map((groupe) => (
        <section key={groupe.cle} className="gestion-groupe">
          <h2 className="gestion-groupe-entete">
            <span aria-hidden="true">{groupe.icone}</span> {groupe.titre}
          </h2>

          {groupe.templates.map((template) => {
            const enCours = enregistrement === template.id
            const aJoursMultiples = template.jours_semaine !== null && template.jours_semaine !== undefined
            const fraicheur = statutFraicheur(template)
            const couleurs = couleurTache(template.periode, template.recurrence)
            const enEditionRecurrence = recurrenceEnEdition === template.id

            const siblingsPeriode = templates
              .filter((t) => t.periode === template.periode)
              .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0))
            const indexPeriode = siblingsPeriode.findIndex((t) => t.id === template.id)
            const estPremierDeSaPeriode = indexPeriode <= 0
            const estDernierDeSaPeriode = indexPeriode >= siblingsPeriode.length - 1
            const infoFamille = FAMILLES_PAR_CLE[familleDe(template)]

            return (
              <div
                key={template.id}
                className={`gestion-carte ${template.actif ? '' : 'inactif'}`}
                style={{
                  '--couleur-periode-fond': couleurs?.fond,
                  '--couleur-periode-bordure': couleurs?.lisere,
                  '--couleur-periode-texte': couleurs?.texte,
                }}
              >
                {fraicheur && (
                  <span className="gestion-badge-fraicheur" style={{ background: BADGE_COULEURS[fraicheur] }}>
                    {fraicheur === 'nouveau' ? T.badges.nouveau : T.badges.modifie}
                  </span>
                )}
                <div className="gestion-carte-entete">
                  <div className="gestion-deplacer">
                    <button
                      type="button"
                      className="gestion-deplacer-bouton"
                      onClick={() => deplacer(template, 'haut')}
                      disabled={enCours || estPremierDeSaPeriode}
                      title={T.reglages.monterBouton}
                    >
                      {T.reglages.monterBouton}
                    </button>
                    <button
                      type="button"
                      className="gestion-deplacer-bouton"
                      onClick={() => deplacer(template, 'bas')}
                      disabled={enCours || estDernierDeSaPeriode}
                      title={T.reglages.descendreBouton}
                    >
                      {T.reglages.descendreBouton}
                    </button>
                  </div>
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
                </div>

                <div className="gestion-actions-secondaires">
                  <button
                    type="button"
                    className={`gestion-actif-bouton ${template.actif ? '' : 'inactif'}`}
                    onClick={() =>
                      template.actif ? demanderDesactivation(template) : appliquer(template, { actif: true })
                    }
                    disabled={enCours}
                  >
                    {template.actif ? T.reglages.desactiverBouton : T.reglages.reactiverBouton}
                  </button>
                  <button
                    type="button"
                    className="gestion-supprimer-bouton"
                    onClick={() => demanderSuppression(template)}
                    disabled={enCours}
                  >
                    {T.reglages.supprimerBouton}
                  </button>
                </div>

                {!template.actif && <p className="gestion-statut">{T.reglages.statutInactif}</p>}

                <label className="gestion-champ">
                  {T.reglages.champPeriode}
                  <select
                    value={template.periode}
                    onChange={(e) => appliquer(template, { periode: e.target.value })}
                    disabled={enCours}
                  >
                    {PERIODES.map((p) => (
                      <option key={p} value={p}>
                        {T.periodes[p]}
                      </option>
                    ))}
                  </select>
                </label>

                <p className="gestion-recurrence">
                  <span className="gestion-badge-recurrence">
                    <span aria-hidden="true">{infoFamille?.icone}</span> {infoFamille?.titre}
                  </span>
                  {template.recurrence === 'intervalle' &&
                    ' ' + formatTexte(T.reglages.intervalleSuffixe, { n: template.intervalle_jours })}
                  {template.recurrence === 'mensuelle' &&
                    template.jours_mois &&
                    ' ' + formatTexte(T.reglages.moisSuffixe, { jours: template.jours_mois.join(', ') })}
                </p>

                {!enEditionRecurrence && (
                  <button
                    type="button"
                    className="gestion-modifier-recurrence-bouton"
                    onClick={() => ouvrirEditionRecurrence(template)}
                    disabled={enCours}
                  >
                    {T.reglages.modifierRecurrenceBouton}
                  </button>
                )}

                {enEditionRecurrence && (
                  <div className="gestion-edition-recurrence">
                    <ChampsRecurrence
                      valeur={brouillonRecurrence}
                      onChange={(patch) => setBrouillonRecurrence((prev) => ({ ...prev, ...patch }))}
                    />
                    {recurrenceErreur && <p className="gestion-erreur">{recurrenceErreur}</p>}
                    <div className="gestion-edition-recurrence-actions">
                      <button type="button" onClick={annulerEditionRecurrence} disabled={enCours}>
                        {T.commun.annuler}
                      </button>
                      <button
                        type="button"
                        className="gestion-ajout-valider"
                        onClick={() => validerRecurrence(template)}
                        disabled={enCours}
                      >
                        {T.commun.enregistrer}
                      </button>
                    </div>
                  </div>
                )}

                {!enEditionRecurrence && template.recurrence === 'hebdo' && (
                  <div className="gestion-jours-cases">
                    {T.jours.abreviations.map((label, index) => {
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
