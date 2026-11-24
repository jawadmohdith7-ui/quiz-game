//ARXIU QUE DONA LES ESTADISTIQUES, ELS PERCENTATGES I EL GRAFIC D'US AL PANELL D'ADMINISTRACIO

//=====================
//IMPORTEM
//=====================
import express from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../db.js";
import { verifyInternalService, verifyToken } from "../auth.middleware.js";
import { requireAdmin } from "../requireAdmin.js";
import { construirFiltreSala } from "../filtreSala.js";

//=====================
//ROUTER
//=====================
export const adminRoutes = express.Router();

adminRoutes.use(verifyInternalService);
adminRoutes.use(verifyToken);
adminRoutes.use(requireAdmin);

//=====================
//AJUDANTS
//=====================

//RETORNA EL RANG DE DATES I ELS PUNTS DEL PERIODE DEMANAT
function dadesPeriode(periode) {
  const resultat = {
    periode: "dia",
    punts: 24,
    unitat: "HOUR",
    dies: 1,
    etiquetaActual: "Avui",
    etiquetaAnterior: "Ahir",
  };

  if (periode === "setmana") {
    resultat.periode = "setmana";
    resultat.punts = 7;
    resultat.unitat = "DAY";
    resultat.dies = 7;
    resultat.etiquetaActual = "Aquesta setmana";
    resultat.etiquetaAnterior = "Setmana anterior";
    return resultat;
  }

  if (periode === "mes") {
    resultat.periode = "mes";
    resultat.punts = 30;
    resultat.unitat = "DAY";
    resultat.dies = 30;
    resultat.etiquetaActual = "Aquest mes";
    resultat.etiquetaAnterior = "Mes anterior";
    return resultat;
  }

  return resultat;
}

//COMPTA ELS REGISTRES D'UN INTERVAL I ELS REPARTEIX EN PUNTS
async function seriePerInterval(taula, camp, inici, punts, unitat) {
  //TIMESTAMPDIFF ENS DONA LA POSICIO DEL PUNT (0 = PRIMER) SIGUI HORA O DIA
  const sql =
    "SELECT TIMESTAMPDIFF(" +
    unitat +
    ", ?, " +
    camp +
    ") AS etiqueta, COUNT(*) AS total FROM " +
    taula +
    " WHERE " +
    camp +
    " >= ? GROUP BY etiqueta ORDER BY etiqueta";

  const files = await sequelize.query(sql, {
    replacements: [inici, inici],
    type: QueryTypes.SELECT,
  });

  const valors = [];

  for (let i = 0; i < punts; i = i + 1) {
    valors.push(0);
  }

  for (const fila of files) {
    const index = Number(fila.etiqueta);

    if (index >= 0 && index < punts) {
      valors[index] = Number(fila.total);
    }
  }

  return valors;
}

//MUNTATGE DE LA RESPOSTA DEL GRAFIC
async function calculaUsage(periode) {
  const dades = dadesPeriode(periode);
  const ara = new Date();

  //INICI DEL PERIODE ACTUAL I DEL PERIODE ANTERIOR
  const iniciActual = new Date(ara.getTime() - dades.dies * 24 * 60 * 60 * 1000);
  const iniciAnterior = new Date(
    ara.getTime() - 2 * dades.dies * 24 * 60 * 60 * 1000
  );

  const usuarisActual = await seriePerInterval(
    "usuaris",
    "data_creacio",
    iniciActual,
    dades.punts,
    dades.unitat
  );

  const usuarisAnterior = await seriePerInterval(
    "usuaris",
    "data_creacio",
    iniciAnterior,
    dades.punts,
    dades.unitat
  );

  const partidesActual = await seriePerInterval(
    "partides",
    "data_partida",
    iniciActual,
    dades.punts,
    dades.unitat
  );

  const partidesAnterior = await seriePerInterval(
    "partides",
    "data_partida",
    iniciAnterior,
    dades.punts,
    dades.unitat
  );

  return {
    periode: dades.periode,
    etiquetaActual: dades.etiquetaActual,
    etiquetaAnterior: dades.etiquetaAnterior,
    usuaris: { actual: usuarisActual, anterior: usuarisAnterior },
    partides: { actual: partidesActual, anterior: partidesAnterior },
  };
}

//PERCENTATGE AMB UNA SOLA DIVISIO I SENSE TERNARIS
function percentatge(part, total) {
  if (total === 0) {
    return 0;
  }

  const resultat = (part / total) * 100;
  return Math.round(resultat * 10) / 10;
}

//=====================
//ESTADISTIQUES
//=====================
adminRoutes.get("/estadistiques", async function estadistiques(req, res) {
  try {
    const sala = String(req.query.sala || "");

    //=====================
    //FILTRE DE SALA: EL MATEIX PER ALS TOTALS I PER A LA LLISTA
    //=====================
    const filtre = construirFiltreSala(sala);

    const general = await sequelize.query(
      "SELECT COUNT(*) AS partides, COUNT(DISTINCT p.usuari_id) AS jugadors, AVG(p.encerts) AS encerts FROM partides p" +
        filtre.condicioSala,
      { replacements: filtre.valorsSala, type: QueryTypes.SELECT }
    );

    let sqlSales =
      "SELECT p.nom_sala, COUNT(*) AS partides, COUNT(DISTINCT p.usuari_id) AS jugadors, AVG(p.encerts) AS encerts FROM partides p GROUP BY p.nom_sala ORDER BY partides DESC";

    if (sala !== "") {
      sqlSales =
        "SELECT p.nom_sala, COUNT(*) AS partides, COUNT(DISTINCT p.usuari_id) AS jugadors, AVG(p.encerts) AS encerts FROM partides p WHERE p.nom_sala = ? GROUP BY p.nom_sala";
    }

    const sales = await sequelize.query(sqlSales, {
      replacements: filtre.valorsSala,
      type: QueryTypes.SELECT,
    });

    res.json({ ok: true, general: general[0], sales: sales });
  } catch (error) {
    res.status(500).json({ ok: false, reason: error.message });
  }
});

//=====================
//REGISTRE (ENCERTS I ERRORS)
//=====================
adminRoutes.get("/registre", async function registreDades(req, res) {
  try {
    //shortcut: setmana i mes son finestres mobils de 7/30 dies, no setmanes o mesos de calendari; canviar si el client ho demana
    const periode = String(req.query.periode || "avui");
    let dies = 1;

    if (periode === "setmana") {
      dies = 7;
    }

    if (periode === "mes") {
      dies = 30;
    }

    const files = await sequelize.query(
      "SELECT estat, COUNT(*) AS total FROM registre WHERE creat_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY estat",
      { replacements: [dies], type: QueryTypes.SELECT }
    );

    let encerts = 0;
    let errors = 0;

    for (const fila of files) {
      if (Number(fila.estat) < 400) {
        encerts = encerts + Number(fila.total);
      } else {
        errors = errors + Number(fila.total);
      }
    }

    const total = encerts + errors;

    res.json({
      ok: true,
      periode: periode,
      total: total,
      encerts: encerts,
      errors: errors,
      percentatgeEncerts: percentatge(encerts, total),
      percentatgeErrors: percentatge(errors, total),
    });
  } catch (error) {
    res.status(500).json({ ok: false, reason: error.message });
  }
});

//=====================
//GRAFIC D'US
//=====================
adminRoutes.get("/usage", async function usage(req, res) {
  try {
    const periode = String(req.query.periode || "dia");
    const dades = await calculaUsage(periode);
    res.json({ ok: true, usage: dades });
  } catch (error) {
    res.status(500).json({ ok: false, reason: error.message });
  }
});
