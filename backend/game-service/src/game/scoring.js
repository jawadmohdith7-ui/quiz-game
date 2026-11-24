//ARXIU QUE CALCULA LA PUNTUACIÓ PER PROXIMITAT

//=====================
//IMPORTEM
//=====================

//=====================
//CONSTANTS DE LA CORBA
//=====================
const EXACT_POINTS = 500;
const EXACT_BONUS = 30;
const PRECISION_POINTS = 450;
const PRECISION_MARGIN = 0.10;
const ZERO_DISTANCE = 3;

//=====================
//FUNCIÓ AUXILIAR: CONVERTEIX LA RESPOSTA DEL CLIENT EN NÚMERO
//ACCEPTA COMA DECIMAL I REBUTJA NaN, INFINIT I TEXT NO NUMÈRIC
//=====================
export function parseAnswerToNumber(rawAnswer) {
  //SI JA ÉS UN NÚMERO
  if (typeof rawAnswer === "number") {
    if (Number.isFinite(rawAnswer)) {
      return rawAnswer;
    }
    return null;
  }

  //SI NO ÉS TEXT, NO ÉS UNA RESPOSTA VÀLIDA
  if (typeof rawAnswer !== "string") {
    return null;
  }

  const normalized = rawAnswer.trim().replace(",", ".");

  //TEXT BUIT
  if (normalized === "") {
    return null;
  }

  const value = Number(normalized);

  //TEXT NO NUMÈRIC O NO FINIT
  const esFinit = Number.isFinite(value);

  if (esFinit === false) {
    return null;
  }

  return value;
}

//=====================
//FUNCIÓ PRINCIPAL: PUNTS SEGONS LA DISTÀNCIA RELATIVA
//d = |resposta - correcte| / |correcte|
//=====================
export function calculatePoints(guess, correctAnswer) {
  const absoluteCorrect = Math.abs(correctAnswer);

  //EL CATÀLEG MAI TÉ RESPOSTA 0, PERÒ EVITEM DIVIDIR PER ZERO
  if (absoluteCorrect === 0) {
    return 0;
  }

  const distance = Math.abs(guess - correctAnswer) / absoluteCorrect;

  //RESPOSTA EXACTA: 500 + 30 D'EXTRA
  if (distance === 0) {
    return EXACT_POINTS + EXACT_BONUS;
  }

  //DINS DEL 10% DE DISTÀNCIA (90% DE PRECISIÓ)
  if (distance <= PRECISION_MARGIN) {
    return PRECISION_POINTS;
  }

  //TRES VEGADES LA RESPOSTA O MÉS ENLLÀ
  if (distance >= ZERO_DISTANCE) {
    return 0;
  }

  //BAIXADA LINEAL DE 450 A 0, SEMPRE ENTER
  return Math.round(
    (PRECISION_POINTS * (ZERO_DISTANCE - distance)) /
      (ZERO_DISTANCE - PRECISION_MARGIN)
  );
}
