//ARXIU QUE CONSTRUEIX I ENVIA EL MISSATGE ROOM:PLAYERS

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { broadcastToRoom } from "../connections/broadcast.js";
import { buildLobbyState } from "./lobbyState.js";

//=====================
//FUNCIÓ AUXILIAR: CONSTRUEIX EL PAYLOAD COMPLET DEL LOBBY
//RETORNA NULL SI LA SALA NO EXISTEIX
//=====================
export function buildRoomPlayersMessage(roomId) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return null;
  }
  if (room === null) {
    return null;
  }

  const lobby = buildLobbyState(room);

  return {
    type: "room:players",
    roomId: roomId,
    nameRoom: room.nameRoom,
    maxPlayers: room.maxPlayers,
    category: room.category,
    difficulty: room.difficulty,
    rounds: room.rounds,
    players: lobby.players,
    hostId: lobby.hostId,
    state: lobby.state,
    durationSeconds: lobby.durationSeconds,
    readyCount: lobby.readyCount,
    readyRequired: lobby.readyRequired,
    canStart: lobby.canStart,
  };
}

//=====================
//FUNCIÓ PRINCIPAL: ENVIA ROOM:PLAYERS A LA SALA
//=====================
export function sendRoomPlayers(roomId, excludeWs) {
  if (excludeWs === undefined) {
    excludeWs = null;
  }
  const message = buildRoomPlayersMessage(roomId);

  if (message === null) {
    return null;
  }

  broadcastToRoom(roomId, message, excludeWs);

  return message;
}
