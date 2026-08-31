// Compression + redressement EXIF d'une photo AVANT upload (§ terrain : une photo brute
// de smartphone pèse 3-8 Mo — ça sature le Storage et l'envoi est très lent en 4G
// d'écurie). Tourne entièrement dans le navigateur, sans dépendance : passer
// `imageOrientation: 'from-image'` à createImageBitmap redresse déjà l'image selon
// l'EXIF avant qu'on ne la dessine sur le canvas, donc pas besoin de parser l'EXIF
// nous-mêmes (les photos portrait smartphone arrivent souvent tournées de 90° sinon).

const COTE_MAX = 1600
const QUALITE_JPEG = 0.75

/** Comprime et redresse une photo (File) en JPEG. Renvoie un Blob prêt à uploader. */
export async function comprimerImage(fichier) {
  const bitmap = await decoderBitmapRedresse(fichier)
  try {
    const ratio = Math.min(1, COTE_MAX / Math.max(bitmap.width, bitmap.height))
    const largeur = Math.round(bitmap.width * ratio)
    const hauteur = Math.round(bitmap.height * ratio)

    const canvas = document.createElement('canvas')
    canvas.width = largeur
    canvas.height = hauteur
    canvas.getContext('2d').drawImage(bitmap, 0, 0, largeur, hauteur)

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Compression de la photo impossible.'))),
        'image/jpeg',
        QUALITE_JPEG
      )
    })
  } finally {
    bitmap.close?.()
  }
}

/** `imageOrientation: 'from-image'` est largement supporté (Chrome/Firefox/Safari
 * récents) ; on retombe sur le décodage brut plutôt que d'échouer si un navigateur
 * plus ancien ne le supporte pas (au pire l'orientation n'est pas corrigée). */
async function decoderBitmapRedresse(fichier) {
  try {
    return await createImageBitmap(fichier, { imageOrientation: 'from-image' })
  } catch {
    return await createImageBitmap(fichier)
  }
}
