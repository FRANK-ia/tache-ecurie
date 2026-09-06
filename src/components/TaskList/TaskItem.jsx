import { BADGE_COULEURS, COULEUR_MAISON, couleurTache } from '../../lib/constants'
import { formatHeureCourte } from '../../lib/calendarLogic'
import { T } from '../../lib/textes'
import './TaskItem.css'

export default function TaskItem({ task, onToggle, disabled }) {
  const emoji = T.conditionEmojis[task.condition]
  // Orange vif PRIME sur la couleur de période habituelle pour les tâches maison
  // (§ mécanisme 3) — la catégorie l'emporte, quelle que soit la période/récurrence.
  const couleurs = task.categorie === 'maison' ? COULEUR_MAISON : couleurTache(task.periode, task.recurrence)
  const heure = formatHeureCourte(task.heureAffichee)

  return (
    <button
      className={`task-item ${task.fait ? 'task-item-fait' : ''}`}
      onClick={() => onToggle(task)}
      disabled={disabled}
      style={{
        '--couleur-periode-fond': couleurs?.fond,
        '--couleur-periode-bordure': couleurs?.lisere,
        '--couleur-periode-texte': couleurs?.texte,
      }}
    >
      <span className={`task-item-case ${task.fait ? 'cochee' : ''}`}>{task.fait ? '✓' : ''}</span>
      <span className="task-item-libelle">
        {emoji && <span aria-hidden="true">{emoji} </span>}
        {task.libelle}
        {heure && <span className="task-item-heure">· {heure}</span>}
      </span>
      {task.fraicheur && (
        <span className="task-item-badge-fraicheur" style={{ background: BADGE_COULEURS[task.fraicheur] }}>
          {task.fraicheur === 'nouveau' ? T.badges.nouveau : T.badges.modifie}
        </span>
      )}
      {task.kind === 'ponctuelle' && (
        <span className="task-item-badge-ajout" style={{ background: BADGE_COULEURS.ajout }}>
          {T.badges.ajout}
        </span>
      )}
    </button>
  )
}
