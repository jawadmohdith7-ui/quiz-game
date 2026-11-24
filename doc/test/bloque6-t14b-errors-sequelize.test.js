const { suite } = require("./lib/check");

suite(
  {
    bloc: 6,
    id: "T14b",
    titol: "Mòduls Sequelize reutilitzables; errors per tipus",
    demana:
      "Els models només es fan servir als mòduls de dades. Els errors es reconeixen per tipus, amb UniqueConstraintError abans que ValidationError, i també es tradueix ForeignKeyConstraintError. Cal saber explicar l'ordre.",
    fem:
      "sequelizeErrors.js: UniqueConstraintError (409) → ForeignKeyConstraintError (409) → ValidationError (400 amb mapa camp:missatge). L'ordre és obligatori perquè UniqueConstraintError HERETA de ValidationError.",
  },
  ({ existeix, llegir, on, check, lista }) => {
    const f = "backend/catalog-service/src/errors/sequelizeErrors.js";
    check("existeix el traductor d'errors", existeix(f));
    if (!existeix(f)) return;
    const txt = llegir(f);

    const iUnique = txt.indexOf("instanceof UniqueConstraintError");
    const iFk = txt.indexOf("instanceof ForeignKeyConstraintError");
    const iVal = txt.indexOf("instanceof ValidationError");

    check("es reconeix UniqueConstraintError", iUnique >= 0);
    check("es reconeix ValidationError", iVal >= 0);
    check("es reconeix ForeignKeyConstraintError", iFk >= 0, "no es tradueix la FK (categoria amb preguntes)");
    check("UniqueConstraintError va ABANS que ValidationError", iUnique >= 0 && iUnique < iVal, "si ValidationError va primer, el duplicat cau al cas genèric");
    check("ForeignKeyConstraintError va abans del cas genèric", iFk >= 0 && iFk < Math.max(iVal, iUnique) + 1);

    check("el ValidationError dona missatge per camp", /path|errors/.test(txt));
    check("hi ha un retorn per defecte (null / error genèric)", /return\s+null|return\s+undefined/.test(txt));

    const foraDelModul = on(/\.(findAll|create|destroy|update)\s*\(/, "backend/catalog-service/src", {
      exclude: /(questions\/preguntas\.repository|questions\/importQuestions|db\/sequelize|cli\/)/,
      include: /\.js$/,
    });
    check("els models només es fan servir als mòduls de dades", foraDelModul.length === 0, lista(foraDelModul));
  }
);
