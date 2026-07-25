import { useState } from 'react'
import Login from './components/Login/Login'
import SalarieView from './components/SalarieView/SalarieView'
import EmployeurView from './components/EmployeurView/EmployeurView'
import { loadSession, saveSession, clearSession } from './lib/session'

function App() {
  const [employe, setEmploye] = useState(() => loadSession())

  function connecter(employeConnecte) {
    saveSession(employeConnecte)
    setEmploye(employeConnecte)
  }

  function deconnecter() {
    clearSession()
    setEmploye(null)
  }

  if (!employe) {
    return <Login onConnecte={connecter} />
  }

  if (employe.role === 'employeur') {
    return <EmployeurView employe={employe} onDeconnexion={deconnecter} />
  }

  return <SalarieView employe={employe} onDeconnexion={deconnecter} />
}

export default App
