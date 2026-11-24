//ARXIU QUE GESTIONA EL MISSATGE GAME:START DEL CLIENT

//=====================
//IMPORTEM
//=====================
import { fetchQuestions } from "./fetchQuestions.js";
import { roomStorage } from "../storage/roomStorage.js";
import { broadcastToRoom } from "../connections/broadcast.js";
import { canStart } from "../rooms/lobbyState.js";
import { sendRoundError } from "./sendRound.js";
import { prepareGame } from "./roundEngine.js";
import { startRound } from "./roundEvents.js";
import { startGameRecord } from "./persistence/gameRepository.js";
import { sendRoomPlayers } from "../rooms/sendRoomPlayers.js";
import { broadcastRoomsList } from "../rooms/roomsListHandler.js";
import { enviaAdminLive } from "../admin/adminLive.js";

//=====================
//FUNCIÓ PRINCIPAL: GESTIONA GAME:START
//=====================
export async function handleGameStart(ws) {
  //LA SALA SEMPRE ÉS LA DEL SOCKET: EL CLIENT NO ENVIA CAP PARÀMETRE
  const room = roomStorage.members.get(ws.roomId);

  if (room === undefined) {
    sendRoundError(ws, "La sala no existeix");
    return;
  }

  //NOMÉS EL HOST POT INICIAR LA PARTIDA
  if (ws.identity === undefined) {
    sendRoundError(ws, "Només el host pot iniciar la partida");
    return;
  }

  if (ws.identity === null) {
    sendRoundError(ws, "Només el host pot iniciar la partida");
    return;
  }

  if (ws.identity.id !== room.hostId) {
    sendRoundError(ws, "Només el host pot iniciar la partida");
    return;
  }

  //UNA SALA NOMÉS POT INICIAR PARTIDA UNA VEGADA
  if (room.state !== "lobby") {
    sendRoundError(ws, "La partida ja ha començat");
    return;
  }

  //CAL QUE EL LLINDAR DE READY ESTIGUI ASSOLIT
  const potComençar = canStart(room);

  if (potComençar === false) {
    sendRoundError(ws, "Falten jugadors a punt per començar");
    return;
  }

  try {
    //LA CONFIGURACIÓ SURT DE LA SALA, NO DEL MISSATGE
    const questions = await fetchQuestions(
      room.rounds,
      room.category,
      room.difficulty,
      ws.roomId
    );

    if (questions.length === 0) {
      throw new Error("No hi ha preguntes disponibles.");
    }

    //RECOLLIM ELS OBSERVADORS (NO HOST I NO READY)
    const observers = [];

    for (const player of room.players.values()) {
      const noEsHost = player.id !== room.hostId;
      const noEstaLlest = player.ready !== true;

      if (noEsHost === false) {
        continue;
      }

      if (noEstaLlest === false) {
        continue;
      }

      observers.push(player.nickname);
    }
    const roundId = await startGameRecord(ws.roomId, questions[0].id, observers);

    //LA REGLA PURA PREPARA INDEX DE PREGUNTES, ROLS I PUNTS
    prepareGame(room, questions);

    sendRoomPlayers(ws.roomId);

    //PRIMER L'ESTAT, DESPRÉS LA PRIMERA RONDA
    broadcastToRoom(ws.roomId, {
      type: "room:state",
      roomId: ws.roomId,
      state: "playing",
    });

    //ACTUALITZEM L'ESTAT DE LA SALA AL LLISTAT DEL LOBBY
    broadcastRoomsList();

    await startRound(ws.roomId, roundId);

    //LA PARTIDA HA COMENÇAT: EL DASHBOARD HO HA DE VEURE
    enviaAdminLive();
  } catch (error) {
    //EN CAS D'ERROR LA SALA CONTINUA AL LOBBY
    sendRoundError(ws, error.message);
  }
}
