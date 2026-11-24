//ARXIU QUE GESTIONA LA PERSISTÈNCIA DE PARTIDES (CREEA, TANCA RONDES, ACABA PARTIDA)

//=====================
//IMPORTEM
//=====================
import { pool } from "../../db/pool.js";
import { calculatePoints } from "../scoring.js";

//=====================
//FUNCIÓ AUXILIAR: CREA UN ERROR AMB CODI
//=====================
function gameError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

//=====================
//FUNCIÓ AUXILIAR: EXECUTA UNA OPERACIÓ DINS D'UNA TRANSACCIÓ
//=====================
async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

//=====================
//FUNCIÓ AUXILIAR: OBTÉ EL RÀNQUING D'UNA PARTIDA
//=====================
async function getRanking(connection, gameId) {
  const [ranking] = await connection.execute(
    `SELECT p.id AS participant_id, p.nickname, COALESCE(SUM(a.punts), 0) AS score
     FROM participant p
     LEFT JOIN resposta a ON a.participant_id = p.id
       AND EXISTS (SELECT 1 FROM ronda r WHERE r.id = a.ronda_id AND r.partida_id = p.partida_id)
     WHERE p.partida_id = ?
     GROUP BY p.id, p.nickname
     ORDER BY score DESC, p.nickname ASC`,
    [gameId]
  );
  return ranking;
}

//=====================
//FUNCIÓ: INICIA EL REGISTRE D'UNA PARTIDA (PRIMERA RONDA)
//=====================
export async function startGameRecord(roomId, questionId, observerNicknames) {
  async function operacioAmbConnexio(connection) {
    const [games] = await connection.execute(
      "SELECT id, estat FROM partida WHERE codi = ? FOR UPDATE",
      [roomId]
    );
    if (games.length === 0) {
      throw gameError("ROOM_NOT_FOUND", "La partida no existeix.");
    }
    if (games[0].estat !== "esperant") {
      throw gameError("ROOM_NOT_WAITING", "La partida ja ha començat.");
    }
    for (const nickname of observerNicknames) {
      await connection.execute(
        "DELETE FROM participant WHERE partida_id = ? AND nickname = ?",
        [games[0].id, nickname]
      );
    }
    const [round] = await connection.execute(
      "INSERT INTO ronda (partida_id, pregunta_id, numero, estat) VALUES (?, ?, 1, 'oberta')",
      [games[0].id, questionId]
    );
    await connection.execute(
      "UPDATE partida SET estat = 'en_curs', data_inici = CURRENT_TIMESTAMP WHERE id = ?",
      [games[0].id]
    );
    return round.insertId;
  }
  return transaction(operacioAmbConnexio);
}

//=====================
//FUNCIÓ: OBRE EL REGISTRE D'UNA NOVA RONDA
//=====================
export async function openRoundRecord(roomId, questionId, number) {
  async function operacioAmbConnexio(connection) {
    const [games] = await connection.execute(
      "SELECT id, estat FROM partida WHERE codi = ? FOR UPDATE",
      [roomId]
    );
    if (games.length === 0) {
      throw gameError("GAME_NOT_RUNNING", "La partida no està en curs.");
    }
    if (games[0].estat !== "en_curs") {
      throw gameError("GAME_NOT_RUNNING", "La partida no està en curs.");
    }
    const [openRounds] = await connection.execute(
      "SELECT id FROM ronda WHERE partida_id = ? AND estat = 'oberta' LIMIT 1 FOR UPDATE",
      [games[0].id]
    );
    if (openRounds.length > 0) {
      throw gameError("ROUND_STILL_OPEN", "Encara hi ha una ronda oberta.");
    }
    const [round] = await connection.execute(
      "INSERT INTO ronda (partida_id, pregunta_id, numero, estat) VALUES (?, ?, ?, 'oberta')",
      [games[0].id, questionId, number]
    );
    return round.insertId;
  }
  return transaction(operacioAmbConnexio);
}

//=====================
//FUNCIÓ: DESA EL REGISTRE D'UNA RESPOSTA
//=====================
export async function saveAnswerRecord(roundId, nickname, value) {
  async function operacioAmbConnexio(connection) {
    const [rounds] = await connection.execute(
      "SELECT id, partida_id, estat FROM ronda WHERE id = ? FOR UPDATE",
      [roundId]
    );
    if (rounds.length === 0) {
      throw gameError("ROUND_NOT_FOUND", "La ronda no existeix.");
    }
    if (rounds[0].estat !== "oberta") {
      throw gameError("ROUND_CLOSED", "La ronda ja està tancada.");
    }
    const [participants] = await connection.execute(
      "SELECT id FROM participant WHERE partida_id = ? AND nickname = ?",
      [rounds[0].partida_id, nickname]
    );
    if (participants.length === 0) {
      throw gameError("PARTICIPANT_NOT_IN_GAME", "El participant no pertany a la partida.");
    }
    try {
      const [result] = await connection.execute(
        "INSERT INTO resposta (ronda_id, partida_id, participant_id, valor) VALUES (?, ?, ?, ?)",
        [roundId, rounds[0].partida_id, participants[0].id, value]
      );
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        throw gameError("ANSWER_ALREADY_EXISTS", "Ja has respost aquesta ronda.");
      }
      throw error;
    }
  }
  return transaction(operacioAmbConnexio);
}

//=====================
//FUNCIÓ: TANCA EL REGISTRE D'UNA RONDA I PUNTUA RESPOSTES
//=====================
export async function closeRoundRecord(roundId, question) {
  if (question === null) {
    throw gameError("QUESTION_INVALID", "La pregunta de la ronda no és vàlida.");
  }
  if (question === undefined) {
    throw gameError("QUESTION_INVALID", "La pregunta de la ronda no és vàlida.");
  }
  const esFinit = Number.isFinite(question.correctAnswer);
  if (esFinit === false) {
    throw gameError("QUESTION_INVALID", "La pregunta de la ronda no és vàlida.");
  }
  async function operacioAmbConnexio(connection) {
    const [rounds] = await connection.execute(
      "SELECT id, partida_id, pregunta_id, estat FROM ronda WHERE id = ? FOR UPDATE",
      [roundId]
    );
    if (rounds.length === 0) {
      throw gameError("ROUND_NOT_FOUND", "La ronda no existeix.");
    }
    if (rounds[0].estat !== "oberta") {
      throw gameError("ROUND_CLOSED", "La ronda ja està tancada.");
    }
    const preguntaIdString = String(rounds[0].pregunta_id);
    const questionIdString = String(question.id);
    if (preguntaIdString !== questionIdString) {
      throw gameError("QUESTION_MISMATCH", "La pregunta no correspon a la ronda.");
    }
    //FEM SERVIR LA PREGUNTA QUE S'HA ENVIAT ALS JUGADORS, NO EL CATÀLEG EDITABLE
    const correctAnswer = question.correctAnswer;
    const [answers] = await connection.execute(
      `SELECT a.id, a.valor, p.nickname, p.partida_id
       FROM resposta a JOIN participant p ON p.id = a.participant_id
       WHERE a.ronda_id = ?
       ORDER BY ABS(a.valor - ?) ASC, a.valor DESC, a.id ASC FOR UPDATE`,
      [roundId, correctAnswer]
    );
    const scoredAnswers = [];
    for (let i = 0; i < answers.length; i += 1) {
      if (answers[i].partida_id !== rounds[0].partida_id) {
        throw gameError("PARTICIPANT_NOT_IN_GAME", "Una resposta pertany a una altra partida.");
      }
      const points = calculatePoints(Number(answers[i].valor), correctAnswer);
      await connection.execute(
        "UPDATE resposta SET posicio = ?, punts = ? WHERE id = ?",
        [i + 1, points, answers[i].id]
      );
      scoredAnswers.push({ nickname: answers[i].nickname, points: points });
    }
    await connection.execute("UPDATE ronda SET estat = 'tancada' WHERE id = ?", [roundId]);
    const ranking = await getRanking(connection, rounds[0].partida_id);
    return { ranking: ranking, scoredAnswers: scoredAnswers };
  }
  return transaction(operacioAmbConnexio);
}

//=====================
//FUNCIÓ: ACABA EL REGISTRE D'UNA PARTIDA
//=====================
export async function finishGameRecord(roomId) {
  async function operacioAmbConnexio(connection) {
    const [games] = await connection.execute(
      "SELECT id, estat FROM partida WHERE codi = ? FOR UPDATE",
      [roomId]
    );
    if (games.length === 0) {
      throw gameError("GAME_NOT_RUNNING", "La partida no està en curs.");
    }
    if (games[0].estat !== "en_curs") {
      throw gameError("GAME_NOT_RUNNING", "La partida no està en curs.");
    }
    const [openRounds] = await connection.execute(
      "SELECT id FROM ronda WHERE partida_id = ? AND estat = 'oberta' LIMIT 1 FOR UPDATE",
      [games[0].id]
    );
    if (openRounds.length > 0) {
      throw gameError("ROUND_STILL_OPEN", "Encara hi ha una ronda oberta.");
    }
    const [result] = await connection.execute(
      `UPDATE partida SET estat = 'acabada', data_fi = CURRENT_TIMESTAMP
       WHERE codi = ? AND estat = 'en_curs'`,
      [roomId]
    );
    if (result.affectedRows === 0) {
      throw gameError("GAME_NOT_RUNNING", "La partida no està en curs.");
    }
    return getRanking(connection, games[0].id);
  }
  return transaction(operacioAmbConnexio);
}

//=====================
//FUNCIÓ: RONDES ENCERTADES (>= 90% DE PRECISIÓ) PER NICKNAME D'UNA PARTIDA
//=====================
export async function getCorrectRoundsByNickname(roomId) {
  const [rows] = await pool.execute(
    `SELECT p.nickname, COUNT(a.id) AS encerts
     FROM partida g
     INNER JOIN participant p ON p.partida_id = g.id
     LEFT JOIN resposta a ON a.participant_id = p.id AND a.punts >= 450
     WHERE g.codi = ?
     GROUP BY p.nickname`,
    [roomId]
  );
  const result = new Map();
  for (const row of rows) {
    result.set(row.nickname, Number(row.encerts));
  }
  return result;
}

//=====================
//FUNCIÓ: REINICIA UNA PARTIDA ABANDONADA
//=====================
export async function resetAbandonedGameRecord(roomId, nicknames) {
  async function operacioAmbConnexio(connection) {
    const [games] = await connection.execute(
      "SELECT id, estat FROM partida WHERE codi = ? FOR UPDATE",
      [roomId]
    );
    if (games.length === 0) {
      throw gameError("GAME_NOT_RUNNING", "La partida no està en curs.");
    }
    const estatActual = games[0].estat;
    const esEnCurs = estatActual === "en_curs";
    const esAcabada = estatActual === "acabada";
    if (esEnCurs === false) {
      if (esAcabada === false) {
        throw gameError("GAME_NOT_RUNNING", "La partida no està en curs.");
      }
    }
    //RESPOSTA I PARTICIPANT TENEN ON DELETE CASCADE: N'HI HA PROU D'ESBORRAR RONDES I PARTICIPANTS
    await connection.execute("DELETE FROM ronda WHERE partida_id = ?", [games[0].id]);
    await connection.execute("DELETE FROM participant WHERE partida_id = ?", [games[0].id]);
    for (const nickname of nicknames) {
      await connection.execute(
        "INSERT INTO participant (partida_id, nickname) VALUES (?, ?)",
        [games[0].id, nickname]
      );
    }
    await connection.execute(
      "UPDATE partida SET estat = 'esperant', data_inici = NULL, data_fi = NULL WHERE id = ?",
      [games[0].id]
    );
  }
  return transaction(operacioAmbConnexio);
}
