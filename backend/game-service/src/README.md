# game-service · estructura del servidor WebSocket

Servidor WebSocket (`ws`) del juego. Estado en memoria (`Map`) para salas, identidad y xat; `partida`, `participant`, `ronda` i `resposta` es persisten a MySQL (MariaDB `howmuch`).

Arranque: `npm start` (lee `.env`) o `node src/server.js`. Con Docker, `docker compose up --build` lee `backend/game-service/.env` gracias a `env_file`.

Variables de `.env`:

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | 3000 | Puerto del WebSocket (`config/websocketConfig.js`) |
| `GRACE_MS` | 10000 | Tiempo de gracia (ms) antes de sacar de la sala a un jugador desconectado |
| `CATALOG_URL` | `http://localhost:3001` | Servicio de preguntas (`game/fetchQuestions.js`) |

---

## 1. Estructura

```
src/
├── server.js                      # entrada: crea el WebSocketServer y delega en handleConnection
├── config/
│   └── websocketConfig.js         # PORT y GRACE_MS leídos del entorno
├── handlers/
│   ├── connectionHandler.js       # nueva conexión: registra cliente, escucha eventos, envía connection:stablished
│   ├── messageHandler.js          # parsea JSON (error si no es válido) y lo envía al router
│   └── disconnectionHandler.js    # cierre: programa salida de sala con gracia y quita el cliente
├── routers/
│   └── messageRouter.js           # enruta según message.type al handler correspondiente
├── connections/
│   └── broadcast.js               # lista de clientes conectados y envíos (a todos, a sala, excepto uno, a cada cliente)
├── guests/
│   ├── createGuest.js             # crea un guest (guest_N) y lo guarda en guestStorage
│   └── identityDeclareHandler.js  # identity:declare: restaura o crea la identidad del cliente
├── rooms/
│   ├── createRoom.js              # reglas de creación de sala
│   ├── createRoomHandler.js       # room:create
│   ├── joinRoom.js                # reglas de entrada en sala
│   ├── joinRoomHandler.js         # room:join
│   ├── leaveRoom.js               # reglas de salida de sala
│   ├── leaveRoomHandler.js        # room:leave
│   ├── lobbyState.js              # contadores de ready y canStart
│   ├── updatePlayerReady.js       # regla del toggle ready
│   ├── sendRoomPlayers.js         # payload único de room:players
│   ├── readyHandler.js            # room:ready
│   ├── roomEvents.js              # salidas por desconexión con gracia y notificaciones
│   ├── roomsListHandler.js        # rooms:list y listado para broadcast
│   ├── updateRoomConfiguration.js # reglas de configuración de sala
│   └── roomConfigurationHandler.js# room:configuration
├── game/
│   ├── fetchQuestions.js          # pide preguntas al catalog-service
│   ├── scoring.js                 # curva de puntos por proximidad
│   ├── ranking.js                 # rànquing: buildRanking y findPosition
│   ├── roundEngine.js             # reglas puras de ronda y fin de partida
│   ├── roundEvents.js             # timers y emisiones de ronda
│   ├── gameStartHandler.js        # game:start (petición del host)
│   ├── answerSubmitHandler.js     # answer:submit: valida y puntúa respuestas
│   ├── roundNextHandler.js        # round:next: només el host obre la ronda següent
│   ├── sendRound.js               # round:started / round:results / round:ranking / game:finished
│   └── sendAnswer.js              # answer:ack / answer:error
└── storage/
    ├── guestStorage.js            # { guests: Map } de guests
    └── roomStorage.js             # { members: Map } de salas (las preguntas viven en cada sala)
```

Criterio: cada carpeta es una funcionalidad. Dentro de `rooms/`, `guests/` y `game/`, las reglas (`joinRoom.js`, `createGuest.js`, `roundEngine.js`…) no conocen el WebSocket; los `*Handler.js`, los `send*.js` y los `*Events.js` sí.

---

## 2. Flujo

1. `server.js` → `handleConnection(ws)` (`handlers/connectionHandler.js`).
2. `ws.on("message")` → `handleMessage` → `routeMessage` → handler del `type`.
3. `ws.on("close")` → `handleDisconnection`: si estaba en sala, `scheduleLeaveOnDisconnect` (`rooms/roomEvents.js`) espera `GRACE_MS` y, si no vuelve, ejecuta la salida de la sala.

Dependencias: `handlers → routers → rooms/guests/game → storage`. `connections/broadcast.js` solo lee `storage/roomStorage.js`.

---

## 3. Contrato de mensajes

Todos los mensajes son JSON con `type` obligatorio. Los datos van en el mismo objeto, no en `payload`.

```jsonc
// cliente → servidor
{ "type": "room:create", ... }
{ "type": "rooms:list" }
{ "type": "room:join", "roomId": "sala-1", ... }
{ "type": "room:leave", "roomId": "sala-1" }
{ "type": "room:configuration", ... }
{ "type": "room:ready", "ready": true }
{ "type": "game:start" }
{ "type": "answer:submit", "questionId": 12, "answer": 42 }
{ "type": "round:next" }
{ "type": "identity:declare", "identity": { ... } }

// servidor → cliente
{ "type": "connection:stablished", "message": "Connexió establerta" }
{ "type": "room:state", "roomId": "sala-1", "state": "playing" }
{ "type": "round:started", ... }
{ "type": "round:results", ... }       // un per socket: només la teva resposta, sense rànquing
{ "type": "round:ranking", ... }       // un per socket: 5 s després dels resultats
{ "type": "game:finished", ... }       // un per socket: you + ranking
{ "type": "answer:ack", ... }
{ "type": "round:error", "message": "..." }
{ "type": "round:next:error", "message": "..." }
{ "type": "error", "message": "..." }
```

- `round:next` és només per al host i només amb la ronda tancada; els errors arriben per socket com a `round:next:error`.
- `round:results` i `round:ranking` no porten la resposta dels altres jugadors. `game:finished` porta `{ roomId, you, ranking }` i `you` és `null` per als observadors.

- JSON no válido → `{ "type": "error", "message": "JSON no vàlid" }`, la conexión sigue abierta.
- `type` desconocido → `{ "type": "error", "message": "Missatge enviat per el client no gestionable!" }`.

---

## 4. Checklist para añadir un mensaje nuevo

1. Define el `type` (`dominio:acción`).
2. Crea la regla en la carpeta de su funcionalidad (`rooms/`, `guests/`, `game/`) y devuelve resultados, sin enviar mensajes.
3. Usa o amplía el storage correspondiente en `storage/`.
4. Crea `<verbo><Entidad>Handler.js` en su carpeta: valida, llama a la regla, responde o hace broadcast.
5. Añade una rama en `routers/messageRouter.js`.
