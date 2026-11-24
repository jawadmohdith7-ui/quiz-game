//ARXIU QUE GESTIONA LA SORTIDA D'UN JUGADOR D'UNA SALA

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { removeRoomParticipant } from "../repositories/roomRepository.js";

//=====================
//FUNCIÓ PRINCIPAL: GESTIONA LA SORTIDA D'UNA SALA
//=====================
export async function leaveRoom({ roomId, identity }) {
  //VALIDACIÓ PARÀMETRES OBLIGATORIS
  if (roomId === undefined) {
    return { ok: false, reason: "Falten el codi de la sala o la identitat" };
  }
  if (roomId === null) {
    return { ok: false, reason: "Falten el codi de la sala o la identitat" };
  }
  if (identity === undefined) {
    return { ok: false, reason: "Falten el codi de la sala o la identitat" };
  }
  if (identity === null) {
    return { ok: false, reason: "Falten el codi de la sala o la identitat" };
  }
  if (identity.id === undefined) {
    return { ok: false, reason: "Falten el codi de la sala o la identitat" };
  }
  if (identity.id === null) {
    return { ok: false, reason: "Falten el codi de la sala o la identitat" };
  }

  //NETEJEM ESPAIS EN BLANC
  const cleanRoomId = roomId.trim();

  //ROOMID BUIT
  if (cleanRoomId === "") {
    return { ok: false, reason: "El codi de la sala no és vàlid" };
  }

  //COMPROVEM QUE LA SALA EXISTEIX
  if (roomStorage.members.has(cleanRoomId) === false) {
    return { ok: false, reason: "La sala no existeix" };
  }

  //RECUPEREM LA SALA
  const room = roomStorage.members.get(cleanRoomId);

  //JUGADOR NO ESTÀ A LA SALA
  let playerExists = false;
  if (room === undefined) {
    playerExists = false;
  } else if (room.players === undefined) {
    playerExists = false;
  } else {
    if (room.players.has(identity.id) === true) {
      playerExists = true;
    }
  }

  if (playerExists === false) {
    return { ok: false, reason: "El jugador no és a la sala" };
  }

  try {
    await removeRoomParticipant({
      roomId: cleanRoomId,
      nickname: room.players.get(identity.id).nickname,
    });
  } catch (error) {
    console.error("No s'ha pogut eliminar el participant de MariaDB:", error);
    return {
      ok: false,
      reason: "No s'ha pogut sortir de la partida. Torna-ho a provar.",
    };
  }

  //ELIMINEM EL JUGADOR DE LA SALA
  room.players.delete(identity.id);

  //SI ERA EL HOST, ASSIGNEM NOU HOST SI N'HI HA
  //PRIMER UN PLAYER; UN OBSERVER NOMÉS SI NO QUEDA CAP JUGADOR
  if (room.hostId === identity.id) {
    let newHostId = null;

    for (const [id, player] of room.players) {
      if (player.role === "player") {
        newHostId = id;
        break;
      }
    }

    if (newHostId === null) {
      for (const [id] of room.players) {
        newHostId = id;
        break;
      }
    }

    room.hostId = newHostId;
  }

  //SI LA SALA QUEDA BUIDA, L'ELIMINEM
  if (room.players.size === 0) {
    if (room.roundTimer !== null) {
      clearTimeout(room.roundTimer);
    }
    roomStorage.members.delete(cleanRoomId);
    return {
      ok: true,
      roomId: cleanRoomId,
      players: [],
      hostId: null,
      category: room.category,
      removed: true,
    };
  }

  //RETORNEM SALA ACTUALITZADA
  const playersArray = [];
  for (const player of room.players.values()) {
    playersArray.push(player);
  }

  return {
    ok: true,
    roomId: cleanRoomId,
    players: playersArray,
    hostId: room.hostId,
    category: room.category,
    removed: false,
  };
}
