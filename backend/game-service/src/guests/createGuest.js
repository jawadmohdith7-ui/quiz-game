//ARXIU QUE GESTIONA LA CREACIÓ D'UN GUEST

//=====================
//IMPORTEM
//=====================
import crypto from "node:crypto";
import { guestStorage } from "../storage/guestStorage.js";

//=====================
//CONSTANTS
//=====================
//CONVIDATS SENSE CONNEXIÓ QUE ES PODEN ESBORRAR
const MINUTS_PER_ESBORRAR = 60;

//CONTADOR GLOBAL PER GESTIONAR L'ID DEL GUEST
let guestCounter = 0;

//=====================
//FUNCIÓ PRINCIPAL: CREA UN GUEST
//=====================
export function createGuest() {
  const id = `guest_${guestCounter++}`;

  //EL SECRET IMPEDEIX QUE UN ALTRE CLIENT RECLAMI AQUEST ID
  const secret = crypto.randomBytes(16).toString("hex");

  const identity = {
    id: id,
    type: "guest",
    nickanme: id,
    guestSecret: secret,
    lastSeen: Date.now(),
  };

  guestStorage.guests.set(id, identity);

  return identity;
}

//=====================
//ESBORREM ELS CONVIDATS VELLS
//=====================
//UN CONVIDAT QUE FA UNA HORA QUE NO ES MOU NO ES TROBARÀ A FALTAR
export function netejarConvidats() {
  const limit = Date.now() - MINUTS_PER_ESBORRAR * 60 * 1000;

  for (const [id, guest] of guestStorage.guests) {
    if (guest.lastSeen === undefined || guest.lastSeen < limit) {
      guestStorage.guests.delete(id);
    }
  }
}
