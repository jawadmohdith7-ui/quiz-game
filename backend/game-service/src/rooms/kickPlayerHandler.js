//ARXIU QUE GESTIONA L'EXPULSIÓ D'UN JUGADOR PER PART DEL CREADOR DE LA SALA (ROOM:KICK)

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { broadcastToRoom, findRoomClient } from "../connections/broadcast.js";
import { leaveRoomAndNotify } from "./roomEvents.js";
import { enviaAdminLive } from "../admin/adminLive.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//FUNCIÓ AUXILIAR: ENVIA ERROR AL CLIENT QUE HA DEMANAT L'EXPULSIÓ
//=====================
function enviaErrorKick(ws, reason) {
  safeSend(ws, JSON.stringify({ type: "error", message: reason }));
}

//=====================
//FUNCIÓ PRINCIPAL: EXPULSA UN JUGADOR DE LA SALA (NOMÉS L'HOST)
//=====================
export async function kickPlayerHandler(ws, message) {
  const roomId = ws.roomId;
  const room = roomStorage.members.get(roomId);

  if (!room || !ws.identity) {
    enviaErrorKick(ws, "No estàs en cap sala.");
    return;
  }

  if (room.hostId !== ws.identity.id) {
    enviaErrorKick(ws, "Només el creador de la sala pot expulsar jugadors.");
    return;
  }

  const targetId = message.playerId;

  if (targetId === ws.identity.id) {
    enviaErrorKick(ws, "No et pots expulsar a tu mateix.");
    return;
  }

  const target = room.players.get(targetId);

  if (!target) {
    enviaErrorKick(ws, "El jugador no és a la sala.");
    return;
  }

  const nickname = target.nickname;
  const kickedWs = findRoomClient(roomId, targetId);

  //DESVINCULEM LA CONNEXIÓ ABANS DE SORTIR: EL BROADCAST JA NO LA INCLOU
  if (kickedWs) {
    kickedWs.roomId = null;
  }

  const result = await leaveRoomAndNotify(kickedWs || { identity: { id: targetId } }, roomId);

  if (result.ok === false) {
    if (kickedWs) {
      kickedWs.roomId = roomId;
    }
    enviaErrorKick(ws, result.reason);
    return;
  }

  if (kickedWs) {
    safeSend(
      kickedWs,
      JSON.stringify({
        type: "room:kicked",
        roomId: roomId,
        reason: "Has estat expulsat de la sala pel creador.",
      })
    );
  }

  broadcastToRoom(roomId, {
    type: "chat:message",
    senderId: null,
    senderName: "SISTEMA",
    text: nickname + " ha estat expulsat de la sala",
    timestamp: Date.now(),
    system: true,
  });

  enviaAdminLive();
}
