//ARXIU AMB LA CONFIGURACIÓ DEL SERVIDOR WEBSOCKET (VALORS DEL .ENV)

//=====================
//CONSTANTS
//=====================

//PORT DEL SERVIDOR WEBSOCKET
let portValor = process.env.PORT;
if (portValor === undefined) {
  portValor = 3000;
}
export const PORT = Number(portValor);

//TEMPS DE GRÀCIA (MS) ABANS DE TREURE UN JUGADOR DESCONNECTAT DE LA SALA
let graceValor = process.env.GRACE_MS;
if (graceValor === undefined) {
  graceValor = 10000;
}
export const GRACE_MS = Number(graceValor);
