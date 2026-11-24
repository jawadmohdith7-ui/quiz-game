const { suite } = require("./lib/check");

suite(
  {
    bloc: 4,
    id: "T10",
    titol: "Tancar una ronda (punts i estat, amb rollback)",
    demana:
      "Transacció amb una sola connexió del pool, rollback i release correctes. Si una passa falla no queda res a mitges. Posicions i punts correctes i l'estat de la ronda actualitzat.",
    fem:
      "gameRepository.js: transaction() amb getConnection → beginTransaction → closeRoundRecord (FOR UPDATE, UPDATE resposta posicio+punts, UPDATE ronda estat='tancada') → commit; catch → rollback; finally → release.",
  },
  ({ existeix, llegir, check }) => {
    const f = "backend/game-service/src/game/persistence/gameRepository.js";
    check("existeix gameRepository.js", existeix(f));
    if (!existeix(f)) return;
    const txt = llegir(f);

    check("agafa una connexió del pool (getConnection)", /pool\.getConnection\s*\(/.test(txt));
    check("obre transacció (beginTransaction)", /beginTransaction\s*\(/.test(txt));
    check("fa commit", /\.commit\s*\(/.test(txt));
    check("fa rollback al catch", /catch\s*\([\s\S]{0,300}?rollback\s*\(/.test(txt), "no hi ha rollback dins del catch");
    check("fa release al finally", /finally\s*\{[\s\S]{0,300}?release\s*\(/.test(txt), "el release no és al finally");

    const tancament = txt.match(/closeRoundRecord[\s\S]*?\n\}/)?.[0] || txt;
    check("desa la posició (posicio)", /UPDATE\s+resposta\s+SET[^`"']*posicio/i.test(tancament));
    check("desa els punts (punts)", /UPDATE\s+resposta\s+SET[^`"']*punts/i.test(tancament));
    check("canvia l'estat de la ronda a tancada", /UPDATE\s+ronda\s+SET\s+estat\s*=\s*'tancada'/i.test(tancament));
    check("la ronda es bloqueja abans de tocar-la", /ronda[\s\S]{0,160}FOR UPDATE/i.test(tancament));

    check("no fa servir pool.query dins la transacció (connexions diferents)", !/pool\.query\s*\(/.test(txt), "pool.query trencaria la transacció");
    check("rebutja tancar una ronda ja tancada", /ROUND_CLOSED/.test(txt));
  }
);
