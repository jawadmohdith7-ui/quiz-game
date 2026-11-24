//ARXIU QUE REALITZA LA CRIDA HTTP AL CATALOG-SERVICE PER OBTENIR PREGUNTES

//=====================
//IMPORTEM
//=====================

//=====================
//CONSTANT: URL BASE DEL CATALOG-SERVICE (CONFIGURABLE PER ENTORN)
//=====================
let CATALOG_URL = process.env.CATALOG_URL;

if (CATALOG_URL === undefined) {
  CATALOG_URL = "http://localhost:3001";
}

//=====================
//CONSTANT: SECRET PER CRIDAR LES RUTES INTERNES
//=====================
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

//=====================
//FUNCIÓ AUXILIAR: LLANÇA UN ERROR SI FALTA EL SECRET
//=====================
function checkInternalSecret() {
  if (INTERNAL_SECRET === undefined || INTERNAL_SECRET.length === 0) {
    const error = new Error("Falta la variable d'entorn INTERNAL_SECRET: no podem demanar preguntes al catàleg.");
    error.code = "INTERNAL_SECRET_MISSING";
    throw error;
  }
}

//=====================
//FUNCIÓ AUXILIAR: LLEGEIX EL MISSATGE D'ERROR DEL CATALOG
//=====================
function readErrorMessage(errorData, status) {
  if (errorData.error === undefined || errorData.error === null) {
    return "Error HTTP: " + status;
  }

  if (errorData.error.message === undefined || errorData.error.message === null) {
    return "Error HTTP: " + status;
  }

  return errorData.error.message;
}

//=====================
//FUNCIÓ AUXILIAR: LLEGEIX EL CODI D'ERROR DEL CATALOG
//=====================
function readErrorCode(errorData) {
  if (errorData.error === undefined || errorData.error === null) {
    return "CATALOG_SERVICE_ERROR";
  }

  if (errorData.error.code === undefined || errorData.error.code === null) {
    return "CATALOG_SERVICE_ERROR";
  }

  return errorData.error.code;
}

//=====================
//FUNCIÓ PRINCIPAL: OBTÉ PREGUNTES VIA HTTP POST
//=====================
export async function fetchQuestions(rounds, category, difficulty, partida) {
  checkInternalSecret();

  //CONSTRUIM LA URL COMPLETA
  const url = `${CATALOG_URL}/internal/preguntas/get`;

  //PREPAREM EL BODY DE LA PETICIÓ
  //AL CATALOG LI DIEM numQuestions PERQUÈ ÉS EL SEU CONTRACTE; AL JOC SÓN RONDES
  const body = {
    numQuestions: rounds,
    category: category,
    difficulty: difficulty,
    partida: partida,
  };

  //EXECUTEM LA PETICIÓ FETCH AMB EL SECRET DE SERVEI
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": INTERNAL_SECRET,
    },
    body: JSON.stringify(body),
  });

  //SI LA RESPOSTA NO ÉS OK, LLANÇEM ERROR
  if (response.ok === false) {
    let errorData = {};

    try {
      errorData = await response.json();
    } catch (parseError) {
      errorData = {};
    }

    const errorMessage = readErrorMessage(errorData, response.status);
    const errorCode = readErrorCode(errorData);

    const error = new Error(errorMessage);
    error.statusCode = response.status;
    error.code = errorCode;
    throw error;
  }

  //PARSEM LA RESPOSTA JSON
  const data = await response.json();

  //RETORNEM L'ARRAY DE PREGUNTES
  return data.questions;
}
