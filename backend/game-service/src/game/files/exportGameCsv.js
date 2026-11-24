//ARXIU QUE EXPORTA LES DADES D'UNA PARTIDA ACABADA EN FORMAT CSV

//=====================
//IMPORTEM
//=====================
import { stringify } from "csv-stringify/sync";
import { pool } from "../../db/pool.js";

//=====================
//FUNCIÓ AUXILIAR: DECIMAL AMB COMA PER A EXCEL (ES-ES/CA)
//EL DECIMAL(20,6) ARRIBA COM A STRING "42.000000"; NULL HA DE QUEDAR BUIT
//=====================
function aDecimalCsv(value) {
  if (value === null) {
    return "";
  }
  if (value === undefined) {
    return "";
  }
  const num = Number(value);
  if (Number.isFinite(num) === false) {
    return "";
  }
  return String(num).replace(".", ",");
}

//=====================
//FUNCIÓ: EXPORTA LES DADES D'UNA PARTIDA EN CSV
//EL CONSTRUCTOR REP L'ID DE LA SALA I OPCIONALMENT UNA CONNEXIÓ
//=====================
export async function exportGameCsv(roomId, connection = pool) {
  //VALIDEM QUE ROOMID SIGUI UN STRING NO BUIT
  if (typeof roomId !== "string") {
    throw new Error("Cal indicar el codi de la partida.");
  }
  const trimmed = roomId.trim();
  if (trimmed === "") {
    throw new Error("Cal indicar el codi de la partida.");
  }

  const [games] = await connection.execute(
    "SELECT id, estat FROM partida WHERE codi = ?",
    [roomId]
  );
  if (games.length === 0) {
    throw new Error("La partida no existeix.");
  }
  if (games[0].estat !== "acabada") {
    throw new Error("Només es poden exportar partides acabades.");
  }

  //OBTENIM TOTES LES RESPOSTES AMB LES SEVES PREGUNTES I PUNTS
  const [rows] = await connection.execute(
    `SELECT p.id AS participant_id, p.nickname, r.numero AS ronda,
            q.text AS pregunta, a.valor AS resposta, a.punts
     FROM participant p
     LEFT JOIN (
       SELECT a.participant_id, SUM(a.punts) AS score
       FROM resposta a JOIN ronda r ON r.id = a.ronda_id
       WHERE r.partida_id = ?
       GROUP BY a.participant_id
     ) totals ON totals.participant_id = p.id
     LEFT JOIN resposta a ON a.participant_id = p.id
       AND a.ronda_id IN (SELECT id FROM ronda WHERE partida_id = p.partida_id)
     LEFT JOIN ronda r ON r.id = a.ronda_id
     LEFT JOIN pregunta q ON q.id = r.pregunta_id
     WHERE p.partida_id = ?
     ORDER BY COALESCE(totals.score, 0) DESC, p.nickname ASC, p.id ASC, r.numero`,
    [games[0].id, games[0].id]
  );

  //AGRUEM LES RESPOSTES PER PARTICIPANT
  const players = new Map();
  for (const row of rows) {
    const alreadyExists = players.has(row.participant_id);
    if (alreadyExists === false) {
      players.set(row.participant_id, { nickname: row.nickname, score: 0, answers: [] });
    }
    const player = players.get(row.participant_id);
    //SUMEM ELS PUNTS (0 SI ÉN NULL)
    let puntsValue = row.punts;
    if (puntsValue === null) {
      puntsValue = 0;
    }
    if (puntsValue === undefined) {
      puntsValue = 0;
    }
    player.score += Number(puntsValue);
    player.answers.push(row);
  }

  //CONSTRUÏM ELS REGISTRES CSV AMB POSICIÓ, NICKNAME I DADES DE RONDA
  const records = [];
  let index = 0;
  for (const player of players.values()) {
    for (const answer of player.answers) {
      const record = {
        posicio: index + 1,
        nickname: player.nickname,
        punts_totals: player.score,
        ronda: answer.ronda,
        pregunta: answer.pregunta,
        resposta: aDecimalCsv(answer.resposta),
        punts_ronda: answer.punts,
      };
      records.push(record);
    }
    index = index + 1;
  }

  return stringify(records, {
    header: true,
    columns: ["posicio", "nickname", "punts_totals", "ronda", "pregunta", "resposta", "punts_ronda"],
    delimiter: ";",
    bom: true,
    escape_formulas: true,
  });
}
