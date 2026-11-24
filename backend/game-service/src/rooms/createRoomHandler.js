//ARXIU QUE GESTIONA LA CREACIÓ DE SALA DES DEL WEBSOCKET

//=====================
//IMPORTEM
//=====================
import { createRoom } from "./createRoom.js";
import { roomStorage } from "../storage/roomStorage.js";
import { buildRoomSummary } from "./roomsListHandler.js";
import { broadcastExcept } from "../connections/broadcast.js";
import { enviaAdminLive } from "../admin/adminLive.js";
import { safeSend } from "../utils/safeSend.js";
//=====================
//FUNCIÓ PRINCIPAL: GESTIONA EL MISSATGE ROOM:CREATE
//=====================
export async function createRoomHandler(ws, message) {
  const nickname = message.nickname;
  const maxPlayers = message.maxPlayers;
  const isPrivate = message.isPrivate;
  const nameRoom = message.nameRoom;

  let result;
  try {
    result = await createRoom({
      nickname: nickname,
      maxPlayers: maxPlayers,
      isPrivate: isPrivate,
      nameRoom: nameRoom,
      identity: ws.identity,
    });
  } catch (error) {
    console.error("No s'ha pogut desar la partida a MariaDB:", error);
    const dadesError = JSON.stringify({
      type: "room:create:error",
      ok: false,
      reason: "No s'ha pogut crear la partida. Torna-ho a provar.",
    });
    safeSend(ws, dadesError);
    return;
  }

  //SI ERROR EN CREAR SALA
  if (result.ok === false) {
    const dadesError = JSON.stringify({
      type: "room:create:error",
      ok: false,
      reason: result.reason,
    });
    safeSend(ws, dadesError);
    return;
  }

  //1. RESPOSTA AL CREATOR (ROOM:CREATED)
  ws.roomId = result.roomId;
  const dadesCreated = JSON.stringify({
    type: "room:created",
    ok: true,
    roomId: result.roomId,
    hostId: result.hostId,
    nameRoom: result.nameRoom,
    category: result.category,
    difficulty: result.difficulty,
    rounds: result.rounds,
    maxPlayers: result.maxPlayers,
    isPrivate: result.isPrivate,
    password: result.password,
    players: result.players,
    state: result.state,
    durationSeconds: result.durationSeconds,
    readyCount: result.readyCount,
    readyRequired: result.readyRequired,
    canStart: result.canStart,
  });
  safeSend(ws, dadesCreated);

  //2. BROADCAST A TOTS ELS ALTRES CLIENTS (ROOM:NEW)
  //EXCLOUEM EL CREATOR PERQUE JA TÉ LA INFO VIA ROOM:CREATED
  const room = roomStorage.members.get(result.roomId);
  const resumSala = buildRoomSummary(result.roomId, room);
  const missatgeNew = Object.assign({}, { type: "room:new" }, resumSala);
  broadcastExcept(ws, missatgeNew);

  //LA LLISTA DE SALES HA CANVIAT: HO PUBLIQUEM
  enviaAdminLive();
}
