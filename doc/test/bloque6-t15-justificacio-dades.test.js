const { suite } = require("./lib/check");

suite(
  {
    bloc: 6,
    id: "T15",
    titol: "Justificació de quines dades es desen i quines no",
    demana:
      "Taula a /docs on cada dada desada té el requisit que la justifica (que duri, que SQL hi pugui calcular o que una transacció la pugui bloquejar). Coherent amb l'esquema.",
    fem:
      "doc/defensa.md: taula de ~14 dades amb el criteri R1 durabilitat / R2 càlcul SQL / R3 bloqueig transaccional / R4 auditoria, i 4 dades que NO es desen.",
  },
  ({ existeix, llegir, check }) => {
    const f = "doc/defensa.md";
    check("existeix doc/defensa.md", existeix(f));
    if (!existeix(f)) return;
    const txt = llegir(f);

    check("defineix els criteris R1 durabilitat", /R1[^\n]{0,80}durab/i.test(txt));
    check("defineix R2 càlcul SQL", /R2[^\n]{0,60}(càlcul|calcul|SQL)/i.test(txt));
    check("defineix R3 bloqueig transaccional", /R3[^\n]{0,60}(bloqueig|bloqueo|FOR UPDATE)/i.test(txt));
    check("defineix R4 auditoria", /R4[^\n]{0,60}(auditoria)/i.test(txt));

    const files = (txt.match(/^\|/gm) || []).length;
    check("la taula té prou files (>=12)", files >= 12, `${files} línies de taula`);

    const claus = ["partida", "participant", "ronda", "resposta", "pregunta", "categoria", "usuaris", "registre"];
    const falten = claus.filter((c) => !txt.includes(c));
    check("cobreix les taules principals", falten.length === 0, `falten: ${falten.join(", ")}`);

    check("explica què NO es desa (memòria, totals derivats)", /NO es desa|no es desa/i.test(txt));
    check("el total acumulat es justifica com a derivat (SUM)", /total[\s\S]{0,120}SUM|SUM[\s\S]{0,120}total/i.test(txt));
  }
);
