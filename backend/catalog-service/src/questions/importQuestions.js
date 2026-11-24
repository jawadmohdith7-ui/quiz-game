import { Categoria, Pregunta, sequelize } from "../db/sequelize.js";
import { loadQuestions } from "./loadQuestions.js";
import { validarPregunta } from "./validarPregunta.js";

//=====================
//ETIQUETES PER A L'INFORME: SENSE TEXT NO HI HA FORMA D'IDENTIFICAR LA PREGUNTA
//=====================
function textDePregunta(question) {
  if (question === null || typeof question !== "object") {
    return "(pregunta no vàlida)";
  }
  if (typeof question.text !== "string") {
    return "(sense text)";
  }
  if (question.text.trim() === "") {
    return "(text buit)";
  }
  return question.text.trim();
}

function nomDeCategoria(group) {
  if (group === null || typeof group !== "object") {
    return "(categoria desconeguda)";
  }
  if (typeof group.category !== "string") {
    return "(sense categoria)";
  }
  if (group.category.trim() === "") {
    return "(categoria buida)";
  }
  return group.category.trim();
}

//=====================
//VALORS QUE S'ESCRIVEN A LA BD, JA NORMALITZATS
//=====================
function valorsDePregunta(question) {
  const resposta =
    question.resposta_correcta ?? question.respuesta_correcta ?? question.correctAnswer ?? question.correcta;
  const unitat = question.unitat ?? question.unit ?? "";
  const dificultat = question.dificultat ?? question.dificultad ?? question.difficulty ?? "";
  const explicacio = question.explicacio ?? question.explicacion ?? question.explanation ?? "";

  return {
    resposta_correcta: Number(resposta),
    min: Number(question.min),
    max: Number(question.max),
    step: Number(question.step),
    unitat: String(unitat).trim(),
    dificultat: String(dificultat).trim().toLowerCase(),
    explicacio: String(explicacio).trim(),
  };
}

//=====================
//COMPARA UN CAMP DESAT AMB EL NOU (ELS NUMEROS PODEN ARRIBAR COM A TEXT)
//=====================
function haCanviat(existing, field, value) {
  if (typeof value === "number") {
    return Number(existing[field]) !== value;
  }
  return existing[field] !== value;
}

//=====================
//DESA UNA PREGUNTA EN LA SEVA PROPIA TRANSACCIO
//=====================
async function desaPregunta(question, rejected) {
  try {
    return await sequelize.transaction(async (transaction) => {
      const [category] = await Categoria.findOrCreate({
        where: { nom: question.categoria.trim() },
        transaction: transaction,
      });

      const text = (question.text ?? question.enunciat).trim();
      const existing = await Pregunta.findOne({
        where: { categoria_id: category.id, text: text },
        transaction: transaction,
      });
      const questionValues = valorsDePregunta(question);

      if (existing) {
        let changed = false;
        for (const field of Object.keys(questionValues)) {
          if (haCanviat(existing, field, questionValues[field]) === true) {
            changed = true;
            break;
          }
        }

        if (changed === false) {
          return "skipped";
        }

        Object.assign(existing, questionValues);
        await existing.save({ transaction: transaction });
        return "updated";
      }

      await Pregunta.create({
        categoria_id: category.id,
        text: text,
        ...questionValues,
      }, { transaction: transaction });
      return "imported";
    });
  } catch (error) {
    rejected.push({
      categoria: question.categoria,
      pregunta: textDePregunta(question),
      categoryIndex: null,
      questionIndex: null,
      errors: ["No s'ha pogut desar: " + error.message],
    });
    return "rejected";
  }
}

export async function importQuestions(filePath) {
  const groups = await loadQuestions(filePath);
  if (!Array.isArray(groups)) {
    throw new Error("El JSON ha de contenir una llista de categories.");
  }

  const rejected = [];
  const validQuestions = [];
  let updated = 0;
  groups.forEach((group, categoryIndex) => {
    if (!group || typeof group !== "object" || !Array.isArray(group.questions)) {
      rejected.push({
        categoria: nomDeCategoria(group),
        pregunta: "(el grup no té una llista de preguntes)",
        categoryIndex: categoryIndex,
        questionIndex: null,
        errors: ["La categoria ha de contenir una llista de preguntes."],
      });
      return;
    }

    group.questions.forEach((question, questionIndex) => {
      const input = question && typeof question === "object" && !Array.isArray(question)
        ? { ...question, categoria: group.category ?? "" }
        : question;
      const result = validarPregunta(input);
      if (!result.valid) {
        rejected.push({
          categoria: nomDeCategoria(group),
          pregunta: textDePregunta(question),
          categoryIndex: categoryIndex,
          questionIndex: questionIndex,
          errors: result.errors,
        });
      } else {
        validQuestions.push(input);
      }
    });
  });

  let imported = 0;
  let skipped = 0;

  //UNA TRANSACCIO PER PREGUNTA: SI UNA FALLA, ES DESCARTA I ES CONTINUA
  for (const question of validQuestions) {
    const estat = await desaPregunta(question, rejected);
    if (estat === "imported") {
      imported += 1;
    }
    if (estat === "updated") {
      updated += 1;
    }
    if (estat === "skipped") {
      skipped += 1;
    }
  }

  return { imported, updated, skipped, rejected };
}
