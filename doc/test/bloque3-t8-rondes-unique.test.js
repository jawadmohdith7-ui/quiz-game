const { suite } = require("./lib/check");

suite(
  {
    bloc: 3,
    id: "T8",
    titol: "Rondes sense preguntes repetides i respostes amb UNIQUE",
    demana:
      "La pregunta es tria amb SQL excloent les ja fetes en la partida. Una segona resposta a la mateixa ronda la rebutja el UNIQUE i el jugador rep un missatge clar.",
    fem:
      "preguntas.repository.js filtra amb NOT IN (SELECT pregunta_id FROM ronda ...) i la BD té uq_ronda_partida_pregunta. gameRepository tradueix ER_DUP_ENTRY → 'Ja has respost aquesta ronda.'",
  },
  ({ existeix, llegir, check }) => {
    const repo = "backend/catalog-service/src/questions/preguntas.repository.js";
    const game = "backend/game-service/src/game/persistence/gameRepository.js";
    const sql = "backend/database/sql/schema.sql";
    check("existeixen els tres fitxers clau", existeix(repo) && existeix(game) && existeix(sql));
    if (!(existeix(repo) && existeix(game) && existeix(sql))) return;

    const r = llegir(repo);
    const g = llegir(game);
    const s = llegir(sql);

    const exclusio = r.match(/NOT IN\s*\([\s\S]{0,600}?\)/);
    check("l'exclusió de preguntes és SQL (NOT IN ... ronda)", Boolean(exclusio), "s'exclouen des de JS o no s'exclouen");
    check("la consulta filtra per partida (codi o id)", /partida/i.test(exclusio?.[0] || ""), "l'exclusió no és per partida");

    check("UNIQUE(partida_id, pregunta_id) a la BD", s.includes("uq_ronda_partida_pregunta"));
    check("UNIQUE(ronda_id, participant_id) a la BD", s.includes("uq_resposta_ronda_participant"));

    check("la resposta doble es tradueix per error.code", /ER_DUP_ENTRY/.test(g));
    check("el missatge al jugador és clar", g.includes("Ja has respost aquesta ronda."), "no s'ha trobat el missatge");

    check("s'agafa una pregunta aleatòria per torn", /RAND\s*\(\s*\)/i.test(r) || /ORDER BY/i.test(r));
  }
);
