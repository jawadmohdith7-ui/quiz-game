//ARXIU QUE IMPLEMENTA UNA CUA DE PROMESES PER SALA (UNA OPERACIÓ ALHORA PER SALA)

//=====================
//ESTAT INTERN: CUA DE PROMESES PER CADA SALA
//CLAU: ROOMID
//=====================
const queues = new Map();

//=====================
//FUNCIÓ PRINCIPAL: ENCUA UNA OPERACIÓ PER A UNA SALA I RETORNA LA SEVA PROMESA
//GARANTEIX QUE NOMÉS HI HA UNA OPERACIÓ EN CURS PER SALA
//=====================
export function enqueueRoom(roomId, operation) {
  //SHORTCUT: CUA DE PROMESES PER SALA; NO ES POT FER AMB ASYNC/AWAIT PERQUÈ HA D'ENCADENAR-SO SÍNCRONAMENT
  let previous;
  const existeix = queues.get(roomId);
  if (existeix === undefined) {
    previous = Promise.resolve();
  } else {
    previous = existeix;
  }

  //SHORTCUT: ENCADENAMENT DE PROMESOS; LA OPERACIÓ S'EXECUTA TANT SI L'ANTERIOR VA BÉ COM SI VA MALAMENT
  const current = previous.then(operation, operation);
  queues.set(roomId, current);

  function cleanup() {
    if (queues.get(roomId) === current) {
      queues.delete(roomId);
    }
  }

  //SHORTCUT: NETEJA LA CUA QUAN LA PROMESA S'HA RESOLT O REBUTJAT
  current.then(cleanup, cleanup);

  return current;
}
