const { suite } = require("./lib/check");

suite(
  {
    bloc: 3,
    id: "T9",
    titol: "Classificació acumulada i final (JOIN, SUM, GROUP BY)",
    demana:
      "Acumulada i final calculades amb SQL (JOIN, SUM, GROUP BY) i ordenades. Coincideixen amb la suma a mà i un jugador sense respostes surt amb 0.",
    fem:
      "gameRepository.js: LEFT JOIN resposta + COALESCE(SUM(a.punts),0) + GROUP BY + ORDER BY. El total no es desa mai: es deriva.",
  },
  ({ existeix, llegir, check }) => {
    const f = "backend/game-service/src/game/persistence/gameRepository.js";
    check("existeix gameRepository.js", existeix(f));
    if (!existeix(f)) return;
    const txt = llegir(f);

    const consulta = txt.match(/SELECT[\s\S]{0,400}?GROUP BY[\s\S]{0,120}/i)?.[0] || "";
    check("hi ha una consulta amb GROUP BY", Boolean(consulta));
    check("suma els punts amb SUM(...)", /SUM\s*\(\s*\w*\.?punts\s*\)/i.test(consulta || txt));
    check("usa LEFT JOIN (perquè hi surti el que no ha respost)", /LEFT\s+JOIN/i.test(consulta || txt));
    check("COALESCE perquè un jugador sense respostes valgui 0", /COALESCE\s*\(\s*SUM/i.test(txt));
    check("agrupa per participant", /GROUP BY\s+(p\.id|participant)/i.test(txt), "no s'agrupa per participant");
    check("està ordenada per punts", /ORDER BY[\s\S]{0,80}(score|punts)[\s\S]{0,20}DESC/i.test(txt), "no s'ordena per punts");

    check("existeix una classificació final", /final|acabada/i.test(txt));
    check("els totals no es desen enlloc (cap UPDATE ... total)", !/UPDATE\s+participant[\s\S]{0,80}total/i.test(txt));
  }
);
