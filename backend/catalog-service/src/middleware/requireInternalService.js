//ARXIU QUE COMPROVA QUE UNA PETICIÓ INTERNA PORTI EL SECRET DE SERVEI

//=====================
//IMPORTEM
//=====================
import { timingSafeEqual } from "node:crypto";

//=====================
//CONSTANT: SECRET COMPARTIT ENTRE SERVEIS
//=====================
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

//=====================
//MIDDLEWARE: NOMÉS DEIXA PASSAR ELS SERVEIS DE LA PLATAFORMA
//=====================
export function requireInternalService(req, res, next) {
  //SI NO HI HA SECRET CONFIGURAT, TANQUEM LA PORTA (NO FALLBACK)
  if (INTERNAL_SECRET === undefined || INTERNAL_SECRET.length === 0) {
    res.status(503).json({
      error: {
        code: "INTERNAL_ACCESS_NOT_CONFIGURED",
        message: "Accés intern no configurat.",
      },
    });
    return;
  }

  const secret = req.headers["x-internal-secret"];

  if (typeof secret !== "string") {
    res.status(403).json({
      error: {
        code: "INTERNAL_ACCESS_DENIED",
        message: "Accés denegat.",
      },
    });
    return;
  }

  if (secret.length === 0) {
    res.status(403).json({
      error: {
        code: "INTERNAL_ACCESS_DENIED",
        message: "Accés denegat.",
      },
    });
    return;
  }

  //COMPAREM LES LONGITUDS EN BYTES ABANS DE timingSafeEqual (SI NO, LLANÇA ERROR)
  if (Buffer.byteLength(secret, "utf8") !== Buffer.byteLength(INTERNAL_SECRET, "utf8")) {
    res.status(403).json({
      error: {
        code: "INTERNAL_ACCESS_DENIED",
        message: "Accés denegat.",
      },
    });
    return;
  }

  const secretBuffer = Buffer.from(secret, "utf8");
  const expectedBuffer = Buffer.from(INTERNAL_SECRET, "utf8");

  if (timingSafeEqual(secretBuffer, expectedBuffer) === false) {
    res.status(403).json({
      error: {
        code: "INTERNAL_ACCESS_DENIED",
        message: "Accés denegat.",
      },
    });
    return;
  }

  next();
}
