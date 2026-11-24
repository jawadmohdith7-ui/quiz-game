//ARXIU QUE CALCULA EL RÀNQUING DE LA PARTIDA

//=====================
//FUNCIÓ AUXILIAR: ORDENA DOS JUGADORS
//PRIMER PER PUNTUACIÓ (MÉS ALTA PRIMER), EN CAS D'EMPAT PEL NICKNAME
//=====================
function comparePlayers(a, b) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  return a.nickname.localeCompare(b.nickname);
}

//=====================
//FUNCIÓ PRINCIPAL: RETORNA ELS JUGADORS AMB LA SEVA POSICIÓ
//=====================
export function buildRanking(room) {
  if (room.state === "finished") {
    if (room.finalRanking === null) {
      // continue to next check
    } else if (room.finalRanking === undefined) {
      // continue to next check
    } else {
      return room.finalRanking;
    }
  }

  if (room.roundOpen === false) {
    if (room.currentRanking === null) {
      // continue to next check
    } else if (room.currentRanking === undefined) {
      // continue to next check
    } else {
      return room.currentRanking;
    }
  }

  const entries = [];

  //TRIEM ELS JUGADORS DE LA PARTIDA O ELS DE LA SALA SI NO N'HI HA
  let jugadorsIterator;
  if (room.gamePlayers === null) {
    jugadorsIterator = room.players.values();
  } else if (room.gamePlayers === undefined) {
    jugadorsIterator = room.players.values();
  } else {
    jugadorsIterator = room.gamePlayers.values();
  }

  for (const player of jugadorsIterator) {
    //ELS OBSERVADORS NO SURTEN AL RÀNQUING
    if (player.role !== "player") {
      continue;
    }

    entries.push({
      id: player.id,
      nickname: player.nickname,
      score: player.score,
      userId: player.userId || null,
      avatarColor: player.avatarColor || null,
    });
  }

  entries.sort(comparePlayers);

  const ranking = [];

  for (let index = 0; index < entries.length; index += 1) {
    ranking.push({
      position: index + 1,
      id: entries[index].id,
      nickname: entries[index].nickname,
      score: entries[index].score,
      userId: entries[index].userId,
      avatarColor: entries[index].avatarColor,
    });
  }

  return ranking;
}

//=====================
//FUNCIÓ AUXILIAR: RETORNA LA POSICIÓ D'UN JUGADOR (0 SI NO HI ÉS)
//=====================
export function findPosition(ranking, playerId) {
  for (const entry of ranking) {
    if (entry.id === playerId) {
      return entry.position;
    }
  }

  return 0;
}
