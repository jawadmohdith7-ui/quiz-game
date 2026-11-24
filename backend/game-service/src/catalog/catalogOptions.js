//ARXIU QUE CONSULTA EL CATALEG I REVALIDA LES SALES QUAN CANVIEN LES OPCIONS

//=====================
//IMPORTEM
//=====================
import {
  broadcast,
  broadcastToRoom,
} from "../connections/broadcast.js";
import { roomStorage } from "../storage/roomStorage.js";
import { buildConfiguration } from "../rooms/roomConfiguration.js";
import { broadcastRoomsList } from "../rooms/roomsListHandler.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//CONSTANTS
//=====================
let catalogUrl = process.env.CATALOG_URL;
if (catalogUrl === undefined) {
  catalogUrl = "http://localhost:3001";
}

const internalSecret = process.env.INTERNAL_SECRET;

const mixCategory = "Mix";
const mixDifficulty = "mix";
const catalogTimeoutMs = 5000;

//=====================
//FUNCIO AUXILIAR: COMPROVA QUE EL SERVEI PUGUI CRIDAR EL CATALOG
//=====================
function checkInternalSecret() {
  if (internalSecret === undefined || internalSecret.length === 0) {
    const error = new Error(
      "Falta la variable d'entorn INTERNAL_SECRET: no podem consultar el cataleg."
    );
    error.code = "INTERNAL_SECRET_MISSING";
    throw error;
  }
}

//=====================
//FUNCIO AUXILIAR: VALIDA QUE UNA LLISTA SIGUI D'STRINGS
//=====================
function validateStringList(list, fieldName) {
  if (Array.isArray(list) === false) {
    throw new Error("El camp " + fieldName + " del cataleg no es una llista");
  }

  const result = [];

  for (let i = 0; i < list.length; i = i + 1) {
    if (typeof list[i] !== "string") {
      throw new Error(
        "El camp " + fieldName + " del cataleg conte un valor que no es text"
      );
    }
    result.push(list[i]);
  }

  return result;
}

//=====================
//FUNCIO AUXILIAR: VALIDA LA RESPOSTA DEL CATALOG
//=====================
function validateCatalogOptions(data) {
  if (data === undefined || data === null) {
    throw new Error("El cataleg ha retornat una resposta buida");
  }

  if (typeof data !== "object") {
    throw new Error("El cataleg ha retornat una resposta no valida");
  }

  const categories = validateStringList(data.categories, "categories");
  const difficulties = validateStringList(data.difficulties, "difficulties");

  return {
    categories: categories,
    difficulties: difficulties,
  };
}

//=====================
//FUNCIO AUXILIAR: LLEGEIX EL MISSATGE D'ERROR DEL CATALOG
//=====================
async function readCatalogError(response) {
  try {
    const data = await response.json();

    if (data.error !== undefined && data.error !== null) {
      if (data.error.message !== undefined && data.error.message !== null) {
        return data.error.message;
      }
    }
  } catch (error) {
    return "Error HTTP: " + response.status;
  }

  return "Error HTTP: " + response.status;
}

//=====================
//FUNCIO PRINCIPAL: OBTEN LES OPCIONS DEL CATALEG
//=====================
export async function getCatalogOptions() {
  checkInternalSecret();

  const url = catalogUrl + "/internal/catalog/options";

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-internal-secret": internalSecret,
    },
    signal: AbortSignal.timeout(catalogTimeoutMs),
  });

  if (response.ok === false) {
    const message = await readCatalogError(response);
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const data = await response.json();
  return validateCatalogOptions(data);
}

//=====================
//FUNCIO: COMPROVA SI UNA CATEGORIA EXISTEIX AL CATALEG
//=====================
export function isCategoryAvailable(category, categories) {
  if (typeof category !== "string") {
    return false;
  }

  if (category.toLowerCase() === "mix") {
    return true;
  }

  for (let i = 0; i < categories.length; i = i + 1) {
    if (categories[i] === category) {
      return true;
    }
  }

  return false;
}

//=====================
//FUNCIO: COMPROVA SI UNA DIFICULTAT EXISTEIX AL CATALEG
//=====================
export function isDifficultyAvailable(difficulty, difficulties) {
  if (typeof difficulty !== "string") {
    return false;
  }

  if (difficulty.toLowerCase() === "mix") {
    return true;
  }

  for (let i = 0; i < difficulties.length; i = i + 1) {
    const catalogDifficulty = difficulties[i];

    if (typeof catalogDifficulty !== "string") {
      continue;
    }

    if (catalogDifficulty.toLowerCase() === difficulty.toLowerCase()) {
      return true;
    }
  }

  return false;
}

//=====================
//FUNCIO: REVALIDA LA CONFIGURACIO D'UNA SALA
//RETORNA ELS CAMPS QUE HAN CANVIAT
//=====================
export function revalidateRoomConfiguration(room, options) {
  const changed = [];

  if (isCategoryAvailable(room.category, options.categories) === false) {
    room.category = mixCategory;
    changed.push("category");
  }

  if (isDifficultyAvailable(room.difficulty, options.difficulties) === false) {
    room.difficulty = mixDifficulty;
    changed.push("difficulty");
  }

  return changed;
}

//=====================
//FUNCIO: REVALIDA NOMES LES SALES QUE SON AL LOBBY
//=====================
export function revalidateLobbyRooms(options) {
  let changedRooms = 0;

  for (const [roomId, room] of roomStorage.members) {
    if (room.state !== "lobby") {
      continue;
    }

    const changed = revalidateRoomConfiguration(room, options);

    if (changed.length === 0) {
      continue;
    }

    broadcastToRoom(roomId, {
      type: "room:configuration:updated",
      ok: true,
      changed: changed,
      configuration: buildConfiguration(room),
    });

    changedRooms = changedRooms + 1;
  }

  if (changedRooms > 0) {
    broadcastRoomsList();
  }

  return changedRooms;
}

//=====================
//FUNCIO: CONSTRUEIX EL MISSATGE CATALOG:OPTIONS
//=====================
export function buildCatalogOptionsMessage(options) {
  return {
    type: "catalog:options",
    ok: true,
    categories: options.categories,
    difficulties: options.difficulties,
  };
}

//=====================
//FUNCIO: RESPON A UNA PETICIO CATALOG:OPTIONS
//=====================
export async function sendCatalogOptions(ws) {
  try {
    const options = await getCatalogOptions();
    const message = buildCatalogOptionsMessage(options);

    if (ws.readyState === 1) {
      safeSend(ws, JSON.stringify(message));
    }
  } catch (error) {
    console.warn(
      "[CATALEG] No s'han pogut carregar les opcions: " + error.message
    );

    if (ws.readyState === 1) {
      safeSend(
        ws,
        JSON.stringify({
          type: "catalog:options",
          ok: false,
          reason: "No s'han pogut carregar les opcions del catàleg",
        })
      );
    }
  }
}

//=====================
//FUNCIO: FA BROADCAST DEL CATALEG I REVALIDA EL LOBBY
//=====================
export async function broadcastCatalogOptions() {
  try {
    const options = await getCatalogOptions();

    broadcast(buildCatalogOptionsMessage(options));
    revalidateLobbyRooms(options);
  } catch (error) {
    console.warn(
      "[CATALEG] No s'ha pogut fer el broadcast de les opcions: " + error.message
    );
  }
}

//=====================
//FUNCIO: REVALIDA UNA SALA QUE TORNA AL LOBBY
//SI EL CATALEG FALLA, MANTENIM LA CONFIGURACIO I NO BLOQUEGEM EL RETORN
//=====================
export async function revalidateRoomAgainstCatalog(roomId) {
  const room = roomStorage.members.get(roomId);

  if (room === undefined || room === null) {
    return [];
  }

  let options;
  try {
    options = await getCatalogOptions();
  } catch (error) {
    console.warn(
      "[CATALEG] No s'ha pogut revalidar la sala " +
        roomId +
        ": " +
        error.message
    );
    return [];
  }

  try {
    const changed = revalidateRoomConfiguration(room, options);

    if (changed.length > 0) {
      broadcastToRoom(roomId, {
        type: "room:configuration:updated",
        ok: true,
        changed: changed,
        configuration: buildConfiguration(room),
      });
    }

    return changed;
  } catch (error) {
    console.warn(
      "[CATALEG] No s'ha pogut aplicar la revalidacio a la sala " +
        roomId +
        ": " +
        error.message
    );
    return [];
  }
}
