//ARXIU QUE COMPROVA EL TOKEN JWT I EL SECRET DE SERVEI A LES RUTES D'ESTADÍSTIQUES

//=====================
//IMPORTEM
//=====================
import crypto from "crypto";
import jwt from "jsonwebtoken";

//=====================
//CONSTANTS: SECRETS DELS TOKENS I DELS SERVEIS
//=====================
const AUTH_SECRET = process.env.AUTH_SECRET;
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

//=====================
//MIDDLEWARE: NOMÉS DEIXA PASSAR ELS SERVEIS DE LA PLATAFORMA
//=====================
export function verifyInternalService(req, res, next) {
  //SI NO HI HA SECRET CONFIGURAT, TANQUEM LA PORTA
  if (INTERNAL_SECRET === undefined || INTERNAL_SECRET.length === 0) {
    res.status(503).json({
      ok: false,
      error: "Accés intern no configurat.",
    });
    return;
  }

  const secret = req.headers["x-internal-secret"];

  if (typeof secret !== "string") {
    res.status(403).json({
      ok: false,
      error: "Accés denegat: només game-service pot registrar partides.",
    });
    return;
  }

  if (secret.length !== INTERNAL_SECRET.length) {
    res.status(403).json({
      ok: false,
      error: "Accés denegat: només game-service pot registrar partides.",
    });
    return;
  }

  const secretBuffer = Buffer.from(secret, "utf8");
  const expectedBuffer = Buffer.from(INTERNAL_SECRET, "utf8");

  if (crypto.timingSafeEqual(secretBuffer, expectedBuffer) === false) {
    res.status(403).json({
      ok: false,
      error: "Accés denegat: només game-service pot registrar partides.",
    });
    return;
  }

  next();
}

//=====================
//MIDDLEWARE: EXIGEIX UN TOKEN JWT VÀLID I DESA req.user
//=====================
export function verifyToken(req, res, next) {
  if (AUTH_SECRET === undefined || AUTH_SECRET.length === 0) {
    res.status(503).json({
      ok: false,
      error: "Autenticació no configurada.",
    });
    return;
  }

  const authHeader = req.headers.authorization;

  if (authHeader === undefined) {
    res.status(401).json({
      ok: false,
      error: "Falta el token d'autenticació.",
    });
    return;
  }

  if (authHeader.startsWith("Bearer ") === false) {
    res.status(401).json({
      ok: false,
      error: "Falta el token d'autenticació.",
    });
    return;
  }

  const token = authHeader.slice(7);
  let payload = null;

  try {
    payload = jwt.verify(token, AUTH_SECRET, { algorithms: ["HS256"] });
  } catch (error) {
    //SI EL TOKEN HA CADUCAT, HO DIEM EXPLÍCITAMENT
    if (error.name === "TokenExpiredError") {
      res.status(401).json({
        ok: false,
        error: "El token ha caducat.",
      });
      return;
    }

    res.status(401).json({
      ok: false,
      error: "Token manipulat o invàlid.",
    });
    return;
  }

  const userId = Number(payload.sub);

  if (Number.isSafeInteger(userId) === false) {
    res.status(401).json({
      ok: false,
      error: "Token manipulat o invàlid.",
    });
    return;
  }

  if (userId < 1) {
    res.status(401).json({
      ok: false,
      error: "Token manipulat o invàlid.",
    });
    return;
  }

  req.user = {
    userId: userId,
    username: payload.username,
    //EL ROL ÉS IMPRESCINDIBLE: SENSE ELL NO ES POT COMPROVAR QUI ÉS ADMIN
    rol: payload.rol,
  };

  next();
}
