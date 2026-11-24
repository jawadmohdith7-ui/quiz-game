//ARXIU QUE GESTIONA ELS ERRORS GLOBALMENT I RETORNA RESPOSTES ESTANDARDITZADES

//=====================
//IMPORTEM
//=====================
import { mapSequelizeError } from "../errors/sequelizeErrors.js";

//=====================
//DECLAREM EL MIDDLEWARE ERROR HANDLER
//=====================
export function errorHandler(err, req, res, next) {
  // LOGUEM L'ERROR PER DEPURACIO
  console.error("Error:", err.message);

  // TRADUIM ELS ERRORS DE SEQUELIZE ABANS DE LLEGIR ELS CODIS PROPIS
  const traduit = mapSequelizeError(err);

  // STATUS CODE: TRADUIT > PROPI > 500
  const statusCode = traduit?.statusCode ?? err.statusCode ?? 500;

  // CODI D'ERROR: TRADUIT > PROPI > GENÈRIC
  const code = traduit?.code ?? err.code ?? "INTERNAL_ERROR";

  // MISSATGE PER AL CLIENT
  const message = traduit?.message ?? err.message ?? "Error intern del servidor";

  // MAPA DE CAMPS: NOMÉS ELS ERRORS TRADUÏTS O ELS PROPIS DE VALIDACIÓ
  const errors = traduit ? traduit.errors : err.errors;

  // RESPOSTA COMPATIBLE AMB LES RUTES PUBLIQUES ({ error }) I LES D'ADMIN ({ ok, reason })
  const resposta = {
    ok: false,
    code,
    reason: message,
    error: { code, message },
  };

  if (errors) {
    resposta.errors = errors;
  }

  res.status(statusCode).json(resposta);
}
