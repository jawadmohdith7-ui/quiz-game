//ARXIU QUE GESTIONA LA PETICIÓ I RESPOSTA HTTP DE PREGUNTES

//=====================
//IMPORTEM
//=====================
import { getRandomQuestions } from "./preguntas.service.js";
import { listCatalogOptions } from "./preguntas.repository.js";

//=====================
//DECLAREM EL CONTROLADOR PER GET /internal/catalog/options
//=====================
export async function getCatalogOptionsController(_req, res) {
  res.json(await listCatalogOptions());
}

//=====================
//DECLAREM EL CONTROLADOR PER POST /internal/preguntas/get
//=====================
export async function getPreguntasController(req, res) {
  //EXTREM EL BODY VALIDAT (ja validat pel middleware)
  const { numQuestions, category, difficulty, partida } = req.body;

  //CRIDEM AL SERVEI PER OBTENIR LES PREGUNTES
  const questions = await getRandomQuestions(
    category,
    numQuestions,
    difficulty,
    partida
  );

  //SI LA CATEGORIA NO EXISTEIX, LLANCEM ERROR
  if (questions === null) {
    const error = new Error(`Categoria no trobada: ${category}`);
    error.statusCode = 404;
    error.code = "CATEGORY_NOT_FOUND";
    throw error;
  }

  //SI EL FILTRE DEIXA LA LLISTA BUIDA, TAMBÉ ÉS UN ERROR
  if (questions.length === 0) {
    const error = new Error(
      "No hi ha preguntes per a aquesta categoria i dificultat"
    );
    error.statusCode = 404;
    error.code = "NO_QUESTIONS_FOUND";
    throw error;
  }

  //RETORNEM LES PREGUNTES EN EL FORMAT ESPERAT
  res.json({ questions });
}
