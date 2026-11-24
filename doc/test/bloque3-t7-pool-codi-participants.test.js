const { suite } = require("./lib/check");

suite(
  {
    bloc: 3,
    id: "T7",
    titol: "Pool compartit, partides amb codi únic i participants",
    demana:
      "Un sol pool compartit per tots els mòduls. Codi únic garantit per UNIQUE amb un nou intent si coincideix. Un nom repetit es rebutja amb un missatge clar.",
    fem:
      "Un createPool per microservei (db/pool.js) reutilitzat per tots els repositoris. UNIQUE(codi) a la BD i reintent a createRoom.js quan error.code === 'ER_DUP_ENTRY'.",
  },
  ({ existeix, llegir, on, check, lista }) => {
    const pools = on(/createPool\s*\(/, "backend", { include: /\.js$/ });
    check("exactament 3 pools (un per servei)", pools.length === 3, `${pools.length}: ${lista(pools)}`);
    const perServei = ["auth-service", "catalog-service", "game-service"].map((s) => pools.filter((p) => p.fitxer.includes(s)).length);
    check("cap servei amb més d'un pool", perServei.every((n) => n === 1), `recompte per servei: ${perServei.join(",")}`);

    const sql = existeix("backend/database/sql/schema.sql") ? llegir("backend/database/sql/schema.sql") : "";
    check("UNIQUE del codi de partida a la BD", sql.includes("uq_partida_codi"));
    check("UNIQUE del nickname dins la partida a la BD", sql.includes("uq_participant_partida_nickname"));

    const create = "backend/game-service/src/rooms/createRoom.js";
    check("createRoom gestiona la col·lisió de codi (ER_DUP_ENTRY)", existeix(create) && llegir(create).includes("ER_DUP_ENTRY"));

    const join = "backend/game-service/src/rooms/joinRoom.js";
    check("joinRoom rebutja el nickname repetit per error.code", existeix(join) && llegir(join).includes("ER_DUP_ENTRY"));

    const soltes = on(/createConnection\s*\(/, "backend", { include: /\.js$/ });
    check("cap connexió solta (createConnection)", soltes.length === 0, lista(soltes));
  }
);
