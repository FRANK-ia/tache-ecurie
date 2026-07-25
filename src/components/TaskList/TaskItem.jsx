import './TaskItem.css'

export default function TaskItem({ task, onToggle, disabled }) {
  const estConditionnelle = Boolean(task.condition)

  return (
    <button
      className={`task-item ${task.fait ? 'task-item-fait' : ''} ${estConditionnelle ? 'task-item-meteo' : ''}`}
      onClick={() => onToggle(task)}
      disabled={disabled}
    >
      <span className={`task-item-case ${task.fait ? 'cochee' : ''}`}>{task.fait ? '✓' : ''}</span>
      <span className="task-item-libelle">{task.libelle}</span>
      {task.kind === 'ponctuelle' && <span className="task-item-badge">ajout</span>}
    </button>
  )
}
