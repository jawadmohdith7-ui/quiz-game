//ARXIU QUE AUTENTICA ELS SOCKETS DEL PANELL D'ADMINISTRACIO

//=====================
//IMPORTEM
//=====================
import jwt from "jsonwebtoken";

//=====================
//ESTAT
//=====================
//NOMES ELS SOCKETS QUE HAN PASSAT ADMIN:AUTH REBEN ELS MISSATGES EN DIRECTE
const adminSockets = new Set();

//=====================
//FUNCIONS
//=====================
export function esAdmin(ws) {
  if (ws.rolAdmin === "admin") {
    return true;
  }

  return false;
}

export function registraAdmin(ws, token) {
  ws.rolAdmin = "admin";
  ws.tokenAdmin = token;
  adminSockets.add(ws);
}

export function desregistraAdmin(ws) {
  adminSockets.delete(ws);
}

export function llistaAdmins() {
  return adminSockets;
}

//COMPROVA EL TOKEN I RETORNA EL ROL, O NULL SI NO VAL
export function comprovaTokenAdmin(token) {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    console.error("[ADMIN] AUTH_SECRET no configurat");
    return null;
  }

  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });

    if (payload.rol !== "admin") {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}
