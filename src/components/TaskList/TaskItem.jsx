import { BADGE_COULEURS, couleurTache } from '../../lib/constants'
import { T } from '../../lib/textes'
import './TaskItem.css'

export default function TaskItem({ task, onToggle, disabled }) {
  const emoji = T.conditionEmojis[task.condition]
  const couleurs = couleurTache(task.periode, task.recurrence)

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
