function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function validarPregunta(pregunta) {
  const errors = [];

  if (!pregunta || typeof pregunta !== "object" || Array.isArray(pregunta)) {
    return { valid: false, errors: ["La pregunta no és un objecte vàlid."] };
  }

  const text = normalizeText(pregunta.text ?? pregunta.enunciat);
  if (!text) {
    errors.push("El text de la pregunta és obligatori.");
  } else if (Buffer.byteLength(text, "utf8") > 65535) {
    errors.push("El text de la pregunta és massa llarg.");
  }

  const rawResposta =
    pregunta.resposta_correcta ??
    pregunta.respuesta_correcta ??
    pregunta.correctAnswer ??
    pregunta.correcta;
  const resposta = ["number", "string"].includes(typeof rawResposta)
    ? Number(rawResposta)
    : NaN;
  if (
    !["number", "string"].includes(typeof rawResposta) ||
    (typeof rawResposta === "string" && !rawResposta.trim()) ||
    !Number.isFinite(resposta) ||
    Math.abs(resposta) >= 1e14
  ) {
    errors.push("La resposta correcta ha de ser numèrica.");
  }

  const rawMin = pregunta.min;
  const rawMax = pregunta.max;
  const rawStep = pregunta.step;
  const min = ["number", "string"].includes(typeof rawMin) ? Number(rawMin) : NaN;
  const max = ["number", "string"].includes(typeof rawMax) ? Number(rawMax) : NaN;
  const step = ["number", "string"].includes(typeof rawStep) ? Number(rawStep) : NaN;
  const steps = (max - min) / step;
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    !Number.isFinite(step) ||
    !Number.isFinite(steps) ||
    min >= max ||
    step <= 0 ||
    steps > 100000 ||
    Math.abs(steps - Math.round(steps)) > Math.max(1e-7, Math.abs(steps) * 1e-9) ||
    resposta < min ||
    resposta > max
  ) {
    errors.push("min, max i step han de definir un rang vàlid i divisible per a la resposta.");
  }

  const unitat = normalizeText(pregunta.unitat ?? pregunta.unit);
  if (unitat.length > 50) {
    errors.push("La unitat no pot superar 50 caràcters.");
  }

  const dificultat = normalizeText(
    pregunta.dificultat ?? pregunta.dificultad ?? pregunta.difficulty
  ).toLowerCase();
  if (!dificultat || dificultat.length > 32 || dificultat === "mix") {
    errors.push("La dificultat ha de tenir entre 1 i 32 caràcters i no pot ser mix.");
  }

  const explicacio = normalizeText(
    pregunta.explicacio ?? pregunta.explicacion ?? pregunta.explanation
  );
  if (!explicacio) {
    errors.push("La explicació és obligatòria.");
  } else if (Buffer.byteLength(explicacio, "utf8") > 65535) {
    errors.push("La explicació és massa llarga.");
  }

  const categoria = normalizeText(
    pregunta.categoria ?? pregunta.category ?? pregunta.categoria_nom
  );
  if (!categoria) {
    errors.push("La categoria és obligatòria.");
  } else if (categoria.length > 100) {
    errors.push("La categoria no pot superar 100 caràcters.");
  }

  if (
    pregunta.categoria_id !== undefined &&
    pregunta.categoria_id !== null &&
    (!["number", "string"].includes(typeof pregunta.categoria_id) ||
      !Number.isInteger(Number(pregunta.categoria_id)))
  ) {
    errors.push("categoria_id ha de ser un enter.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
