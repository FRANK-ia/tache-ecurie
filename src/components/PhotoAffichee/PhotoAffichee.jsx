import { useEffect, useState } from 'react'
import { fetchUrlSigneePhotoObservation } from '../../lib/api'
import './PhotoAffichee.css'

/**
 * Affiche la photo d'un commentaire à partir de son chemin dans le bucket privé —
 * génère une URL signée temporaire au moment de l'affichage (jamais d'URL publique,
 * jamais d'URL stockée). Vignette cliquable -> plein écran.
 *
 * Tolère une photo déjà purgée (§ purge n8n, hors périmètre ici) : que ce soit
 * `createSignedUrl` qui échoue (fichier déjà supprimé) ou l'`<img>` qui échoue au
 * chargement (URL signée avec succès mais fichier absent), on masque silencieusement
 * la photo — le texte du commentaire reste affiché seul, sans erreur visible.
 */
export default function PhotoAffichee({ cheminImage }) {
  const [url, setUrl] = useState(null)
  const [indisponible, setIndisponible] = useState(false)
  const [pleinEcran, setPleinEcran] = useState(false)

  useEffect(() => {
    let annule = false
    setUrl(null)
    setIndisponible(false)
    if (!cheminImage) return
    fetchUrlSigneePhotoObservation(cheminImage)
      .then((u) => {
        if (!annule) setUrl(u)
      })
      .catch(() => {
        if (!annule) setIndisponible(true)
      })
    return () => {
      annule = true
    }
  }, [cheminImage])

  if (!cheminImage || indisponible || !url) return null

  return (
    <>
      <button type="button" className="photo-affichee-vignette" onClick={() => setPleinEcran(true)}>
        <img src={url} alt="" onError={() => setIndisponible(true)} />
      </button>
      {pleinEcran && (
        <div className="photo-affichee-plein-ecran" onClick={() => setPleinEcran(false)}>
          <img src={url} alt="" />
        </div>
      )}
    </>
  )
}
