//ARXIU QUE GESTIONA EL MISSATGE ROUND:NEXT DEL CLIENT
//NOMÉS EL HOST POT OBRIR LA RONDA SEGÜENT

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { sendRoundNextError } from "./sendRound.js";
import { nextRound } from "./roundEvents.js";

//=====================
//FUNCIÓ PRINCIPAL: VALIDA EL HOST I AVANÇA LA RONDA
//=====================
export async function handleRoundNext(ws) {
  const room = roomStorage.members.get(ws.roomId);

  if (room === undefined) {
    sendRoundNextError(ws, "La sala no existeix");
    return;
  }

  if (ws.identity === undefined) {
    sendRoundNextError(ws, "Falta la identitat");
    return;
  }

  if (ws.identity === null) {
    sendRoundNextError(ws, "Falta la identitat");
    return;
  }

  if (ws.identity.id === undefined) {
    sendRoundNextError(ws, "Falta la identitat");
    return;
  }

  if (ws.identity.id === null) {
    sendRoundNextError(ws, "Falta la identitat");
    return;
  }

  //NOMÉS EL HOST TÉ EL BOTÓ DE SEGÜENT
  if (ws.identity.id !== room.hostId) {
    sendRoundNextError(ws, "Només el host pot avançar la ronda");
    return;
  }

  if (room.state !== "playing") {
    sendRoundNextError(ws, "La partida no està en curs");
    return;
  }

  //LA RONDA HA D'ESTAR TANCADA PER PODER OBRIR-NE UNA ALTRA
  if (room.roundOpen) {
    sendRoundNextError(ws, "La ronda encara no ha acabat");
    return;
  }

  await nextRound(ws.roomId);
}
