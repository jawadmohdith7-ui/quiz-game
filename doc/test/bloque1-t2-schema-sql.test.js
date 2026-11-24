const { suite } = require("./lib/check");

suite(
  {
    bloc: 1,
    id: "T2",
    titol: "schema.sql",
    demana:
      "S'executa sense errors en una BD buida. Té PK, FK amb ON DELETE coherent, UNIQUE (codi de partida, nom per partida, resposta per ronda i participant), NOT NULL i CHECK. Una fila que incompleixi el CHECK ha de ser rebutjada.",
    fem:
      "backend/database/sql/schema.sql: 10 taules, 2 FK compostes, 6 UNIQUE i 8 CHECK. La prova del CHECK es fa en directe a phpMyAdmin (comanda al README).",
  },
  ({ existeix, llegir, check }) => {
    const f = "backend/database/sql/schema.sql";
    check("existeix schema.sql", existeix(f));
    if (!existeix(f)) return;
    const sql = llegir(f);

    const taules = (sql.match(/CREATE TABLE/gi) || []).length;
    check("crea 10 taules", taules === 10, `n'hi ha ${taules}`);
    check("totes les taules tenen PRIMARY KEY", (sql.match(/PRIMARY KEY/gi) || []).length >= taules);
    check("usa InnoDB", /ENGINE\s*=\s*InnoDB/i.test(sql));
    check("usa utf8mb4", /utf8mb4/i.test(sql));

    const trossosFk = sql.split(/FOREIGN KEY/i).slice(1);
    const senseDelete = trossosFk.filter((t) => !/ON DELETE/i.test(t.slice(0, 220)));
    check("totes les FK tenen ON DELETE", trossosFk.length >= 6 && senseDelete.length === 0, `${trossosFk.length} FK, ${senseDelete.length} sense ON DELETE`);

    const uniques = (sql.match(/UNIQUE\s*\(/gi) || []).length;
    check("hi ha UNIQUE compostos (>=6)", uniques >= 6, `n'hi ha ${uniques}`);
    check("UNIQUE del codi de partida", sql.includes("uq_partida_codi"));
    check("UNIQUE del nickname per partida", sql.includes("uq_participant_partida_nickname"));
    check("UNIQUE de resposta per ronda i participant", sql.includes("uq_resposta_ronda_participant"));
    check("UNIQUE de pregunta per partida (no repetir)", sql.includes("uq_ronda_partida_pregunta"));

    check("hi ha CHECK", /CHECK\s*\(/i.test(sql));
    check("CHECK del slider (resposta dins del rang)", /chk_pregunta_slider/i.test(sql));
    check("hi ha NOT NULL", /NOT NULL/i.test(sql));

    const fkCat = sql.match(/fk_pregunta_categoria[\s\S]{0,220}/)?.[0] || "";
    check("categoria → pregunta és ON DELETE RESTRICT", /ON DELETE RESTRICT/i.test(fkCat));
    const fkPart = sql.match(/fk_participant_partida[\s\S]{0,220}/)?.[0] || "";
    check("partida → participant és ON DELETE CASCADE", /ON DELETE CASCADE/i.test(fkPart));
  }
);
