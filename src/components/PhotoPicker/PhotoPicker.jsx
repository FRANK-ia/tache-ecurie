import { useEffect, useRef, useState } from 'react'
import { T } from '../../lib/textes'
import './PhotoPicker.css'

/**
 * Sélecteur de photo contrôlé (value/onChange, comme un <input>) — une seule photo
 * à la fois, choisir une nouvelle photo remplace la précédente. `capture="environment"`
 * ouvre directement l'appareil photo (caméra arrière) sur mobile, pas la galerie :
 * c'est la capture du moment qui est demandée, pas une photo déjà existante.
 * Ne compresse ni n'uploade rien ici — la compression/upload sont gérés par
 * l'appelant au moment de l'envoi (voir src/lib/image.js, src/lib/api.js).
 */
export default function PhotoPicker({ value, onChange, disabled }) {
  const inputRef = useRef(null)
  const [apercu, setApercu] = useState(null)

  useEffect(() => {
    if (!value) {
      setApercu(null)
      return
    }
    const url = URL.createObjectURL(value)
    setApercu(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  function retirer() {
    if (inputRef.current) inputRef.current.value = ''
    onChange(null)
  }

  return (
    <div className="photo-picker">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={inputRef}
        onChange={(e) => onChange(e.target.files[0] ?? null)}
        disabled={disabled}
        hidden
      />
      {apercu ? (
        <div className="photo-picker-apercu">
          <img src={apercu} alt="" />
          <button type="button" className="photo-picker-retirer" onClick={retirer} disabled={disabled}>
            {T.commun.retirerPhoto}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="photo-picker-bouton"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          {T.commun.ajouterPhoto}
        </button>
      )}
    </div>
  )
}
