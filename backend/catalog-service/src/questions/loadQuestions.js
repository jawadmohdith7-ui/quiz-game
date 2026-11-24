//ARXIU QUE CARREGA LES PREGUNTES DES DEL FITXER JSON

//=====================
//IMPORTEM
//=====================
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

//=====================
//DECLAREM LA CONSTANT AMB LA RUTA ABSOLUTA AL FITXER JSON
//=====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const QUESTIONS_JSON_PATH = path.resolve(
  __dirname,
  "../../../database/preguntas/preguntas.json"
);

//=====================
//FUNCIÓ AUXILIAR: LLEGEIX EL JSON
//=====================
async function readQuestionsFile() {
  return fs.readFile(QUESTIONS_JSON_PATH, "utf-8");
}

//=====================
//DECLAREM LA FUNCIÓ QUE LLEGEIX I RETORNA TOTES LES PREGUNTES
//=====================
export async function loadQuestions(filePath) {
  try {
    const fileContent = filePath
      ? await fs.readFile(filePath, "utf-8")
      : await readQuestionsFile();
    const data = JSON.parse(fileContent);

    return data;
  } catch (error) {
    const wrappedError = new Error(
      `No s'ha pogut carregar el fitxer de preguntes: ${error.message}`
    );
    wrappedError.code = "QUESTIONS_FILE_ERROR";
    wrappedError.cause = error;
    throw wrappedError;
  }
}

