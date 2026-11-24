//ARXIU QUE ENVIA MISSATGES PEL WEBSOCKET SENSE PODER TOMBAR EL SERVIDOR

//=====================
//CONSTANTS
//=====================
//1 ÉS L'ESTAT "OBERT" DE UNA CONNEXIÓ WEBSOCKET
const ESTAT_OBERT = 1;

//=====================
//ENVIAMENT SEGUR
//=====================
//SI EL SOCKET ESTÀ TANCAT NO S'ENVIA RES I ES RETORNA false
//AIXÍ UN JUGADOR QUE MARXA NO DEIXA UNA PROMESA REBUTJADA QUE TOMBI EL PROCÉS
export function safeSend(ws, missatge) {
  if (ws === null || ws === undefined) {
    return false;
  }

  if (ws.readyState !== ESTAT_OBERT) {
    return false;
  }

  //PASSEM UN CALLBACK: SI L'ENVIAMENT FALLA, HO REGISTREM I NO LLENCEM RES
  ws.send(missatge, function (error) {
    if (error !== undefined && error !== null) {
      console.error("[ws] no s'ha pogut enviar el missatge:", error.message);
    }
  });

  return true;
}
