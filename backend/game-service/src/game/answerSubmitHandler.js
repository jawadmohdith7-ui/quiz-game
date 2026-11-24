//ARXIU QUE GESTIONA EL MISSATGE ANSWER:SUBMIT DEL CLIENT

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { sendAnswerAck, sendAnswerError } from "./sendAnswer.js";
import { parseAnswerToNumber, calculatePoints } from "./scoring.js";
import { closeRoundIfAllAnswered } from "./roundEvents.js";
import { saveAnswerRecord } from "./persistence/gameRepository.js";

//=====================
//FUNCIÓ PRINCIPAL: VALIDA LA RESPOSTA I LA PUNTUA
//NO RETORNA SI ÉS CORRECTA: AIXÒ ARRIBA A ROUND:RESULTS
//=====================
export async function handleAnswerSubmit(ws, message) {
  //RECUPEREM LA SALA DEL SOCKET
  const room = roomStorage.members.get(ws.roomId);

  if (room === undefined) {
    sendAnswerError(ws, "La sala no existeix");
    return;
  }

  //NOMÉS S'ACCEPTEN RESPOSTES AMB LA PARTIDA EN CURS
  if (room.state !== "playing") {
    sendAnswerError(ws, "La partida no està en curs");
    return;
  }

  //LA RONDA HA D'ESTAR OBERTA
  if (room.roundOpen === false) {
    sendAnswerError(ws, "La ronda ja ha acabat");
    return;
  }

  if (ws.identity === undefined) {
    sendAnswerError(ws, "Falta la identitat");
    return;
  }

  if (ws.identity === null) {
    sendAnswerError(ws, "Falta la identitat");
    return;
  }

  if (ws.identity.id === undefined) {
    sendAnswerError(ws, "Falta la identitat");
    return;
  }

  if (ws.identity.id === null) {
    sendAnswerError(ws, "Falta la identitat");
    return;
  }

  const player = room.players.get(ws.identity.id);

  if (player === undefined) {
    sendAnswerError(ws, "No ets a la sala");
    return;
  }

  //ELS OBSERVADORS NO PODEN RESPONDRE
  if (player.role !== "player") {
    sendAnswerError(ws, "Els observadors no poden respondre");
    return;
  }

  const questionId = message.questionId;
  const answer = message.answer;

  //VALIDACIÓ DEL PAYLOAD
  let hasInvalidPayload = false;
  if (questionId === undefined) {
    hasInvalidPayload = true;
  } else if (questionId === null) {
    hasInvalidPayload = true;
  } else if (answer === undefined) {
    hasInvalidPayload = true;
  } else if (answer === null) {
    hasInvalidPayload = true;
  }

  if (hasInvalidPayload) {
    sendAnswerError(ws, "Payload invàlid: falten questionId o answer");
    return;
  }

  //HA DE SER LA PREGUNTA DE LA RONDA ACTUAL
  if (String(questionId) !== String(room.currentQuestionId)) {
    sendAnswerError(ws, "Aquesta pregunta no és la ronda actual");
    return;
  }

  //FORA DE TEMPS
  if (Date.now() > room.roundEndsAt) {
    sendAnswerError(ws, "El temps de la ronda s'ha acabat");
    return;
  }

  //UNA SOLA RESPOSTA PER JUGADOR I RONDA
  if (room.roundAnswers.has(player.id)) {
    sendAnswerError(ws, "Ja has respost aquesta ronda");
    return;
  }

  const numericAnswer = parseAnswerToNumber(answer);

  if (numericAnswer === null) {
    sendAnswerError(ws, "La resposta ha de ser un número");
    return;
  }

  if (Math.abs(numericAnswer) >= 1e14) {
    sendAnswerError(ws, "La resposta supera el límit permès");
    return;
  }
  const storedAnswer = Number(numericAnswer.toFixed(6));
  const question = room.questionsById.get(room.currentQuestionId);
  const points = calculatePoints(storedAnswer, question.correctAnswer);

  try {
    await saveAnswerRecord(room.currentRoundId, player.nickname, storedAnswer);
  } catch (error) {
    console.error("No s'ha pogut desar la resposta:", error);

    let missatgeError = "No s'ha pogut desar la resposta";

    if (error.code === "ANSWER_ALREADY_EXISTS") {
      missatgeError = error.message;
    } else if (error.code === "ROUND_CLOSED") {
      missatgeError = error.message;
    } else if (error.code === "PARTICIPANT_NOT_IN_GAME") {
      missatgeError = error.message;
    }

    sendAnswerError(ws, missatgeError);
    return;
  }
  room.roundAnswers.set(player.id, {
    answer: storedAnswer,
    points: points,
  });

  player.score += points;

  //NOMÉS ACUSEM LA REBUDA: SENSE CORRECTE NI PUNTS
  sendAnswerAck(ws, questionId);

  //SI TOTHOM HA RESPOST, LA RONDA ES TANCA SENSE ESPERAR EL RELLOTGE
  await closeRoundIfAllAnswered(ws.roomId);
}
