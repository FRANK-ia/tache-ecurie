// Session terrain : sessionStorage uniquement (effacée à la fermeture de l'onglet/navigateur).
// Pas de token, pas de PIN stocké — juste l'identité de l'employé connecté (§5).

const KEY = 'ecurie_session_employe'

export function saveSession(employe) {
  sessionStorage.setItem(KEY, JSON.stringify(employe))
}

export function loadSession() {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearSession() {
  sessionStorage.removeItem(KEY)
}
