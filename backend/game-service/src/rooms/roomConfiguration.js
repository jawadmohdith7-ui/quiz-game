//ARXIU QUE CONSTRUEIX LA CONFIGURACIO PUBLICA D'UNA SALA

//=====================
//IMPORTEM
//=====================

//=====================
//FUNCIO AUXILIAR: RETORNA LA CONFIGURACIO ACTUAL D'UNA SALA
//=====================
export function buildConfiguration(room) {
  return {
    category: room.category,
    difficulty: room.difficulty,
    maxPlayers: room.maxPlayers,
    rounds: room.rounds,
    durationSeconds: room.roundDurationMs / 1000,
    state: room.state,
  };
}
