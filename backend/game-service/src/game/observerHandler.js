//ARXIU QUE GESTIONA ELS MISSATGES DEL MODE ESPECTADOR: OBSERVER:SELECT I GAMEPLAY:UPDATE

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { broadcastToRoomEach } from "../connections/broadcast.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//FUNCIÓ AUXILIAR: ENVIA UN ERROR DE SELECCIÓ D'OBSERVADOR
//=====================
function sendObserverSelectError(ws, reason) {
  safeSend(ws, JSON.stringify({ type: "observer:select:error", reason: reason }));
}

//=====================
//FUNCIÓ AUXILIAR: RETORNA EL JUGADOR DEL SOCKET SI EL SEU ROL COINCIDEIX
//=====================
function findMemberWithRole(ws, role) {
  if (ws.identity === undefined || ws.identity === null) {
    return null;
  }

  const room = roomStorage.members.get(ws.roomId);

  if (room === undefined) {
    return null;
  }

  const member = room.players.get(ws.identity.id);

  if (member === undefined || member.role !== role) {
    return null;
  }

  return member;
}

//=====================
//FUNCIÓ PRINCIPAL: L'ESPECTADOR TRIA QUIN JUGADOR VOL SEGUIR
//=====================
export function handleObserverSelect(ws, message) {
  const observer = findMemberWithRole(ws, "observer");

  if (observer === null) {
    sendObserverSelectError(ws, "Només els espectadors poden seleccionar un jugador");
    return;
  }

  const room = roomStorage.members.get(ws.roomId);
  const target = room.players.get(message.playerId);

  if (target === undefined || target.role !== "player") {
    sendObserverSelectError(ws, "El jugador seleccionat no existeix");
    return;
  }

  ws.observedPlayerId = target.id;

  safeSend(
    ws,
    JSON.stringify({
      type: "observer:selected",
      playerId: target.id,
      nickname: target.nickname,
    })
  );

  safeSend(
    ws,
    JSON.stringify({
      type: "gameplay:update",
      playerId: target.id,
      playerNickname: target.nickname,
      gameplay: target.gameplay ?? "",
    })
  );
}

//=====================
//FUNCIÓ PRINCIPAL: EL JUGADOR ENVIA EL QUE ESTÀ ESCRIVINT
//NOMÉS ELS ESPECTADORS QUE SEGUEIXEN AQUEST JUGADOR EL REBEN
//=====================
export function handleGameplayUpdate(ws, message) {
  const player = findMemberWithRole(ws, "player");

  if (player === null) {
    return;
  }

  player.gameplay = typeof message.gameplay === "string" ? message.gameplay : "";

  broadcastToRoomEach(ws.roomId, function construeixGameplayPerObservador(client) {
    if (client.observedPlayerId !== player.id) {
      return null;
    }

    if (findMemberWithRole(client, "observer") === null) {
      return null;
    }

    return {
      type: "gameplay:update",
      playerId: player.id,
      playerNickname: player.nickname,
      gameplay: player.gameplay,
    };
  });
}
