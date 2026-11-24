//ARXIU QUE GESTIONA L'UNIÓ D'UN JUGADOR A UNA SALA

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { addRoomParticipant } from "../repositories/roomRepository.js";
import { buildLobbyState } from "./lobbyState.js";
import { pool } from "../db/pool.js";

//COLOR D'AVATAR DE L'USUARI REGISTRAT (ELS GUESTS NO EN TENEN)
export async function findAvatarColor(userId) {
  if (!userId) {
    return null;
  }
  try {
    const [rows] = await pool.execute("SELECT avatar_color FROM usuaris WHERE id = ? LIMIT 1", [userId]);
    return rows.length > 0 ? rows[0].avatar_color : null;
  } catch (error) {
    console.error("No s'ha pogut llegir el color d'avatar:", error.message);
    return null;
  }
}

//=====================
//CONSTANTS
//=====================
const forbiddenWords = ["admin", "hack", "spam"];

export function findPrivateRoomId(password) {
  if (typeof password !== "string") {
    return null;
  }
  if (!/^\d{6}$/.test(password)) {
    return null;
  }
  for (const [roomId, room] of roomStorage.members) {
    if (room.isPrivate === true) {
      if (room.password === password) {
        return roomId;
      }
    }
  }
  return null;
}

//=====================
//FUNCIÓ AUXILIAR: COMPROVA SI EL VALOR CONTÉ PARAULES PROHIBIDES
//=====================
function containsForbiddenWord(value, words) {
  const normalized = value.toLowerCase().trim();

  let hasForbidden = false;
  for (const word of words) {
    if (normalized.includes(word.toLowerCase().trim())) {
      hasForbidden = true;
      break;
    }
  }
  return hasForbidden;
}

//=====================
//FUNCIÓ PRINCIPAL: GESTIONA L'ENTRADA A UNA SALA
//=====================
export async function joinRoom({ roomId, nickname, identity, password }) {
  //VALIDACIÓ PARÀMETRES OBLIGATORIS
  let validationError = null;

  if (typeof roomId !== "string") {
    validationError = "Falten el codi de la sala o el nom d'usuari";
  } else if (typeof nickname !== "string") {
    validationError = "Falten el codi de la sala o el nom d'usuari";
  } else if (identity === undefined) {
    validationError = "Falten el codi de la sala o el nom d'usuari";
  } else if (identity === null) {
    validationError = "Falten el codi de la sala o el nom d'usuari";
  } else if (typeof identity.id !== "string") {
    validationError = "Falten el codi de la sala o el nom d'usuari";
  } else if (identity.id === "") {
    validationError = "Falten el codi de la sala o el nom d'usuari";
  }

  if (validationError !== null) {
    return { ok: false, reason: validationError };
  }

  //NETEJEM ESPAIS EN BLANC
  const cleanRoomId = roomId.trim();
  const cleanNickname = nickname.trim();

  //ROOMID O NICKNAME BUITS
  if (cleanRoomId === "") {
    return {
      ok: false,
      reason: "El codi de la sala o el nom d'usuari són buits",
    };
  }
  if (cleanNickname === "") {
    return {
      ok: false,
      reason: "El codi de la sala o el nom d'usuari són buits",
    };
  }

  //RECUPEREM LA SALA
  const room = roomStorage.members.get(cleanRoomId);

  //SALA NO EXISTEIX
  if (room === undefined) {
    return { ok: false, reason: "La sala no existeix" };
  }

  //RECONNEXIÓ: SI EL JUGADOR JA ESTÀ A LA SALA, PERMETEM TORNAR SENSE DEMANAR PASSWORD
  //VA ABANS DEL CONTROL DE SALA PLENA I DEL DE PASSWORD: JA HI ERA I NO OCUPA PLAÇA NOVA
  if (room.players.has(identity.id)) {
    //TORNAM L'ESTAT ACTUAL DE LA SALA SENSE MODIFICAR RES NI CANVIAR EL ROL
    const lobby = buildLobbyState(room);
    const existingPlayer = room.players.get(identity.id);

    let currentRole = existingPlayer.role;
    if (currentRole === undefined) {
      currentRole = "player";
    }
    if (currentRole === null) {
      currentRole = "player";
    }

    let passwordValor = null;
    if (room.isPrivate === true) {
      passwordValor = room.password;
    }

    return {
      ok: true,
      roomId: cleanRoomId,
      players: lobby.players,
      hostId: room.hostId,
      nameRoom: room.nameRoom,
      maxPlayers: room.maxPlayers,
      role: currentRole,
      isPrivate: room.isPrivate,
      password: passwordValor,
      category: room.category,
      difficulty: room.difficulty,
      rounds: room.rounds,
      state: lobby.state,
      durationSeconds: lobby.durationSeconds,
      readyCount: lobby.readyCount,
      readyRequired: lobby.readyRequired,
      canStart: lobby.canStart,
      reconnected: true,
    };
  }

  //SALA PLENA (NOMÉS PER NOUS MEMBRES: ELS ESPECTADORS TAMBÉ OCUPEN PLAÇA)
  if (room.players.size >= room.maxPlayers) {
    return { ok: false, reason: "La sala és plena" };
  }

  //SALA PRIVADA: COMPROVEM PASSWORD TAMBÉ PER ALS ESPECTADORS
  if (room.isPrivate === true) {
    if (password === undefined) {
      return { ok: false, reason: "No has introduït la contrasenya" };
    }
    if (password === null) {
      return { ok: false, reason: "No has introduït la contrasenya" };
    }
    if (password === "") {
      return { ok: false, reason: "No has introduït la contrasenya" };
    }
    if (password !== room.password) {
      return { ok: false, reason: "La contrasenya de la sala és incorrecta" };
    }
  }

  //NICKNAME EN ÚS
  let nicknameInUse = false;
  for (const player of room.players.values()) {
    if (player.nickname === cleanNickname) {
      nicknameInUse = true;
      break;
    }
  }

  if (nicknameInUse === true) {
    return { ok: false, reason: "Aquest nom d'usuari ja està en ús" };
  }

  //LONGITUD NICKNAME
  let curt = false;
  let llarg = false;
  if (cleanNickname.length < 3) {
    curt = true;
  }
  if (cleanNickname.length > 15) {
    llarg = true;
  }
  if (curt === true) {
    return {
      ok: false,
      reason: "El nom d'usuari ha de tenir entre 3 i 15 caràcters",
    };
  }
  if (llarg === true) {
    return {
      ok: false,
      reason: "El nom d'usuari ha de tenir entre 3 i 15 caràcters",
    };
  }

  //CARÀCTERS PERMESOS
  const regexNickname = /^[a-zA-Z0-9_]+$/;
  const teCaractersInvalids = regexNickname.test(cleanNickname) === false;
  if (teCaractersInvalids === true) {
    return {
      ok: false,
      reason: "El nom d'usuari només pot contenir lletres i números",
    };
  }

  //PARAULES PROHIBIDES
  if (containsForbiddenWord(cleanNickname, forbiddenWords)) {
    return { ok: false, reason: "El nom d'usuari conté paraules no permeses" };
  }

  //AL LOBBY TOTHOM JUGA; A PARTIR DE 'PLAYING' O 'FINISHED' NOMÉS ES POT ENTRAR D'ESPECTADOR
  let role = "player";

  if (room.state === "lobby") {
    role = "player";
  } else if (room.state === "playing") {
    role = "observer";
  } else if (room.state === "finished") {
    role = "observer";
  } else {
    return { ok: false, reason: "La partida ja ha començat" };
  }

  //ELS ESPECTADORS NO S'HAN DE DESAR A participant
  if (role === "player") {
    //CONFIRMEM L'ESTAT I LA CAPACITAT A LA BD ABANS D'ACTUALITZAR LA MEMÒRIA
    try {
      await addRoomParticipant({
        roomId: cleanRoomId,
        nickname: cleanNickname,
      });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return { ok: false, reason: "Aquest nom d'usuari ja està en ús" };
      }
      if (
        ["ROOM_NOT_FOUND", "ROOM_NOT_WAITING", "ROOM_FULL"].includes(error.code)
      ) {
        return { ok: false, reason: error.message };
      }
      throw error;
    }
  }

  const avatarColor = await findAvatarColor(identity.userId);

  //AFEGIM EL MEMBRE A LA SALA
  room.players.set(identity.id, {
    id: identity.id,
    nickname: cleanNickname,
    score: 0,
    ready: false,
    role: role,
    userId: identity.userId || null,
    avatarColor: avatarColor,
  });

  //RETORNEM RESPOSTA D'ÈXIT
  const lobby = buildLobbyState(room);

  let passwordValor = null;
  if (room.isPrivate === true) {
    passwordValor = room.password;
  }

  return {
    ok: true,
    roomId: cleanRoomId,
    players: lobby.players,
    hostId: room.hostId,
    nameRoom: room.nameRoom,
    maxPlayers: room.maxPlayers,
    role: role,
    isPrivate: room.isPrivate,
    password: passwordValor,
    category: room.category,
    difficulty: room.difficulty,
    rounds: room.rounds,
    state: lobby.state,
    durationSeconds: lobby.durationSeconds,
    readyCount: lobby.readyCount,
    readyRequired: lobby.readyRequired,
    canStart: lobby.canStart,
    reconnected: false,
  };
}
