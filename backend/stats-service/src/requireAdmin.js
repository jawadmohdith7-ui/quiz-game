//ARXIU QUE COMPROVA QUE L'USUARI DE LA PETICIÓ SIGUI ADMINISTRADOR

//=====================
//MIDDLEWARE
//=====================
export function requireAdmin(req, res, next) {
  if (req.user === null || req.user === undefined) {
    res.status(401).json({
      ok: false,
      code: "AUTH_REQUIRED",
      reason: "Cal iniciar sessió",
    });
    return;
  }

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
