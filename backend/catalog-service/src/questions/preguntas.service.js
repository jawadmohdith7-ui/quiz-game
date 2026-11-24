import { getRandomQuestionsFromDatabase } from "./preguntas.repository.js";

export async function getRandomQuestions(category, numQuestions, difficulty, partida) {
  return getRandomQuestionsFromDatabase(category, numQuestions, difficulty, partida);
}
