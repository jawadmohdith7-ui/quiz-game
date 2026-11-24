//ARXIU QUE GESTIONA EL LLISTAT DE SALES PÚBLIQUES

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { broadcast } from "../connections/broadcast.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//FUNCIÓ AUXILIAR: CONSTRUEIX EL RESUM D'UNA SALA PER AL LOBBY
//=====================
export function buildRoomSummary(roomId, room) {
  let name = room.nameRoom;

  if (name === undefined) {
    name = `Sala ${roomId.slice(-6)}`;
  }
  if (name === null) {
    name = `Sala ${roomId.slice(-6)}`;
  }
  if (name === "") {
    name = `Sala ${roomId.slice(-6)}`;
  }

  return {
    id: roomId,
    name: name,
    maxPlayers: room.maxPlayers,
    players: room.players.size,
    category: room.category,
    state: room.state,
    isPrivate: room.isPrivate,
  };
}

//=====================
//FUNCIÓ AUXILIAR: CONSTRUEIX EL LLISTAT DE SALES NO PRIVADES
//=====================
export function buildRoomsList() {
  const publicRooms = [];
  for (const [roomId, room] of roomStorage.members) {
    if (room.isPrivate === false) {
      publicRooms.push(buildRoomSummary(roomId, room));
    }
  }

  return publicRooms;
}

//=====================
//FUNCIÓ PRINCIPAL: RETORNA EL LLISTAT DE SALES NO PRIVADES
//=====================
export function roomsListHandler(ws) {
  const dadesLlistat = JSON.stringify({
    type: "rooms:list",
    ok: true,
    rooms: buildRoomsList(),
  });
  safeSend(ws, dadesLlistat);
}

//=====================
//FUNCIÓ AUXILIAR: ENVIA EL LLISTAT A TOTS ELS CLIENTS (ACTUALITZA EL LOBBY)
//=====================
export function broadcastRoomsList() {
  broadcast({
    type: "rooms:list",
    ok: true,
    rooms: buildRoomsList(),
  });
}
