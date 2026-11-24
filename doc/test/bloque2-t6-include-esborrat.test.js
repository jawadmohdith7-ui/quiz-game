const { suite } = require("./lib/check");

suite(
  {
    bloc: 2,
    id: "T6",
    titol: "Associació categoria-preguntes amb include i esborrat protegit",
    demana:
      "Associació en els dos sentits i llistat amb include. Una categoria amb preguntes no s'esborra i el missatge diu per què; una categoria sense preguntes sí que s'esborra.",
    fem:
      "hasMany + belongsTo a sequelize.js; include de Categoria/Pregunta a preguntas.repository.js; doble barrera: comprovació al mòdul (missatge amb el nombre de preguntes) i ON DELETE RESTRICT a la BD.",
  },
  ({ existeix, llegir, check }) => {
    const model = "backend/catalog-service/src/db/sequelize.js";
    const repo = "backend/catalog-service/src/questions/preguntas.repository.js";
    const sql = "backend/database/sql/schema.sql";
    check("existeixen model, repositori i schema", existeix(model) && existeix(repo) && existeix(sql));
    if (!(existeix(model) && existeix(repo) && existeix(sql))) return;

    const m = llegir(model);
    const r = llegir(repo);

    check("associació en un sentit: hasMany(Pregunta)", /hasMany\s*\(\s*Pregunta/.test(m));
    check("associació en l'altre: belongsTo(Categoria)", /belongsTo\s*\(\s*Categoria/.test(m));

    check("llistat de categories amb include de Pregunta", /include\s*:\s*\[\s*\{\s*model\s*:\s*Pregunta/.test(r), "el llistat no fa include");
    check("llistat de preguntes amb include de Categoria", /include\s*:\s*\[\s*\{\s*model\s*:\s*Categoria/.test(r), "el llistat no fa include");

    const natura = /ON DELETE RESTRICT/i.test(llegir(sql).match(/fk_pregunta_categoria[\s\S]{0,220}/)?.[0] || "");
    check("la BD protegeix amb ON DELETE RESTRICT", natura);

    check("el mòdul comprova si té preguntes abans d'esborrar", /count\s*\(|findAll\s*\(/.test(r) && /pregunta/i.test(r));
    check("el missatge diu per què (nombre de preguntes)", /pregunt/i.test(r) && /\$\{|[0-9]|length/.test(r));
  }
);
