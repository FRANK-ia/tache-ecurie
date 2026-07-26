import { useEffect, useState } from 'react'
import { fetchEmployes, updateEmploye } from '../../lib/api'
import './GestionComptes.css'

const PIN_REGEX = /^[0-9]{4}$/

export default function GestionComptes() {
  const [employes, setEmployes] = useState([])
  const [prenoms, setPrenoms] = useState({})
  const [pins, setPins] = useState({})
  const [chargement, setChargement] = useState(true)
  const [erreurs, setErreurs] = useState({})
  const [enregistrement, setEnregistrement] = useState(null)
  const [succes, setSucces] = useState(null)

  useEffect(() => {
    fetchEmployes()
      .then((data) => {
        setEmployes(data)
        setPrenoms(Object.fromEntries(data.map((e) => [e.id, e.prenom])))
      })
      .catch((e) => setErreurs({ global: e.message }))
      .finally(() => setChargement(false))
  }, [])

  async function enregistrer(employe) {
    const nouveauPrenom = (prenoms[employe.id] ?? '').trim()
    const nouveauPin = (pins[employe.id] ?? '').trim()

    if (!nouveauPrenom) {
      setErreurs((prev) => ({ ...prev, [employe.id]: 'Le prénom ne peut pas être vide.' }))
      return
    }
    if (nouveauPin && !PIN_REGEX.test(nouveauPin)) {
      setErreurs((prev) => ({ ...prev, [employe.id]: 'Le code doit contenir exactement 4 chiffres.' }))
      return
    }

    const champs = {}
    if (nouveauPrenom !== employe.prenom) champs.prenom = nouveauPrenom
    if (nouveauPin) champs.pin = nouveauPin
    if (Object.keys(champs).length === 0) return

    setEnregistrement(employe.id)
    setErreurs((prev) => ({ ...prev, [employe.id]: '' }))
    try {
      await updateEmploye(employe.id, champs)
      setEmployes((prev) => prev.map((e) => (e.id === employe.id ? { ...e, ...champs } : e)))
      setPins((prev) => ({ ...prev, [employe.id]: '' }))
      setSucces(employe.id)
      setTimeout(() => setSucces((s) => (s === employe.id ? null : s)), 2500)
    } catch (e) {
      setErreurs((prev) => ({ ...prev, [employe.id]: e.message }))
    } finally {
      setEnregistrement(null)
    }
  }

  if (chargement) return <p className="comptes-chargement">Chargement…</p>

  return (
    <div className="gestion-comptes">
      <p className="comptes-intro">
        Renomme un compte (le nom affiché sur l'écran de connexion) ou change son code PIN à 4
        chiffres. Laisse le champ code vide pour ne pas le changer.
      </p>

      {erreurs.global && <p className="comptes-erreur">{erreurs.global}</p>}

      {employes.map((employe) => {
        const enCours = enregistrement === employe.id
        return (
          <div key={employe.id} className="compte-carte">
            <p className="compte-role">{employe.role === 'employeur' ? 'Employeur' : 'Salarié'}</p>

            <label className="compte-champ">
              Nom affiché
              <input
                type="text"
                value={prenoms[employe.id] ?? ''}
                onChange={(e) => setPrenoms((prev) => ({ ...prev, [employe.id]: e.target.value }))}
                disabled={enCours}
              />
            </label>

            <label className="compte-champ">
              Nouveau code PIN (4 chiffres)
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={pins[employe.id] ?? ''}
                onChange={(e) =>
                  setPins((prev) => ({ ...prev, [employe.id]: e.target.value.replace(/\D/g, '').slice(0, 4) }))
                }
                disabled={enCours}
              />
            </label>

            {erreurs[employe.id] && <p className="compte-erreur">{erreurs[employe.id]}</p>}
            {succes === employe.id && <p className="compte-succes">Enregistré ✓</p>}

            <button
              type="button"
              className="compte-bouton"
              onClick={() => enregistrer(employe)}
              disabled={enCours}
            >
              Enregistrer
            </button>
          </div>
        )
      })}
    </div>
  )
}
