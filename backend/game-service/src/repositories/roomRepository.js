//ARXIU QUE GESTIONA LA PERSISTÈNCIA DE SALES A LA BASE DE DADES

//=====================
//IMPORTEM
//=====================
import { pool } from "../db/pool.js";

//=====================
//FUNCIÓ: CREA EL REGISTRE D'UNA SALA NOVA
//=====================
export async function createRoomRecord({ roomId, isPrivate, maxPlayers, nickname }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    //DETERMINEM EL TIPUS DE SALA (PRIVADA O PÚBLICA)
    let tipusSala = "publica";
    if (isPrivate === true) {
      tipusSala = "privada";
    }

    const [gameResult] = await connection.execute(
      `INSERT INTO partida (tipus, codi, estat, max_jugadors)
       VALUES (?, ?, 'esperant', ?)`,
      [tipusSala, roomId, maxPlayers]
    );

    await connection.execute(
      "INSERT INTO participant (partida_id, nickname) VALUES (?, ?)",
      [gameResult.insertId, nickname]
    );

    await connection.commit();
    return gameResult.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

//=====================
//FUNCIÓ: AFEGEIX UN PARTICIPANT A UNA SALA EXISTENT
//=====================
export async function addRoomParticipant({ roomId, nickname }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [games] = await connection.execute(
      `SELECT id, estat, max_jugadors
       FROM partida
       WHERE codi = ?
       FOR UPDATE`,
      [roomId]
    );

    if (games.length === 0) {
      const error = new Error("La sala no existeix a la base de dades");
      error.code = "ROOM_NOT_FOUND";
      throw error;
    }

    const game = games[0];
    if (game.estat !== "esperant") {
      const error = new Error("La partida ja no accepta més jugadors");
      error.code = "ROOM_NOT_WAITING";
      throw error;
    }

    const [countRows] = await connection.execute(
      "SELECT COUNT(*) AS total FROM participant WHERE partida_id = ?",
      [game.id]
    );

    if (Number(countRows[0].total) >= game.max_jugadors) {
      const error = new Error("La sala és plena");
      error.code = "ROOM_FULL";
      throw error;
    }

    await connection.execute(
      "INSERT INTO participant (partida_id, nickname) VALUES (?, ?)",
      [game.id, nickname]
    );

    const [participants] = await connection.execute(
      `SELECT nickname
       FROM participant
       WHERE partida_id = ?
       ORDER BY id`,
      [game.id]
    );

    await connection.commit();

    //EXTRAIEM ELS NICKNAMES DELS PARTICIPANTS AMB UN BUCLE
    const nicknames = [];
    for (const participant of participants) {
      nicknames.push(participant.nickname);
    }
    return nicknames;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

//=====================
//FUNCIÓ: ACTUALITZA EL MÀXIM DE JUGADORS D'UNA SALA
//=====================
export async function updateRoomMaxPlayers({ roomId, maxPlayers }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [games] = await connection.execute(
      "SELECT id, estat FROM partida WHERE codi = ? FOR UPDATE",
      [roomId]
    );
    if (games.length === 0) {
      const error = new Error("La sala no existeix a la base de dades");
      error.code = "ROOM_NOT_FOUND";
      throw error;
    }
    if (games[0].estat !== "esperant") {
      const error = new Error("La partida ja ha començat");
      error.code = "ROOM_NOT_WAITING";
      throw error;
    }

    const [counts] = await connection.execute(
      "SELECT COUNT(*) AS total FROM participant WHERE partida_id = ?",
      [games[0].id]
    );
    if (Number(counts[0].total) > maxPlayers) {
      const error = new Error("La sala ja té més jugadors que el nou màxim");
      error.code = "ROOM_CAPACITY_BELOW_PARTICIPANTS";
      throw error;
    }

    await connection.execute(
      "UPDATE partida SET max_jugadors = ? WHERE id = ?",
      [maxPlayers, games[0].id]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

//=====================
//FUNCIÓ: TREU UN PARTICIPANT D'UNA SALA
//=====================
export async function removeRoomParticipant({ roomId, nickname }) {
  const connexio = await pool.getConnection();

  try {
    await connexio.beginTransaction();

    const [games] = await connexio.execute(
      "SELECT id FROM partida WHERE codi = ? FOR UPDATE",
      [roomId]
    );

    if (games.length > 0) {
      const gameId = games[0].id;

      const [participants] = await connexio.execute(
        "SELECT id FROM participant WHERE partida_id = ? AND nickname = ? FOR UPDATE",
        [gameId, nickname]
      );

      //S'ESBORRA SEMPRE, TAMBÉ AMB LA PARTIDA EN CURS
      //SI NO, QUI MARXA A MITJA PARTIDA ES QUEDA AL RÀNQUING I BLOQUEJA EL SEU SOBRENOM
      for (let i = 0; i < participants.length; i++) {
        await connexio.execute(
          "DELETE FROM resposta WHERE participant_id = ? AND partida_id = ?",
          [participants[i].id, gameId]
        );

        await connexio.execute(
          "DELETE FROM participant WHERE id = ? AND partida_id = ?",
          [participants[i].id, gameId]
        );
      }

      //LA PARTIDA BUIDA NOMÉS S'ESBORRA SI ENCARA ESPERA
      const [files] = await connexio.execute(
        "SELECT COUNT(*) AS total FROM participant WHERE partida_id = ?",
        [gameId]
      );

      if (Number(files[0].total) === 0) {
        await connexio.execute(
          "DELETE FROM partida WHERE id = ? AND estat = 'esperant'",
          [gameId]
        );
      }
    }

    await connexio.commit();
  } catch (error) {
    await connexio.rollback();
    throw error;
  } finally {
    connexio.release();
  }
}
