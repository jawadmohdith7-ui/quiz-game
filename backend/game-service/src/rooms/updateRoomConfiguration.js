//ARXIU QUE VALIDA I ACTUALITZA LA CONFIGURACIÓ D'UNA SALA

//=====================
//IMPORTEM
//=====================
import { roomStorage } from "../storage/roomStorage.js";
import { updateRoomMaxPlayers } from "../repositories/roomRepository.js";
import { buildConfiguration } from "./roomConfiguration.js";

//=====================
//CONSTANTS DE VALIDACIÓ
//=====================
const minPlayers = 2;
const maxPlayersLimit = 20;
const minRounds = 1;
const maxRounds = 50;
const minDurationSeconds = 5;
const maxDurationSeconds = 60;

//=====================
//FUNCIÓ PRINCIPAL: APLICA ELS CAMPS ENVIATS I RETORNA ELS QUE HAN CANVIAT
//=====================
export async function updateRoomConfiguration(roomId, configuration) {
  //RECUPEREM LA SALA DEL MAGATZEM
  const room = roomStorage.members.get(roomId);

  if (room === undefined) {
    return { ok: false, reason: "La sala no existeix" };
  }

  //SI LA PARTIDA JA HA COMENÇAT NO ES POT CANVIAR RES
  if (room.state !== "lobby") {
    return { ok: false, reason: "La partida ja ha començat" };
  }

  //LA CONFIGURACIÓ HA DE SER UN OBJECTE
  if (configuration === undefined) {
    return { ok: false, reason: "Falta la configuració" };
  }
  if (configuration === null) {
    return { ok: false, reason: "Falta la configuració" };
  }
  const esObjecte = typeof configuration === "object";
  if (esObjecte === false) {
    return { ok: false, reason: "Falta la configuració" };
  }

  //PARTIM DE LA CONFIGURACIÓ ACTUAL I VALIDEM TOT ABANS D'APLICAR RES
  const next = buildConfiguration(room);

  //CATEGORIA
  if (configuration.category !== undefined) {
    const category = String(configuration.category).trim();

    const massaCurta = category.length < 1;
    const massaLlarga = category.length > 100;

    if (massaCurta === true) {
      return {
        ok: false,
        reason: "La categoria ha de tenir entre 1 i 100 caràcters",
      };
    }
    if (massaLlarga === true) {
      return {
        ok: false,
        reason: "La categoria ha de tenir entre 1 i 100 caràcters",
      };
    }

    next.category = category;
  }

  //DIFICULTAT
  if (configuration.difficulty !== undefined) {
    if (typeof configuration.difficulty !== "string") {
      return {
        ok: false,
        reason: "La dificultat ha de ser un text",
      };
    }

    const difficulty = String(configuration.difficulty).trim().toLowerCase();

    if (!difficulty || difficulty.length > 32) {
      return {
        ok: false,
        reason: "La dificultat ha de tenir entre 1 i 32 caràcters",
      };
    }

    next.difficulty = difficulty;
  }

  //NOMBRE MÀXIM DE JUGADORS
  if (configuration.maxPlayers !== undefined) {
    const maxPlayers = configuration.maxPlayers;

    const noEnter = Number.isInteger(maxPlayers) === false;
    const massaPetit = maxPlayers < minPlayers;
    const massaGran = maxPlayers > maxPlayersLimit;

    if (noEnter === true) {
      return {
        ok: false,
        reason: "El nombre de jugadors ha de ser un enter entre 2 i 20",
      };
    }
    if (massaPetit === true) {
      return {
        ok: false,
        reason: "El nombre de jugadors ha de ser un enter entre 2 i 20",
      };
    }
    if (massaGran === true) {
      return {
        ok: false,
        reason: "El nombre de jugadors ha de ser un enter entre 2 i 20",
      };
    }

    //NO PODEM DEIXAR LA SALA AMB MENYS PLAÇA QUE JUGADORS
    if (maxPlayers < room.players.size) {
      return {
        ok: false,
        reason: "La sala ja té més jugadors que el nou màxim",
      };
    }

    next.maxPlayers = maxPlayers;
  }

  //NOMBRE DE RONDES (CADA RONDA ÉS UNA PREGUNTA)
  if (configuration.rounds !== undefined) {
    const rounds = configuration.rounds;

    const noEnter = Number.isInteger(rounds) === false;
    const massaPetit = rounds < minRounds;
    const massaGran = rounds > maxRounds;

    if (noEnter === true) {
      return {
        ok: false,
        reason: "El nombre de rondes ha de ser un enter entre 1 i 50",
      };
    }
    if (massaPetit === true) {
      return {
        ok: false,
        reason: "El nombre de rondes ha de ser un enter entre 1 i 50",
      };
    }
    if (massaGran === true) {
      return {
        ok: false,
        reason: "El nombre de rondes ha de ser un enter entre 1 i 50",
      };
    }

    next.rounds = rounds;
  }

  //DURADA DE LA RONDA (EL CLIENT L'ENVIA EN SEGONS)
  if (configuration.durationSeconds !== undefined) {
    const durationSeconds = configuration.durationSeconds;

    const noEnter = Number.isInteger(durationSeconds) === false;
    const massaCurta = durationSeconds < minDurationSeconds;
    const massaLlarga = durationSeconds > maxDurationSeconds;

    if (noEnter === true) {
      return {
        ok: false,
        reason: "La durada de la ronda ha de ser un enter entre 5 i 60 segons",
      };
    }
    if (massaCurta === true) {
      return {
        ok: false,
        reason: "La durada de la ronda ha de ser un enter entre 5 i 60 segons",
      };
    }
    if (massaLlarga === true) {
      return {
        ok: false,
        reason: "La durada de la ronda ha de ser un enter entre 5 i 60 segons",
      };
    }

    next.durationSeconds = durationSeconds;
  }

  if (next.maxPlayers !== room.maxPlayers) {
    await updateRoomMaxPlayers({ roomId: roomId, maxPlayers: next.maxPlayers });
  }

  //APLIQUEM NOMÉS ELS CAMPS QUE HAN CANVIAT
  const changed = [];

  if (next.category !== room.category) {
    room.category = next.category;
    changed.push("category");
  }

  if (next.difficulty !== room.difficulty) {
    room.difficulty = next.difficulty;
    changed.push("difficulty");
  }

  if (next.maxPlayers !== room.maxPlayers) {
    room.maxPlayers = next.maxPlayers;
    changed.push("maxPlayers");
  }

  if (next.rounds !== room.rounds) {
    room.rounds = next.rounds;
    changed.push("rounds");
  }

  //LA CONVERSIÓ A MS ES FA NOMÉS AQUÍ
  if (next.durationSeconds * 1000 !== room.roundDurationMs) {
    room.roundDurationMs = next.durationSeconds * 1000;
    changed.push("durationSeconds");
  }

  return {
    ok: true,
    changed: changed,
    configuration: buildConfiguration(room),
  };
}
