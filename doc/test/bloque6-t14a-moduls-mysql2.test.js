const { suite } = require("./lib/check");

suite(
  {
    bloc: 6,
    id: "T14a",
    titol: "Mòduls mysql2 reutilitzables des de REST i WebSockets; errors per error.code",
    demana:
      "Tot el SQL és als mòduls, que no reben req/res/socket ni escriuen per pantalla. Una mateixa funció es fa servir des de REST i WebSockets. Els errors es tradueixen per error.code (ER_DUP_ENTRY i similars).",
    fem:
      "Repositoris a game-service (roomRepository, gameRepository) i catalog-service. Errors traduïts per error.code. Forat conegut: queda SQL a stats-service/src/admin/admin.routes.js i cap funció compartida REST+WS.",
  },
  ({ on, check, conegut, lista }) => {
    const rutes = on(/(pool|connection|connexio|sequelize)\.(query|execute)\s*\(/, "backend", { include: /(routes|Router)\.js$/ });
    conegut("no hi ha SQL a les rutes", rutes.length === 0, lista(rutes) || "cap");

    const handlers = on(/(pool|connection|connexio)\.(query|execute)\s*\(/, "backend/game-service/src/game", { include: /Handler\.js$/ });
    check("no hi ha SQL als handlers de WebSockets", handlers.length === 0, lista(handlers));

    const ambReq = on(/function\s+\w+\s*\([^)]*\b(req|res|socket)\b/, "backend", { include: /(repository|persistence)\// });
    check("les funcions de dades no reben req/res/socket", ambReq.length === 0, lista(ambReq));

    const logs = on(/console\.(log|error)\s*\(/, "backend", { include: /(repository|persistence)\// });
    check("les funcions de dades no escriuen per pantalla", logs.length === 0, lista(logs));

    const codi = on(/error\.code\s*===?\s*["']ER_/, "backend/game-service/src", { include: /\.js$/ });
    check("els errors es tradueixen per error.code", codi.length >= 2, `${codi.length} traduccions`);

    conegut(
      "una mateixa funció es crida des de REST i des de WebSockets",
      on(/require\(.*(roomRepository|gameRepository)/, "backend/game-service/src", { include: /(routes|Router)\.js$/ }).length > 0 &&
        on(/require\(.*(roomRepository|gameRepository)/, "backend/game-service/src", { include: /Handler\.js$/ }).length > 0,
      "els handlers i les rutes no comparteixen cap repositori"
    );
  }
);
