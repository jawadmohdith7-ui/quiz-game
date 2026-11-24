//ARXIU QUE CONFIGURA L'API HTTP DEL SERVEI D'AUTENTICACIÓ

//=====================
//IMPORTEM
//=====================
import express from "express";
import {
  registerUser,
  verifyEmailCode,
  resendVerificationCode,
  loginUser,
  updateUserAvatar,
  getUserAvatarImage,
} from "./authService.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { adminRoutes } from "./admin/admin.routes.js";
import { registre } from "./middleware/registre.js";

//=====================
//CONSTANTS
//=====================
const PORT = Number(process.env.PORT || 3011);
const BODY_LIMIT = "3mb";

//=====================
//CREEM L'APLICACIÓ EXPRESS
//=====================
const app = express();

//NO PUBLIQUEM LA CAPÇALERA X-POWERED-BY
app.disable("x-powered-by");

//=====================
//MIDDLEWARE: CORS OBERT I RESPOSTA A OPTIONS
//=====================
app.use(function corsMiddleware(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

//=====================
//MIDDLEWARE: LECTURA DEL COS EN JSON
//=====================
//EL LÍMIT ÉS DE 3 MB PERQUÈ UNA IMATGE D'AVATAR POT ARRIBAR A 2,2 MB
app.use(express.json({ limit: BODY_LIMIT }));

//ANOTEM TOTES LES RESPOSTES AL REGISTRE (NO BLOQUEJA MAI LA PETICIO)
app.use(registre("auth"));

//=====================
//FUNCIÓ: EMBOLCALA UN HANDLER PERQUÈ ELS ERRORS ARRIBIN AL MIDDLEWARE
//=====================
function wrap(handler) {
  return async function wrappedHandler(req, res, next) {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

//=====================
//RUTA: ESTAT DEL SERVEI
//=====================
app.get("/health", function healthHandler(_req, res) {
  res.json({ ok: true });
});

//=====================
//RUTA: REGISTRE D'USUARI
//=====================
app.post(
  "/register",
  wrap(async function registerHandler(req, res) {
    const result = await registerUser(req.body);

    res.status(201).json({
      ok: true,
      requiresVerification: result.requiresVerification,
      email: result.email,
      message: result.message,
    });
  })
);

//=====================
//RUTA: VERIFICACIÓ DEL CODI DE CORREU
//=====================
app.post(
  "/verify",
  wrap(async function verifyHandler(req, res) {
    const result = await verifyEmailCode(req.body);

    res.json({
      ok: true,
      userId: result.userId,
      username: result.username,
      token: result.token,
      user: result.user,
    });
  })
);

//=====================
//RUTA: REENVIAMENT DEL CODI DE VERIFICACIÓ
//=====================
app.post(
  "/resend-code",
  wrap(async function resendCodeHandler(req, res) {
    const result = await resendVerificationCode(req.body);

    res.json({
      ok: true,
      email: result.email,
      message: result.message,
    });
  })
);

//=====================
//RUTA: INICI DE SESSIÓ
//=====================
app.post(
  "/login",
  wrap(async function loginHandler(req, res) {
    const result = await loginUser(req.body);

    res.json({
      ok: true,
      userId: result.userId,
      username: result.username,
      rol: result.rol,
      token: result.token,
      user: result.user,
    });
  })
);

//=====================
//RUTA: ACTUALITZACIÓ DE L'AVATAR (CAL TOKEN)
//=====================
app.patch(
  "/avatar",
  requireAuth,
  wrap(async function avatarHandler(req, res) {
    //SI EL COS PORTA userId, HA DE COINCIDIR AMB EL DEL TOKEN
    if (req.body.userId !== undefined && req.body.userId !== null) {
      if (Number(req.body.userId) !== req.user.userId) {
        res.status(403).json({
          ok: false,
          code: "NOT_OWNER",
          reason: "Només pots modificar el teu propi avatar.",
        });
        return;
      }
    }

    const user = await updateUserAvatar({
      userId: req.user.userId,
      avatarImage: req.body.avatarImage,
      avatarColor: req.body.avatarColor,
    });

    res.json({ ok: true, user: user });
  })
);

//=====================
//RUTA: IMATGE D'AVATAR D'UN USUARI
//=====================
app.get(
  "/avatar/:id",
  wrap(async function avatarImageHandler(req, res) {
    const image = await getUserAvatarImage(Number(req.params.id));

    if (!image) {
      res.status(404).json({ ok: false, reason: "Sense avatar" });
      return;
    }

    res.setHeader("Content-Type", image.mime);
    //EVITEM QUE EL NAVEGADOR ENDEVINI EL TIPUS DE CONTINGUT
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.send(image.data);
  })
);

//RUTES INTERNES DEL PANELL D'ADMINISTRACIO
app.use("/internal/admin", adminRoutes);

//=====================
//MIDDLEWARE: RUTA NO TROBADA
//=====================
app.use(function notFoundHandler(_req, res) {
  res.status(404).json({
    ok: false,
    code: "ROUTE_NOT_FOUND",
    reason: "Ruta no trobada",
  });
});

//=====================
//MIDDLEWARE: TRADUCCIÓ D'ERRORS AL FORMAT { ok, code, reason }
//=====================
app.use(function errorMiddleware(error, _req, res, _next) {
  let status = 500;

  if (Number.isInteger(error.status) === true) {
    status = error.status;
  }

  let code = "INTERNAL_ERROR";

  if (error.code !== undefined && error.code !== null) {
    code = error.code;
  }

  let reason = "Error intern del servidor";

  if (status !== 500) {
    reason = error.message;
  }

  //SI EL COS NO ÉS JSON VÀLID, NO EXPOSEM EL CODI NI EL MISSATGE DEL PARSER
  if (error.type === "entity.parse.failed") {
    status = 400;
    code = "INVALID_JSON";
    reason = "El cos de la petició no és JSON vàlid.";
  }

  //SI NO HI HA CONNEXIÓ AMB LA BASE DE DADES, RESPONEM 503
  if (error.code === "ECONNREFUSED") {
    status = 503;
    reason = "No hi ha connexió amb la base de dades.";
  }

  if (error.code === "PROTOCOL_CONNECTION_LOST") {
    status = 503;
    reason = "No hi ha connexió amb la base de dades.";
  }

  //NOMÉS REGISTREM ELS ERRORS NO CONTROLATS
  if (status === 500) {
    console.error("Error intern de l'auth-service:", error);
  }

  res.status(status).json({
    ok: false,
    code: code,
    reason: reason,
  });
});

//=====================
//ARRENCADA DEL SERVIDOR
//=====================
app.listen(PORT, function onListen() {
  console.log("auth-service escoltant al port " + PORT);
});
