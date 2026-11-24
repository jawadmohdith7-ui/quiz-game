//ARXIU QUE GESTIONA ELS ENVIAMENTS A CLIENTS (BROADCAST)

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//ESTAT INTERN: CLIENTS CONNECTATS
//=====================
const connectedClients = new Set();

//=====================
//FUNCIÓ: REGISTRA UN NOU CLIENT
//=====================
export function registerClient(ws) {
  connectedClients.add(ws);
}

//=====================
//FUNCIÓ: ELIMINA UN CLIENT DEL LLISTAT
//=====================
export function unregisterClient(ws) {
  connectedClients.delete(ws);
}

//=====================
//FUNCIÓ: RETORNA EL NOMBRE DE CLIENTS CONNECTATS
//=====================
export function connectedCount() {
  return connectedClients.size;
}

//=====================
//FUNCIÓ: RETORNA ELS CLIENTS CONNECTATS QUE NO SON ADMINISTRADORS
//=====================
export function playersCount() {
  let total = 0;

  for (const client of connectedClients) {
    if (client.rolAdmin === "admin") {
      continue;
    }

    total = total + 1;
  }

  return total;
}

//=====================
//FUNCIÓ: BROADCAST A TOTS ELS CLIENTS CONNECTATS
//=====================
export function broadcast(message) {
  const data = JSON.stringify(message);

  for (const client of connectedClients) {
    if (client.readyState !== 1) {
      continue;
    }

    safeSend(client, data);
  }
}

//=====================
//FUNCIÓ: BROADCAST EXCLOENT UN CLIENT ESPECÍFIC
//=====================
export function broadcastExcept(excludeWs, message) {
  const data = JSON.stringify(message);

  for (const client of connectedClients) {
    if (client === excludeWs) {
      continue;
    }

    if (client.readyState !== 1) {
      continue;
    }

    safeSend(client, data);
  }
}

//=====================
//FUNCIÓ: BROADCAST ALS MEMBRES D'UNA SALA ESPECÍFICA
//=====================
export function broadcastToRoom(roomId, message, excludeWs) {
  if (excludeWs === undefined) {
    excludeWs = null;
  }

  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return;
  }

  const data = JSON.stringify(message);

  //ENVIEM SEGONS EL ROOMID DE CADA CONNEXIÓ (NO VIA CLIENTSBYID: POT QUEDAR DESACTUALITZAT)
  for (const client of connectedClients) {
    if (client.roomId !== roomId) {
      continue;
    }

    if (client === excludeWs) {
      continue;
    }

    if (client.readyState !== 1) {
      continue;
    }

    safeSend(client, data);
  }
}

//=====================
//FUNCIÓ: RETORNA LA CONNEXIÓ D'UNA IDENTITAT DINS D'UNA SALA (O NULL)
//=====================
export function findRoomClient(roomId, identityId) {
  for (const client of connectedClients) {
    if (client.roomId !== roomId) {
      continue;
    }
    if (client.identity && client.identity.id === identityId) {
      return client;
    }
  }
  return null;
}

//=====================
//FUNCIÓ: BROADCAST AMB UN MISSATGE DIFERENT PER A CADA CLIENT DE LA SALA
//EL CONSTRUCTOR REP EL CLIENT I RETORNA EL SEU MISSATGE PERSONALITZAT
//=====================
export function broadcastToRoomEach(roomId, buildMessage) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return;
  }

  for (const client of connectedClients) {
    if (client.roomId !== roomId) {
      continue;
    }

    if (client.readyState !== 1) {
      continue;
    }

    //CADA CLIENT NECESSITA EL SEU PROPI JSON: ES SERIALITZA UN COP PER CLIENT
    const message = buildMessage(client);

    if (message === null) {
      continue;
    }

    const data = JSON.stringify(message);
    safeSend(client, data);
  }
}
