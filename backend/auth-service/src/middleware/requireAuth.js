//ARXIU QUE COMPROVA EL TOKEN JWT DE LES RUTES D'USUARI

//=====================
//IMPORTEM
//=====================
import jwt from "jsonwebtoken";

//=====================
//CONSTANT: SECRET PER VERIFICAR ELS TOKENS
//=====================
const AUTH_SECRET = process.env.AUTH_SECRET;

//=====================
//MIDDLEWARE: EXIGEIX UN TOKEN VÀLID I DESA req.user
//=====================
export function requireAuth(req, res, next) {
  //SI EL SERVEI NO TÉ SECRET, NO PODEM VERIFICAR RES
  if (AUTH_SECRET === undefined || AUTH_SECRET.length === 0) {
    res.status(503).json({
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      reason: "Autenticació no configurada.",
    });
    return;
  }

  const authHeader = req.headers.authorization;

  //HA DE VENIR LA CAPÇALERA AMB EL FORMAT "Bearer <token>"
  if (authHeader === undefined) {
    res.status(401).json({
      ok: false,
      code: "NO_TOKEN",
      reason: "Falta el token d'autenticació.",
    });
    return;
  }

  if (authHeader.startsWith("Bearer ") === false) {
    res.status(401).json({
      ok: false,
      code: "NO_TOKEN",
      reason: "Falta el token d'autenticació.",
    });
    return;
  }

  const token = authHeader.slice(7);
  let payload = null;

  //VERIFIQUEM LA SIGNATURA I LA CADUCITAT
  try {
    payload = jwt.verify(token, AUTH_SECRET, { algorithms: ["HS256"] });
  } catch (error) {
    res.status(401).json({
      ok: false,
      code: "INVALID_TOKEN",
      reason: "Token manipulat o caducat.",
    });
    return;
  }

  const userId = Number(payload.sub);

  //EL SUBJECTE HA DE SER UN ID NUMÈRIC POSITIU
  if (Number.isSafeInteger(userId) === false) {
    res.status(401).json({
      ok: false,
      code: "INVALID_TOKEN",
      reason: "Token manipulat o caducat.",
    });
    return;
  }

  if (userId < 1) {
    res.status(401).json({
      ok: false,
      code: "INVALID_TOKEN",
      reason: "Token manipulat o caducat.",
    });
    return;
  }

  //DEIXEM EL ROL AL COSTAT DE L'USUARI PERQUE ELS ALTRES MIDDLEWARES EL PUGUIN LLEGIR
  req.user = {
    userId: userId,
    username: payload.username,
    rol: payload.rol,
  };

  next();
}
