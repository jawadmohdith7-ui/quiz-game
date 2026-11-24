const { suite } = require("./lib/check");

suite(
  {
    bloc: 2,
    id: "T5",
    titol: "CRUD de categories i preguntes amb validacions al model",
    demana:
      "Des de l'administració: crear, modificar i esborrar categories i preguntes, comprovar-ho a phpMyAdmin i veure que una dada invàlida es rebutja amb un missatge clar per camp (també el nom de categoria repetit). Les validacions han de ser al model.",
    fem:
      "CRUD a l'admin Vue; validacions amb allowNull + validate a sequelize.js; errors traduïts a { camp: missatge } a errors/sequelizeErrors.js.",
  },
  ({ existeix, llegir, on, check, lista }) => {
    const model = "backend/catalog-service/src/db/sequelize.js";
    const errors = "backend/catalog-service/src/errors/sequelizeErrors.js";
    check("existeix el model", existeix(model));
    check("existeix el traductor d'errors", existeix(errors));
    if (!existeix(model) || !existeix(errors)) return;

    const m = llegir(model);
    const e = llegir(errors);

    check("hi ha allowNull: false al model", (m.match(/allowNull\s*:\s*false/g) || []).length >= 8);
    check("hi ha validate: al model", (m.match(/validate\s*:/g) || []).length >= 4);
    check("nom de categoria únic (unique: true)", /unique\s*:\s*true/.test(m));
    check("hi ha una validació a nivell de model sencer", /^\s{4}validate\s*:/m.test(m), "les validacions només serien per columna");

    check("ValidationError es tradueix", /ValidationError/.test(e));
    check("el missatge és per camp (item.path)", /item\.path|err\.errors/.test(e), "no es desglossa per camp");
    check("UniqueConstraintError es reconeix abans que ValidationError", e.indexOf("instanceof UniqueConstraintError") < e.indexOf("instanceof ValidationError"));

    const routes = on(/validate\s*:|AllowNull/, "backend/catalog-service/src", { include: /routes\.js$/ });
    check("les validacions no viuen a les rutes", routes.length === 0, lista(routes));

    const crud = on(/\b(create|update|destroy|findAll)\s*\(/, "backend/catalog-service/src/questions/preguntas.repository.js");
    check("el repositori fa el CRUD complet (create/update/destroy)", crud.length >= 4);
  }
);
