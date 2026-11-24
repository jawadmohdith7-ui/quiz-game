//ARXIU QUE GUARDA L'ESTAT GLOBAL DEL JOC I DE LA SALA

//=====================
//IMPORTEM
//=====================
import { defineStore } from "pinia";
import { ref, computed } from "vue";

const STATS_STORAGE_PREFIX = "howmuchUserStats";

function createEmptyStats() {
  return {
    gamesPlayed: 0,
    gamesWon: 0,
    answeredQuestions: 0,
    correctAnswers: 0,
    lastUpdatedAt: null,
  };
}

function getStatsStorageKey(userId) {
  if (!userId) {
    return "";
  }

  return `${STATS_STORAGE_PREFIX}:${String(userId)}`;
}

function parseStoredStats(rawValue) {
  if (!rawValue) {
    return createEmptyStats();
  }

  try {
    const parsed = JSON.parse(rawValue);
    return {
      gamesPlayed: Number(parsed.gamesPlayed) || 0,
      gamesWon: Number(parsed.gamesWon) || 0,
      answeredQuestions: Number(parsed.answeredQuestions) || 0,
      correctAnswers: Number(parsed.correctAnswers) || 0,
      lastUpdatedAt: parsed.lastUpdatedAt || null,
    };
  } catch {
    return createEmptyStats();
  }
}

//=====================
//DECLAREM EL STORE
//=====================
export const useGameStore = defineStore("game", () => {
  //DADES DEL JUGADOR I DE LA CONNEXIÓ
  const nickname = ref(localStorage.getItem("nickname") || "");
  const authUserId = ref(localStorage.getItem("authUserId") || "");
  const authUserEmail = ref(localStorage.getItem("authUserEmail") || "");
  const authToken = ref(localStorage.getItem("authToken") || "");
  const avatarImage = ref(localStorage.getItem("avatarImage") || "");
  const avatarColor = ref(localStorage.getItem("avatarColor") || "#22c55e");
  const guestId = ref(sessionStorage.getItem("guestId") || "");
  //EL SECRET VIATJA AL COSTAT DEL guestId: SENSE ELL, EL SERVIDOR NO ENS RECONEIX
  const guestSecret = ref(sessionStorage.getItem("guestSecret") || "");
  const connected = ref(false);
  const connectionInfo = ref(null);

  //DADES DE LA SALA
  const rooms = ref([]);
  //RECORDEM LA SALA PER SOBREVIURE A UN REFRESH (LA RESTA D'ESTAT EL RECUPERA EL BACKEND)
  const roomId = ref(sessionStorage.getItem("activeRoomId") || null);
  const roomName = ref("");
  const players = ref([]);
  const hostId = ref(null);
  const createdRoom = ref(null);
  const roomPassword = ref(null);
  const isPrivateRoom = ref(false);
  const roomState = ref(null);

  //CONFIGURACIÓ REAL DE LA SALA (CATEGORIA, DIFICULTAT, AFORAMENT, RONDES I TEMPS)
  const configuration = ref(null);

  //CATALEG DISPONIBLE (ARRIBA PER WEBSOCKET)
  const categories = ref([]);
  const difficulties = ref([]);
  const catalogError = ref("");
  const catalogLoading = ref(true);

  //DADES DE LA PARTIDA
  const questions = ref([]);
  const errorMessage = ref("");
  const currentQuestionIndex = ref(0);
  const currentQuestion = ref(null);
  const roundEndsAt = ref(0);
  const currentRound = ref(0);
  const totalRounds = ref(0);
  const answered = ref(false);
  const results = ref(null);
  const ranking = ref(null);
  const chatMessages = ref([]);
  const kickedNotice = ref("");
  const screen = ref("round");
  const isHost = ref(false);
  const spectatorPhase = ref(null);
  const observedPlayerId = ref(null);
  const observedPlayerNickname = ref("");
  const observedGameplay = ref("");
  const userStats = ref(createEmptyStats());
  const currentStatsKey = ref("");
  const hasCountedCurrentGame = ref(false);

  //ESTAT DEL LOBBY (READY I ROLS)
  const readyCount = ref(0);
  const readyRequired = ref(1);
  const canStart = ref(false);

  //EL MEU MEMBRE DINS LA SALA I EL SEU ROL
  const myPlayer = computed(() => {
    return players.value.find((player) => player.id === guestId.value);
  });

  const isObserver = computed(() => {
    if (!myPlayer.value) {
      return false;
    }

    if (myPlayer.value.role === "observer") {
      return true;
    }

    return false;
  });

  const accuracyPercentage = computed(() => {
    if (userStats.value.answeredQuestions === 0) {
      return 0;
    }

    const percentage =
      (userStats.value.correctAnswers / userStats.value.answeredQuestions) * 100;
    return Number(percentage.toFixed(1));
  });

  function resolveStatsUserId() {
    if (authUserId.value) {
      return authUserId.value;
    }

    if (guestId.value) {
      return guestId.value;
    }

    return nickname.value;
  }

  function loadUserStats() {
    const userId = resolveStatsUserId();
    const key = getStatsStorageKey(userId);

    currentStatsKey.value = key;

    if (!key) {
      userStats.value = createEmptyStats();
      return;
    }

    userStats.value = parseStoredStats(localStorage.getItem(key));
  }

  function persistUserStats() {
    if (!currentStatsKey.value) {
      return;
    }

    userStats.value.lastUpdatedAt = new Date().toISOString();
    localStorage.setItem(currentStatsKey.value, JSON.stringify(userStats.value));
  }

  function trackRoundResult(data) {
    //L'OBSERVADOR NO ACUMULA ESTADÍSTIQUES: EL BLOC you ÉS DEL JUGADOR OBSERVAT
    if (isObserver.value === true) {
      return;
    }

    if (!data || !data.you) {
      return;
    }

    if (data.you.answer === null || data.you.answer === undefined) {
      return;
    }

    userStats.value.answeredQuestions += 1;

    if (data.you.answer === data.correctAnswer) {
      userStats.value.correctAnswers += 1;
    }

    persistUserStats();
  }

  function trackFinishedGame(data) {
    if (hasCountedCurrentGame.value) {
      return;
    }

    userStats.value.gamesPlayed += 1;

    let didWin = false;

    if (Array.isArray(data?.ranking) && data.ranking.length > 0) {
      const winner =
        data.ranking.find((entry) => Number(entry.position) === 1) ||
        data.ranking[0];
      didWin = winner?.id === guestId.value;
    } else if (data?.you && Number(data.you.position) === 1) {
      didWin = true;
    }

    if (didWin) {
      userStats.value.gamesWon += 1;
    }

    hasCountedCurrentGame.value = true;
    persistUserStats();
  }

  loadUserStats();

  //=====================
  //FUNCIONS DEL JUGADOR
  //=====================
  function changeNickname(name) {
    nickname.value = name.trim();
    localStorage.setItem("nickname", nickname.value);
  }

  function setAuthUser(user) {
    authUserId.value = String(user.id || "");
    authUserEmail.value = String(user.email || "");
    authToken.value = String(user.token || "");
    avatarImage.value = String(user.avatarImage || "");
    avatarColor.value = String(user.avatarColor || "#22c55e");

    localStorage.setItem("authUserId", authUserId.value);
    localStorage.setItem("authUserEmail", authUserEmail.value);
    if (authToken.value) {
      localStorage.setItem("authToken", authToken.value);
    } else {
      localStorage.removeItem("authToken");
    }
    localStorage.setItem("avatarImage", avatarImage.value);
    localStorage.setItem("avatarColor", avatarColor.value);

    if (typeof user.name === "string" && user.name.trim() !== "") {
      changeNickname(user.name);
    }

    loadUserStats();

    //EL ROL D'ADMIN NO POT SOBREVIURE A UNA SESSIO QUE NO ES D'ADMIN
    if (user.rol === "admin") {
      localStorage.setItem("authRol", "admin");
    } else {
      localStorage.removeItem("authRol");
    }

    //UN CONVIDAT NO PORTA TOKEN PROPIO: EL D'UNA SESSIO ANTERIOR NO HA DE QUEDAR
    if (!user.token) {
      localStorage.removeItem("authToken");
    }
  }

  function setAvatarValue(newAvatarImage, newAvatarColor) {
    avatarImage.value = String(newAvatarImage || "");
    avatarColor.value = String(newAvatarColor || "#22c55e");
    localStorage.setItem("avatarImage", avatarImage.value);
    localStorage.setItem("avatarColor", avatarColor.value);
  }

  function clearAuthUser() {
    authUserId.value = "";
    authUserEmail.value = "";
    authToken.value = "";
    avatarImage.value = "";
    avatarColor.value = "#22c55e";
    nickname.value = "";
    guestId.value = "";

    localStorage.removeItem("authUserId");
    localStorage.removeItem("authUserEmail");
    localStorage.removeItem("authToken");
    localStorage.removeItem("avatar");
    localStorage.removeItem("avatarImage");
    localStorage.removeItem("avatarColor");
    localStorage.removeItem("authToken");
    localStorage.removeItem("authRol");
    localStorage.removeItem("nickname");
    sessionStorage.removeItem("guestId");
    sessionStorage.removeItem("guestSecret");

    userStats.value = createEmptyStats();
    currentStatsKey.value = "";
    hasCountedCurrentGame.value = false;
  }

  function setConnection(info) {
    connected.value = true;
    connectionInfo.value = info;

    // SUPORTA DOS FORMATS:
    // 1. NOU FORMAT (IDENTITY:CONFIRMED): {ID, TYPE, NICKNAME}
    const identityId = info.id;
    const identityNickname = info.nickname; // NICKNAME (NOU)

    // ACTUALITZAR NICKNAME SI NO EN TENIM UN O SI EL DEL SERVIDOR ÉS DIFERENT
    if (
      identityNickname &&
      (!nickname.value || nickname.value !== identityNickname)
    ) {
      nickname.value = identityNickname;
      localStorage.setItem("nickname", nickname.value);
    }

    // ACTUALITZAR GUESTID SI EL TENIM I ÉS DIFERENT
    if (identityId && identityId !== guestId.value) {
      guestId.value = identityId;
      sessionStorage.setItem("guestId", guestId.value);
    }

    // GUARDEM EL SECRET: SI EL SERVIDOR NO ENS HA RECONEGUT, AQUÍ ARRIBA EL NOU
    if (info.guestSecret) {
      guestSecret.value = info.guestSecret;
      sessionStorage.setItem("guestSecret", guestSecret.value);
    }

    if (!authUserId.value) {
      loadUserStats();
    }
  }

  function setDisconnected() {
    connected.value = false;
    connectionInfo.value = null;
  }

  //=====================
  //FUNCIONS DE LA SALA
  //=====================
  function setRooms(roomList) {
    rooms.value = roomList;
  }

  function setRoom(
    id,
    roomPlayers,
    roomHostId = null,
    password = null,
    isPrivate = false
  ) {
    console.log("[STORE] SETROOM CALLED", {
      roomId: id,
      count: roomPlayers?.length,
      players: roomPlayers?.map((p) => p.nickname),
    });
    roomId.value = id;

    //GUARDEM EL ROOMID PER PODER TORNAR-HI DESPRÉS D'UN REFRESH
    if (id) {
      sessionStorage.setItem("activeRoomId", id);
    }

    players.value = roomPlayers;
    hostId.value = roomHostId;
    roomPassword.value = password;
    isPrivateRoom.value = isPrivate;
    clearChatMessages();
    console.log(
      "[STORE] PLAYERS.VALUE NOW",
      players.value?.map((p) => p.nickname)
    );
  }

  function setPrivateRoom(data) {
    setRoom(data.roomId, data.players, data.hostId, data.password, true);
  }

  function setPlayers(roomPlayers, roomHostId = null) {
    console.log("[STORE] SETPLAYERS CALLED", {
      count: roomPlayers?.length,
      players: roomPlayers?.map((p) => p.nickname),
    });
    players.value = roomPlayers;
    hostId.value = roomHostId;
    const observedStillPresent = players.value.some(
      (player) => player.id === observedPlayerId.value && player.role === "player"
    );
    if (observedStillPresent === false) {
      clearObserverTracking();
    }
    console.log(
      "[STORE] PLAYERS.VALUE NOW",
      players.value?.map((p) => p.nickname)
    );
  }

  function setObserverSelection(playerId, nickname) {
    observedPlayerId.value = playerId || null;
    observedPlayerNickname.value = nickname || "";
    observedGameplay.value = "";
  }

  function setObservedGameplay(data) {
    if (!data || typeof data.gameplay !== "string") {
      return;
    }

    observedPlayerId.value = data.playerId || observedPlayerId.value;
    observedPlayerNickname.value =
      data.playerNickname || observedPlayerNickname.value;
    observedGameplay.value = data.gameplay;
  }

  function clearObserverTracking() {
    observedPlayerId.value = null;
    observedPlayerNickname.value = "";
    observedGameplay.value = "";
  }

  function notifyKicked(reason) {
    kickedNotice.value = reason || "Has estat expulsat de la sala.";
    resetGame();
  }

  function clearKickedNotice() {
    kickedNotice.value = "";
  }

  function addChatMessage(message) {
    if (!message || typeof message.text !== "string") {
      return;
    }

    const trimmedText = message.text.trim();

    if (trimmedText === "") {
      return;
    }

    chatMessages.value.push({
      id: `${message.senderId || "anon"}-${message.timestamp || Date.now()}-${chatMessages.value.length}`,
      senderId: message.senderId || null,
      senderName: message.senderName || "Anònim",
      senderUserId: message.senderUserId || null,
      senderAvatarColor: message.senderAvatarColor || null,
      text: trimmedText,
      timestamp: message.timestamp || Date.now(),
      system: message.system === true,
    });

    if (chatMessages.value.length > 200) {
      chatMessages.value = chatMessages.value.slice(-200);
    }
  }

  function clearChatMessages() {
    chatMessages.value = [];
  }

  //GUARDA LA CONFIGURACIÓ QUE ARRIBA DEL BACKEND SENSE TREURE CAP CAMP
  function setConfiguration(data) {
    if (!data) {
      return;
    }

    let currentCategory = "mix";
    let currentDifficulty = "mix";
    let currentMaxPlayers = null;
    let currentRounds = 5;
    let currentDurationSeconds = 20;

    //SI JA TENÍEM CONFIGURACIÓ, PARTIM D'ELLA
    if (configuration.value) {
      currentCategory = configuration.value.category;
      currentDifficulty = configuration.value.difficulty;
      currentMaxPlayers = configuration.value.maxPlayers;
      currentRounds = configuration.value.rounds;
      currentDurationSeconds = configuration.value.durationSeconds;
    }

    //NOMÉS TREIEM ELS CAMPS QUE ARRIBEN AL MISSATGE
    if (data.category !== undefined) {
      currentCategory = data.category;
    }

    if (data.difficulty !== undefined) {
      currentDifficulty = data.difficulty;
    }

    if (data.maxPlayers !== undefined) {
      currentMaxPlayers = data.maxPlayers;
    }

    if (data.rounds !== undefined) {
      currentRounds = data.rounds;
    }

    if (data.durationSeconds !== undefined) {
      currentDurationSeconds = data.durationSeconds;
    }

    configuration.value = {
      category: currentCategory,
      difficulty: currentDifficulty,
      maxPlayers: currentMaxPlayers,
      rounds: currentRounds,
      durationSeconds: currentDurationSeconds,
    };
  }

  //=====================
  //FUNCIONS DEL CATALEG
  //=====================
  function setCatalogOptions(data) {
    if (Array.isArray(data.categories)) {
      categories.value = data.categories;
    }

    if (Array.isArray(data.difficulties)) {
      difficulties.value = data.difficulties;
    }

    catalogError.value = "";
    catalogLoading.value = false;
  }

  function setCatalogError(message) {
    catalogError.value = message;
    catalogLoading.value = false;
  }

  function setCatalogLoading(value) {
    catalogLoading.value = value;
  }

  function setLobbyState(data) {
    if (typeof data.nameRoom === "string") {
      roomName.value = data.nameRoom;
    }

    //L'ESTAT DE LA SALA ARRIBA A ROOM:JOINED I ROOM:PLAYERS
    if (typeof data.state === "string" && data.state) {
      roomState.value = data.state;
    }

    if (data.readyCount !== undefined) {
      readyCount.value = data.readyCount;
    }

    if (data.readyRequired !== undefined) {
      readyRequired.value = data.readyRequired;
    }

    if (data.canStart !== undefined) {
      canStart.value = data.canStart;
    }

    //ROOM:JOINED, ROOM:CREATED I ROOM:PLAYERS PORTEN LA CONFIGURACIÓ
    if (data.category !== undefined) {
      setConfiguration(data);
    }
  }

  function setRoomState(data) {
    roomState.value = data.state;

    if (data.roomId) {
      roomId.value = data.roomId;
    }

    //SI TORNEM AL LOBBY, NETEJEM LA PARTIDA I L'ESTAT D'ESPECTADOR
    if (data.state === "lobby") {
      currentQuestion.value = null;
      roundEndsAt.value = 0;
      currentRound.value = 0;
      totalRounds.value = 0;
      answered.value = false;
      results.value = null;
      ranking.value = null;
      spectatorPhase.value = null;
      screen.value = "round";
      clearObserverTracking();
    }
  }

  function resetRoom() {
    roomId.value = null;
    sessionStorage.removeItem("activeRoomId");
    roomName.value = "";
    players.value = [];
    hostId.value = null;
    roomPassword.value = null;
    isPrivateRoom.value = false;
    roomState.value = null;
    configuration.value = null;
    readyCount.value = 0;
    readyRequired.value = 1;
    canStart.value = false;
    clearChatMessages();
    clearObserverTracking();
  }

  function setCreatedRoom(data) {
    createdRoom.value = data;
  }

  function clearCreatedRoom() {
    createdRoom.value = null;
  }

  function addRoom(roomData) {
    //ROOMS:LIST PORTA "id" I ROOM:NEW POT PORTAR "roomId"; ACCEPTEM ELS DOS
    let roomId = roomData.id;

    if (!roomId) {
      roomId = roomData.roomId;
    }

    //EVITA DUPLICATS: SI JA EXISTEIX UNA SALA AMB AQUEST ID, NO L'AFEGIM
    if (rooms.value.some((r) => r.id === roomId)) {
      return;
    }

    //EL NOM POT VENIR COM "name" O COM "nameRoom"
    let name = roomData.name;

    if (!name) {
      name = roomData.nameRoom;
    }

    if (!name) {
      name = `SALA ${roomId.slice(-6)}`;
    }

    rooms.value.push({
      id: roomId,
      name: name,
      maxPlayers: roomData.maxPlayers,
      players: roomData.players,
      category: roomData.category,
      state: roomData.state,
    });
  }

  function removeRoom(id) {
    rooms.value = rooms.value.filter((r) => r.id !== id);
  }

  //=====================
  //FUNCIONS DE LA PARTIDA
  //=====================
  function setQuestions(data) {
    questions.value = data;
    currentQuestionIndex.value = 0;
    errorMessage.value = "";
  }

  function setError(message) {
    errorMessage.value = message;
  }

  function clearError() {
    errorMessage.value = "";
  }

  function startRound(data) {
    currentRound.value = data.round;
    totalRounds.value = data.totalRounds;
    currentQuestion.value = data.question;
    roundEndsAt.value = Date.now() + data.durationMs;
    answered.value = false;
    results.value = null;
    ranking.value = null;
    screen.value = "round";
    hasCountedCurrentGame.value = false;
  }

function setResults(data) {
  results.value = data;
  screen.value = "result";
  observedGameplay.value = "";
  trackRoundResult(data);
}

  function setRanking(data) {
    ranking.value = data;
    screen.value = "ranking";
  }

  //L'ESPECTADOR NO REP MAI LA PREGUNTA NI ELS RESULTATS: NOMÉS LA FASE
  function setSpectatorRound(data) {
    currentRound.value = data.round;
    totalRounds.value = data.totalRounds;
    currentQuestion.value = null;
    results.value = null;
    ranking.value = null;
    answered.value = false;
    spectatorPhase.value = data.phase;

    if (data.phase === "question") {
      roundEndsAt.value = Date.now() + data.remainingMs;
      screen.value = "round";
      return;
    }

    roundEndsAt.value = 0;
    screen.value = "result";
    observedGameplay.value = "";
  }

function finishGame(data) {
  ranking.value = data;
  screen.value = "finished";
  observedGameplay.value = "";
  trackFinishedGame(data);
}

  function resetGame() {
    questions.value = [];
    currentQuestionIndex.value = 0;
    errorMessage.value = "";
    currentQuestion.value = null;
    roundEndsAt.value = 0;
    currentRound.value = 0;
    totalRounds.value = 0;
    answered.value = false;
    results.value = null;
    ranking.value = null;
    spectatorPhase.value = null;
    screen.value = "round";
    isHost.value = false;
    hasCountedCurrentGame.value = false;
    resetRoom();
  }

  return {
    nickname,
    authUserId,
    authUserEmail,
    authToken,
    avatarImage,
    avatarColor,
    guestId,
    guestSecret,
    connected,
    connectionInfo,
    rooms,
    roomId,
    roomName,
    players,
    myPlayer,
    isObserver,
    hostId,
    createdRoom,
    roomPassword,
    isPrivateRoom,
    roomState,
    configuration,
    categories,
    difficulties,
    catalogError,
    catalogLoading,
    setCatalogOptions,
    setCatalogError,
    setCatalogLoading,
    setRoomState,
    questions,
    errorMessage,
    changeNickname,
    setAuthUser,
    setAvatarValue,
    clearAuthUser,
    setConnection,
    setDisconnected,
    setRooms,
    setRoom,
    setPrivateRoom,
    setPlayers,
    resetRoom,
    setCreatedRoom,
    clearCreatedRoom,
    addRoom,
    removeRoom,
    setQuestions,
    setError,
    clearError,
    resetGame,
    currentQuestionIndex,
    currentQuestion,
    roundEndsAt,
    currentQuestionIndex,
    currentQuestion,
    roundEndsAt,
    currentRound,
    totalRounds,
    answered,
    answered,
    results,
    ranking,
    chatMessages,
    kickedNotice,
    notifyKicked,
    clearKickedNotice,    addChatMessage,
    clearChatMessages,
    screen,
    spectatorPhase,
    isHost,
    readyCount,
    readyRequired,
    canStart,
    observedPlayerId,
    observedPlayerNickname,
    observedGameplay,
    userStats,
    accuracyPercentage,
    setConfiguration,
    setLobbyState,
    setObserverSelection,
    setObservedGameplay,
    clearObserverTracking,
    startRound,
    setResults,
    setRanking,
    setSpectatorRound,
    finishGame,
    startRound,
    setResults,
    setRanking,
    setSpectatorRound,
    finishGame,
  };
});
