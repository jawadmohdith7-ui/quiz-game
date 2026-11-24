//ARXIU QUE ATEN ELS MISSATGES ADMIN:* DEL WEBSOCKET

//=====================
//IMPORTEM
//=====================
import { comprovaTokenAdmin, registraAdmin, esAdmin } from "./adminAuth.js";
import { estatDirecte } from "./adminState.js";
import { cridaCatalog, cridaAuth, cridaStats } from "./adminClient.js";
import { broadcastCatalogOptions } from "../catalog/catalogOptions.js";
import { enviaAdminLive, enviaCategories } from "./adminLive.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//AJUDANTS
//=====================
function respon(ws, type, requestId, dades) {
  const missatge = { type: type, requestId: requestId };

  for (const clau in dades) {
    missatge[clau] = dades[clau];
  }

  if (ws.readyState === 1) {
    safeSend(ws, JSON.stringify(missatge));
  }
}

//=====================
//L'ID VE DEL CLIENT: HA DE SER UN NÚMERO
//=====================
function idValid(id) {
  if (typeof id !== "number" && typeof id !== "string") {
    return false;
  }

  const text = String(id);

  if (text.length === 0) {
    return false;
  }

  return /^\d+$/.test(text);
}

function responError(ws, type, requestId, reason) {
  respon(ws, type, requestId, { ok: false, reason: reason });
}

//=====================
//AJUDANT: NOTIFICA EL NOU CATALEG SI LA MUTACIO HA ANAT BE
//=====================
async function broadcastCatalogIfOk(dades) {
  if (dades.ok === true) {
    await broadcastCatalogOptions();
    enviaAdminLive();
  }
}

//=====================
//AJUDANT: REPARTEIX LA LLISTA DE CATEGORIES A TOTS ELS ADMINS
//=====================
async function broadcastCategories(token) {
  try {
    const dades = await cridaCatalog("/internal/admin/categories", "GET", null, token);

    if (dades.ok === true) {
      enviaCategories(dades.categories);
    }
  } catch (error) {
    console.error("[ADMIN] No s'ha pogut repartir les categories: " + error.message);
  }
}

//=====================
//ENTRADA
//=====================
export async function handleAdminMessage(ws, message) {
  const type = String(message.type || "");
  const requestId = message.requestId || null;

  //AUTENTICACIO: ES L'UNIC MISSATGE QUE ES POT ENVIAR SENSE SER ADMIN
  if (type === "admin:auth") {
    const payload = comprovaTokenAdmin(message.token);

    if (!payload) {
      respon(ws, "admin:auth:error", requestId, { ok: false, reason: "Token invalid o sense permisos" });
      return;
    }

    registraAdmin(ws, message.token);
    respon(ws, "admin:auth:ok", requestId, { ok: true, usuari: payload.username });
    return;
  }

  //TOTA LA RESTA VOL UNA SESSIO D'ADMIN
  if (esAdmin(ws) === false) {
    responError(ws, type, requestId, "Cal autenticar-se com a admin");
    return;
  }

  try {
    //=====================
    //DIRECTE
    //=====================
    if (type === "admin:live:get") {
      const estat = estatDirecte();
      respon(ws, type, requestId, {
        ok: true,
        jugadors: estat.jugadors,
        sales: estat.sales,
        partidesEnCurs: estat.partidesEnCurs,
      });
      return;
    }

    //=====================
    //PREGUNTES
    //=====================
    if (type === "admin:preguntes:list") {
      const dades = await cridaCatalog("/internal/admin/preguntes", "GET", null, ws.tokenAdmin);
      respon(ws, type, requestId, { ok: dades.ok, preguntes: dades.preguntes, reason: dades.reason });
      return;
    }

    if (type === "admin:preguntes:create") {
      const dades = await cridaCatalog("/internal/admin/preguntes", "POST", message.dades, ws.tokenAdmin);
      await broadcastCatalogIfOk(dades);
      respon(ws, type, requestId, { ok: dades.ok, pregunta: dades.pregunta, reason: dades.reason, errors: dades.errors });
      return;
    }

    if (type === "admin:preguntes:update") {
      if (idValid(message.id) === false) {
        responError(ws, type, requestId, "Identificador no vàlid");
        return;
      }
      const ruta = "/internal/admin/preguntes/" + encodeURIComponent(String(message.id));
      const dades = await cridaCatalog(ruta, "PATCH", message.dades, ws.tokenAdmin);
      await broadcastCatalogIfOk(dades);
      respon(ws, type, requestId, { ok: dades.ok, pregunta: dades.pregunta, reason: dades.reason, errors: dades.errors });
      return;
    }

    if (type === "admin:preguntes:delete") {
      if (idValid(message.id) === false) {
        responError(ws, type, requestId, "Identificador no vàlid");
        return;
      }
      const ruta = "/internal/admin/preguntes/" + encodeURIComponent(String(message.id));
      const dades = await cridaCatalog(ruta, "DELETE", null, ws.tokenAdmin);
      await broadcastCatalogIfOk(dades);
      respon(ws, type, requestId, { ok: dades.ok, reason: dades.reason });
      return;
    }

    //=====================
    //CATEGORIES
    //=====================
    if (type === "admin:categories:list") {
      const dades = await cridaCatalog("/internal/admin/categories", "GET", null, ws.tokenAdmin);
      respon(ws, type, requestId, { ok: dades.ok, categories: dades.categories, reason: dades.reason });
      return;
    }

    if (type === "admin:categories:create") {
      const dades = await cridaCatalog("/internal/admin/categories", "POST", message.dades, ws.tokenAdmin);
      await broadcastCatalogIfOk(dades);
      await broadcastCategories(ws.tokenAdmin);
      respon(ws, type, requestId, { ok: dades.ok, categoria: dades.categoria, reason: dades.reason, errors: dades.errors });
      return;
    }

    if (type === "admin:categories:update") {
      if (idValid(message.id) === false) {
        responError(ws, type, requestId, "Identificador no vàlid");
        return;
      }
      const ruta = "/internal/admin/categories/" + encodeURIComponent(String(message.id));
      const dades = await cridaCatalog(ruta, "PATCH", message.dades, ws.tokenAdmin);
      await broadcastCatalogIfOk(dades);
      await broadcastCategories(ws.tokenAdmin);
      respon(ws, type, requestId, { ok: dades.ok, categoria: dades.categoria, reason: dades.reason, errors: dades.errors });
      return;
    }

    if (type === "admin:categories:delete") {
      if (idValid(message.id) === false) {
        responError(ws, type, requestId, "Identificador no vàlid");
        return;
      }
      const ruta = "/internal/admin/categories/" + encodeURIComponent(String(message.id));
      const dades = await cridaCatalog(ruta, "DELETE", null, ws.tokenAdmin);
      await broadcastCatalogIfOk(dades);
      await broadcastCategories(ws.tokenAdmin);
      respon(ws, type, requestId, { ok: dades.ok, reason: dades.reason });
      return;
    }

    //=====================
    //USUARIS
    //=====================
    if (type === "admin:usuaris:list") {
      const dades = await cridaAuth("/internal/admin/usuaris", "GET", null, ws.tokenAdmin);
      respon(ws, type, requestId, { ok: dades.ok, usuaris: dades.usuaris, reason: dades.reason });
      return;
    }

    if (type === "admin:usuaris:create") {
      const dades = await cridaAuth("/internal/admin/usuaris", "POST", message.dades, ws.tokenAdmin);
      respon(ws, type, requestId, { ok: dades.ok, usuari: dades.usuari, reason: dades.reason });
      return;
    }

    if (type === "admin:usuaris:update") {
      if (idValid(message.id) === false) {
        responError(ws, type, requestId, "Identificador no vàlid");
        return;
      }
      const ruta = "/internal/admin/usuaris/" + encodeURIComponent(String(message.id));
      const dades = await cridaAuth(ruta, "PATCH", message.dades, ws.tokenAdmin);
      respon(ws, type, requestId, { ok: dades.ok, usuari: dades.usuari, reason: dades.reason });
      return;
    }

    if (type === "admin:usuaris:delete") {
      if (idValid(message.id) === false) {
        responError(ws, type, requestId, "Identificador no vàlid");
        return;
      }
      const ruta = "/internal/admin/usuaris/" + encodeURIComponent(String(message.id));
      const dades = await cridaAuth(ruta, "DELETE", null, ws.tokenAdmin);
      respon(ws, type, requestId, { ok: dades.ok, reason: dades.reason });
      return;
    }

    //=====================
    //ESTADISTIQUES I GRAFIC
    //=====================
    if (type === "admin:estadistiques:get") {
      let ruta = "/internal/admin/estadistiques";

      if (message.sala) {
        ruta = ruta + "?sala=" + encodeURIComponent(message.sala);
      }

      const dades = await cridaStats(ruta, "GET", null, ws.tokenAdmin);
      respon(ws, type, requestId, { ok: dades.ok, general: dades.general, sales: dades.sales, reason: dades.reason });
      return;
    }

    if (type === "admin:registre:get") {
      const periode = message.periode || "avui";
      const ruta = "/internal/admin/registre?periode=" + encodeURIComponent(periode);
      const dades = await cridaStats(ruta, "GET", null, ws.tokenAdmin);
      respon(ws, type, requestId, {
        ok: dades.ok,
        total: dades.total,
        encerts: dades.encerts,
        errors: dades.errors,
        percentatgeEncerts: dades.percentatgeEncerts,
        percentatgeErrors: dades.percentatgeErrors,
        reason: dades.reason,
      });
      return;
    }

    if (type === "admin:usage:get") {
      const periode = message.periode || "dia";
      const ruta = "/internal/admin/usage?periode=" + encodeURIComponent(periode);
      const dades = await cridaStats(ruta, "GET", null, ws.tokenAdmin);
      respon(ws, type, requestId, { ok: dades.ok, usage: dades.usage, reason: dades.reason });
      return;
    }

    //CAP DE LES ANTERIORS
    responError(ws, type, requestId, "Missatge d'admin desconegut");
  } catch (error) {
    console.error("[ADMIN] " + error.message);
    responError(ws, type, requestId, "Error intern del servei");
  }
}
