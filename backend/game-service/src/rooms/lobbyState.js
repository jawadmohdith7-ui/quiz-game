//ARXIU QUE CALCULA L'ESTAT DEL LOBBY D'UNA SALA (READY I ROLS)

//=====================
//IMPORTEM
//=====================

//=====================
//CONSTANTS
//=====================
const READY_RATIO = 0.4;
const MIN_READY = 1;

//=====================
//JUGADORS QUE COMPTEN (SENSE OBSERVADORS NI AMFITRIÓ)
//=====================
export function jugadorsQueCompten(sala) {
  let total = 0;

  for (const jugador of sala.players.values()) {
    if (jugador.role === "observer") {
      continue;
    }

    if (jugador.id === sala.hostId) {
      continue;
    }

    total = total + 1;
  }

  return total;
}

//=====================
//FUNCIÓ AUXILIAR: COMPTA ELS MEMBRES QUE HAN DONAT READY
//L'AMFITRIÓ I ELS OBSERVADORS NO COMPTEN
//=====================
export function countReady(room) {
  let count = 0;

  for (const player of room.players.values()) {
    if (player.role === "observer") {
      continue;
    }

    if (player.id === room.hostId) {
      continue;
    }

    if (player.ready === true) {
      count = count + 1;
    }
  }

  return count;
}

//=====================
//QUANTS HAN DE DIR QUE SÍ
//=====================
//EL 40 % ARRODONIT CAP AMUNT, COM A MÍNIM UN
export function requiredReady(sala) {
  const jugadors = jugadorsQueCompten(sala);

  if (jugadors === 0) {
    return 0;
  }

  return Math.max(MIN_READY, Math.ceil(jugadors * READY_RATIO));
}

//=====================
//ES POT COMENÇAR?
//=====================
export function canStart(sala) {
  if (sala.state !== "lobby") {
    return false;
  }

  const jugadors = jugadorsQueCompten(sala);

  //NOMÉS L'AMFITRIÓ: POT JUGAR SOL SI VOL
  if (jugadors === 0) {
    return true;
  }

  return countReady(sala) >= requiredReady(sala);
}

//=====================
//FUNCIÓ PRINCIPAL: CONSTRUEIX L'ESTAT DEL LOBBY PER AL CLIENT
//=====================
export function buildLobbyState(room) {
  const playersArray = [];
  for (const player of room.players.values()) {
    playersArray.push(player);
  }

  return {
    players: playersArray,
    hostId: room.hostId,
    state: room.state,
    durationSeconds: room.roundDurationMs / 1000,
    readyCount: countReady(room),
    readyRequired: requiredReady(room),
    canStart: canStart(room),
  };
}
