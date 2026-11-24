const { suite } = require("./lib/check");

suite(
  {
    bloc: 1,
    id: "T3",
    titol: "dades-inicials.sql",
    demana:
      "Es pot executar dues vegades seguides i deixa sempre el mateix estat: mateixes files i mateixos id. Hi ha prou dades per jugar.",
    fem:
      "Ids explícits + ON DUPLICATE KEY UPDATE id = id (no-op) dins d'una transacció: la segona passada no canvia res.",
  },
  ({ existeix, llegir, check }) => {
    const f = "backend/database/sql/dades-inicials.sql";
    check("existeix dades-inicials.sql", existeix(f));
    if (!existeix(f)) return;
    const sql = llegir(f);

    check("és idempotent (ON DUPLICATE KEY UPDATE)", sql.includes("ON DUPLICATE KEY UPDATE"));
    check("no esborra res (sense DELETE FROM ni TRUNCATE)", !/DELETE\s+FROM|TRUNCATE\s+TABLE/i.test(sql), "hi ha un esborrat: els ids podrien canviar");
    check("usa ids explícits a l'INSERT", /INSERT INTO `?categoria`?\s*\(\s*id/i.test(sql) || /INSERT INTO `?categoria`?\s*\([^)]*\bid\b/i.test(sql));
    check("no toca AUTO_INCREMENT", !/AUTO_INCREMENT\s*=/i.test(sql), "ALTER TABLE ... AUTO_INCREMENT pot variar segons l'estat previ");

    const preguntes = (sql.match(/^\s*\(\s*\d+\s*,\s*\d+\s*,/gm) || []).length;
    check("hi ha prou preguntes per jugar (>=20)", preguntes >= 20, `només ${preguntes} preguntes`);

    const cats = ["Geografia", "Ciencia", "Historia", "Esports", "Cultura", "Cos Humà", "Tecnologia", "Curiositats"];
    const trobades = cats.filter((c) => sql.toLowerCase().includes(c.toLowerCase()));
    check("les 8 categories inicials hi són", trobades.length === 8, `trobades ${trobades.length}/8: ${trobades.join(", ")}`);
  }
);
