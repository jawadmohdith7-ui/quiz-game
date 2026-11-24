const { suite } = require("./lib/check");

suite(
  {
    bloc: 5,
    id: "T13",
    titol: "Exportació CSV d'una partida acabada",
    demana:
      "El CSV s'obre bé en un full de càlcul: columnes ben separades, accents i decimals correctes, amb participants, respostes, punts i classificació final. Fet amb csv-stringify. Una partida no acabada no s'exporta.",
    fem:
      "exportGameCsv.js amb csv-stringify/sync i bom: true (accents OK), consulta amb la classificació final. Forat conegut: els decimals poden sortir com a 42.000000.",
  },
  ({ existeix, llegir, check, conegut }) => {
    const f = "backend/game-service/src/game/files/exportGameCsv.js";
    check("existeix exportGameCsv.js", existeix(f));
    if (!existeix(f)) return;
    const txt = llegir(f);

    check("fa servir csv-stringify", /csv-stringify/.test(txt), "concatenaria text a mà");
    check("BOM perquè Excel llegeixi UTF-8 (accents)", /bom\s*:\s*true/.test(txt), "sense BOM els accents surten trencats");
    check("inclou els participants", /participant/i.test(txt));
    check("inclou les respostes", /resposta/i.test(txt));
    check("inclou els punts", /punts|score/i.test(txt));
    check("inclou la classificació final (SUM/GROUP BY)", /SUM\s*\(/i.test(txt) && /GROUP BY/i.test(txt));

    check("una partida no acabada no s'exporta", /acabada/i.test(txt), "no es comprova l'estat de la partida");
    check("l'estat es llegeix de la BD", /estat/i.test(txt));

    conegut("els decimals s'exporten nets (Number abans d'escriure)", /Number\s*\(/.test(txt), "podrien sortir com a 42.000000");
    check("el separador és de full de càlcul (sync + columns)", /columns\s*:|delimiter/.test(txt));
  }
);
