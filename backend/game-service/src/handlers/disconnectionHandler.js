//ARXIU QUE GESTIONA LA DESCONNEXIÓ D'UN CLIENT WEBSOCKET

//=====================
//IMPORTEM
//=====================
import { unregisterClient, connectedCount } from "../connections/broadcast.js";
import { scheduleLeaveOnDisconnect } from "../rooms/roomEvents.js";
import { desregistraAdmin } from "../admin/adminAuth.js";
import { enviaAdminLive } from "../admin/adminLive.js";

//=====================
//FUNCIÓ PRINCIPAL: GESTIONA LA DESCONNEXIÓ D'UN CLIENT
//=====================
export function handleDisconnection(ws) {
  //SI ERA UN ADMIN, EL TREIEM DE LA LLISTA DE MISSATGES EN DIRECTE
  desregistraAdmin(ws);

  //COMPROVEM SI EL CLIENT TE SALA, IDENTITAT I ID D'IDENTITAT (PAS A PAS)
  let teSala = false;
  if (ws.roomId !== null) {
    if (ws.roomId !== undefined) {
      teSala = true;
    }
  }

  let teIdentitat = false;
  if (ws.identity !== null) {
    if (ws.identity !== undefined) {
      teIdentitat = true;
    }
  }

  let teIdIdentitat = false;
  if (teIdentitat === true) {
    if (ws.identity.id !== null) {
      if (ws.identity.id !== undefined) {
        teIdIdentitat = true;
      }
    }
  }

  let potFerLeave = false;
  if (teSala === true) {
    if (teIdIdentitat === true) {
      potFerLeave = true;
    }
  }

  if (potFerLeave === true) {
    //NO TREIEM EL JUGADOR DE SEGUIDA: SI ÉS UN REFRESH, TORNARÀ DINS LA FINESTRA DE GRÀCIA
    scheduleLeaveOnDisconnect(ws);
    ws.roomId = null;
  }

  //ELIMINEM CLIENT DE LA LLISTA
  unregisterClient(ws);

  const total = connectedCount();
  console.log("Client desconnectat. Total: " + total);

  enviaAdminLive();
}
