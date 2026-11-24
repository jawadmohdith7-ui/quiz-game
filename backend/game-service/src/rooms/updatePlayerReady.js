//ARXIU QUE VALIDA I APLICA EL READY D'UN MEMBRE

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";

//=====================
//FUNCIÓ PRINCIPAL: MARCA O DESMARCA UN MEMBRE COM A READY
//=====================
export function updatePlayerReady(roomId, identityId, ready) {
  //RECUPEREM LA SALA DEL MAGATZEM
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return { ok: false, reason: "La sala no existeix" };
  }

  //NOMÉS ES POT DONAR READY AL LOBBY
  if (room.state !== "lobby") {
    return { ok: false, reason: "La partida ja ha començat" };
  }

  if (identityId === undefined) {
    return { ok: false, reason: "Falta la identitat" };
  }

  if (identityId === null) {
    return { ok: false, reason: "Falta la identitat" };
  }

  //L'AMFITRIÓ SEMPRE ESTÀ PREPARAT I NO COMTABILITZA
  if (identityId === room.hostId) {
    const hostPlayer = room.players.get(identityId);
    if (hostPlayer !== undefined && hostPlayer !== null) {
      hostPlayer.ready = true;
    }
    return { ok: true };
  }

  const player = room.players.get(identityId);

  if (player === undefined) {
    return { ok: false, reason: "No ets a la sala" };
  }

  //EL VALOR HA DE SER EXPLÍCIT: NO FEM TOGGLE IMPLÍCIT
  if (typeof ready !== "boolean") {
    return { ok: false, reason: "El camp ready ha de ser cert o fals" };
  }

  player.ready = ready;

  return { ok: true };
}
