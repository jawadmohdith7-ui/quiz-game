const { suite } = require("./lib/check");

suite(
  {
    bloc: 4,
    id: "T11",
    titol: "Unir-se a una partida i respondre amb FOR UPDATE",
    demana:
      "Les dues operacions (respondre i unir-se) fan servir una transacció amb SELECT ... FOR UPDATE. Una resposta a una ronda tancada es rebutja i l'entrada a una partida començada també, amb missatge clar.",
    fem:
      "FOR UPDATE a gameRepository.js (respondre: ronda + partida) i a roomRepository.js (unir-se / estat de la partida). Rebuig amb error de domini, no amb estat a memòria.",
  },
  ({ existeix, llegir, on, check, lista }) => {
    const game = "backend/game-service/src/game/persistence/gameRepository.js";
    const room = "backend/game-service/src/repositories/roomRepository.js";
    check("existeixen les dues capes", existeix(game) && existeix(room));
    if (!(existeix(game) && existeix(room))) return;

    const g = llegir(game);
    const r = llegir(room);

    check("respondre bloqueja la ronda (FOR UPDATE)", /ronda[\s\S]{0,200}?FOR UPDATE/i.test(g) || /FOR UPDATE[\s\S]{0,200}?ronda/i.test(g));
    check("respondre bloqueja la partida (FOR UPDATE)", /partida[\s\S]{0,200}?FOR UPDATE/i.test(g) || /FOR UPDATE[\s\S]{0,200}?partida/i.test(g));
    check("unir-se fa FOR UPDATE", /FOR UPDATE/i.test(r), "unir-se no bloqueja res");
    check("unir-se llegeix l'estat de la partida", /estat/i.test(r) && /partida/i.test(r));

    check("la ronda tancada es detecta per estat a la BD", /estat\s*=\s*'?oberta'?/i.test(g) || /estat\s*<>\s*'?oberta'?/i.test(g));
    check("hi ha error de domini per ronda tancada", /ROUND_|TANCADA|CLOSED/i.test(g), "no s'ha trobat l'error de ronda tancada");
    check("hi ha error de domini per entrar a partida començada", /ROOM_|IN_PROGRESS|COMEN|JA_COMEN/i.test(r), "no s'ha trobat l'error d'entrada");
    check("les transaccions fan servir una sola connexió", /getConnection\s*\(/.test(g) && /getConnection\s*\(/.test(r));

    const total = on(/FOR UPDATE/i, "backend/game-service/src", { include: /\.js$/ });
    check("FOR UPDATE només a les capes de dades (no a rutes ni handlers)", total.every((m) => /repositor|persistence/i.test(m.fitxer)), lista(total.filter((m) => !/repositor|persistence/i.test(m.fitxer))));
  }
);
