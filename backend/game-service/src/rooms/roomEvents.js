//ARXIU QUE CENTRALITZA ELS EVENTS D'UNA SALA

//=====================
//IMPORTEM
//=====================
import { leaveRoom } from "./leaveRoom.js";
import { broadcast, broadcastToRoom } from "../connections/broadcast.js";
import { broadcastRoomsList } from "./roomsListHandler.js";
import { sendRoomPlayers } from "./sendRoomPlayers.js";
import { closeRoundIfAllAnswered, resetToLobbyIfNoPlayers } from "../game/roundEvents.js";
import { GRACE_MS } from "../config/websocketConfig.js";
import { enqueueRoom } from "./roomQueue.js";

//=====================
//ESTAT INTERN: SORTIDES PENDENTS PER DESCONNEXIÓ
//CLAU: ID DEL JUGADOR (UN JUGADOR NOMÉS POT SER EN UNA SALA ALHORA)
//=====================
const pendingLeaves = new Map();

//=====================
//FUNCIÓ PRINCIPAL: SURT DE LA SALA I NOTIFICA (LEAVE EXPLÍCIT I GRÀCIA EXPIRADA FAN SERVIR EL MATEIX CAMÍ)
//=====================
export async function leaveRoomAndNotify(ws, roomId) {
  const result = await leaveRoom({ roomId: roomId, identity: ws.identity });

  if (result.ok === false) {
    return result;
  }

  //SI LA SALA QUEDA BUIDA: AVISSEM EL LOBBY
  if (result.removed === true) {
    broadcast({ type: "room:removed", roomId: result.roomId });
  }
  //SI QUEDEN JUGADORS: ACTUALITZEM LLISTA, ROLS I NOU HOST
  else {
    sendRoomPlayers(result.roomId, ws);

    //SI EL QUE HA MARXAT ERA L'ÚLTIM PENDENT, LA RONDA ES TANCA SENSE ESPERAR EL RELLOTGE
    try {
      await closeRoundIfAllAnswered(result.roomId);
      //SI NO QUEDA CAP JUGADOR, LA SALA TORNA AL LOBBY PER ALS OBSERVADORS
      await resetToLobbyIfNoPlayers(result.roomId);
    } catch (error) {
      console.error("No s'ha pogut actualitzar la partida després de la sortida:", error);
      broadcastToRoom(result.roomId, { type: "round:error", message: "No s'ha pogut actualitzar la partida." });
    }
  }

  //ACTUALITZEM EL COMPTADOR DE JUGADORS AL LOBBY
  broadcastRoomsList();

  return result;
}

//=====================
//FUNCIÓ AUXILIAR: ACCIÓ QUE S'EXECUTA QUAN EXPIRA EL TEMPS DE GRÀCIA
//=====================
async function accioSortidaAjornada(roomId, identity, timer) {
  if (pendingLeaves.get(identity.id) !== timer) {
    return;
  }
  pendingLeaves.delete(identity.id);
  const client = { identity: identity };
  await leaveRoomAndNotify(client, roomId);
}

//=====================
//FUNCIÓ AUXILIAR: GESTIONA L'ERROR DE LA SORTIDA PER DESCONNEXIÓ
//=====================
function gestionaErrorSortida(error) {
  console.error("No s'ha pogut processar la sortida per desconnexió:", error);
}

//=====================
//FUNCIÓ AUXILIAR: AJORNA LA SORTIDA QUAN ES TANCA EL SOCKET (POT SER UN REFRESH)
//=====================
export function scheduleLeaveOnDisconnect(ws) {
  //GUARDEM LA SALA ARA: DESPRÉS ES POSA A NULL I EL TIMER LLEGEIX AQUESTA VARIABLE
  const roomId = ws.roomId;
  const identity = ws.identity;

  if (roomId === undefined) {
    return;
  }
  if (roomId === null) {
    return;
  }
  if (identity === undefined) {
    return;
  }
  if (identity === null) {
    return;
  }
  if (identity.id === undefined) {
    return;
  }
  if (identity.id === null) {
    return;
  }

  //SI JA HI HAVIA UNA SORTIDA PENDENT, LA SUBSTITUIM
  cancelPendingLeave(identity.id);

  //EL TIMER ES DECLARA ABANS PERQUÈ LA FUNCIÓ EL PUGUI LLEGIR QUAN S'EXECUTI
  let timer;

  function executaSortida() {
    const operacio = function () {
      return accioSortidaAjornada(roomId, identity, timer);
    };
    const promesa = enqueueRoom(roomId, operacio);
    promesa.catch(gestionaErrorSortida);
  }

  timer = setTimeout(executaSortida, GRACE_MS);

  pendingLeaves.set(identity.id, timer);
}

//=====================
//FUNCIÓ AUXILIAR: CANCEL·LA UNA SORTIDA AJORNADA (EL JUGADOR HA TORNAT O HA SORTIT EXPLÍCITAMENT)
//=====================
export function cancelPendingLeave(identityId) {
  const timer = pendingLeaves.get(identityId);

  if (timer === undefined) {
    return;
  }

  clearTimeout(timer);
  pendingLeaves.delete(identityId);
}
