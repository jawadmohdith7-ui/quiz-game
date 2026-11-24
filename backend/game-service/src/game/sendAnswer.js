//ARXIU QUE ENVIA L'ACUSAMENT DE REBUDA I ELS ERRORS DE RESPOSTA

//=====================
//IMPORTEM
//=====================
import { safeSend } from "../utils/safeSend.js";

//=====================
//FUNCIÓ: ENVIA ANSWER:ACK (SENSE CORRECTE NI PUNTS)
//=====================
export function sendAnswerAck(ws, questionId) {
  const dades = JSON.stringify({
    type: "answer:ack",
    questionId: questionId,
  });

  safeSend(ws, dades);
}

//=====================
//FUNCIÓ: ENVIA ANSWER:ERROR AMB MISSATGE DESCRIPTIU EN CATALÀ
//=====================
export function sendAnswerError(ws, messageText) {
  const dades = JSON.stringify({
    type: "answer:error",
    message: messageText,
  });

  safeSend(ws, dades);
}
