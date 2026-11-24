//ARXIU QUE GESTIONA L'ACCÉS A DADES DE LES PREGUNTES

//=====================
//IMPORTEM
//=====================
import { UniqueConstraintError } from "sequelize";
import { Categoria, Pregunta } from "../db/sequelize.js";
import { pool } from "../db/pool.js";
import { importQuestions } from "./importQuestions.js";

export async function ensureInitialCatalog() {
  await pool.query(
    `INSERT IGNORE INTO categoria (nom) VALUES
      ('Geografia'),
      ('Ciencia'),
      ('Historia'),
      ('Esports'),
      ('Cultura'),
      ('Cos Humà'),
      ('Tecnologia'),
      ('Curiositats')`
  );

  const [rows] = await pool.execute(
    "SELECT COUNT(*) AS total FROM pregunta"
  );
  if (Number(rows[0].total) === 0) {
    return importQuestions();
  }

  return null;
}

export async function listCatalogOptions() {
  const [categories] = await pool.execute(
    "SELECT nom FROM categoria ORDER BY nom"
  );
  const [difficulties] = await pool.execute(
    "SELECT DISTINCT dificultat FROM pregunta ORDER BY dificultat"
  );

  return {
    categories: categories.map((category) => category.nom),
    difficulties: difficulties.map((difficulty) => difficulty.dificultat),
  };
}

export async function getRandomQuestionsFromDatabase(category, limit, difficulty, partidaCodi = null, conn = pool) {
  const filters = [];
  const params = [];
  if (category.trim().toLowerCase() !== "mix") {
    const [categories] = await conn.execute(
      "SELECT id FROM categoria WHERE nom = ?",
      [category.trim()]
    );
    if (!categories.length) return null;
    filters.push("p.categoria_id = ?");
    params.push(categories[0].id);
  }
  if (difficulty && difficulty !== "mix") {
    filters.push("p.dificultat = ?");
    params.push(difficulty);
  }
  if (partidaCodi) {
    //EXCLOU LES PREGUNTES QUE JA TENEN RONDA EN AQUESTA PARTIDA
    filters.push(`p.id NOT IN (
      SELECT r.pregunta_id
      FROM ronda r
      JOIN partida pa ON pa.id = r.partida_id
      WHERE pa.codi = ?
    )`);
    params.push(partidaCodi);
  }
  params.push(limit);
  const [rows] = await conn.execute(
    `SELECT p.id, p.text, p.resposta_correcta AS correctAnswer,
            p.min_value AS min, p.max_value AS max, p.step_value AS step,
            p.unitat AS unit, p.dificultat AS difficulty, p.explicacio AS explanation
     FROM pregunta p
     ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
     ORDER BY RAND() LIMIT ?`,
    params
  );
  return rows.map((row) => ({
    ...row,
    correctAnswer: Number(row.correctAnswer),
    min: Number(row.min),
    max: Number(row.max),
    step: Number(row.step),
  }));
}

//=====================
//UTILS: validació i normalització
//=====================
function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validateCategoriaInput(nom) {  const nomNormalitzat = normalizeText(nom);

  if (!nomNormalitzat) {
    const error = new Error("El nom de la categoria és obligatori.");
    error.code = "CATEGORY_NAME_REQUIRED";
    throw error;
  }

  return nomNormalitzat;
}

//=====================
//ERRORS DE VALIDACIO: UN MISSATGE PER CAMP
//=====================
function validationError(errors) {
  const error = new Error("Revisa els camps marcats.");
  error.code = "VALIDATION_ERROR";
  error.statusCode = 422;
  error.errors = errors;
  return error;
}

function isBlank(value) {
  return value === "" || value === null || value === undefined;
}

export function validatePreguntaInput(pregunta) {
  if (!pregunta || typeof pregunta !== "object") {
    throw validationError({ general: "La pregunta no és vàlida." });
  }

  const errors = {};

  const text = normalizeText(pregunta.text ?? pregunta.enunciat ?? "");
  if (!text) {
    errors.text = "El text de la pregunta és obligatori.";
  }

  const categoriaId = Number(pregunta.categoria_id ?? pregunta.categoriaId);
  if (!Number.isInteger(categoriaId) || categoriaId <= 0) {
    errors.categoria_id = "La categoria de la pregunta és obligatòria.";
  }

  const respostaRaw =
    pregunta.resposta_correcta ?? pregunta.respuesta_correcta ?? pregunta.correctAnswer;
  const respostaCorrecta = Number(respostaRaw);
  if (isBlank(respostaRaw) || !Number.isFinite(respostaCorrecta)) {
    errors.resposta_correcta = "La resposta correcta és obligatòria i ha de ser numèrica.";
  }

  const min = Number(pregunta.min);
  const max = Number(pregunta.max);
  const step = Number(pregunta.step);

  if (isBlank(pregunta.min) || !Number.isFinite(min)) {
    errors.min = "El valor mínim ha de ser numèric.";
  }
  if (isBlank(pregunta.max) || !Number.isFinite(max)) {
    errors.max = "El valor màxim ha de ser numèric.";
  }
  if (isBlank(pregunta.step) || !Number.isFinite(step) || step <= 0) {
    errors.step = "L'increment ha de ser més gran que 0.";
  }

  if (!errors.min && !errors.max && min >= max) {
    errors.max = "El valor màxim ha de ser més gran que el mínim.";
  }

  if (!errors.min && !errors.max && !errors.step) {
    const steps = (max - min) / step;
    const enter = Math.abs(steps - Math.round(steps)) <= Math.max(1e-7, Math.abs(steps) * 1e-9);
    if (!Number.isFinite(steps) || steps > 100000 || !enter) {
      errors.step = "L'increment no encaixa dins del rang (ha de fer un nombre enter de passos).";
    }
  }

  if (!errors.resposta_correcta && !errors.min && !errors.max) {
    if (respostaCorrecta < min || respostaCorrecta > max) {
      errors.resposta_correcta = "La resposta correcta ha d'estar entre el mínim i el màxim.";
    }
  }

  const unitat = normalizeText(pregunta.unitat ?? pregunta.unit ?? "");
  if (unitat.length > 50) {
    errors.unitat = "La unitat no pot passar de 50 caràcters.";
  }

  const dificultat = normalizeText(
    pregunta.dificultat ?? pregunta.dificultad ?? pregunta.difficulty ?? ""
  ).toLowerCase();
  if (!dificultat) {
    errors.dificultat = "La dificultat és obligatòria.";
  } else if (dificultat.length > 32) {
    errors.dificultat = "La dificultat no pot passar de 32 caràcters.";
  } else if (dificultat === "mix") {
    errors.dificultat = "«mix» no és una dificultat vàlida per a una pregunta.";
  }

  const explicacio = normalizeText(
    pregunta.explicacio ?? pregunta.explicacion ?? pregunta.explanation ?? ""
  );
  if (!explicacio) {
    errors.explicacio = "L'explicació és obligatòria.";
  }

  if (Object.keys(errors).length > 0) {
    throw validationError(errors);
  }

  return {
    categoria_id: categoriaId,
    text,
    resposta_correcta: respostaCorrecta,
    min,
    max,
    step,
    unitat,
    dificultat,
    explicacio,
  };
}

//=====================
//CRUD: categories
//=====================
//LA UNICITAT TE DUES BARREERES: EL findOne PER AL MISSATGE I L'UNIQUE PER A LA CURSA
function categoryAlreadyExistsError() {
  const error = new Error("Ja existeix una categoria amb aquest nom.");
  error.code = "CATEGORY_ALREADY_EXISTS";
  error.statusCode = 409;
  error.errors = { nom: "Ja existeix una categoria amb aquest nom." };
  return error;
}

export async function listCategoriesWithQuestions() {
  return Categoria.findAll({
    include: [{ model: Pregunta, as: "preguntas" }],
    order: [["id", "ASC"], [{ model: Pregunta, as: "preguntas" }, "id", "ASC"]],
  });
}

export async function createCategory(nom) {
  const nomNormalitzat = validateCategoriaInput(nom);

  const existing = await Categoria.findOne({
    where: { nom: nomNormalitzat },
  });

  if (existing) {
    throw categoryAlreadyExistsError();
  }

  try {
    return await Categoria.create({ nom: nomNormalitzat });
  } catch (error) {
    //DOS ADMINS ALHORA: EL findOne PASSA I QUI REBUTJA ES L'UNIQUE (schema.sql:17)
    if (error instanceof UniqueConstraintError) {
      throw categoryAlreadyExistsError();
    }
    throw error;
  }
}

export async function updateCategory(id, nom) {
  const categoria = await Categoria.findByPk(id);

  if (!categoria) {
    const error = new Error("Categoria no trobada.");
    error.code = "CATEGORY_NOT_FOUND";
    throw error;
  }

  const nomNormalitzat = validateCategoriaInput(nom);

  const duplicate = await Categoria.findOne({
    where: { nom: nomNormalitzat },
  });

  if (duplicate && duplicate.id !== Number(id)) {
    throw categoryAlreadyExistsError();
  }

  categoria.nom = nomNormalitzat;

  try {
    await categoria.save();
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw categoryAlreadyExistsError();
    }
    throw error;
  }

  return categoria;
}

export async function deleteCategory(id) {
  const categoria = await Categoria.findByPk(id);

  if (!categoria) {
    const error = new Error("Categoria no trobada.");
    error.code = "CATEGORY_NOT_FOUND";
    throw error;
  }

  await categoria.destroy();
  return true;
}

//=====================
//CRUD: preguntes
//=====================
export async function listQuestions() {
  return Pregunta.findAll({
    include: [{ model: Categoria, as: "categoria" }],
    order: [["id", "ASC"]],
  });
}

export async function createQuestion(input) {
  const data = validatePreguntaInput(input);

  const categoria = await Categoria.findByPk(data.categoria_id);
  if (!categoria) {
    const error = new Error("La categoria indicada no existeix.");
    error.code = "CATEGORY_NOT_FOUND";
    throw error;
  }

  return Pregunta.create(data);
}

export async function updateQuestion(id, input) {
  const pregunta = await Pregunta.findByPk(id);

  if (!pregunta) {
    const error = new Error("Pregunta no trobada.");
    error.code = "QUESTION_NOT_FOUND";
    throw error;
  }

  const data = validatePreguntaInput({ ...pregunta.toJSON(), ...input });

  if (data.categoria_id !== pregunta.categoria_id) {
    const categoria = await Categoria.findByPk(data.categoria_id);
    if (!categoria) {
      const error = new Error("La categoria indicada no existeix.");
      error.code = "CATEGORY_NOT_FOUND";
      throw error;
    }
  }

  Object.assign(pregunta, data);
  await pregunta.save();
  return pregunta;
}

export async function deleteQuestion(id) {
  const pregunta = await Pregunta.findByPk(id);

  if (!pregunta) {
    const error = new Error("Pregunta no trobada.");
    error.code = "QUESTION_NOT_FOUND";
    throw error;
  }

  await pregunta.destroy();
  return true;
}