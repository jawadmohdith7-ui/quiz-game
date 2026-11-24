//ARXIU QUE GESTIONA LA CONNEXIO WEBSOCKET I ELS MISSATGES DEL JOC

//=====================
//IMPORTEM
//=====================
import { useGameStore } from "../stores/game";
import { useAdminStore } from "../stores/admin.js";

//=====================
//VARIABLES GLOBALS
//=====================
let socket = null;
const pendingRequests = new Map();

//=====================
//PETICIONS D'ADMIN (CADA UNA AMB EL SEU ID I EL SEU TEMPS MAXIM)
//=====================
const pendingAdmin = new Map();
let adminCounter = 0;
const ADMIN_TIMEOUT_MS = 10000;

//EVITA UN BUCLE SI EL SERVIDOR REBUTJA TAMBÉ LA IDENTITAT NOVA
let fallbackIdentitatFet = false;

//=====================
//GESTIÓ DE PETICIONS PENDENTS
//=====================
function sendRequest(type, payload) {
  return new Promise((resolve, reject) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return reject("NO HI HA CONNEXIÓ AMB EL SERVIDOR");
    }
    pendingRequests.set(type, { resolve, reject });
    socket.send(JSON.stringify(payload));
  });
}

function resolvePending(type, data) {
  if (pendingRequests.has(type)) {
    pendingRequests.get(type).resolve(data);
    pendingRequests.delete(type);
  }
}

function rejectPending(type, error) {
  if (pendingRequests.has(type)) {
    pendingRequests.get(type).reject(error);
    pendingRequests.delete(type);
  }
}

//=====================
//INICIALITZACIÓ DE LA CONNEXIÓ
//=====================
export function initSocket() {
  if (
    socket &&
    (socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const game = useGameStore();

  //EN DEV EL PORT VE DEL .ENV (VITE_WS_PORT); EN PRODUCCIÓ NGINX FA PROXY DE /WS
  const wsPort = import.meta.env.DEV ? import.meta.env.VITE_WS_PORT : undefined;

  let protocol;
  if (location.protocol === "https:") {
    protocol = "wss";
  } else {
    protocol = "ws";
  }

  let socketUrl;
  if (wsPort) {
    socketUrl = `${protocol}://${location.hostname}:${wsPort}`;
  } else {
    socketUrl = `${protocol}://${location.host}/ws`;
  }

  socket = new WebSocket(socketUrl);
  //CADA CONNEXIÓ NOVA TORNA A PERMETRE UN SOL FALLBACK D'IDENTITAT
  fallbackIdentitatFet = false;

  socket.onopen = () => {
    console.log("CONNEXIÓ WEBSOCKET ESTABLEERTA");
    // NO ENVIEM CONNECTION:RESTORE AQUÍ - ESPEREM CONNECTION:STABLISHED
    // REQUESTROOMSLIST() S'ENVIARÀ DESPRÉS D'IDENTITAT CONFIRMADA
  };

  socket.onclose = () => {
    game.setDisconnected();
    console.log("CONNEXIÓ WEBSOCKET TANCADA");
    pendingRequests.forEach(({ reject }) =>
      reject("CONNEXIÓ TANCADA AMB EL SERVIDOR")
    );
    pendingRequests.clear();

    //LES PETICIONS D'ADMIN PENDENTS TAMBÉ ES CULLEN
    pendingAdmin.forEach(({ reject, temporitzador }) => {
      clearTimeout(temporitzador);
      reject(new Error("CONNEXIÓ TANCADA AMB EL SERVIDOR"));
    });
    pendingAdmin.clear();
  };

  socket.onerror = () => {
    game.setError("ERROR DE CONNEXIÓ AMB EL SERVIDOR");
    game.setDisconnected();
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log("[WS] RECV", data.type, data);

    //ELS MISSATGES D'ADMIN VAN PER UN CAMI PROPI I NO TOQUEN L'ESTAT DEL JOC
    if (String(data.type || "").indexOf("admin:") === 0) {
      handleAdminMessage(data);
      return;
    }

    switch (data.type) {
      case "connection:stablished": {
        // REBUT ACK DE CONNEXIÓ - ARA DECLAREM IDENTITAT DES DE LOCALSTORAGE
        console.log("[WS] CONNEXIÓ ESTABLERTA, DECLARANT IDENTITAT...");
        declareIdentity();
        break;
      }

      case "identity:confirmed": {
        // REBUT IDENTITAT CONFIRMADA DEL SERVIDOR
        if (data.error) {
          game.setError(data.error);
          console.error("[WS] ERROR IDENTITAT:", data.error);

          //SI EL RESTORE HA ESTAT REBUTJAT, NO ENS HI QUEDEM: PROVEM UNA IDENTITAT NOVA
          if (fallbackIdentitatFet === false) {
            fallbackIdentitatFet = true;
            declareIdentityNova();
          }
        } else if (data.identity) {
          game.clearError();
          game.setConnection(data.identity);
          console.log("[WS] IDENTITAT CONFIRMADA:", data.identity);
          // ARA QUE TENIM IDENTITAT, PODEM DEMANAR LLISTA DE SALES I CATALEG
          requestRoomsList();
          requestCatalogOptions();
        }
        break;
      }

      case "catalog:options":
        if (data.ok === false) {
          game.setCatalogError(
            data.reason || "No s'han pogut carregar les opcions del catàleg"
          );
        } else {
          game.setCatalogOptions(data);
        }
        break;

      case "chat:message":
        game.addChatMessage(data);
        break;

      case "chat:error":
        game.setError(data.message);
        break;

      case "round:started":
        game.startRound(data);
        break;

      case "round:spectator":
        game.setSpectatorRound(data);
        break;

      case "observer:selected":
        game.setObserverSelection(data.playerId, data.nickname);
        resolvePending("observer:select", data);
        break;

      case "observer:select:error":
        game.setError(data.reason || "No s'ha pogut seleccionar el jugador.");
        rejectPending(
          "observer:select",
          data.reason || "No s'ha pogut seleccionar el jugador."
        );
        break;

      case "gameplay:update":
        game.setObservedGameplay(data);
        break;

      case "round:results":
        game.setResults(data);
        break;

      case "round:ranking":
        game.setRanking(data);
        break;

      case "room:state":
        game.setRoomState(data);
        break;
        
      case "game:finished":
        game.finishGame(data);
        break;

      case "answer:ack":
        game.answered = true;
        resolvePending("answer:submit", data);
        break;

      case "round:error":
        game.setError(data.message);
        break;

      case "round:next:error":
        game.setError(data.message);
        break;

      case "nickname:updated":
        game.changeNickname(data.nickname);
        resolvePending("nickname:update", data);
        break;

      case "nickname:error":
        game.setError(data.message);
        rejectPending("nickname:update", data.message);
        break;

      case "answer:error":
        game.setError(data.message);
        rejectPending("answer:submit", data.message);
        break;

      case "room:ready:error":
        game.setError(data.reason || data.message);
        break;

      case "room:configuration:updated":
        //EL BACKEND ÉS LA FONT DE VERITAT: GUARDEM LA CONFIGURACIÓ AL STORE
        game.setConfiguration(data.configuration);
        resolvePending("room:configuration", data);
        break;

      case "room:configuration:error":
        game.setError(data.reason);
        rejectPending("room:configuration", data.reason);
        break;

      //=====================
      //RESPOSTES DE SALA
      //=====================
      case "room:joined":
        console.log("[WS] HANDLING ROOM:JOINED", data);
        game.clearError();
        game.setPlayers(data.players, data.hostId);
        game.setLobbyState(data);
        game.setRoom(data.roomId, data.players, data.hostId, data.password || null, data.isPrivate);
        game.isHost = game.guestId === data.hostId;

        resolvePending("room:join", data);
        resolvePending("room:join:private", data);
        break;

      case "room:join:error":
        game.setError(data.reason);
        rejectPending("room:join", data.reason);
        rejectPending("room:join:private", data.reason);
        break;

      case "room:left":
        resolvePending("room:leave", data);
        break;

      case "room:leave:error":
        game.setError(data.reason);
        rejectPending("room:leave", data.reason);
        break;

      case "room:created":
        console.log("[WS] HANDLING ROOM:CREATED", data);
        game.clearError();
        game.setPlayers(data.players, data.hostId);
        game.setLobbyState(data);
        game.setRoom(
          data.roomId,
          data.players,
          data.hostId,
          data.password || null,
          data.isPrivate || false
        );
        game.isHost = game.guestId === data.hostId;
        resolvePending("room:create", data);
        break;

      case "room:create:error":
        game.setError(data.reason);
        rejectPending("room:create", data.reason);
        break;

      case "room:new":
        // BROADCAST DE SALA NOVA DES DEL SERVIDOR (ALTRE USUARI LA VA CREAR)
        if (!data.isPrivate) {
            game.addRoom(data);
        }
        break;

      case "rooms:list":
        game.setRooms(data.rooms.filter(room => !room.isPrivate));
        break;

      case "room:players":
        console.log("[WS] HANDLING ROOM:PLAYERS (BROADCAST)", data);
        game.setPlayers(data.players, data.hostId);
        game.setLobbyState(data);
        game.isHost = game.guestId === data.hostId;
        break;

      case "room:removed":
        game.removeRoom(data.roomId);
        break;

      case "room:kicked":
        game.notifyKicked(data.reason);
        break;

      case "error":
        game.setError(data.message);
        break;
    }
  };
}

//=====================
//FUNCIÓ PER DECLARAR IDENTITAT DES DE SESSIONSTORAGE
//=====================
function declareIdentity() {
  const game = useGameStore();
  const nickname = game.nickname; // JA CARREGAT DE SESSIONSTORAGE A L'INICIALITZAR EL STORE
  const guestId = game.guestId; // JA CARREGAT DE SESSIONSTORAGE A L'INICIALITZAR EL STORE
  const guestSecret = game.guestSecret; // EL SECRET QUE ENS VA DONAR EL SERVIDOR

  if (socket === null || socket.readyState !== WebSocket.OPEN) {
    return;
  }

  if (guestId && nickname) {
    // FLUX RESTORE: ID + SECRET; SI EL SECRET NO COINCIDEIX EL SERVIDOR ENS EN DONA UN DE NOU
    socket.send(
      JSON.stringify({
        type: "identity:declare",
        identity: {
          type: "restore",
          guestId: guestId,
          //SI NO TENIM SECRET (CONVIDAT ANTIC) L'OMETEM PERQUÈ EL SERVIDOR EL DEIXI PASSAR
          guestSecret: guestSecret || undefined,
          nickname: nickname,
          token: game.authToken || undefined,
        },
      })
    );
    console.log("[WS] DECLARANT IDENTITAT RESTORE:", guestId);
    return;
  }

  declareIdentityNova();
}

//=====================
//IDENTITAT NOVA (SENSE RES A RECUPERAR O QUAN EL RESTORE HA FALLAT)
//=====================
function declareIdentityNova() {
  const game = useGameStore();
  const nickname = game.nickname;

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(
      JSON.stringify({
        type: "identity:declare",
        identity: {
          type: "new",
          nickname: nickname || undefined,
          token: game.authToken || undefined,
        },
      })
    );
    console.log("[WS] DECLARANT IDENTITAT NEW");
  }
}

//=====================
//LLISTAT DE SALES
//=====================
export function requestRoomsList() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "rooms:list" }));
  }
}

//=====================
//CATALEG DE CATEGORIES I DIFICULTATS
//=====================
export function requestCatalogOptions() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const game = useGameStore();
    game.setCatalogLoading(true);
    socket.send(JSON.stringify({ type: "catalog:options" }));
  }
}

//=====================
//ENVIAMENT DE MISSATGES SENSE RESPOSTA
//=====================
function sendMessage(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  } else {
    const game = useGameStore();
    game.setError("NO HI HA CONNEXIÓ AMB EL SERVIDOR");
  }
}

//=====================
//PETICIONS D'ADMIN
//=====================
export function sendAdminRequest(type, payload) {
  return new Promise(function executor(resolve, reject) {
    if (!socket || (socket.readyState !== WebSocket.OPEN && socket.readyState !== WebSocket.CONNECTING)) {
      reject(new Error("Sense connexio"));
      return;
    }

    adminCounter = adminCounter + 1;
    const requestId = "adm-" + adminCounter + "-" + Date.now();

    const missatge = { type: type, requestId: requestId };

    for (const clau in payload) {
      missatge[clau] = payload[clau];
    }

    const temporitzador = setTimeout(function onTimeout() {
      pendingAdmin.delete(requestId);
      reject(new Error("Temps d'espera esgotat"));
    }, ADMIN_TIMEOUT_MS);

    pendingAdmin.set(requestId, {
      resolve: resolve,
      reject: reject,
      temporitzador: temporitzador,
    });

    function envia() {
      //SI HA CADUCAT MENTRE ESPERAVEM, NO L'ENVIEM
      if (!pendingAdmin.has(requestId) || !socket) {
        return;
      }

      //SI EL SOCKET ENCARA ESTA CONNECTANT, ENVIEM QUAN ESTIGUI OBERT
      if (socket.readyState === WebSocket.CONNECTING) {
        socket.addEventListener("open", function onOpen() {
          if (pendingAdmin.has(requestId)) {
            socket.send(JSON.stringify(missatge));
          }
        }, { once: true });
        return;
      }

      sendMessage(missatge);
    }

    //L'AUTENTICACIO NO ES POT ESPERAR A SI MATEIXA
    if (type === "admin:auth") {
      envia();
      return;
    }

    //CAP PETICIO SURT ABANS QUE EL CANAL HAGI PASSAT ADMIN:AUTH
    useAdminStore().authReady.then(envia);
  });
}

function handleAdminMessage(data) {
  const admin = useAdminStore();

  //EL DIRECTE NO ES RESPOSTA DE CAP PETICIO: L'ENVIA EL SERVIDOR
  if (data.type === "admin:live") {
    admin.applyLive(data);
    return;
  }

  //LA LLISTA DE CATEGORIES ARRIBA SOLA QUAN ALGÚ LA CANVIA AL SERVIDOR
  if (data.type === "admin:categories:live") {
    admin.setCategories(data.categories || []);
    return;
  }

  const pendent = pendingAdmin.get(data.requestId);

  if (!pendent) {
    return;
  }

  clearTimeout(pendent.temporitzador);
  pendingAdmin.delete(data.requestId);

  if (data.ok === false) {
    const error = new Error(data.reason || "Error d'admin");
    error.errors = data.errors;
    pendent.reject(error);
    return;
  }

  pendent.resolve(data);
}

//=====================
//FUNCIONS PÚBLIQUES DE LA PARTIDA
//=====================
export function submitAnswer(questionId, answer) {
  const game = useGameStore();

  if (game.answered) {
    return Promise.reject("JA HAS RESPOST A AQUESTA RONDA");
  }

  game.answered = true;

  return sendRequest("answer:submit", {
    type: "answer:submit",
    questionId: Number(questionId),
    answer: Number(answer),
  }).catch((error) => {
    game.answered = false;
    throw error;
  });
}

export function startRound() {
  const game = useGameStore();
  game.clearError();

  sendMessage({
    type: "game:start",
  });
}

export function nextRound() {
  const game = useGameStore();
  game.clearError();

  if (!game.isHost) {
    return;
  }

  sendMessage({
    type: "round:next",
  });
}

export function updateNickname(nickname) {
  return sendRequest("nickname:update", {
    type: "nickname:update",
    nickname: nickname,
  });
}

//=====================
//FUNCIONS PÚBLIQUES DE LA SALA
//=====================
export function joinRoom(roomId, nickname, password = null) {
  return sendRequest("room:join", {
    type: "room:join",
    roomId: roomId,
    nickname: nickname,
    password: password,
  });
}

export function leaveRoom(roomId) {
  return sendRequest("room:leave", {
    type: "room:leave",
    roomId: roomId,
  });
}

export function setReady(ready) {
  return sendRequest("room:ready", {
    type: "room:ready",
    ready: ready,
  });
}

export function updateConfiguration(configuration) {
  return sendRequest("room:configuration", {
    type: "room:configuration",
    configuration: configuration,
  });
}

export function kickPlayer(playerId) {
  sendMessage({
    type: "room:kick",
    playerId: playerId,
  });
}

export function sendChatMessage(text) {
  const cleaned = typeof text === "string" ? text.trim() : "";

  if (cleaned === "") {
    return;
  }

  sendMessage({
    type: "chat:message",
    text: cleaned,
  });
}

export function selectObservedPlayer(playerId) {
  return sendRequest("observer:select", {
    type: "observer:select",
    playerId: playerId,
  });
}

export function sendGameplayUpdate(gameplay) {
  const currentGameplay = typeof gameplay === "string" ? gameplay : "";

  sendMessage({
    type: "gameplay:update",
    gameplay: currentGameplay,
  });
}

export function createRoom(nickname, maxPlayers, isPrivate, nameRoom) {
  return sendRequest("room:create", {
    type: "room:create",
    nickname: nickname,
    maxPlayers: Number(maxPlayers),
    isPrivate: isPrivate,
    nameRoom: nameRoom,
  });
}

//=====================
//TANCAMENT DE LA CONNEXIÓ
//=====================
export function disconnectSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }

  const game = useGameStore();
  game.setDisconnected();
}