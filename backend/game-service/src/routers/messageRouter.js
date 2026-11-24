//ARXIU QUE ENRUTA CADA MISSATGE WS AL HANDLER CORRESPONENT SEGONS EL SEU TIPUS

//=====================
//IMPORTEM EL HANDLER DE CADA TIPUS DE MISSATGE
//=====================
import { createRoomHandler } from "../rooms/createRoomHandler.js";
import { joinRoomHandler } from "../rooms/joinRoomHandler.js";
import { findPrivateRoomId } from "../rooms/joinRoom.js";
import { leaveRoomHandler } from "../rooms/leaveRoomHandler.js";
import { kickPlayerHandler } from "../rooms/kickPlayerHandler.js";
import { roomStorage } from "../storage/roomStorage.js";
import { handleGameStart } from "../game/gameStartHandler.js";
import { handleAnswerSubmit } from "../game/answerSubmitHandler.js";
import { handleObserverSelect, handleGameplayUpdate } from "../game/observerHandler.js";
import { handleRoundNext } from "../game/roundNextHandler.js";
import { roomsListHandler } from "../rooms/roomsListHandler.js";
import { handleIdentityDeclare, handleNicknameUpdate } from "../guests/identityDeclareHandler.js";
import { roomConfigurationHandler } from "../rooms/roomConfigurationHandler.js";
import { readyHandler } from "../rooms/readyHandler.js";
import { enqueueRoom } from "../rooms/roomQueue.js";
import { broadcastToRoom } from "../connections/broadcast.js";
import { sendCatalogOptions } from "../catalog/catalogOptions.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//GESTIONA L'ERROR QUAN UNA PROMESA D'OPERACIO RETORNA REBUTJADA
//=====================
function gestioErrorOperacio(ws, error, origen) {
  console.error("Error en processar " + origen + ":", error);

  let preparatPerEnviar = false;
  if (ws.readyState === 1) {
    preparatPerEnviar = true;
  }

  if (preparatPerEnviar === true) {
    const dades = JSON.stringify({
      type: "round:error",
      message: "No s'ha pogut actualitzar la partida.",
    });
    safeSend(ws, dades);
  }
}

//=====================
//ENCOA UNA OPERACIO PER A LA SALA I GESTIONA EL REBUIG DE LA PROMESA
//=====================
function runRoomOperation(ws, roomId, operation) {
  let key;
  if (typeof roomId === "string") {
    key = roomId.trim();
  } else {
    key = "";
  }

  const promesa = enqueueRoom(key, operation);

  promesa.catch(function gestionarErrorEnQueue(error) {
    gestioErrorOperacio(ws, error, "l'operació de sala");
  });
}

//=====================
//FUNCIÓ PRINCIPAL: ENRUTA EL MISSATGE SEGONS EL SEU TIPUS
//=====================
export function routeMessage(ws, message) {
  //SI EL TIPUS ÉS CATALOG:OPTIONS
  if (message.type === "catalog:options") {
    sendCatalogOptions(ws);

    console.log("Executant sendCatalogOptions");
  }

  //SI EL TIPUS ÉS ROOM:CREATE
  else if (message.type === "room:create") {
    const promesa = createRoomHandler(ws, message);

    promesa.catch(function gestionarErrorCreate(error) {
      gestioErrorOperacio(ws, error, "room:create");
    });

    console.log("Executant createRoomHandler");
  }

  //SI EL TIPUS ÉS ROOMS:LIST
  else if (message.type === "rooms:list") {
    roomsListHandler(ws);
  }

  //SI EL TIPUS ÉS ROOM:JOIN
  else if (message.type === "room:join") {
    let roomId = message.roomId;

    let roomIdFalta = false;
    if (roomId === null) {
      roomIdFalta = true;
    }
    if (roomId === undefined) {
      roomIdFalta = true;
    }

    if (roomIdFalta === true) {
      let contrasenyaEsString = false;
      if (typeof message.password === "string") {
        contrasenyaEsString = true;
      }

      if (contrasenyaEsString === true) {
        roomId = findPrivateRoomId(message.password);

        let salaNoTrobada = true;
        if (roomId !== null) {
          if (roomId !== undefined) {
            salaNoTrobada = false;
          }
        }

        if (salaNoTrobada === true) {
          const dades = JSON.stringify({
            type: "room:join:error",
            ok: false,
            reason: "El codi de la sala privada és incorrecte",
          });
          safeSend(ws, dades);
          return;
        }
      }
    }

    const missatgeAmbRoomId = Object.assign({}, message, { roomId: roomId });

    runRoomOperation(ws, roomId, function executarJoinRoom() {
      return joinRoomHandler(ws, missatgeAmbRoomId);
    });

    console.log("Executant joinRoomHandler");
  }

  //SI EL TIPUS ÉS ROOM:LEAVE
  else if (message.type === "room:leave") {
    runRoomOperation(ws, message.roomId, function executarLeaveRoom() {
      return leaveRoomHandler(ws, message);
    });

    console.log("Executant leaveRoomHandler");
  }

  //SI EL TIPUS ÉS ROOM:CONFIGURATION
  else if (message.type === "room:configuration") {
    runRoomOperation(ws, ws.roomId, function executarConfiguracio() {
      return roomConfigurationHandler(ws, message);
    });

    console.log("Executant roomConfigurationHandler");
  }

  //SI EL TIPUS ÉS ROOM:READY
  else if (message.type === "room:ready") {
    runRoomOperation(ws, ws.roomId, function executarReady() {
      return readyHandler(ws, message);
    });

    console.log("Executant readyHandler");
  }

  //SI EL TIPUS ÉS GAME:START
  else if (message.type === "game:start") {
    runRoomOperation(ws, ws.roomId, function executarGameStart() {
      return handleGameStart(ws);
    });

    console.log("Executant gameStartHandler");
  }

  //SI EL TIPUS ÉS ANSWER:SUBMIT
  else if (message.type === "answer:submit") {
    runRoomOperation(ws, ws.roomId, function executarAnswerSubmit() {
      return handleAnswerSubmit(ws, message);
    });

    console.log("Executant handleAnswerSubmit");
  }

  //SI EL TIPUS ÉS CHAT:MESSAGE
  else if (message.type === "chat:message") {
    //=====================
    //XAT DE SALA
    //=====================
    const sala = roomStorage.members.get(ws.roomId);

    if (sala === undefined || sala === null) {
      safeSend(ws, {
        type: "chat:error",
        message: "Necessites entrar a una sala per enviar missatges.",
      });
      return;
    }

    //NOMÉS TEXT, SENSE ESPAIS AL PRINCIPI NI AL FINAL
    if (typeof message.text !== "string") {
      safeSend(ws, {
        type: "chat:error",
        message: "El missatge no pot estar buit.",
      });
      return;
    }

    const text = message.text.trim().slice(0, 200);

    if (text === "") {
      safeSend(ws, {
        type: "chat:error",
        message: "El missatge no pot estar buit.",
      });
      return;
    }

    let senderId = null;
    let senderUserId = null;
    let senderAvatarColor = null;
    let senderName = "Anònim";

    if (ws.identity !== undefined && ws.identity !== null) {
      senderId = ws.identity.id;
      senderName = ws.identity.nickanme || ws.identity.nickname || "Anònim";

      const senderPlayer = sala.players.get(ws.identity.id);
      if (senderPlayer !== undefined && senderPlayer !== null) {
        senderName = senderPlayer.nickname;
        senderUserId = senderPlayer.userId;
        senderAvatarColor = senderPlayer.avatarColor;
      }
    }

    //AFEGIM AL FINAL I RETALLEM PELS DE DALT
    sala.chat.push({ from: senderName, text: text, at: Date.now() });

    if (sala.chat.length > 50) {
      sala.chat.splice(0, sala.chat.length - 50);
    }

    //S'ENVIA A TOTHOM DE LA SALA
    broadcastToRoom(ws.roomId, {
      type: "chat:message",
      senderId: senderId,
      senderName: senderName,
      senderUserId: senderUserId,
      senderAvatarColor: senderAvatarColor,
      text: text,
      timestamp: Date.now(),
    });
  }

  //SI EL TIPUS ÉS ROOM:KICK (NOMÉS L'HOST)
  else if (message.type === "room:kick") {
    runRoomOperation(ws, ws.roomId, function executarKick() {
      return kickPlayerHandler(ws, message);
    });
  }

  //SI EL TIPUS ÉS ROUND:NEXT
  else if (message.type === "round:next") {
    runRoomOperation(ws, ws.roomId, function executarRoundNext() {
      return handleRoundNext(ws);
    });

    console.log("Executant handleRoundNext");
  }

  //SI EL TIPUS ÉS IDENTITY:DECLARE
  else if (message.type === "identity:declare") {
    handleIdentityDeclare(ws, message);

    console.log("Executant handleIdentityDeclare");
  }

  //SI EL TIPUS ÉS NICKNAME:UPDATE
  else if (message.type === "nickname:update") {
    handleNicknameUpdate(ws, message);

    console.log("Executant handleNicknameUpdate");
  }

  //SI EL TIPUS ÉS OBSERVER:SELECT
  else if (message.type === "observer:select") {
    handleObserverSelect(ws, message);
  }

  //SI EL TIPUS ÉS GAMEPLAY:UPDATE
  else if (message.type === "gameplay:update") {
    handleGameplayUpdate(ws, message);
  }

  //SI EL TIPUS NO ÉS RECONEIXUT
  else {
    const dades = JSON.stringify({
      type: "error",
      message: "Missatge enviat per el client no gestionable!",
    });
    safeSend(ws, dades);
  }
}