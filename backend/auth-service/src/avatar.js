//ARXIU QUE VALIDA QUE UNA IMATGE D'AVATAR SIGUI SEGURA DE DESAR I PINTAR

//=====================
//LLISTA BLANCA DE MIMES PERMESOS
//=====================
//FORA svg+xml: POT PORTAR JAVASCRIPT I ES PINTARIA AL NAVEGADOR
const MIMES_AVATAR_PERMESOS = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
  "data:image/webp;base64,",
  "data:image/gif;base64,",
];

//=====================
//FUNCIÓ: COMPROVA SI LA IMATGE ÉS UN ENLLAÇ https O UN DATA URI PERMÈS
//=====================
export function esAvatarValid(imatge) {
  //SI NO ÉS UN TEXT, NO ÉS CAP IMATGE
  if (typeof imatge !== "string") {
    return false;
  }

  const text = imatge.trim();

  //UNA CADENA BUIDA NO ÉS CAP IMATGE
  if (text.length === 0) {
    return false;
  }

  //UN ENLLAÇ NORMAL: NOMÉS https
  if (text.indexOf("https://") === 0) {
    return true;
  }

  //UN DATA URI: HA DE COMENÇAR PER UN DELS MIMES PERMESOS
  for (let i = 0; i < MIMES_AVATAR_PERMESOS.length; i++) {
    if (text.indexOf(MIMES_AVATAR_PERMESOS[i]) === 0) {
      return true;
    }
  }

  return false;
}
