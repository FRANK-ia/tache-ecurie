import { PERIODES, PERIODE_LABELS, PERIODE_ICONS, PERIODE_COULEURS } from '../../lib/constants'
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
      {parPeriode.map((groupe) => {
        const couleurs = PERIODE_COULEURS[groupe.periode]
        return (
          <section
            key={groupe.periode}
            className="task-list-groupe"
            style={{ '--couleur-periode-fond': couleurs?.fond, '--couleur-periode-bordure': couleurs?.bordure }}
          >
            <h2 className="task-list-entete">
              <span className="task-list-icone" aria-hidden="true">
                {PERIODE_ICONS[groupe.periode]}
              </span>
              {PERIODE_LABELS[groupe.periode]}
            </h2>
            <div className="task-list-items">
              {groupe.taches.map((tache) => (
                <TaskItem key={`${tache.kind}-${tache.id}`} task={tache} onToggle={onToggle} disabled={disabled} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
