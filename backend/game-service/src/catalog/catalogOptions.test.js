//ARXIU QUE COMPROVA LA CONSULTA DEL CATALEG I LA REVALIDACIO DE SALES

//=====================
//IMPORTEM
//=====================
import assert from "node:assert/strict";
import test from "node:test";
import { roomStorage } from "../storage/roomStorage.js";
import { registerClient, unregisterClient } from "../connections/broadcast.js";

//LA CONFIGURACIO ES LLEGEIX EN IMPORTAR EL MODUL
process.env.INTERNAL_SECRET = "test-secret";
process.env.CATALOG_URL = "http://catalog.test";

const catalog = await import("./catalogOptions.js");

//=====================
//FUNCIO AUXILIAR: SIMULA LA RESPOSTA DEL CATALOG
//=====================
function mockCatalogResponse(categories, difficulties) {
  const originalFetch = global.fetch;

  global.fetch = async function fakeFetch(url, options) {
    assert.equal(url, "http://catalog.test/internal/catalog/options");
    assert.equal(options.headers["x-internal-secret"], "test-secret");

    return {
      ok: true,
      status: 200,
      json: async function readJson() {
        return {
          categories: categories,
          difficulties: difficulties,
        };
      },
    };
  };

  return originalFetch;
}

//=====================
//TEST: RESPOSTA CORRECTA DEL CATALOG
//=====================
test("getCatalogOptions retorna les llistes del catalog", async () => {
  const originalFetch = mockCatalogResponse(["Ciencia", "Futbol"], ["facil"]);

  try {
    const options = await catalog.getCatalogOptions();

    assert.deepEqual(options.categories, ["Ciencia", "Futbol"]);
    assert.deepEqual(options.difficulties, ["facil"]);
  } finally {
    global.fetch = originalFetch;
  }
});

//=====================
//TEST: CATEGORIA ELIMINADA
//=====================
test("revalidateRoomConfiguration canvia una categoria eliminada a Mix", () => {
  const room = {
    category: "Futbol",
    difficulty: "facil",
  };

  const changed = catalog.revalidateRoomConfiguration(room, {
    categories: ["Ciencia"],
    difficulties: ["facil"],
  });

  assert.deepEqual(changed, ["category"]);
  assert.equal(room.category, "Mix");
  assert.equal(room.difficulty, "facil");
});

//=====================
//TEST: DIFICULTAT ELIMINADA
//=====================
test("revalidateRoomConfiguration canvia una dificultat eliminada a mix", () => {
  const room = {
    category: "Futbol",
    difficulty: "dificil",
  };

  const changed = catalog.revalidateRoomConfiguration(room, {
    categories: ["Futbol"],
    difficulties: ["facil"],
  });

  assert.deepEqual(changed, ["difficulty"]);
  assert.equal(room.category, "Futbol");
  assert.equal(room.difficulty, "mix");
});

//=====================
//TEST: UNA SALA EN PARTIDA NO ES TOCA
//=====================
test("revalidateLobbyRooms no toca una sala playing", () => {
  const roomId = "test-playing-room";
  const room = {
    state: "playing",
    category: "Futbol",
    difficulty: "dificil",
  };

  roomStorage.members.set(roomId, room);

  try {
    catalog.revalidateLobbyRooms({
      categories: ["Ciencia"],
      difficulties: ["facil"],
    });

    assert.equal(room.category, "Futbol");
    assert.equal(room.difficulty, "dificil");
  } finally {
    roomStorage.members.delete(roomId);
  }
});

//=====================
//TEST: RETORN AL LOBBY AMB AVIS ROOM:CONFIGURATION:UPDATED
//=====================
test("revalidateRoomAgainstCatalog emet room:configuration:updated", async () => {
  const roomId = "test-lobby-room";
  const room = {
    state: "lobby",
    category: "Futbol",
    difficulty: "dificil",
    maxPlayers: 4,
    rounds: 5,
    roundDurationMs: 20000,
  };

  const sent = [];
  const fakeClient = {
    roomId: roomId,
    readyState: 1,
    send: function send(data) {
      sent.push(data);
    },
  };

  roomStorage.members.set(roomId, room);
  registerClient(fakeClient);

  const originalFetch = mockCatalogResponse(["Ciencia"], ["facil"]);

  try {
    const changed = await catalog.revalidateRoomAgainstCatalog(roomId);

    assert.deepEqual(changed, ["category", "difficulty"]);
    assert.equal(room.category, "Mix");
    assert.equal(room.difficulty, "mix");
    assert.equal(sent.length, 1);

    const message = JSON.parse(sent[0]);
    assert.equal(message.type, "room:configuration:updated");
    assert.deepEqual(message.changed, ["category", "difficulty"]);
    assert.equal(message.configuration.category, "Mix");
    assert.equal(message.configuration.difficulty, "mix");
  } finally {
    global.fetch = originalFetch;
    unregisterClient(fakeClient);
    roomStorage.members.delete(roomId);
  }
});
