import { PERIODES, PERIODE_LABELS } from '../../lib/constants'
import TaskItem from './TaskItem'
import './TaskList.css'

export default function TaskList({ taches, onToggle, disabled }) {
  const parPeriode = PERIODES.map((periode) => ({
    periode,
    taches: taches.filter((t) => t.periode === periode),
  })).filter((groupe) => groupe.taches.length > 0)

  if (parPeriode.length === 0) {
    return <p className="task-list-vide">Aucune tâche prévue aujourd'hui.</p>
  }

  return (
    <div className="task-list">
      {parPeriode.map((groupe) => (
        <section key={groupe.periode} className="task-list-groupe">
          <h2 className="task-list-entete">{PERIODE_LABELS[groupe.periode]}</h2>
          <div className="task-list-items">
            {groupe.taches.map((tache) => (
              <TaskItem key={`${tache.kind}-${tache.id}`} task={tache} onToggle={onToggle} disabled={disabled} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
