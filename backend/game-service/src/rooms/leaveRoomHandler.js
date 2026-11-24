//ARXIU QUE GESTIONA LA SORTIDA D'UN CLIENT D'UNA SALA

//=====================
//IMPORTEM
//=====================
import { leaveRoomAndNotify, cancelPendingLeave } from "./roomEvents.js";
import { roomStorage } from "../storage/roomStorage.js";
import { broadcastToRoom } from "../connections/broadcast.js";
import { enviaAdminLive } from "../admin/adminLive.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//FUNCIÓ PRINCIPAL: GESTIONA LA SORTIDA D'UN JUGADOR D'UNA SALA
//=====================
export async function leaveRoomHandler(ws, message) {
  const roomId = message.roomId;
  const room = roomStorage.members.get(roomId);
  let nickname = "Un jugador";

  if (ws.identity !== null && ws.identity !== undefined && room) {
    const player = room.players.get(ws.identity.id);

    if (player) {
      nickname = player.nickname;
    }
  }

  const result = await leaveRoomAndNotify(ws, roomId);

  //CANCEL·LEM QUALSEVOL SORTIDA PENDENT PER AQUESTA IDENTITAT (SORTIDA EXPLÍCITA)
  if (ws.identity === null) {
    //no fem res
  } else if (ws.identity.id === undefined) {
    //no fem res
  } else {
    cancelPendingLeave(ws.identity.id);
  }

  //SI ERROR EN SORTIR
  if (result.ok === false) {
    const dadesError = JSON.stringify({
      type: "room:leave:error",
      ok: false,
      reason: result.reason,
    });
    safeSend(ws, dadesError);
    return;
  }

  broadcastToRoom(roomId, {
    type: "chat:message",
    senderId: null,
    senderName: "SISTEMA",
    text: nickname + " ha salido de la sala",
    timestamp: Date.now(),
    system: true,
  });

  ws.roomId = null;

  //RESPOTA D'ÈXIT AL CLIENT QUE SURT
  const dadesLeft = JSON.stringify({
    type: "room:left",
    ok: true,
    roomId: result.roomId,
    players: result.players,
  });
  safeSend(ws, dadesLeft);

  //LA LLISTA DE SALES HA CANVIAT: HO PUBLIQUEM
  enviaAdminLive();
}
