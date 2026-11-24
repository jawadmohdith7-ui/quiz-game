//ARXIU QUE VERIFICA EL TOKEN DE LA PETICIÓ I EXIGEIX EL ROL D'ADMINISTRADOR

//=====================
//IMPORTEM
//=====================
import jwt from "jsonwebtoken";

//=====================
//CONSTANT: SECRET PER VERIFICAR ELS TOKENS
//=====================
const AUTH_SECRET = process.env.AUTH_SECRET;

//=====================
//MIDDLEWARE: DESA EL PAYLOAD A req.user I COMPROVA EL ROL
//=====================
export function requireAdmin(req, res, next) {
  //SENSE SECRET CONFIGURAT NO PODEM VERIFICAR RES
  if (AUTH_SECRET === undefined || AUTH_SECRET.length === 0) {
    res.status(503).json({
      ok: false,
      code: "AUTH_NOT_CONFIGURED",
      reason: "Autenticació no configurada",
    });
    return;
  }

  const capcalera = req.headers.authorization;

  //HA DE VENIR LA CAPÇALERA AMB EL FORMAT "Bearer <token>"
  if (capcalera === undefined || capcalera === null) {
    res.status(401).json({
      ok: false,
      code: "AUTH_REQUIRED",
      reason: "Cal iniciar sessió",
    });
    return;
  }

  const parts = capcalera.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    res.status(401).json({
      ok: false,
      code: "AUTH_REQUIRED",
      reason: "Cal iniciar sessió",
    });
    return;
  }

  //VERIFIQUEM LA SIGNATURA I LA CADUCITAT
  try {
    req.user = jwt.verify(parts[1], AUTH_SECRET, { algorithms: ["HS256"] });
  } catch (error) {
    res.status(401).json({
      ok: false,
      code: "INVALID_TOKEN",
      reason: "Token manipulat o caducat",
    });
    return;
  }

  //EL ROL VIATJA DINS EL TOKEN
  if (req.user.rol !== "admin") {
    res.status(403).json({
      ok: false,
      code: "ADMIN_REQUIRED",
      reason: "Aquesta operació només la pot fer un administrador",
    });
    return;
  }

  next();
}
