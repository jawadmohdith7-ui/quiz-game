//ARXIU QUE GESTIONA EL MISSATGE ROOM:READY DEL CLIENT

//=====================
//IMPORTEM
//=====================
import { updatePlayerReady } from "./updatePlayerReady.js";
import { sendRoomPlayers } from "./sendRoomPlayers.js";
import { roomStorage } from "../storage/roomStorage.js";
import { broadcastToRoom } from "../connections/broadcast.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//FUNCIÓ AUXILIAR: ENVIA UN ERROR DE READY AL CLIENT
//=====================
function sendReadyError(ws, reason) {
  const dadesError = JSON.stringify({
    type: "room:ready:error",
    ok: false,
    reason: reason,
  });
  safeSend(ws, dadesError);
}

//=====================
//FUNCIÓ PRINCIPAL: GESTIONA ROOM:READY
//=====================
export function readyHandler(ws, message) {
  let identityId = null;

  if (ws.identity !== undefined) {
    if (ws.identity !== null) {
      identityId = ws.identity.id;
    }
  }

  //DELEGUEM LA VALIDACIÓ I L'APLICACIÓ A LA REGLA
  const result = updatePlayerReady(ws.roomId, identityId, message.ready);

  if (result.ok === false) {
    sendReadyError(ws, result.reason);
    return;
  }

  const player = roomStorage.members.get(ws.roomId).players.get(identityId);

  broadcastToRoom(ws.roomId, {
    type: "chat:message",
    senderId: null,
    senderName: "SISTEMA",
    text: player.nickname + (message.ready ? " está listo." : " ya no está listo."),
    timestamp: Date.now(),
    system: true,
  });

  //TOTA LA SALA HA DE VEURE EL NOU COMPTADOR
  sendRoomPlayers(ws.roomId);
}