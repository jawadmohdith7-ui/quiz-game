//ARXIU QUE GESTIONA L'UNIÓ A SALA DES DEL WEBSOCKET

//=====================
//IMPORTEM
//=====================
import { joinRoom } from "./joinRoom.js";
import { sendRoomPlayers } from "./sendRoomPlayers.js";
import { broadcastRoomsList } from "./roomsListHandler.js";
import { cancelPendingLeave } from "./roomEvents.js";
import { roomStorage } from "../storage/roomStorage.js";
import {
  buildRoundStartedMessage,
  buildRoundRankingMessage,
  buildGameFinishedMessage,
  buildSpectatorRoundMessage,
} from "../game/sendRound.js";
import { sendAnswerAck } from "../game/sendAnswer.js";
import { broadcastToRoom } from "../connections/broadcast.js";
import { enviaAdminLive } from "../admin/adminLive.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//FUNCIÓ PRINCIPAL: GESTIONA EL MISSATGE ROOM:JOIN
//=====================
export async function joinRoomHandler(ws, message) {
  const roomId = message.roomId;
  const nickname = message.nickname;
  const password = message.password;

  let result;
  try {
    result = await joinRoom({
      roomId: roomId,
      nickname: nickname,
      password: password,
      identity: ws.identity,
    });
  } catch (error) {
    console.error("No s'ha pogut desar el participant a MariaDB:", error);
    const dadesError = JSON.stringify({
      type: "room:join:error",
      ok: false,
      reason: "No t'has pogut unir a la partida. Torna-ho a provar.",
    });
    safeSend(ws, dadesError);
    return;
  }

  //SI ERROR EN UNIR-SE
  if (result.ok === false) {
    const dadesError = JSON.stringify({
      type: "room:join:error",
      ok: false,
      reason: result.reason,
    });
    safeSend(ws, dadesError);
    return;
  }

  //CANCEL·LEM QUALSEVOL SORTIDA PENDENT PER AQUEST JUGADOR (RECONNEXIÓ RÀPIDA)
  if (ws.identity === null) {
    //no fem res
  } else if (ws.identity.id === undefined) {
    //no fem res
  } else {
    cancelPendingLeave(ws.identity.id);
  }

  //RECORDEM LA SALA AL WS PER PODER SORTIR-NE SI ES TANCA LA CONNEXIÓ
  ws.roomId = result.roomId;

  //1. RESPOSTA AL QUE ENTRA (JA PORTA LA LLISTA COMPLETA)
  const dadesJoined = JSON.stringify({
    type: "room:joined",
    ok: true,
    roomId: result.roomId,
    nameRoom: result.nameRoom,
    isPrivate: result.isPrivate,
    password: result.password,
    category: result.category,
    difficulty: result.difficulty,
    rounds: result.rounds,
    players: result.players,
    hostId: result.hostId,
    maxPlayers: result.maxPlayers,
    role: result.role,
    state: result.state,
    durationSeconds: result.durationSeconds,
    readyCount: result.readyCount,
    readyRequired: result.readyRequired,
    canStart: result.canStart,
  });
  safeSend(ws, dadesJoined);

  //SNAPSHOT DE L'ESTAT DE LA PARTIDA SEGONS EL ROL QUE ENTRA
  const room = roomStorage.members.get(result.roomId);

  if (room === undefined) {
    //sala ja no existeix, no enviem res
  } else if (room.state === "playing") {
    if (room.roundOpen === true) {
      const question = room.questionsById.get(room.currentQuestionId);

      //TOTHOM VEU LA PREGUNTA; L'OBSERVADOR NO REP ACK DE RESPOSTA
      const dadesRoundStarted = JSON.stringify(buildRoundStartedMessage(room, question));
      safeSend(ws, dadesRoundStarted);

      if (result.role === "player" && room.roundAnswers.has(ws.identity.id) === true) {
        sendAnswerAck(ws, question.id);
      }
    } else if (room.rankingVisible === true) {
      const dadesRanking = JSON.stringify(buildRoundRankingMessage(room, ws));
      safeSend(ws, dadesRanking);
    } else if (result.role === "observer") {
      const dadesSpectator = JSON.stringify(buildSpectatorRoundMessage(room.roomId));
      safeSend(ws, dadesSpectator);
    }
  } else if (room.state === "finished") {
    const dadesFinished = JSON.stringify(buildGameFinishedMessage(room, ws));
    safeSend(ws, dadesFinished);
  }

  //2. AVISSEM ELS QUE JA EREN DINS (EXCLOENT EL QUE ACABA D'ENTRAR)
  //EL QUE ENTRA JA TÉ room:joined; LA RESTA REP L'ESTAT COMPLET
  sendRoomPlayers(result.roomId, ws);

    if (result.reconnected !== true) {
      broadcastToRoom(result.roomId, {
        type: "chat:message",
        senderId: null,
        senderName: "SISTEMA",
        text: nickname + " se ha unido a la sala.",
        timestamp: Date.now(),
        system: true,
      });
    }

  //3. ACTUALITZEM EL COMPTADOR DE JUGADORS AL LOBBY
  broadcastRoomsList();

  //LA LLISTA DE SALES HA CANVIAT: HO PUBLIQUEM
  enviaAdminLive();
}
