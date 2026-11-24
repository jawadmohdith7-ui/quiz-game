const { suite } = require("./lib/check");

suite(
  {
    bloc: 5,
    id: "T12a",
    titol: "Llegir i validar el JSON amb validarPregunta() i informe de descartades",
    demana:
      "Un JSON amb preguntes invàlides: totes es descarten i l'informe diu el motiu de cadascuna, incloent-hi TOTS els errors d'una mateixa pregunta. Un fitxer amb la sintaxi trencada dona un missatge clar i el servidor continua funcionant.",
    fem:
      "validarPregunta() acumula tots els errors en un array; loadQuestions.js captura el JSON.parse i llança QUESTIONS_FILE_ERROR; importQuestions retorna un array rejected amb motius.",
  },
  ({ existeix, llegir, check }) => {
    const val = "backend/catalog-service/src/questions/validarPregunta.js";
    const imp = "backend/catalog-service/src/questions/importQuestions.js";
    const load = "backend/catalog-service/src/questions/loadQuestions.js";
    check("existeixen validarPregunta, importQuestions i loadQuestions", existeix(val) && existeix(imp) && existeix(load));
    if (!(existeix(val) && existeix(imp) && existeix(load))) return;

    const v = llegir(val);
    const i = llegir(imp);
    const l = llegir(load);

    check("valida el text", /text/i.test(v));
    check("valida la resposta correcta", /resposta_correcta/i.test(v));
    check("valida el rang del slider (min/max/step)", /min/i.test(v) && /max/i.test(v) && /step/i.test(v));
    check("valida que la resposta caigui dins del rang", /resposta\s*<\s*min|resposta\s*>\s*max/i.test(v));
    check("valida la dificultat", /dificultat/i.test(v));
    check("valida la categoria", /categoria/i.test(v));
    check("acumula TOTS els errors (no surt al primer)", /errors\.push/.test(v) && (v.match(/errors\.push/g) || []).length >= 5);
    check("retorna valid + llista d'errors", /valid\s*:/.test(v) && /errors\s*,/.test(v));
    check("importQuestions crida validarPregunta", /validarPregunta/.test(i));

    check("el JSON mal format es captura (try + JSON.parse)", /try\s*\{[\s\S]{0,200}?JSON\.parse/.test(l));
    check("l'error de fitxer té codi propi i missatge clar", /QUESTIONS_FILE_ERROR/.test(l));
    check("hi ha informe de descartades (rejected)", /rejected/.test(i));
    check("cada descartada porta el motiu (errors)", /errors\s*:\s*result\.errors|errors\s*:\s*\[/.test(i));
  }
);
