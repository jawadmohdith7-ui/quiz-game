//ARXIU QUE GESTIONA LES CONNEXIONS DELS CLIENTS WEBSOCKET

//=====================
//IMPORTEM
//=====================
import { registerClient, connectedCount } from "../connections/broadcast.js";
import { handleMessage } from "./messageHandler.js";
import { handleDisconnection } from "./disconnectionHandler.js";
import { enviaAdminLive } from "../admin/adminLive.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//FUNCIÓ PRINCIPAL: GESTIONA LA CONNEXIÓ D'UN CLIENT WEBSOCKET
//=====================
export function handleConnection(ws) {
  //INICIALITZEM LA IDENTITAT COM A NULL (ES RESOUDRA VIA IDENTITY:DECLARE)
  ws.identity = null;
  ws.roomId = null;

  //AFEGIM CLIENT A LA LLISTA DE CONNECTATS
  registerClient(ws);

  console.log(`Nou client connectat. Total: ${connectedCount()}`);

  //DEFINIM ELS HANDLERS LOCALS (TANQUEN WS PER CLAUDÀTOR)
  function handleError(error) {
    console.error("Error en la connexió WebSocket:", error);
  }

  function handleMissatge(message) {
    handleMessage(ws, message);
  }

  function handleTancament() {
    handleDisconnection(ws);
  }

  //REGISTREM ELS EVENTS AMB LES FUNCIONS LOCALS
  ws.on("error", handleError);
  ws.on("message", handleMissatge);
  ws.on("close", handleTancament);

  //ENVIEM MISSATGE CONNECTION:STABLISHED (NOMÉS ACK CONNEXIÓ, SENSE IDENTITAT)
  const dades = JSON.stringify({
    type: "connection:stablished",
    message: "Connexió establerta",
  });
  safeSend(ws, dades);

  //EL DASHBOARD HA DE VEURE EL JUGADOR NOU A L'ACTE
  enviaAdminLive();
}
