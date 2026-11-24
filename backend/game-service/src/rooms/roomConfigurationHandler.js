//ARXIU QUE GESTIONA EL MISSATGE ROOM:CONFIGURATION DEL CLIENT

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { updateRoomConfiguration } from "./updateRoomConfiguration.js";
import { broadcastToRoom } from "../connections/broadcast.js";
import { broadcastRoomsList } from "./roomsListHandler.js";
import { enviaAdminLive } from "../admin/adminLive.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//FUNCIÓ AUXILIAR: ENVIA UN ERROR DE CONFIGURACIÓ AL CLIENT
//=====================
function sendConfigurationError(ws, reason) {
  const dadesError = JSON.stringify({
    type: "room:configuration:error",
    ok: false,
    reason: reason,
  });
  safeSend(ws, dadesError);
}

//=====================
//FUNCIÓ PRINCIPAL: GESTIONA ROOM:CONFIGURATION
//=====================
export async function roomConfigurationHandler(ws, message) {
  //LA SALA SEMPRE ÉS LA DEL SOCKET: NO ENS REFIEM DEL CLIENT
  const roomId = ws.roomId;

  if (roomId === undefined) {
    sendConfigurationError(ws, "No estàs dins de cap sala");
    return;
  }
  if (roomId === null) {
    sendConfigurationError(ws, "No estàs dins de cap sala");
    return;
  }

  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    sendConfigurationError(ws, "La sala no existeix");
    return;
  }

  //NOMÉS EL HOST POT CANVIAR LA CONFIGURACIÓ
  if (ws.identity === undefined) {
    sendConfigurationError(ws, "Només el host pot canviar la configuració");
    return;
  }
  if (ws.identity === null) {
    sendConfigurationError(ws, "Només el host pot canviar la configuració");
    return;
  }
  if (ws.identity.id !== room.hostId) {
    sendConfigurationError(ws, "Només el host pot canviar la configuració");
    return;
  }

  //DELEGUEM LA VALIDACIÓ I L'APLICACIÓ AL DOMINI
  let result;
  try {
    result = await updateRoomConfiguration(roomId, message.configuration);
  } catch (error) {
    let errorReconegut = false;
    if (error.code === "ROOM_NOT_FOUND") {
      errorReconegut = true;
    }
    if (error.code === "ROOM_NOT_WAITING") {
      errorReconegut = true;
    }
    if (error.code === "ROOM_CAPACITY_BELOW_PARTICIPANTS") {
      errorReconegut = true;
    }
    if (errorReconegut === true) {
      sendConfigurationError(ws, error.message);
    } else {
      console.error(
        "No s'ha pogut actualitzar la configuració de la sala:",
        error
      );
      sendConfigurationError(
        ws,
        "No s'ha pogut actualitzar la configuració de la sala"
      );
    }
    return;
  }

  if (result.ok === false) {
    sendConfigurationError(ws, result.reason);
    return;
  }

  //CONSTRUÏM LA RESPOSTA UN SOL COP: LA MATEIXA PER AL HOST I PER A LA RESTA
  const response = {
    type: "room:configuration:updated",
    ok: true,
    changed: result.changed,
    configuration: result.configuration,
  };

  //1. RESPOSTA AL HOST
  const dadesResponse = JSON.stringify(response);
  safeSend(ws, dadesResponse);

  //2. LA RESTA DE LA SALA HA DE VEURE EL MATEIX ESTAT
  broadcastToRoom(roomId, response, ws);

  broadcastRoomsList();
  enviaAdminLive();
}
