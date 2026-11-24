const { suite } = require("./lib/check");

suite(
  {
    bloc: 1,
    id: "T1",
    titol: "Diagrama ER i model relacional",
    demana:
      "Document a /docs coherent amb schema.sql: totes les classes, associacions amb nom i multiplicitats, claus i restriccions. El profe triarà dues associacions i les haurem de trobar a schema.sql.",
    fem:
      "doc/model-de-dades.md (ER + model relacional) i doc/defensa.md (taula associació → constraint amb fitxer/línia).",
  },
  ({ existeix, llegir, check }) => {
    const doc = "doc/model-de-dades.md";
    check("existeix el document a doc/", existeix(doc));
    if (!existeix(doc)) return;

    const txt = llegir(doc);
    const taules = ["categoria", "pregunta", "partida", "participant", "ronda", "resposta", "rol", "usuaris", "partides", "registre"];
    const falten = taules.filter((t) => !txt.includes(t));
    check(`el document descriu les ${taules.length} taules`, falten.length === 0, `falten: ${falten.join(", ")}`);

    check("hi ha el diagrama ER incrustat", Boolean(txt.match(/!\[[^\]]*\]\(/)));
    check(
      "documenta les multiplicitats al text (no només al dibuix)",
      /1\s*(\.\.|a|—|-|:)\s*\*?N|N:M|N a 1/i.test(txt),
      "les multiplicitats només són al PNG"
    );
    check("documenta les claus (PK/FK)", /clau|primary key|FK/i.test(txt), "no es mencionen les claus");
    check("documenta restriccions (UNIQUE/CHECK/RESTRICT)", /UNIQUE|CHECK|RESTRICT/i.test(txt), "no es mencionen restriccions");

    const def = "doc/defensa.md";
    check("doc/defensa.md té la taula associació → constraint", existeix(def) && llegir(def).includes("fk_pregunta_categoria"));
  }
);
