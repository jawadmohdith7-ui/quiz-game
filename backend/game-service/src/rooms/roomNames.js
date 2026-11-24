//ARXIU QUE GESTIONA LA UNICITAT DELS NOMS DE SALA

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { normalizeText } from "../utils/normalizeText.js";

//=====================
//NOMS RESERVATS MENTRE ES CREA LA SALA A LA BD
//=====================
const pendingRoomNames = new Set();

//=====================
//FUNCIÓ AUXILIAR: COMPROVA SI UN NOM DE SALA JA EXISTEIX
//=====================
export function isRoomNameTaken(nameRoom) {
  const normalized = normalizeText(nameRoom);
  if (normalized === "") {
    return false;
  }

  if (pendingRoomNames.has(normalized)) {
    return true;
  }

  for (const room of roomStorage.members.values()) {
    if (normalizeText(room.nameRoom) === normalized) {
      return true;
    }
  }

  return false;
}

//=====================
//FUNCIÓ AUXILIAR: RESERVA UN NOM ABANS DEL AWAIT
//=====================
export function reserveRoomName(nameRoom) {
  const normalized = normalizeText(nameRoom);
  pendingRoomNames.add(normalized);
  return normalized;
}

//=====================
//FUNCIÓ AUXILIAR: ALLIBERA UNA RESERVA
//=====================
export function releaseRoomName(normalizedName) {
  pendingRoomNames.delete(normalizedName);
}
