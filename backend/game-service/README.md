# game-service

Servei del joc en temps real: servidor WebSocket al port 3000 per a sales, rondes, respostes,
puntuació i panell d'administració. Persisteix `partida`, `participant`, `ronda` i `resposta` a
MySQL (MariaDB `howmuch`); l'estat viu de les sales, el xat inclòs, és a memòria. Només pot
haver-hi una instància.

## Desconnexions

Quan es tanca un socket, el jugador no surt de la sala immediatament: hi ha 10 s de gràcia per cobrir un refresh (`src/rooms/roomEvents.js`). La sortida explícita amb `room:leave` és immediata.

## Tests

`npm test` executa `node --test` (sense dependències). Cobreix la vista del jugador observat, la construcció dels missatges de ronda i de final de partida, i les opcions del catàleg.
