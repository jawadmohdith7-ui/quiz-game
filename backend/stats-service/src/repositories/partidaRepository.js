//ARXIU QUE GESTIONA L'ACCÉS A DADES DE LES PARTIDES RESUM

//=====================
//IMPORTEM
//=====================
import { fn, col, literal } from "sequelize";
import { sequelize } from "../db.js";
import { Partida } from "../models/Partida.js";

//=====================
//ESCRIPTURA
//=====================
export function crearPartida(dades) {
  return Partida.create(dades);
}

//=====================
//LECTURA: PERFIL DEL JUGADOR
//=====================
export async function obtenirEstadistiquesJugador(userId) {
  const [resum] = await Partida.findAll({
    where: { usuari_id: userId },
    attributes: [
      [fn("COUNT", col("id")), "partidesJugades"],
      [fn("SUM", literal("CASE WHEN posicio = 1 THEN 1 ELSE 0 END")), "victories"],
      [fn("SUM", literal("CASE WHEN posicio IN (2, 3) THEN 1 ELSE 0 END")), "podis"],
      [fn("ROUND", fn("AVG", col("encerts")), 2), "mitjanaEncerts"]
    ],
    raw: true
  });

  const catTop = await Partida.findOne({
    where: { usuari_id: userId },
    attributes: ["categoria", [fn("COUNT", col("id")), "vegades"]],
    group: ["categoria"],
    order: [[literal("vegades"), "DESC"]],
    raw: true
  });

  const historial = await Partida.findAll({
    where: { usuari_id: userId },
    attributes: [
      ["nom_sala", "nomSala"],
      "categoria",
      "posicio",
      ["data_partida", "data"]
    ],
    order: [["data_partida", "DESC"]],
    limit: 30,
    raw: true
  });

  return { resum, catTop, historial };
}

//=====================
//LECTURA: RANKING GLOBAL
//=====================
export async function obtenirRanking(limit) {
  const [rows] = await sequelize.query(
    `SELECT
       u.id AS userId,
       u.nom AS username,
       u.avatar_color AS avatarColor,
       COUNT(p.id) AS partidesJugades,
       SUM(CASE WHEN p.posicio = 1 THEN 1 ELSE 0 END) AS victories,
       SUM(CASE WHEN p.posicio IN (2, 3) THEN 1 ELSE 0 END) AS podis,
       SUM(p.encerts) AS encertsTotals
     FROM partides p
     INNER JOIN usuaris u ON u.id = p.usuari_id
     GROUP BY u.id, u.nom, u.avatar_color
     ORDER BY victories DESC, podis DESC, encertsTotals DESC, partidesJugades DESC, u.nom ASC
     LIMIT ?`,
    { replacements: [limit] }
  );

  return rows;
}
