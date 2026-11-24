//ARXIU QUE CENTRALITZA ELS ESDEVENIMENTS DE RONDA I DE FI DE PARTIDA

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import {
  broadcastToRoom,
  broadcastToRoomEach,
} from "../connections/broadcast.js";
import {
  openRound,
  closeRound,
  isRoundComplete,
  setGameFinished,
  resetGame,
  RANKING_DELAY_MS,
  NEXT_ROUND_DELAY_MS,
  FINAL_RANKING_DELAY_MS,
} from "./roundEngine.js";
import {
  buildRoundStartedMessage,
  buildRoundResultsMessage,
  buildRoundRankingMessage,
  buildGameFinishedMessage,
} from "./sendRound.js";
import { sendRoomPlayers } from "../rooms/sendRoomPlayers.js";
import {
  openRoundRecord, closeRoundRecord, finishGameRecord, resetAbandonedGameRecord,
  getCorrectRoundsByNickname,
} from "./persistence/gameRepository.js";
import { enqueueRoom } from "../rooms/roomQueue.js";
import { reportGameStats } from "./reportStats.js";
import { broadcastRoomsList } from "../rooms/roomsListHandler.js";
import { enviaAdminLive } from "../admin/adminLive.js";
import { revalidateRoomAgainstCatalog } from "../catalog/catalogOptions.js";

//=====================
//FUNCIÓ AUXILIAR: PROGRAMA UNA OPERACIÓ DE RONDA AMB RETARD
//=====================
function executaEnqueueRoom(roomId, operation) {
  function gestionaErrorOperacio(error) {
    console.error("Error en l'operació de la partida:", error);
    broadcastToRoom(roomId, { type: "round:error", message: "No s'ha pogut actualitzar la partida." });
    const room = roomStorage.members.get(roomId);
    if (room === undefined) {
      return;
    }
    if (room.state !== "playing") {
      return;
    }
    if (room.roundTimer !== null) {
      return;
    }
    if (room.roundTimer !== undefined) {
      return;
    }
    room.roundTimer = scheduleRoomOperation(roomId, operation, 5000);
  }
  enqueueRoom(roomId, operation).catch(gestionaErrorOperacio);
}

function scheduleRoomOperation(roomId, operation, delay) {
  return setTimeout(executaEnqueueRoom, delay, roomId, operation);
}

//=====================
//FUNCIÓ AUXILIAR: CANCEL·LA EL TEMPORITZADOR DE LA SALA
//=====================
function clearRoundTimer(room) {
  if (room.roundTimer === undefined || room.roundTimer === null) {
    return;
  }
  clearTimeout(room.roundTimer);
  room.roundTimer = null;
}

//=====================
//FUNCIÓ AUXILIAR: APLICA EL RÀNQUING DE LA BD ALS JUGADORS DE LA SALA
//RETORNA UN ARRAY AMB POSICIÓ, ID, NICKNAME I SCORE DE CADA ENTRADA
//=====================
function applyRanking(room, ranking) {
  const players = new Map();

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
    players.set(player.nickname, player);
  }

  const resultat = [];

  for (let index = 0; index < ranking.length; index += 1) {
    const entry = ranking[index];
    const player = players.get(entry.nickname);
    const score = Number(entry.score);
    const position = index + 1;

    if (player === null) {
      console.error(`Participant de la BD absent de la sala: ${entry.nickname}`);
      const idParticipant = `participant_${entry.participant_id}`;
      resultat.push({ position: position, id: idParticipant, participantId: entry.participant_id, nickname: entry.nickname, score: score });
      continue;
    }
    if (player === undefined) {
      console.error(`Participant de la BD absent de la sala: ${entry.nickname}`);
      const idParticipant = `participant_${entry.participant_id}`;
      resultat.push({ position: position, id: idParticipant, participantId: entry.participant_id, nickname: entry.nickname, score: score });
      continue;
    }

    player.score = score;
    resultat.push({
      position: position,
      id: player.id,
      participantId: entry.participant_id,
      nickname: entry.nickname,
      score: score,
      userId: player.userId || null,
      avatarColor: player.avatarColor || null,
    });
  }

  return resultat;
}

//=====================
//FUNCIÓ AUXILIAR: CONSTRUEIX ELS NICKNAMES DELS JUGADORS DE LA SALA
//=====================
function buildPlayerNicknames(room) {
  const nicknames = [];
  for (const player of room.players.values()) {
    nicknames.push(player.nickname);
  }
  return nicknames;
}

//=====================
//FUNCIÓ: OBRE LA RONDA SEGÜENT
//=====================
export async function startRound(roomId, existingRoundId) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return;
  }

  if (room.state !== "playing") {
    return;
  }

  const nextId = room.questionOrder[room.roundIndex + 1];

  //SENSE PREGUNTA NO HI HA RONDA: LA PARTIDA S'HA ACABAT
  if (nextId === undefined) {
    await finishGame(roomId);
    return;
  }

  //SI NO ENS PASSEN UN ROUNDID, EN DEMANEM UN DE NOU A LA BD
  let roundId;
  if (existingRoundId === null) {
    roundId = await openRoundRecord(roomId, nextId, room.roundIndex + 2);
  } else if (existingRoundId === undefined) {
    roundId = await openRoundRecord(roomId, nextId, room.roundIndex + 2);
  } else {
    roundId = existingRoundId;
  }

  const question = openRound(room);
  room.currentRoundId = roundId;

  const operacioTemporitzador = creaOperacioFinishRound(roomId);
  clearRoundTimer(room);
  room.roundTimer = scheduleRoomOperation(roomId, operacioTemporitzador, room.roundDurationMs);

  //TOTHOM REB LA PREGUNTA: L'OBSERVADOR LA MIRA, PERÒ NO POT RESPONDRE
  broadcastToRoom(roomId, buildRoundStartedMessage(room, question));
}

function creaOperacioFinishRound(roomId) {
  async function operacioFinishRound() {
    await finishRound(roomId);
  }
  return operacioFinishRound;
}

//=====================
//FUNCIÓ: TANCA LA RONDA I ENVIA ELS RESULTATS
//NO OBRE LA SEGÜENT: ALS 5 SEGONS S'ENVIA EL RÀNQUING I DESPRÉS S'ESPERA EL HOST
//=====================
export async function finishRound(roomId) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return;
  }

  if (room.state !== "playing") {
    return;
  }

  //JA TANCADA (TEMPORITZADOR I TOTHOM RESPOST PODEN COINCIDIR)
  if (room.roundOpen === false) {
    return;
  }

  clearRoundTimer(room);

  let result;
  try {
    const question = room.questionsById.get(room.currentQuestionId);
    result = await closeRoundRecord(room.currentRoundId, question);
  } catch (error) {
    const operacioReintent = creaOperacioFinishRound(roomId);
    clearRoundTimer(room);
    room.roundTimer = scheduleRoomOperation(roomId, operacioReintent, 5000);
    throw error;
  }

  const question = closeRound(room);

  const players = new Map();
  let jugadorsIterator;
  if (room.gamePlayers === null) {
    jugadorsIterator = room.players.values();
  } else if (room.gamePlayers === undefined) {
    jugadorsIterator = room.players.values();
  } else {
    jugadorsIterator = room.gamePlayers.values();
  }
  for (const player of jugadorsIterator) {
    players.set(player.nickname, player);
  }

  for (const answer of result.scoredAnswers) {
    const player = players.get(answer.nickname);
    if (player === null) {
      continue;
    }
    if (player === undefined) {
      continue;
    }
    const stored = room.roundAnswers.get(player.id);
    if (stored === null) {
      continue;
    }
    if (stored === undefined) {
      continue;
    }
    stored.points = answer.points;
  }

  room.currentRanking = applyRanking(room, result.ranking);

  //CADA CLIENT REP EL SEU RESULTAT (SENSE EL RÀNQUING)
  broadcastToRoomEach(roomId, construeixMissatgeResultatsRonda(room, question));

  //AL CAP DE 5 SEGONS S'ENVIA EL RÀNQUING: EL CLIENT NO PORTA CAP COMPTE ENRERE
  const operacioRanking = creaOperacioShowRanking(roomId);
  clearRoundTimer(room);
  room.roundTimer = scheduleRoomOperation(roomId, operacioRanking, RANKING_DELAY_MS);
}

function construeixMissatgeResultatsRonda(room, question) {
  function missatgePerClient(client) {
    //ELS RESULTATS SÓN PER A TOTHOM; EL BLOC PERSONAL EL RESOL buildYou
    return buildRoundResultsMessage(room, question, client);
  }
  return missatgePerClient;
}

function creaOperacioShowRanking(roomId) {
  function operacioShowRanking() {
    showRanking(roomId);
  }
  return operacioShowRanking;
}

//=====================
//FUNCIÓ: ENVIA EL RÀNQUING I ARMA L'AVANÇ AUTOMÀTIC
//LA CRIDA EL TEMPORITZADOR DE 5 SEGONS
//=====================
export function showRanking(roomId) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return;
  }

  if (room.state !== "playing") {
    return;
  }

  //SI LA RONDA JA S'HA REOBERT, AQUEST RÀNQUING JA NO TOCA
  if (room.roundOpen === true) {
    return;
  }

  //SI ENS CRIDEN DIRECTAMENT, EL TEMPORITZADOR DE 5 SEGONS JA NO HA DE SALTAR
  clearRoundTimer(room);
  room.rankingVisible = true;

  //CADA CLIENT REP LA SEVA POSICIÓ I EL RÀNQUING COMPLET
  broadcastToRoomEach(roomId, construeixMissatgeRanking(room));

  //SI EL HOST NO FA RES, LA RONDA SEGÜENT ARRIBA SOLA AL CAP DE NEXT_ROUND_DELAY_MS
  const operacioNextRound = creaOperacioNextRound(roomId);
  clearRoundTimer(room);
  room.roundTimer = scheduleRoomOperation(roomId, operacioNextRound, NEXT_ROUND_DELAY_MS);
}

function construeixMissatgeRanking(room) {
  function missatgePerClient(client) {
    return buildRoundRankingMessage(room, client);
  }
  return missatgePerClient;
}

function creaOperacioNextRound(roomId) {
  async function operacioNextRound() {
    await nextRound(roomId);
  }
  return operacioNextRound;
}

//=====================
//FUNCIÓ: OBRE LA RONDA SEGÜENT O ACABA LA PARTIDA
//LA CRIDEN EL TEMPORITZADOR DE NEXT_ROUND_DELAY_MS I EL HANDLER DE ROUND:NEXT
//=====================
export async function nextRound(roomId) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return;
  }

  if (room.state !== "playing") {
    return;
  }

  //SI LA RONDA ENCARA ÉS OBERTA, NO HI HA RES A AVANÇAR
  if (room.roundOpen === true) {
    return;
  }

  clearRoundTimer(room);
  room.rankingVisible = false;

  //ERA L'ÚLTIMA RONDA: LA PARTIDA S'ACABA
  if (room.roundIndex + 1 >= room.totalRounds) {
    await finishGame(roomId);
    return;
  }

  await startRound(roomId);
}

//=====================
//FUNCIÓ: TANCA LA PARTIDA I ENVIA EL RÀNQUING FINAL
//=====================
export async function finishGame(roomId) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return;
  }

  if (room.state !== "playing") {
    return;
  }

  clearRoundTimer(room);
  room.rankingVisible = false;

  const ranking = await finishGameRecord(roomId);
  room.finalRanking = applyRanking(room, ranking);
  setGameFinished(room);

  //GUARDEM LES ESTADÍSTIQUES DELS USUARIS REGISTRATS SENSE BLOQUEJAR EL FINAL DE PARTIDA
  getCorrectRoundsByNickname(roomId)
    .then((correct) => reportaTotesLesEstadistiques(room, roomId, correct))
    .catch((error) => console.error("Error guardant estadístiques:", error));

  broadcastToRoom(roomId, {
    type: "room:state",
    roomId: roomId,
    state: "finished",
  });

  //ACTUALITZEM L'ESTAT DE LA SALA AL LLISTAT DEL LOBBY
  broadcastRoomsList();

  //CADA CLIENT REP LA SEVA POSICIÓ I EL RÀNQUING COMPLET
  broadcastToRoomEach(roomId, construeixMissatgeFiPartida(room));

  //EL DASHBOARD HA DE VEURE LA SALA ACABADA: HO PUBLIQUEM AQUI PERQUE TOTS ELS CAMINS HI PASSEN
  enviaAdminLive();

  //AL CAP DE 15 SEGONS LA SALA TORNA AL LOBBY PER PODER TORNAR A JUGAR
  const operacioTornarLobby = creaOperacioReturnToLobby(roomId);
  clearRoundTimer(room);
  room.roundTimer = scheduleRoomOperation(roomId, operacioTornarLobby, FINAL_RANKING_DELAY_MS);
}

function construeixMissatgeFiPartida(room) {
  function missatgePerClient(client) {
    return buildGameFinishedMessage(room, client);
  }
  return missatgePerClient;
}

function creaOperacioReturnToLobby(roomId) {
  async function operacioReturnToLobby() {
    await returnToLobby(roomId);
  }
  return operacioReturnToLobby;
}

//=====================
//FUNCIÓ AUXILIAR: REPORTA CADA JUGADOR AL STATS-SERVICE
//=====================
async function reportaTotesLesEstadistiques(room, roomId, correct) {
  let nomSala = room.nameRoom;
  if (nomSala === undefined || nomSala === null || nomSala === "") {
    nomSala = roomId;
  }

  //RONDES JUGADES DE VERITAT: L'ÚLTIM ÍNDEX OBERT MÉS U
  let rondes = room.roundIndex + 1;
  if (rondes < 0) {
    rondes = 0;
  }

  for (let i = 0; i < room.finalRanking.length; i++) {
    const entry = room.finalRanking[i];

    //NOMÉS ELS USUARIS REGISTRATS TENEN ESTADÍSTIQUES
    if (entry.userId === undefined || entry.userId === null) {
      continue;
    }

    let encerts = correct.get(entry.nickname);
    if (encerts === undefined) {
      encerts = 0;
    }

    await reportGameStats({
      userId: entry.userId,
      nomSala: nomSala,
      categoria: room.category,
      posicio: entry.position,
      encerts: encerts,
      rondes: rondes,
    });
  }
}

//=====================
//FUNCIÓ: TORNA AL LOBBY DESPRÉS DEL RÀNQUING FINAL
//REUTILITZA EL MATEIX CODI DE SALA: LA PARTIDA DE LA BD HA DE TORNAR A 'esperant'
//=====================
export async function returnToLobby(roomId) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return;
  }

  //SI JA S'HA TORNAT AL LOBBY (PER EXEMPLE, HAN MARXAT TOTS), NO FEM RES
  if (room.state !== "finished") {
    return;
  }

  clearRoundTimer(room);

  const nicknames = buildPlayerNicknames(room);

  try {
    await resetAbandonedGameRecord(roomId, nicknames);
  } catch (error) {
    //MANTENIM EL RÀNQUING I HO REINTENTEM: LA SALA NO POT QUEDAR A MITGES
    const operacioReintent = creaOperacioReturnToLobby(roomId);
    clearRoundTimer(room);
    room.roundTimer = scheduleRoomOperation(roomId, operacioReintent, 5000);
    throw error;
  }

  //CONFIGURACIÓ INTACTA: resetGame NOMÉS TOCA ROLS, READY, SCORE I ESTAT DE PARTIDA
  resetGame(room);

  //SI EL CATALEG HA CANVIAT MENTRE LA PARTIDA, AJUSTEM LA SALA AL LOBBY
  await revalidateRoomAgainstCatalog(roomId);

  broadcastToRoom(roomId, {
    type: "room:state",
    roomId: roomId,
    state: "lobby",
  });

  //EL CLIENT REB LA CONFIGURACIÓ DE LA SALA I TORNA A VEURE EL SETUP
  broadcastRoomsList();
  sendRoomPlayers(roomId);

  //LA SALA TORNA AL LOBBY: EL DASHBOARD HO HA DE VEURE
  enviaAdminLive();
}

//=====================
//FUNCIÓ: TANCA LA RONDA SI TOTS ELS JUGADORS HAN RESPOST
//=====================
export async function closeRoundIfAllAnswered(roomId) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return;
  }

  if (room.state !== "playing") {
    return;
  }

  const rodadaCompleta = isRoundComplete(room);
  if (rodadaCompleta === false) {
    return;
  }

  await finishRound(roomId);
}

//=====================
//FUNCIÓ: SI NO QUEDA CAP JUGADOR, LA SALA TORNA AL LOBBY
//=====================
export async function resetToLobbyIfNoPlayers(roomId) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return;
  }

  if (room.state !== "playing") {
    if (room.state !== "finished") {
      return;
    }
  }

  //SI QUEDA ALGUN JUGADOR, LA PARTIDA CONTINUA
  for (const member of room.players.values()) {
    if (member.role === "player") {
      return;
    }
  }

  clearRoundTimer(room);

  const nicknames = buildPlayerNicknames(room);

  try {
    await resetAbandonedGameRecord(roomId, nicknames);
  } catch (error) {
    const operacioReintent = creaOperacioResetLobby(roomId);
    clearRoundTimer(room);
    room.roundTimer = scheduleRoomOperation(roomId, operacioReintent, 5000);
    throw error;
  }

  resetGame(room);

  //SI EL CATALEG HA CANVIAT MENTRE LA PARTIDA, AJUSTEM LA SALA AL LOBBY
  await revalidateRoomAgainstCatalog(roomId);

  broadcastToRoom(roomId, {
    type: "room:state",
    roomId: roomId,
    state: "lobby",
  });

  //REFRESQUEM EL LOBBY: NOU HOST, ROLS I COMENÇAR DE ZERO
  broadcastRoomsList();
  sendRoomPlayers(roomId);

  //LA SALA TORNA AL LOBBY: EL DASHBOARD HO HA DE VEURE
  enviaAdminLive();
}

function creaOperacioResetLobby(roomId) {
  async function operacioResetLobby() {
    await resetToLobbyIfNoPlayers(roomId);
  }
  return operacioResetLobby;
}
