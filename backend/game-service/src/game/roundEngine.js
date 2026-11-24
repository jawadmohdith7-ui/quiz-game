//ARXIU QUE CONTÉ LES REGLES DE LA PARTIDA (SENSE WEBSOCKET)

//=====================
//CONSTANTS DE TEMPS DELS RESULTATS
//=====================
//TEMPS QUE PASSEN ELS RESULTATS A LA PANTALLA ABANS D'ENVIAR EL RÀNQUING
export const RANKING_DELAY_MS = 5000;

//TEMPS PER DEFECTE ENTRE EL RÀNQUING I L'OBERTURA DE LA RONDA SEGÜENT
const DEFAULT_NEXT_ROUND_DELAY_MS = 10000;

//ES POT SOBREESCRIURE DES DEL .ENV AMB NEXT_ROUND_DELAY_MS
let nextRoundDelayValor = Number(process.env.NEXT_ROUND_DELAY_MS);
if (nextRoundDelayValor === 0) {
  nextRoundDelayValor = DEFAULT_NEXT_ROUND_DELAY_MS;
}
if (Number.isNaN(nextRoundDelayValor)) {
  nextRoundDelayValor = DEFAULT_NEXT_ROUND_DELAY_MS;
}
export const NEXT_ROUND_DELAY_MS = nextRoundDelayValor;

//TEMPS QUE ES MOSTRA EL RÀNQUING FINAL ABANS DE TORNAR AL LOBBY
export const FINAL_RANKING_DELAY_MS = 15000;

//=====================
//FUNCIÓ AUXILIAR: ASSIGNA ELS ROLS I REINICIA ELS PUNTS
//EL HOST SEMPRE JUGA; QUI NO HA DONAT READY PASSA A OBSERVADOR
//=====================
function preparePlayers(room) {
  for (const player of room.players.values()) {
    const wasReady = player.ready;

    player.score = 0;
    player.ready = false;

    if (player.id === room.hostId) {
      player.role = "player";
    } else if (wasReady === true) {
      player.role = "player";
    } else {
      player.role = "observer";
    }
  }
}

//=====================
//FUNCIÓ PRINCIPAL: PREPARA LA SALA PER COMENÇAR LA PARTIDA
//=====================
export function prepareGame(room, questions) {
  const questionsById = new Map();
  const questionOrder = [];

  for (const question of questions) {
    questionsById.set(question.id, question);
    questionOrder.push(question.id);
  }

  room.questionsById = questionsById;
  room.questionOrder = questionOrder;

  //SI EL CATALOG EN RETORNA MENYS, MANEN LES QUE HI HA
  //NO TOQUEM room.rounds: ÉS LA CONFIGURACIÓ DEL LOBBY, NO LA DURADA DE LA PARTIDA
  room.totalRounds = questions.length;
  room.roundIndex = -1;
  room.currentQuestionId = null;
  room.currentRoundId = null;
  room.roundEndsAt = 0;
  room.roundAnswers = new Map();
  room.roundOpen = false;
  room.state = "playing";

  preparePlayers(room);

  //CONSTRUÏM EL MAPA DE JUGADORS (NOMÉS ELS QUE TENEN ROL "player")
  const gamePlayers = new Map();
  for (const entrada of room.players) {
    const playerId = entrada[0];
    const player = entrada[1];
    if (player.role === "player") {
      gamePlayers.set(playerId, player);
    }
  }
  room.gamePlayers = gamePlayers;

  room.finalRanking = null;
  room.currentRanking = null;
  room.rankingVisible = false;
}

//=====================
//FUNCIÓ: OBRE LA RONDA SEGÜENT I RETORNA LA PREGUNTA
//RETORNA NULL SI NO QUEDEN RONDES O FALTA LA PREGUNTA
//=====================
export function openRound(room) {
  room.roundIndex += 1;

  if (room.roundIndex >= room.totalRounds) {
    return null;
  }

  const questionId = room.questionOrder[room.roundIndex];
  const question = room.questionsById.get(questionId);

  if (question === undefined) {
    return null;
  }

  room.currentQuestionId = questionId;
  room.roundEndsAt = Date.now() + room.roundDurationMs;
  room.roundAnswers = new Map();
  room.roundOpen = true;
  room.currentRanking = null;
  room.rankingVisible = false;

  return question;
}

//=====================
//FUNCIÓ: TANCA LA RONDA OBERTA I RETORNA LA PREGUNTA
//RETORNA NULL SI JA ESTAVA TANCADA
//=====================
export function closeRound(room) {
  if (room.roundOpen === false) {
    return null;
  }

  const question = room.questionsById.get(room.currentQuestionId);

  room.roundOpen = false;
  room.currentQuestionId = null;
  room.roundEndsAt = 0;

  return question;
}

//=====================
//FUNCIÓ: TOTS ELS JUGADORS HAN RESPOST LA RONDA?
//ELS OBSERVADORS NO COMPTEN
//=====================
export function isRoundComplete(room) {
  if (room.roundOpen === false) {
    return false;
  }

  let playerCount = 0;

  for (const player of room.players.values()) {
    if (player.role !== "player") {
      continue;
    }

    playerCount += 1;

    const haRespost = room.roundAnswers.has(player.id);
    if (haRespost === false) {
      return false;
    }
  }

  //SENSE JUGADORS (NOMÉS OBSERVADORS) NO HI HA RES A TANCAR
  if (playerCount > 0) {
    return true;
  }
  return false;
}

//=====================
//FUNCIÓ: CONGELA LA PARTIDA
//=====================
export function setGameFinished(room) {
  room.roundOpen = false;
  room.currentQuestionId = null;
  room.currentRoundId = null;
  room.roundEndsAt = 0;
  room.state = "finished";
  room.rankingVisible = false;
}

//=====================
//FUNCIÓ: TORNA LA SALA AL LOBBY (NOMÉS QUAN NO QUEDA CAP JUGADOR)
//=====================
export function resetGame(room) {
  room.state = "lobby";
  room.roundIndex = -1;
  room.currentQuestionId = null;
  room.currentRoundId = null;
  room.roundEndsAt = 0;
  room.roundAnswers = new Map();
  room.roundOpen = false;
  room.questionOrder = [];
  room.questionsById = new Map();
  room.totalRounds = room.rounds;
  room.gamePlayers = null;
  room.finalRanking = null;
  room.currentRanking = null;
  room.rankingVisible = false;

  //AL LOBBY TOTHOM ÉS JUGADOR I TORNA A COMENÇAR DE ZERO
  for (const player of room.players.values()) {
    player.role = "player";
    player.ready = false;
    player.score = 0;
  }
}
