import { useEffect, useState } from 'react'
import { fetchEmployes, verifierPin } from '../../lib/api'
import './Login.css'

export default function Login({ onConnecte }) {
  const [employes, setEmployes] = useState([])
  const [employeSelectionne, setEmployeSelectionne] = useState(null)
  const [pin, setPin] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(true)
  const [verification, setVerification] = useState(false)

  useEffect(() => {
    fetchEmployes()
      .then(setEmployes)
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false))
  }, [])

  function choisirEmploye(employe) {
    setEmployeSelectionne(employe)
    setPin('')
    setErreur('')
  }

  function retour() {
    setEmployeSelectionne(null)
    setPin('')
    setErreur('')
  }

  function saisirChiffre(chiffre) {
    if (pin.length >= 4) return
    setPin(pin + chiffre)
  }

  function effacer() {
    setPin(pin.slice(0, -1))
  }

  useEffect(() => {
    if (pin.length !== 4 || !employeSelectionne) return
    setVerification(true)
    setErreur('')
    verifierPin(employeSelectionne.id, pin)
      .then((employe) => {
        if (employe) {
          onConnecte(employe)
        } else {
          setErreur('Code incorrect. Réessaie.')
          setPin('')
        }
      })
      .catch((e) => setErreur(e.message))
      .finally(() => setVerification(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  if (chargement) return <div className="login-loading">Chargement…</div>

  if (!employeSelectionne) {
    return (
      <div className="login-screen">
        <h1 className="login-titre">Qui es-tu ?</h1>
        {erreur && <p className="login-erreur">{erreur}</p>}
        <div className="login-liste-employes">
          {employes.map((employe) => (
            <button key={employe.id} className="login-bouton-employe" onClick={() => choisirEmploye(employe)}>
              {employe.prenom}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="login-screen">
      <button className="login-retour" onClick={retour}>
        ← Retour
      </button>
      <h1 className="login-titre">Bonjour {employeSelectionne.prenom}</h1>
      <p className="login-sous-titre">Entre ton code à 4 chiffres</p>
      <div className="login-pin-affichage">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`login-pin-case ${i < pin.length ? 'remplie' : ''}`} />
        ))}
      </div>
      {erreur && <p className="login-erreur">{erreur}</p>}
      <div className="login-pave-numerique">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((chiffre) => (
          <button key={chiffre} className="login-touche" onClick={() => saisirChiffre(chiffre)} disabled={verification}>
            {chiffre}
          </button>
        ))}
        <span />
        <button className="login-touche" onClick={() => saisirChiffre('0')} disabled={verification}>
          0
        </button>
        <button className="login-touche login-touche-effacer" onClick={effacer} disabled={verification}>
          ⌫
        </button>
      </div>
    </div>
  )
}
