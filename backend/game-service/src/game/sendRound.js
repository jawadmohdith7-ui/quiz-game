//ARXIU QUE CONSTRUEIX I ENVIA ELS MISSATGES DE RONDA I DE FI DE PARTIDA

//=====================
//IMPORTEM
//=====================
import { buildRanking, findPosition } from "./ranking.js";
import { roomStorage } from "../storage/roomStorage.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//FUNCIÓ AUXILIAR: CONSTRUEIX ROUND:STARTED SENSE SOLUCIÓ NI EXPLICACIÓ
//=====================
export function buildRoundStartedMessage(room, question) {
  return {
    type: "round:started",
    round: room.roundIndex + 1,
    totalRounds: room.totalRounds,
    durationMs: room.roundDurationMs,
    question: {
      id: question.id,
      text: question.text,
      min: question.min,
      max: question.max,
      step: question.step,
      unit: question.unit,
      difficulty: question.difficulty,
    },
  };
}

//=====================
//FUNCIÓ AUXILIAR: CONSTRUEIX L'ESTAT DE RONDA PER A UN ESPECTADOR
//=====================
export function buildSpectatorRoundMessage(roomId) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return null;
  }

  let phase = "waiting";

  if (room.roundOpen) {
    phase = "question";
  } else {
    if (room.roundIndex >= 0) {
      phase = "results";
    }
  }

  let remainingMs = 0;

  if (phase === "question") {
    remainingMs = Math.max(0, room.roundEndsAt - Date.now());
  }

  //LA SALA GUARDA EL CODI A roomId: NO HI HA CAP CAMP id
  return {
    type: "round:spectator",
    roomId: roomId,
    round: room.roundIndex + 1,
    totalRounds: room.totalRounds,
    phase: phase,
    remainingMs: remainingMs,
    durationMs: room.roundDurationMs,
  };
}

//=====================
//FUNCIÓ AUXILIAR: JUGADOR QUE REPRESENTA EL CLIENT
//UN OBSERVADOR REPRESENTA EL JUGADOR QUE ESTÀ OBSERVANT
//=====================
function resolvePlayerForClient(room, client) {
  if (room === undefined) {
    return null;
  }

  if (client === undefined || client === null) {
    return null;
  }

  if (client.identity === undefined || client.identity === null) {
    return null;
  }

  const ownPlayer = room.players.get(client.identity.id);

  //EL JUGADOR SEMPRE ES REPRESENTA A ELL MATEIX
  if (ownPlayer !== undefined && ownPlayer.role === "player") {
    return ownPlayer;
  }

  //NOMÉS ELS OBSERVADORS HERETEN EL JUGADOR OBSERVAT
  if (ownPlayer === undefined || ownPlayer.role !== "observer") {
    return null;
  }

  if (client.observedPlayerId === undefined || client.observedPlayerId === null) {
    return null;
  }

  const observedPlayer = room.players.get(client.observedPlayerId);

  if (observedPlayer === undefined) {
    return null;
  }

  if (observedPlayer.role !== "player") {
    return null;
  }

  return observedPlayer;
}

//=====================
//FUNCIÓ AUXILIAR: CONSTRUEIX EL BLOC "YOU" D'UN CLIENT
//PER A UN OBSERVADOR ÉS EL BLOC DEL JUGADOR QUE ESTÀ OBSERVANT
//=====================
function buildYou(room, client, ranking) {
  const player = resolvePlayerForClient(room, client);

  if (player === null) {
    return null;
  }

  const storedAnswer = room.roundAnswers.get(player.id);
  let answerValue = null;
  let roundPoints = 0;

  if (storedAnswer !== undefined) {
    if (storedAnswer !== null) {
      answerValue = storedAnswer.answer;
      roundPoints = storedAnswer.points;
    }
  }

  return {
    answer: answerValue,
    roundPoints: roundPoints,
    totalScore: player.score,
    position: findPosition(ranking, player.id),
  };
}

//=====================
//FUNCIÓ AUXILIAR: CONSTRUEIX ROUND:RESULTS PER A UN CLIENT
//NOMÉS PORTEN LA PRÒPIA RESPOSTA: LA DELS ALTRES NO ES MOSTRA
//EL RÀNQUING NO VA AQUÍ: ARRIBA A ROUND:RANKING 5 SEGONS DESPRÉS
//=====================
export function buildRoundResultsMessage(room, question, client) {
  const ranking = buildRanking(room);

  return {
    type: "round:results",
    round: room.roundIndex + 1,
    totalRounds: room.totalRounds,
    correctAnswer: question.correctAnswer,
    unit: question.unit,
    explanation: question.explanation,
    you: buildYou(room, client, ranking),
  };
}

//=====================
//FUNCIÓ AUXILIAR: CONSTRUEIX ROUND:RANKING PER A UN CLIENT
//EL SERVIDOR L'ENVIA QUAN HAN PASSAT ELS 5 SEGONS: EL CLIENT NO PORTA CAP COMPTE ENRERE
//=====================
export function buildRoundRankingMessage(room, client) {
  const ranking = buildRanking(room);

  //EL BLOC PERSONAL TAMBÉ ÉS EL DEL JUGADOR OBSERVAT
  const player = resolvePlayerForClient(room, client);

  let you = null;
  if (player !== null) {
    you = {
      position: findPosition(ranking, player.id),
      totalScore: player.score,
    };
  }

  return {
    type: "round:ranking",
    round: room.roundIndex + 1,
    totalRounds: room.totalRounds,
    you: you,
    ranking: ranking,
  };
}

//=====================
//FUNCIÓ AUXILIAR: CONSTRUEIX GAME:FINISHED PER A UN CLIENT
//=====================
export function buildGameFinishedMessage(room, client) {
  const ranking = buildRanking(room);

  //EL BLOC PERSONAL TAMBÉ ÉS EL DEL JUGADOR OBSERVAT
  const player = resolvePlayerForClient(room, client);

  let you = null;
  if (player !== null) {
    you = {
      position: findPosition(ranking, player.id),
      score: player.score,
    };
  }

  return {
    type: "game:finished",
    roomId: room.roomId,
    you: you,
    ranking: ranking,
  };
}

//=====================
//FUNCIÓ AUXILIAR: ENVIA UN ERROR DE RONDA
//=====================
export function sendRoundError(ws, messageText) {
  const dades = JSON.stringify({
    type: "round:error",
    message: messageText,
  });

  safeSend(ws, dades);
}

//=====================
//FUNCIÓ AUXILIAR: ENVIA UN ERROR DEL BOTÓ DE SEGÜENT
//=====================
export function sendRoundNextError(ws, messageText) {
  const dades = JSON.stringify({
    type: "round:next:error",
    message: messageText,
  });

  safeSend(ws, dades);
}
