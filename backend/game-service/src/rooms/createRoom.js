//ARXIU QUE GESTIONA LA CREACIÓ D'UNA SALA

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { randomBytes, randomInt } from "node:crypto";
import { createRoomRecord } from "../repositories/roomRepository.js";
import { buildLobbyState } from "./lobbyState.js";
import { findAvatarColor } from "./joinRoom.js";
import { normalizeText } from "../utils/normalizeText.js";
import {
  isRoomNameTaken,
  reserveRoomName,
  releaseRoomName,
} from "./roomNames.js";

//=====================
//CONSTANTS I VARIABLES GLOBALS
//=====================
const forbiddenWords = ["admin", "hack", "spam"];

//=====================
//FUNCIÓ AUXILIAR: COMPROVA SI EL VALOR CONTÉ PARAULES PROHIBIDES
//=====================
function containsForbiddenWord(value) {
  const normalized = normalizeText(value);

  let hasForbidden = false;
  for (const word of forbiddenWords) {
    if (normalized.includes(word)) {
      hasForbidden = true;
      break;
    }
  }
  return hasForbidden;
}

//=====================
//FUNCIÓ PRINCIPAL: CREA UNA NOVA SALA AMB VALIDACIONS
//=====================
export async function createRoom(params) {
  const nickname = params.nickname;
  const identity = params.identity;
  const maxPlayers = params.maxPlayers;
  let isPrivate = params.isPrivate;
  const nameRoom = params.nameRoom;

  if (isPrivate === undefined) {
    isPrivate = false;
  }

  //VALIDACIONS D'ENTRADA
  let validationError = null;

  if (typeof nickname !== "string") {
    validationError =
      "Falten el nom d'usuari, el nombre màxim de jugadors o la identitat";
  } else if (maxPlayers === undefined) {
    validationError =
      "Falten el nom d'usuari, el nombre màxim de jugadors o la identitat";
  } else if (identity === undefined) {
    validationError =
      "Falten el nom d'usuari, el nombre màxim de jugadors o la identitat";
  } else if (identity === null) {
    validationError =
      "Falten el nom d'usuari, el nombre màxim de jugadors o la identitat";
  } else if (typeof identity.id !== "string") {
    validationError =
      "Falten el nom d'usuari, el nombre màxim de jugadors o la identitat";
  } else if (identity.id === "") {
    validationError =
      "Falten el nom d'usuari, el nombre màxim de jugadors o la identitat";
  }

  if (validationError !== null) {
    return {
      ok: false,
      reason: validationError,
    };
  }

  const cleanNickname = nickname.trim();

  //NICKNAME BUIT
  if (cleanNickname === "") {
    return { ok: false, reason: "El nom d'usuari no pot estar buit" };
  }

  //LONGITUD NICKNAME
  let massaCurt = false;
  let massaLlarg = false;
  if (cleanNickname.length < 3) {
    massaCurt = true;
  }
  if (cleanNickname.length > 15) {
    massaLlarg = true;
  }
  if (massaCurt === true) {
    return {
      ok: false,
      reason: "El nom d'usuari ha de tenir entre 3 i 15 caràcters",
    };
  }
  if (massaLlarg === true) {
    return {
      ok: false,
      reason: "El nom d'usuari ha de tenir entre 3 i 15 caràcters",
    };
  }

  //CARÀCTERS PERMESOS NICKNAME
  const regexNickname = /^[a-zA-Z0-9_]+$/;
  const teCaractersInvalids = regexNickname.test(cleanNickname) === false;
  if (teCaractersInvalids === true) {
    return {
      ok: false,
      reason: "El nom d'usuari només pot contenir lletres i números",
    };
  }

  //PARAULES PROHIBIDES
  if (containsForbiddenWord(cleanNickname) === true) {
    return { ok: false, reason: "El nom d'usuari conté paraules no permeses" };
  }

  //NOM DE LA SALA: SI NO S'ENVIA, FEM SERVIR EL NICKNAME
  let cleanRoomName = cleanNickname;
  if (typeof nameRoom === "string") {
    const trimmedName = nameRoom.trim();
    if (trimmedName !== "") {
      cleanRoomName = trimmedName;
    }
  }

  //LONGITUD NOM DE LA SALA
  let salaCurta = false;
  let salaLlarga = false;
  if (cleanRoomName.length < 3) {
    salaCurta = true;
  }
  if (cleanRoomName.length > 20) {
    salaLlarga = true;
  }
  if (salaCurta === true) {
    return {
      ok: false,
      reason: "El nom de la sala ha de tenir entre 3 i 20 caràcters",
    };
  }
  if (salaLlarga === true) {
    return {
      ok: false,
      reason: "El nom de la sala ha de tenir entre 3 i 20 caràcters",
    };
  }

  //CARÀCTERS PERMESOS NOM DE LA SALA
  const regexRoomName = /^[\p{L}\p{N}_ ]+$/u;
  const teCaractersInvalidsSala = regexRoomName.test(cleanRoomName) === false;
  if (teCaractersInvalidsSala === true) {
    return {
      ok: false,
      reason:
        "El nom de la sala només pot contenir lletres, números, espais i guions baixos",
    };
  }

  //PARAULES PROHIBIDES NOM DE LA SALA
  if (containsForbiddenWord(cleanRoomName) === true) {
    return {
      ok: false,
      reason: "El nom de la sala conté paraules no permeses",
    };
  }

  //NOM DE SALA ÚNIC ENTRE LES SALES ACTIVES
  if (isRoomNameTaken(cleanRoomName) === true) {
    return { ok: false, reason: "Ja existeix una sala amb aquest nom" };
  }

  //MAXPLAYERS VÀLID
  let maxPlayersNoEnter = false;
  let massaPetit = false;
  let massaGran = false;
  if (Number.isInteger(maxPlayers) === false) {
    maxPlayersNoEnter = true;
  }
  if (maxPlayers < 2) {
    massaPetit = true;
  }
  if (maxPlayers > 20) {
    massaGran = true;
  }
  if (maxPlayersNoEnter === true) {
    return {
      ok: false,
      reason: "El nombre màxim de jugadors ha de ser un enter entre 2 i 20",
    };
  }
  if (massaPetit === true) {
    return {
      ok: false,
      reason: "El nombre màxim de jugadors ha de ser un enter entre 2 i 20",
    };
  }
  if (massaGran === true) {
    return {
      ok: false,
      reason: "El nombre màxim de jugadors ha de ser un enter entre 2 i 20",
    };
  }

  //ISPRIVATE BOOLEAN
  if (typeof isPrivate !== "boolean") {
    return {
      ok: false,
      reason: "El camp de partida privada ha de ser cert o fals",
    };
  }

  const reservedRoomName = reserveRoomName(cleanRoomName);
  let roomId;
  let saved = false;
  try {
    let attempt = 0;
    while (attempt < 3) {
      if (saved === true) {
        break;
      }
      roomId = `sala_${randomBytes(5).toString("hex")}`;
      try {
        await createRoomRecord({
          roomId: roomId,
          isPrivate: isPrivate,
          maxPlayers: maxPlayers,
          nickname: cleanNickname,
        });
        saved = true;
      } catch (error) {
        let esDuplicat = false;
        if (error.code === "ER_DUP_ENTRY") {
          esDuplicat = true;
        }
        let esUltimIntent = false;
        if (attempt === 2) {
          esUltimIntent = true;
        }
        if (esDuplicat === false) {
          throw error;
        }
        if (esUltimIntent === true) {
          throw error;
        }
      }
      attempt = attempt + 1;
    }
  } finally {
    releaseRoomName(reservedRoomName);
  }

  let password = null;
  if (isPrivate === true) {
    let contrasenyaDuplicada = true;
    while (contrasenyaDuplicada === true) {
      password = String(randomInt(100000, 1000000));
      contrasenyaDuplicada = false;
      for (const room of roomStorage.members.values()) {
        if (room.password === password) {
          contrasenyaDuplicada = true;
          break;
        }
      }
    }
  }

  //CREEM L'OBJECTE SALA DESPRÉS DE GUARDAR LA PARTIDA I EL HOST
  const hostAvatarColor = await findAvatarColor(identity.userId);
  const room = {
    roomId: roomId,
    players: new Map([
      [
        identity.id,
        {
          id: identity.id,
          nickname: cleanNickname,
          score: 0,
          ready: false,
          role: "player",
          userId: identity.userId || null,
          avatarColor: hostAvatarColor,
        },
      ],
    ]),
    hostId: identity.id,
    maxPlayers: maxPlayers,
    isPrivate: isPrivate,
    password: password,
    nameRoom: cleanRoomName,
    category: "mix",
    difficulty: "mix",
    rounds: 5,
    totalRounds: 5,
    roundDurationMs: 20000,
    state: "lobby",

    //EL XAT VIU A LA MEMÒRIA DE LA SALA I MOR AMB ELLA
    chat: [],

    //ESTAT DE PARTIDA (NOMÉS VIU MENTRE state === "playing")
    questionOrder: [],
    questionsById: new Map(),
    roundIndex: -1,
    currentQuestionId: null,
    roundEndsAt: 0,
    roundAnswers: new Map(),
    roundOpen: false,
    roundTimer: null,
  };

  //GUARDEM AL MAGATZEM
  roomStorage.members.set(roomId, room);

  //RETORNEM RESULTAT
  const lobby = buildLobbyState(room);

  return {
    ok: true,
    roomId: roomId,
    hostId: room.hostId,
    nameRoom: room.nameRoom,
    category: room.category,
    difficulty: room.difficulty,
    rounds: room.rounds,
    maxPlayers: room.maxPlayers,
    isPrivate: room.isPrivate,
    password: room.password,
    players: lobby.players,
    state: lobby.state,
    durationSeconds: lobby.durationSeconds,
    readyCount: lobby.readyCount,
    readyRequired: lobby.readyRequired,
    canStart: lobby.canStart,
  };
}
