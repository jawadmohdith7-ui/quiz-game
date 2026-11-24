//ARXIU QUE TRADUEIX ELS ERRORS DE SEQUELIZE A RESPOSTES HTTP

//=====================
//IMPORTEM
//=====================
import {
  UniqueConstraintError,
  ForeignKeyConstraintError,
  ValidationError,
} from "sequelize";

//=====================
//UNIQUE HERETA DE VALIDATION: HA D'ANAR PRIMER
//=====================
export function mapSequelizeError(err) {
  if (err instanceof UniqueConstraintError) {
    return {
      statusCode: 409,
      code: "UNIQUE_CONSTRAINT",
      message: "Ja existeix un registre amb aquestes dades.",
    };
  }

  if (err instanceof ForeignKeyConstraintError) {
    return {
      statusCode: 409,
      code: "FOREIGN_KEY_CONSTRAINT",
      message: "El registre referenciat no existeix o encara s'està fent servir.",
    };
  }

  if (err instanceof ValidationError) {
    const errors = {};

    for (const item of err.errors) {
      errors[item.path] = item.message;
    }

    return {
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: err.errors.map((item) => item.path + ": " + item.message).join(" "),
      errors,
    };
  }

  return null;
}
