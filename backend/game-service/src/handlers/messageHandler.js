//ARXIU QUE PARSEJA ELS MISSATGES ENTRANTS DELS CLIENTS I ELS PASSA AL ROUTER

//=====================
//IMPORTEM
//=====================
import { routeMessage } from "../routers/messageRouter.js";
import { handleAdminMessage } from "../admin/adminRouter.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//FUNCIÓ PRINCIPAL: PARSEJA EL MISSATGE I L'ENVIA AL ROUTER
//=====================
export async function handleMessage(ws, message) {
  let data;

  //SI EL JSON NO ÉS VÀLID NO TIREM EL SERVIDOR, RESPONEM AMB ERROR
  try {
    const text = message.toString();
    data = JSON.parse(text);
  } catch (error) {
    const dades = JSON.stringify({
      type: "error",
      message: "JSON no vàlid",
    });
    safeSend(ws, dades);
    return;
  }

  //UN FRAME NULL O QUE NO ÉS OBJECTE NO ES POT ENRUTAR
  if (data === null || typeof data !== "object") {
    return;
  }

  //ELS MISSATGES D'ADMIN TENEN EL SEU PROPI ROUTER I NO TOQUEN EL JOC
  if (String(data.type || "").indexOf("admin:") === 0) {
    await handleAdminMessage(ws, data);
    return;
  }

  routeMessage(ws, data);
}
