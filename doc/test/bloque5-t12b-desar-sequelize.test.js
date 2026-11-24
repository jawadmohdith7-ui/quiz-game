const { suite } = require("./lib/check");

suite(
  {
    bloc: 5,
    id: "T12b",
    titol: "Desar les preguntes vàlides amb Sequelize",
    demana:
      "Només les vàlides queden a la BD, amb la seva categoria, desades amb el mòdul de dades de Sequelize. Si una falla en desar-la es descarta i es continua. Cal justificar què passa amb una categoria inexistent i amb una importació repetida.",
    fem:
      "desaPregunta() obre una transacció de Sequelize per pregunta, amb try/catch que la descarta i continua. findOrCreate resol la categoria pel nom; findOne per (categoria, text) fa que reimportar actualitzi o salti.",
  },
  ({ existeix, llegir, check }) => {
    const f = "backend/catalog-service/src/questions/importQuestions.js";
    check("existeix importQuestions.js", existeix(f));
    if (!existeix(f)) return;
    const txt = llegir(f);

    check("desa pregunta a pregunta (no bulkCreate)", /for\s*\(/.test(txt) && !/bulkCreate/.test(txt));
    check("ho fa amb els models de Sequelize (create/findOne)", /Pregunta\.(create|findOne|findOrCreate)/.test(txt));
    check("no escriu SQL a mà (cap INSERT INTO)", !/INSERT\s+INTO/i.test(txt));
    check("una fallada en desar no atura el lot (try/catch per pregunta)", /try\s*\{[\s\S]{0,1500}?rejected\.push/.test(txt));
    check("la transacció és per pregunta", /sequelize\.transaction/.test(txt));
    check("la categoria es resol pel nom", /findOrCreate[\s\S]{0,120}nom/.test(txt));
    check("informa del resultat (imported/updated/skipped/rejected)", /imported/.test(txt) && /skipped/.test(txt) && /rejected/.test(txt));
  }
);
