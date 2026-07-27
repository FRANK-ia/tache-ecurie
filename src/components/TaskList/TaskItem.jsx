import { CONDITION_EMOJIS, BADGE_COULEURS } from '../../lib/constants'
import './TaskItem.css'

export default function TaskItem({ task, onToggle, disabled }) {
  const emoji = CONDITION_EMOJIS[task.condition]

  return (
    <button
      className={`task-item ${task.fait ? 'task-item-fait' : ''}`}
      onClick={() => onToggle(task)}
      disabled={disabled}
    >
      <span className={`task-item-case ${task.fait ? 'cochee' : ''}`}>{task.fait ? '✓' : ''}</span>
      <span className="task-item-libelle">
        {emoji && <span aria-hidden="true">{emoji} </span>}
        {task.libelle}
      </span>
      {task.fraicheur && (
        <span className="task-item-badge-fraicheur" style={{ background: BADGE_COULEURS[task.fraicheur] }}>
          {task.fraicheur === 'nouveau' ? 'Nouveau' : 'Modifié'}
        </span>
      )}
      {task.kind === 'ponctuelle' && (
        <span className="task-item-badge-ajout" style={{ background: BADGE_COULEURS.ajout }}>
          ajout
        </span>
      )}
    </button>
  )
}
