//ARXIU QUE GESTIONA LA DECLARACIÓ D'IDENTITAT DEL CLIENT

//=====================
//IMPORTEM
//=====================
import jwt from "jsonwebtoken";
import { createGuest } from "./createGuest.js";
import { guestStorage } from "../storage/guestStorage.js";
import { normalizeText } from "../utils/normalizeText.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//TOKEN DE L'USUARI
//=====================
//AUTH-SERVICE EMET UN JWT ESTÀNDARD; EL VALIDEM AMB EL MATEIX SECRET QUE EL PANELL
//SI NO HI HA TOKEN O NO ÉS VÀLID, L'USUARI ÉS UN CONVIDAT I userId ÉS null
const AUTH_SECRET = process.env.AUTH_SECRET;

function obtenirUserId(token) {
  if (token === undefined || token === null || token === "") {
    return null;
  }

  try {
    const payload = jwt.verify(token, AUTH_SECRET, { algorithms: ["HS256"] });
    //AUTH-SERVICE POSA L'ID NUMÈRIC A sub, NO A id
    return payload.sub;
  } catch (error) {
    return null;
  }
}

//=====================
//FUNCIÓ AUXILIAR: BUSCA UN GUEST PEL NICKNAME NORMALITZAT
//=====================
function findGuestByNickname(nickname, excludeId) {
  const normalized = normalizeText(nickname);
  if (normalized === "") {
    return null;
  }

  for (const guest of guestStorage.guests.values()) {
    if (guest.id === excludeId) {
      continue;
    }
    if (normalizeText(guest.nickanme) === normalized) {
      return guest;
    }
  }

  return null;
}

//=====================
//FUNCIÓ AUXILIAR: ASSIGNA EL NICKNAME SI ESTÀ LLIURE
//=====================
function assignaNickname(guest, nickname) {
  const esString = typeof nickname === "string";
  let teContingut = false;
  if (esString === true) {
    const trimmed = nickname.trim();
    if (trimmed !== "") {
      teContingut = true;
    }
  }
  if (teContingut === true) {
    const trimmed = nickname.trim();
    const duplicate = findGuestByNickname(trimmed, guest.id);
    if (duplicate === null) {
      guest.nickanme = trimmed;
    }
  }
}

//=====================
//FUNCIÓ PRINCIPAL: GESTIONA IDENTITY:DECLARE
//=====================
export function handleIdentityDeclare(ws, message) {
  //UN SOCKET QUE JA JUGA NO POT CANVIAR D'IDENTITAT
  if (ws.roomId !== undefined && ws.roomId !== null) {
    safeSend(ws, {
      type: "identity:error",
      reason: "No pots canviar d'identitat dins d'una sala",
    });
    return;
  }

  //EXTREM LA IDENTITAT DECLARADA DEL MISSATGE
  const declaredIdentity = message.identity;

  //VALIDEM QUE EL CAMP IDENTITY EXISTEIXI
  if (declaredIdentity === null) {
    sendIdentityConfirmed(ws, null, "Camp identity obligatori");
    return;
  }
  if (declaredIdentity === undefined) {
    sendIdentityConfirmed(ws, null, "Camp identity obligatori");
    return;
  }

  const declareType = declaredIdentity.type;

  //VALIDEM EL TIPUS DE DECLARACIÓ
  if (declareType !== "restore") {
    if (declareType !== "new") {
      sendIdentityConfirmed(
        ws,
        null,
        'Tipus de declaració invàlid. Ha de ser "restore" o "new"'
      );
      return;
    }
  }

  let resolvedIdentity;

  //FLUX RESTORE: CLIENT TÉ LOCALSTORAGE AMB ID, SECRET I NICKNAME
  if (declareType === "restore") {
    //S'ACCEPTA guestId (CONTRACTE NOU) I id (CLIENTS ANTICS)
    let guestId = declaredIdentity.guestId;
    if (guestId === undefined || guestId === null) {
      guestId = declaredIdentity.id;
    }
    const nickname = declaredIdentity.nickname;

    //VALIDEM QUE TINGUI ID PER RESTORE
    if (guestId === null) {
      sendIdentityConfirmed(ws, null, "ID obligatori per declaració restore");
      return;
    }
    if (guestId === undefined) {
      sendIdentityConfirmed(ws, null, "ID obligatori per declaració restore");
      return;
    }

    //=====================
    //RECUPEREM UN CONVIDAT NOMÉS SI PORTA EL SECRET
    //=====================
    let guest = null;
    const guardat = guestStorage.guests.get(guestId);

    //SI EL CONVIDAT EXISTEIX, EL SECRET HA DE COINCIDIR
    if (guardat !== undefined && guardat !== null) {
      if (guardat.guestSecret === declaredIdentity.guestSecret) {
        guest = guardat;
      }
    }

    //SI NO HA PASSAT LA COMPROVACIÓ, EN CREEM UN DE NOU
    //AIXÍ NO ES TRENCA CAP CLIENT VELL QUE ENCARA NO TÉ SECRET
    if (guest === null) {
      guest = createGuest();
    }

    assignaNickname(guest, nickname);
    resolvedIdentity = guest;
  } else {
    //FLUX NEW: CLIENT SENSE LOCALSTORAGE, CREEM NOU GUEST
    resolvedIdentity = createGuest();
    //SI EL CLIENT ENVIA NICKNAME I ESTÀ LLIURE, L'UTILITZEM
    assignaNickname(resolvedIdentity, declaredIdentity.nickname);
  }

  //ASSIGNEM LA IDENTITAT RESOLTA AL WEBSOCKET
  //ABANS: verifyAuthToken RETORNAVA SEMPRE null PERQUÈ ESPERAVA UN ALTRE FORMAT
  resolvedIdentity.userId = obtenirUserId(declaredIdentity.token);
  resolvedIdentity.lastSeen = Date.now();
  ws.identity = resolvedIdentity;

  //ENVIEM IDENTITY:CONFIRMED AMB LA IDENTITAT COMPLETA
  sendIdentityConfirmed(ws, resolvedIdentity);
}

//=====================
//FUNCIÓ: GESTIONA LA PETICIÓ DE CANVI DE NICKNAME
//=====================
export function handleNicknameUpdate(ws, message) {
  let nickname = "";
  if (typeof message.nickname === "string") {
    nickname = message.nickname.trim();
  }

  //VALIDEM QUE EL WEBSOCKET TENGUI IDENTITAT
  if (ws.identity === null) {
    const dades = JSON.stringify({
      type: "nickname:error",
      message: "El nom d'usuari ha de tenir entre 3 i 15 lletres, números o guions baixos",
    });
    safeSend(ws, dades);
    return;
  }
  if (ws.identity === undefined) {
    const dades = JSON.stringify({
      type: "nickname:error",
      message: "El nom d'usuari ha de tenir entre 3 i 15 lletres, números o guions baixos",
    });
    safeSend(ws, dades);
    return;
  }

  //VALIDEM EL FORMAT DEL NICKNAME
  const regex = /^[a-zA-Z0-9_]{3,15}$/;
  const esValid = regex.test(nickname);
  if (esValid === false) {
    const dades = JSON.stringify({
      type: "nickname:error",
      message: "El nom d'usuari ha de tenir entre 3 i 15 lletres, números o guions baixos",
    });
    safeSend(ws, dades);
    return;
  }

  //NO ES POT CANVIAR EL NICKNAME DINS D'UNA SALA
  if (ws.roomId !== null) {
    if (ws.roomId !== undefined) {
      const dades = JSON.stringify({
        type: "nickname:error",
        message: "No es pot canviar el nom d'usuari dins d'una sala",
      });
      safeSend(ws, dades);
      return;
    }
  }

  //COMPROVEM QUE EL NICKNAME NO ESTIGUI AGAFAT
  const duplicate = findGuestByNickname(nickname, ws.identity.id);
  if (duplicate !== null) {
    const dades = JSON.stringify({
      type: "nickname:error",
      message: "Aquest nom d'usuari ja existeix",
    });
    safeSend(ws, dades);
    return;
  }

  //ACTUALITZEM EL NICKNAME I ENVIEM CONFIRMACIÓ
  ws.identity.nickanme = nickname;
  const dades = JSON.stringify({ type: "nickname:updated", nickname: nickname });
  safeSend(ws, dades);
}

//=====================
//FUNCIÓ AUXILIAR: ENVIA IDENTITY:CONFIRMED
//=====================
function sendIdentityConfirmed(ws, identity, errorMessage = null) {
  let haError = false;
  if (errorMessage === null) {
    haError = false;
  } else if (errorMessage === undefined) {
    haError = false;
  } else {
    haError = true;
  }

  if (haError === true) {
    const dades = JSON.stringify({
      type: "identity:confirmed",
      error: errorMessage,
    });
    safeSend(ws, dades);
  } else {
    //CONSTRUÏM L'OBJECTE IDENTITY
    let nicknameValue = null;
    if (identity.nickanme === null) {
      nicknameValue = null;
    } else if (identity.nickanme === undefined) {
      nicknameValue = null;
    } else {
      nicknameValue = identity.nickanme;
    }

    const dades = JSON.stringify({
      type: "identity:confirmed",
      identity: {
        id: identity.id,
        type: identity.type,
        nickname: nicknameValue,
        guestSecret: identity.guestSecret,
      },
    });
    safeSend(ws, dades);
  }
}
