//ARXIU QUE COMPROVA QUE L'USUARI AUTENTICAT SIGUI ADMINISTRADOR

//=====================
//IMPORTEM
//=====================
import { requireAuth } from "./requireAuth.js";

//=====================
//MIDDLEWARE
//=====================
export function requireAdmin(req, res, next) {
  //PRIMER VALIDEM EL TOKEN I DESPRES MIREM EL ROL
  requireAuth(req, res, function afterAuth() {
    if (req.user.rol !== "admin") {
      res.status(403).json({
        ok: false,
        code: "NOT_ADMIN",
        reason: "Cal ser administrador",
      });
      return;
    }

    next();
  });
}
