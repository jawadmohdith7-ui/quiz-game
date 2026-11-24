//ARXIU QUE VALIDA EL BODY DE LA PETICIÓ DE PREGUNTES

//=====================
//DECLAREM EL MIDDLEWARE DE VALIDACIÓ PER GET PREGUNTES
//=====================
export function validateGetPreguntas(req, res, next) {
  const { numQuestions, category, difficulty } = req.body;

  //VALIDEM numQuestions: HA DE SER ENTER MAJOR QUE 0
  if (
    typeof numQuestions !== "number" ||
    !Number.isInteger(numQuestions) ||
    numQuestions <= 0
  ) {
    const error = new Error(
      "numQuestions ha de ser un enter positiu major que 0"
    );
    error.statusCode = 400;
    error.code = "INVALID_NUM_QUESTIONS";
    return next(error);
  }

  //VALIDEM category: HA DE SER TEXT NO BUIT
  if (typeof category !== "string" || category.trim() === "") {
    const error = new Error("category ha de ser un text no buit");
    error.statusCode = 400;
    error.code = "INVALID_CATEGORY";
    return next(error);
  }

  //VALIDEM difficulty SI VE: mix ÉS EL FILTRE SENSE RESTRICCIÓ
  if (difficulty !== undefined) {
    const normalizedDifficulty =
      typeof difficulty === "string" ? difficulty.trim().toLowerCase() : "";
    if (
      normalizedDifficulty.length === 0 ||
      normalizedDifficulty.length > 32
    ) {
      const error = new Error("difficulty ha de tenir entre 1 i 32 caràcters");
      error.statusCode = 400;
      error.code = "INVALID_DIFFICULTY";
      return next(error);
    }

    req.body.difficulty = normalizedDifficulty;
  }

  //VALIDEM partida SI VE: ÉS EL CODI DE LA SALA (sala_xxxxx)
  if (req.body.partida !== undefined) {
    if (
      typeof req.body.partida !== "string" ||
      req.body.partida.trim() === "" ||
      req.body.partida.length > 20
    ) {
      const error = new Error("partida ha de ser el codi de la sala");
      error.statusCode = 400;
      error.code = "INVALID_PARTIDA";
      return next(error);
    }

    req.body.partida = req.body.partida.trim();
  }

  //SI TOT CORRECTE, CONTINUEM
  next();
}
