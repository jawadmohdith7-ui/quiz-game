//ARXIU QUE ARRENCA EL SERVIDOR WS I REGISTRA LA CONNEXIÓ

//=====================
//IMPORTEM
//=====================
import { WebSocketServer } from "ws";
import { handleConnection } from "./handlers/connectionHandler.js";
import { PORT } from "./config/websocketConfig.js";
import { netejarConvidats } from "./guests/createGuest.js";

//=====================
//ARRANQUEM EL SERVIDOR
//=====================
function startServer() {
  //64 KB ÉS DE SOBRA PER A QUALSEVOL MISSATGE DEL JOC
  //EL VALOR PER DEFECTE (100 MB) PERMET TOMBAR LA MEMÒRIA AMB UN SOL MISSATGE
  const wss = new WebSocketServer({ port: PORT, maxPayload: 65536 });

  //CADA DEU MINUTS, FORA CONVIDATS VELLS
  setInterval(netejarConvidats, 10 * 60 * 1000);

  console.log(`Servidor WebSocket en funcionament al port ${PORT}`);

  //REGISTREM L'EVENT DE CONNEXIÓ AMB FUNCIÓ AMB NOM
  wss.on("connection", handleNovaConnexio);
}

//=====================
//EVENT: NOVA CONNEXIÓ
//=====================
function handleNovaConnexio(ws) {
  handleConnection(ws);
}

//EXECUTEM EL SERVIDOR
startServer();
