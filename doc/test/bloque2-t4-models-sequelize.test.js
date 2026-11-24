const { suite } = require("./lib/check");

suite(
  {
    bloc: 2,
    id: "T4",
    titol: "Connexió i models de categories i preguntes, sense sync()",
    demana:
      "Els models corresponen a les taules de l'script: columnes i tipus iguals, tableName, timestamps: false i la clau forana. Una sola instància de Sequelize. Cap sync().",
    fem:
      "backend/catalog-service/src/db/sequelize.js defineix Categoria i Pregunta amb tableName i timestamps: false. schema.sql és l'única font de DDL.",
  },
  ({ existeix, llegir, on, check, conegut, lista }) => {
    const f = "backend/catalog-service/src/db/sequelize.js";
    check("existeix db/sequelize.js", existeix(f));
    if (!existeix(f)) return;
    const txt = llegir(f);

    const syncs = on(/\.sync\s*\(/, "backend", { include: /\.js$/ });
    check("cap sync() a tot el projecte", syncs.length === 0, lista(syncs));

    const instancies = on(/new Sequelize\s*\(/, "backend", { include: /\.js$/ });
    check("una sola instància de Sequelize al servei del catàleg", instancies.filter((i) => i.fitxer.includes("catalog-service")).length === 1);
    conegut(
      "una sola instància a tot el projecte",
      instancies.length === 1,
      `${instancies.length} (${lista(instancies)}): cada microservei és un procés i té la seva connexió`
    );

    check("els models tenen tableName", (txt.match(/tableName\s*:/g) || []).length >= 2);
    check("els models tenen timestamps: false", (txt.match(/timestamps\s*:\s*false/g) || []).length >= 2);
    check("Pregunta declara la FK categoria_id", /categoria_id/.test(txt));
    check("tipus de text TEXT", /TEXT/.test(txt));
    check("resposta_correcta és DOUBLE", /resposta_correcta[\s\S]{0,80}DOUBLE|DOUBLE[\s\S]{0,80}resposta_correcta/.test(txt));
    check("min/max/step declarats", /min_value/.test(txt) && /max_value/.test(txt) && /step_value/.test(txt));
    check("el nom de la categoria és únic al model", /unique\s*:\s*true/.test(txt));
  }
);
