# game-service

> Documentació tècnica basada en el codi de `backend/game-service/` (estat del repositori en el moment de l'anàlisi). Totes les rutes, camps i missatges provenen del codi; quan una dada no es pot determinar o no s'ha pogut verificar, s'indica **no determinat** o **no verificat**.

---

## 1. Resum i responsabilitat

`game-service` és el microservei de joc en temps real del projecte **How Much?**. La seva responsabilitat és:

- Mantenir l'estat de les **sales** **en memòria** (`Map`), amb una única instància per desplegament. `room.state` només pot ser `lobby`, `playing` o `finished`; el rànquing és una **fase** dins `playing` (`rankingVisible`), no un estat.
- Atendre les connexions **WebSocket** dels jugadors, espectadors i del **panell d'administració**.
- Gestionar el cicle de vida d'una partida: crear/entrar/sortir de sala, `ready`, inici, rondes, respostes, puntuació, rànquing i retorn al lobby.
- Persistir partides, rondes, participants i respostes a **MariaDB/MySQL** (`howmuch`), i enviar estadístiques al `stats-service`.
- Obtenir les preguntes del `catalog-service` i reenviar les operacions CRUD del panell d'admin cap a `catalog-service`, `auth-service` i `stats-service`.
- Publicar un **estat en directe** (`admin:live`) als sockets d'administració autenticats.

No exposa cap servidor HTTP: només un `WebSocketServer` al port configurat, sense ruta `/ws` ni healthcheck. El fitxer `package.json` i el `README.md` esmenten REST de health/consulta de sala, però **no hi ha implementació REST** al codi. Totes les rutes `/internal/*`, `/stats*` i `/admin*` que apareixen en aquest document són **sortints** (crides a catalog/auth/stats), mai rutes ateses per aquest servei; vegeu 6.7.

---

## 2. Stack i dependències

| Element | Valor |
|---|---|
| Runtime | Node.js 22 (Docker `node:22-alpine`) |
| Mòduls | ESM (`"type": "module"`) |
| Servidor WS | `ws` `^8.22.1` |
| BD | `mysql2` `^3.24.6` (pool de connexions) |
| Autenticació admin | `jsonwebtoken` `^9.0.2` (HS256) |
| Token de jugador | HMAC-SHA256 manual amb `node:crypto` |
| Export CSV | `csv-stringify` `^6.9.0` |
| Altres dependències declarades | `mariadb`, `sequelize`, `nodemailer` (no s'importen al codi del servei) |
| Overrides | `uuid ^11.1.1` |
| Tests | `node --test` (natiu, sense framework) |
| Contenidor | `Dockerfile` propi, xarxa `tr1-network`, `env_file` |

`package.json`:

```json
{
  "scripts": {
    "start": "node --env-file-if-exists=.env src/server.js",
    "test": "node --test",
    "export:csv": "node src/cli/exportGameCsv.js"
  }
}
```

---

## 3. Estructura de fitxers

Arbre comentat complet (sense `node_modules`):

```text
backend/game-service/
├── Dockerfile                      # imatge node:22-alpine, npm ci --only=production, CMD node src/server.js
├── package.json                    # deps, scripts start/test/export:csv
├── package-lock.json               # lockfile
├── README.md                       # notes de desconnexions i tests
├── .env / .env.example             # configuració (NOMS: PORT, GRACE_MS, DB_*, CATALOG_URL, AUTH_URL, STATS_URL, AUTH_SECRET, INTERNAL_SECRET)
└── src/
    ├── server.js                   # entrada: crea WebSocketServer({port: PORT}) i registra handleConnection
    ├── README.md                   # documentació interna de l'estructura i contracte bàsic
    ├── config/
    │   └── websocketConfig.js      # PORT (def. 3000) i GRACE_MS (def. 10000) des del .env
    ├── db/
    │   └── pool.js                 # pool mysql2 (DB_HOST/PORT/USER/PASSWORD/NAME, límit 10 connexions)
    ├── handlers/
    │   ├── connectionHandler.js    # alta de socket: identity/roomId a null, registre, events, connection:stablished
    │   ├── messageHandler.js       # parseja JSON; els tipus admin:* van a adminRouter; la resta a messageRouter
    │   └── disconnectionHandler.js # baixa de socket: desregistra admin, programa sortida amb gràcia, unregister
    ├── routers/
    │   └── messageRouter.js        # enruta cada type de joc al handler; errors genèrics i operacions per sala
    ├── connections/
    │   └── broadcast.js            # Set de clients; broadcast, broadcastExcept, broadcastToRoom, broadcastToRoomEach
    ├── storage/
    │   ├── roomStorage.js          # { members: Map<roomId, room> } (estat viu de les sales)
    │   └── guestStorage.js         # { guests: Map<guestId, identity> }
    ├── utils/
    │   └── normalizeText.js        # minúscules, sense accents, espais col·lapsats
    ├── guests/
    │   ├── createGuest.js          # crea guest_N seqüencial i el desa a guestStorage
    │   ├── verifyAuthToken.js      # valida token HMAC payloadB64.signatura i retorna userId o null
    │   └── identityDeclareHandler.js # identity:declare (new/restore) i nickname:update
    ├── rooms/
    │   ├── createRoom.js           # regles i validacions de creació + insert a BD
    │   ├── createRoomHandler.js    # room:create → room:created / room:new
    │   ├── joinRoom.js             # regles d'entrada, reconnexió, password, rol, insert participant
    │   ├── joinRoomHandler.js      # room:join → room:joined + snapshot de partida + room:players
    │   ├── leaveRoom.js            # regles de sortida, reassignació d'host, esborrat de sala buida
    │   ├── leaveRoomHandler.js     # room:leave → room:left + xat de sistema
    │   ├── roomEvents.js           # sortida amb GRACE_MS, pendingLeaves, notificacions post-sortida
    │   ├── lobbyState.js           # countReady, requiredReady (40%, mínim 1), canStart, buildLobbyState
    │   ├── updatePlayerReady.js    # validació del toggle ready (host no en pot donar)
    │   ├── readyHandler.js         # room:ready → room:players + xat de sistema
    │   ├── roomConfiguration.js    # buildConfiguration (vista pública de configuració)
    │   ├── updateRoomConfiguration.js # validació i aplicació de category/difficulty/maxPlayers/rounds/duration
    │   ├── roomConfigurationHandler.js # room:configuration → room:configuration:updated
    │   ├── roomsListHandler.js     # rooms:list, buildRoomsList, buildRoomSummary, broadcastRoomsList
    │   ├── sendRoomPlayers.js      # payload únic room:players
    │   ├── roomNames.js            # reserva i unicitat de noms de sala
    │   └── roomQueue.js            # cua de promeses: una operació alhora per roomId
    ├── game/
    │   ├── fetchQuestions.js       # POST /internal/preguntas/get al catalog-service
    │   ├── gameStartHandler.js     # game:start (només host, ready assolit, crea registre i obre ronda 1)
    │   ├── roundEngine.js          # regles pures: prepareGame, openRound, closeRound, isRoundComplete, reset
    │   ├── roundEvents.js          # timers, startRound, finishRound, showRanking, nextRound, finishGame, returnToLobby
    │   ├── answerSubmitHandler.js  # answer:submit: validacions, persistència, punts, answer:ack
    │   ├── roundNextHandler.js     # round:next (només host, ronda tancada)
    │   ├── sendRound.js            # builders de round:started/results/ranking/spectator/game:finished i errors
    │   ├── sendAnswer.js           # answer:ack / answer:error
    │   ├── scoring.js              # parseAnswerToNumber i corba de punts per proximitat
    │   ├── ranking.js              # buildRanking i findPosition
    │   ├── reportStats.js          # POST /stats/partides (només usuaris registrats)
    │   ├── sendRound.test.js       # test: la pregunta enviada no inclou correctAnswer/explanation
    │   ├── persistence/
    │   │   └── gameRepository.js   # transaccions: partida, ronda, resposta, rànquing, reset
    │   └── files/
    │       └── exportGameCsv.js    # exporta una partida 'acabada' a CSV
    ├── repositories/
    │   └── roomRepository.js       # CRUD de partida/participant (crear, afegir, maxPlayers, treure); `markRoomStarted` i `joinRoomWithLock` són codi mort
    ├── catalog/
    │   ├── catalogOptions.js       # GET /internal/catalog/options, revalidació de sales, broadcast
    │   └── catalogOptions.test.js  # tests de consulta i revalidació
    ├── admin/
    │   ├── adminAuth.js            # JWT admin (rol=admin), registre de sockets admin
    │   ├── adminRouter.js          # tots els admin:*: auth, live i proxy a catalog/auth/stats
    │   ├── adminClient.js          # fetch intern amb x-internal-secret + Authorization Bearer
    │   ├── adminState.js           # estat: jugadors connectats, sales, partides en curs
    │   └── adminLive.js            # envia admin:live als admins registrats
    └── cli/
        └── exportGameCsv.js        # CLI: npm run export:csv -- <codi> → stdout
```

Cobertura: tots els fitxers de `src/` apareixen a l'arbre (47 `.js` + els dos `README.md`). No hi ha fitxers orfes ni rutes HTTP. Convencions: les regles de domini (`joinRoom.js`, `roundEngine.js`, `scoring.js`, `updatePlayerReady.js`, `updateRoomConfiguration.js`) no coneixen el WebSocket; els `*Handler.js`, `send*.js` i `*Events.js` sí que envien o fan broadcast.

Notes que el codi desmenteix:

- `src/README.md` diu "sin base de datos propia" i només llista `PORT`, `GRACE_MS` i `CATALOG_URL`; en realitat el servei fa servir MySQL (`db/pool.js`), `AUTH_SECRET`, `INTERNAL_SECRET`, `AUTH_URL` i `STATS_URL`. És documentació desactualitzada, no el comportament.
- `backend/game-service/README.md` diu que els tests cobreixen la reconnexió de `joinRoom` i el control del host; els tests reals són `sendRound.test.js` i `catalogOptions.test.js` (vegeu 9.6).

### 3.1 `exportGameCsv`: dues ubicacions, una sola implementació

| Fitxer | Què fa | S'usa? |
|---|---|---|
| `src/game/files/exportGameCsv.js` | Implementació real. Exporta `exportGameCsv(roomId, connection = pool)`; valida que `roomId` sigui string no buit, busca `partida` per `codi`, exigeix `estat='acabada'`, fa el `JOIN` `participant`/`resposta`/`ronda`/`pregunta`, agrupa per participant ordenat per punts i retorna el CSV amb columnes `posicio,nickname,punts_totals,ronda,pregunta,resposta,punts_ronda` (`escape_formulas: true`). Accepta una connexió injectada per a tests. | Sí: l'importa el CLI. No l'usa cap ruta HTTP ni el servidor WS. |
| `src/cli/exportGameCsv.js` | Wrapper executable: agafa `process.argv[2]`, crida la implementació, escriu el CSV a `stdout`, posa `process.exitCode = 1` si falla i tanca el pool al `finally`. | Sí: `npm run export:csv` (`node src/cli/exportGameCsv.js`). |

No és lògica duplicada: el CLI no reimplementa res. Cap dels dos s'executa dins del servidor WebSocket.

---

## 4. Fluxos principals

### 4.1 Connexió WebSocket

1. `server.js` crea `new WebSocketServer({ port: PORT })` (no hi ha ruta HTTP `/ws`; el client es connecta a `ws://host:3000`).
2. A `connection`, `handleConnection(ws)`:
   - `ws.identity = null`, `ws.roomId = null`.
   - `registerClient(ws)` (afegeix al `Set` de `connections/broadcast.js`).
   - Registra `error`, `message` i `close`.
   - Envia `{ type: "connection:stablished", message: "Connexió establerta" }` (sic, amb la falta d'ortografia).
   - Crida `enviaAdminLive()` perquè el panell vegi el canvi de comptador.
3. No hi ha heartbeat ping/pong ni timeout d'autenticació.

### 4.2 Identitat / login (sense contrasenya de joc)

1. En rebre `connection:stablished`, el client (`frontend/client-vue/src/services/websocket.js`) envia `identity:declare`.
2. `guests/identityDeclareHandler.js`:
   - `identity.type` ha de ser `"new"` o `"restore"`.
   - **new**: `createGuest()` genera `guest_<n>` (contador en memòria) i el desa a `guestStorage`. Si s'envia un `nickname` no buit i no duplicat (normalitzat), s'assigna.
   - **restore**: busca `guestStorage.guests.get(id)`. Si no existeix, crea un guest nou i, si el nickname és lliure, l'assigna. Si existeix, actualitza el nickname si està lliure.
   - `verifyAuthToken(identity.token)` (opcional) valida un token HMAC-SHA256 amb `AUTH_SECRET`; si és vàlid, desa `identity.userId` (número). Si no, `userId = null`. El token ha de tenir el format `payloadB64url.signaturaB64url`, la signatura es calcula sobre el payload i cal `payload.sub` enter positiu i `payload.exp` futur; no hi ha revocació ni comprovació d'emissor.
   - Assigna `ws.identity` i respon `identity:confirmed` amb `{ id, type, nickname }`, o `{ error }` si la declaració és invàlida.
3. El client, en rebre `identity:confirmed`, demana `rooms:list` i `catalog:options`.
4. Important: la identitat de convidat és **només un ID en memòria**; no hi ha contrasenya ni prova de propietat.

### 4.3 Crear sala

Missatge: `room:create` amb `{ nickname, maxPlayers, isPrivate, nameRoom }`.

1. `createRoomHandler` delega a `createRoom({ ..., identity: ws.identity })`.
2. Validacions:
   - `identity` present i `identity.id` string no buit; `nickname` string; `maxPlayers` enter 2–20.
   - Nickname: 3–15 caràcters, regex `^[a-zA-Z0-9_]+$`, no buit i sense paraules prohibides (`admin`, `hack`, `spam`, normalitzades).
   - `nameRoom` opcional; si és buit s'usa el nickname. 3–20 caràcters, regex `^[\p{L}\p{N}_ ]+$/u`, sense paraules prohibides i únic entre sales actives (normalitzat).
   - `isPrivate` boolean.
3. Reserva el nom (`reserveRoomName`) i genera `roomId = sala_<10 hex>` (5 bytes aleatoris). Intenta inserir a BD fins a 3 vegades si hi ha `ER_DUP_ENTRY`.
4. `createRoomRecord` (transacció): `INSERT partida (tipus, codi, estat='esperant', max_jugadors)` + `INSERT participant (partida_id, nickname)`.
5. Si és privada, genera password de 6 dígits (`randomInt(100000, 1000000)`) única entre sales vives.
6. Crea l'objecte sala en memòria amb `category="mix"`, `difficulty="mix"`, `rounds=5`, `roundDurationMs=20000`, `state="lobby"`. L'objecte del host **no** inclou `userId` ni `avatarColor`, encara que la identitat porti token: el creador no tindrà avatar ni estadístiques de partida (vegeu 9.7).
7. Respon al creador `room:created` (payload complet), fa `room:new` a la resta de clients connectats (`broadcastExcept`) i `enviaAdminLive()`. **No** fa `broadcastRoomsList()`: la resta de clients reben el resum dins `room:new`, però no un `rooms:list` global fins al següent esdeveniment de sala (vegeu 9.7).

### 4.4 Entrar a una sala

Missatge: `room:join` amb `{ roomId, nickname, password }`. Si no s'envia `roomId` i `password` és un string, `messageRouter` busca la sala privada per password (`findPrivateRoomId`, que exigeix exactament 6 dígits). Si el password és string però no és de 6 dígits o no correspon a cap sala, el router respon "El codi de la sala privada és incorrecte" sense cridar `joinRoom`.

`joinRoom`:

1. Valida `roomId`/`nickname` strings, `identity.id` present, no buits.
2. Si la sala no existeix → `room:join:error` "La sala no existeix".
3. **Reconnexió**: si `room.players.has(identity.id)`, retorna l'estat actual sense comprovar capacitat ni password, amb `reconnected: true` i el rol existent. El handler **no** reenvia `reconnected` al client (vegeu 9.7).
4. Comprova capacitat (`players.size >= maxPlayers`) i, si és privada, `password === room.password` (també per a espectadors).
5. Comprova nickname únic a la sala (comparació exacta, sense normalitzar), longitud 3–15, regex i paraules prohibides.
6. Assigna rol: `player` al lobby; `observer` a `playing` o `finished`; si l'estat és un altre, error "La partida ja ha començat".
7. Si és `player`, `addRoomParticipant` a BD (transacció, `FOR UPDATE`; errors `ROOM_NOT_FOUND`, `ROOM_NOT_WAITING`, `ROOM_FULL`, `ER_DUP_ENTRY`). Els observadors no es desen a `participant`.
8. Llegeix `usuaris.avatar_color` si `identity.userId` (només usuaris registrats).
9. Afegeix el jugador a `room.players`, desa `ws.roomId`, cancel·la qualsevol sortida pendent de la mateixa identitat i respon `room:joined`.
10. Envia un snapshot segons l'estat: `round:started`/`answer:ack` (jugador), `round:spectator` (observador), `round:ranking` (rànquing visible) o `game:finished`. Si és `playing`, la ronda no està oberta i el rànquing no és visible, un `player` no rep cap snapshot (acaba de rebre `round:results`); un `observer` sí que rep `round:spectator` amb `phase:"results"`.
11. `room:players` a la resta, xat de sistema "X se ha unido a la sala." i `rooms:list`/admin live.

### 4.5 Sortir de sala

- **Explicit** `room:leave` amb `{ roomId }`: `leaveRoomAndNotify` → `leaveRoom`:
  - `removeRoomParticipant` a BD (només si `partida.estat='esperant'`; si la partida està en curs, la fila de `participant` es conserva per a l'historial).
  - Elimina el jugador de `room.players`. Si era host, assigna el primer `player` restant o, si no n'hi ha, qualsevol observador.
  - Si la sala queda buida, cancel·la el timer i esborra la sala de memòria.
  - Notifica `room:removed` a tots (sala buida) o `room:players` a la resta; tanca la ronda si tots els jugadors restants han respost; si no queda cap `player`, torna al lobby.
  - Respon `room:left` al socket que marxa i publica xat de sistema.
- **Per desconnexió**: vegeu 4.8.

### 4.6 Inici de partida

Missatge: `game:start` (sense paràmetres; la sala és `ws.roomId`).

1. Només el **host** (`ws.identity.id === room.hostId`), estat `lobby`.
2. `canStart(room)`: `countReady >= floor(players.size * 0.4)` amb mínim 1. El host no ha de marcar ready (i el backend ho rebutja).
3. `fetchQuestions(room.rounds, room.category, room.difficulty)` → `POST {CATALOG_URL}/internal/preguntas/get`.
4. Es recullen com a observadors els membres que no són host i no estan ready.
5. `startGameRecord(roomId, questions[0].id, observers)` (transacció): bloqueja `partida` per `codi`, exigeix `estat='esperant'`, esborra files `participant` dels observadors, crea `ronda` número 1 `oberta` i passa `partida` a `en_curs`.
6. `prepareGame`: rols (host sempre `player`; ready → `player`; resta → `observer`), punts a 0, `totalRounds = questions.length`.
7. Envia `room:players`, `room:state {state:"playing"}` i obre la primera ronda (`startRound`), que envia `round:started` als jugadors i `round:spectator` als observadors.

### 4.7 Rondes, respostes i puntuació (no hi ha torns)

El joc és **simultani per ronda**, no per torns:

1. `startRound` obre ronda, fixa `roundEndsAt = now + roundDurationMs` i programa `finishRound` amb aquest temps.
2. Cada jugador envia `answer:submit` amb `{ questionId, answer }`.
3. `handleAnswerSubmit` valida: partida `playing`, `roundOpen`, identitat, jugador amb rol `player`, `questionId` igual a la ronda actual, dins de termini, una sola resposta, resposta numèrica (`parseAnswerToNumber`, accepta coma decimal) i `|answer| < 1e14`.
4. `saveAnswerRecord` desa a `resposta` dins una transacció amb bloqueig de la fila `ronda`; errors `ANSWER_ALREADY_EXISTS`, `ROUND_CLOSED`, `PARTICIPANT_NOT_IN_GAME`.
5. Calcula punts en memòria (`calculatePoints`) i acumula `player.score`; respon `answer:ack` (sense dir si és correcte).
6. Si tots els `player` han respost, es tanca la ronda sense esperar el rellotge (`closeRoundIfAllAnswered`).
7. `finishRound`: `closeRoundRecord` bloqueja la ronda, ordena respostes per proximitat, assigna `posicio` i `punts` a `resposta`, marca `ronda='tancada'` i retorna el rànquing aggregate de la BD. Desa els punts a `room.roundAnswers` i envia **a cada socket** el seu `round:results` (només la pròpia resposta; els observadors reben `round:spectator`).
8. Al cap de 5 s (`RANKING_DELAY_MS`) envia `round:ranking` a cada socket.
9. Al cap de 10 s (`NEXT_ROUND_DELAY_MS`, configurable) o quan el host envia `round:next`, s'obre la ronda següent. Si no en queden, `finishGame`.
10. `finishGame`: `finishGameRecord` marca `partida='acabada'`, calcula rànquing final, envia `room:state {state:"finished"}` i `game:finished` a cada socket; llança `reportGameStats` **sense bloquejar**; al cap de 15 s (`FINAL_RANKING_DELAY_MS`) `returnToLobby`.

Puntuació (`scoring.js`), on `d = |resposta − correcta| / |correcta|`:

| Condició | Punts |
|---|---|
| `d === 0` | 530 (500 + 30 bonus) |
| `d <= 0.10` | 450 |
| `d >= 3` | 0 |
| Altrament | `round(450 * (3 − d) / (3 − 0.10))` |

Si `correctAnswer === 0`, retorna 0 (evita divisió per zero).

### 4.8 Desconnexió amb període de gràcia

1. `close` → `handleDisconnection(ws)`:
   - `desregistraAdmin(ws)`.
   - Si el socket té `roomId` i `identity.id`, `scheduleLeaveOnDisconnect(ws)` i posa `ws.roomId = null`.
   - `unregisterClient(ws)`, log i `enviaAdminLive()`.
2. `scheduleLeaveOnDisconnect` captura `roomId` i `identity`, cancel·la una sortida pendent prèvia de la mateixa identitat i programa `setTimeout(..., GRACE_MS)` (def. 10 s).
3. En expirar, encua l'operació a la cua de la sala i executa `leaveRoomAndNotify` (el mateix camí que `room:leave`).
4. Si el jugador torna amb `room:join` (mateixa `identity.id`) dins la finestra, `cancelPendingLeave(identity.id)` cancel·la el timer; el jugador conserva plaça i estat.
5. `pendingLeaves` és un `Map` global per `identity.id`, no per socket.

### 4.9 Panell d'administració en directe

1. El socket (sense identitat de joc) envia `admin:auth` amb `{ token }`.
2. `comprovaTokenAdmin` valida JWT HS256 amb `AUTH_SECRET` i exigeix `payload.rol === "admin"`. Si és correcte, `registraAdmin(ws, token)`: `ws.rolAdmin="admin"`, `ws.tokenAdmin=token` i alta al `Set` d'admins. Respon `admin:auth:ok {usuari}` o `admin:auth:error`.
3. Qualsevol altre `admin:*` exigeix `ws.rolAdmin === "admin"`; si no, respon amb **el mateix `type`** i `{ok:false, reason:"Cal autenticar-se com a admin"}`.
4. `admin:live:get` retorna l'estat sota demanda.
5. El servidor envia `admin:live` (push) a tots els admins en: nova connexió, desconnexió, canvis de sala, inici/fi de partida, retorn al lobby i mutacions de catàleg.
6. Les operacions CRUD són **proxy**:
   - Preguntes/categories → `catalog-service`.
   - Usuaris → `auth-service`.
   - Estadístiques/registre/usage → `stats-service`.
   - Totes porten `x-internal-secret` i `Authorization: Bearer <tokenAdmin>`.
   - Si una mutació de catàleg retorna `ok:true`, es fa `broadcastCatalogOptions()` (que fa un `catalog:options` global i revalida les sales en lobby) i `enviaAdminLive()`.
7. Estat publicat: `jugadors` = sockets connectats que no són admin (`playersCount()`); `sales` = llista de sales vives; `partidesEnCurs` = sales amb `state === "playing"` (les `finished` no compten).

### 4.10 Màquina d'estats, fases i temporitzadors

`room.state` només pren tres valors. **No existeix l'estat `ranking`**: el rànquing és una fase dins `playing`, marcada amb el booleà `room.rankingVisible`.

| Estat | S'hi arriba per | Se'n surt per |
|---|---|---|
| `lobby` | creació de sala (4.3); `returnToLobby` al cap de 15 s (4.7); `resetToLobbyIfNoPlayers` quan no queda cap `player` (4.5/4.8) | `game:start` → `playing` |
| `playing` | `prepareGame` dins `game:start` | `finishGame` → `finished`; `resetToLobbyIfNoPlayers` → `lobby` |
| `finished` | `finishGame` | `returnToLobby` al cap de 15 s → `lobby` |

Fases dins `playing` (flags, no `state`):

| Fase | Flags | Què reben els clients |
|---|---|---|
| pregunta oberta | `roundOpen=true`, `rankingVisible=false` | `round:started` (player) / `round:spectator` `phase:"question"` (observer) |
| resultats enviats (fins al rànquing) | `roundOpen=false`, `rankingVisible=false` | `round:results` (player) / `round:spectator` `phase:"results"` (observer) |
| rànquing visible | `roundOpen=false`, `rankingVisible=true` | `round:ranking` (tots els de la sala) |

Temporitzadors (tots `setTimeout`, sense persistència; un reinici els perd):

| Timer | Valor | Constant / origen | Efecte |
|---|---|---|---|
| durada de ronda | 20000 ms per defecte; configurable 5–60 s | `room.roundDurationMs` | `finishRound` |
| resultats → rànquing | 5000 ms fix | `RANKING_DELAY_MS` (`game/roundEngine.js`) | `showRanking` |
| rànquing → ronda següent | 10000 ms per defecte; `NEXT_ROUND_DELAY_MS` (0 o NaN → 10000) | `NEXT_ROUND_DELAY_MS` | `nextRound`, llevat que el host enviï `round:next` abans |
| rànquing final → lobby | 15000 ms fix | `FINAL_RANKING_DELAY_MS` | `returnToLobby` |
| gràcia de desconnexió | 10000 ms per defecte | `GRACE_MS` | `leaveRoomAndNotify` |
| reintent d'operació de BD | 5000 ms | `scheduleRoomOperation` (`game/roundEvents.js`) | reintenta l'operació que ha fallat: `finishRound`, `nextRound`/`finishGame`, `returnToLobby` o `resetToLobbyIfNoPlayers` |

Els timers de ronda viuen a `room.roundTimer`; `clearRoundTimer` els cancel·la abans de reprogramar. `GRACE_MS` no es valida: un valor no numèric produeix `NaN` i `setTimeout(NaN)` s'executa immediatament.

### 4.11 Configuració de sala i `ready`

`room:configuration` (només host, només `lobby`, sempre sobre `ws.roomId`) aplica **només els camps enviats** i retorna a `changed` els noms aplicats:

| Camp | Validació |
|---|---|
| `category` | `String().trim()`, 1–100 caràcters; **no** es valida contra el catàleg |
| `difficulty` | string, `trim().toLowerCase()`, 1–32 caràcters |
| `maxPlayers` | enter 2–20 i `>= room.players.size`; si canvia, `UPDATE partida.max_jugadors` |
| `rounds` | enter 1–50 (1 ronda = 1 pregunta) |
| `durationSeconds` | enter 5–60; es desa com `roundDurationMs = ×1000` |

Resposta: `room:configuration:updated` al host i, amb `broadcastToRoom(..., ws)`, a la resta; després `broadcastRoomsList()` global i `admin:live`. Errors: `room:configuration:error` amb el motiu; les excepcions de BD reconegudes (`ROOM_NOT_FOUND`, `ROOM_NOT_WAITING`, `ROOM_CAPACITY_BELOW_PARTICIPANTS`) propaguen el `message`, qualsevol altra es converteix en "No s'ha pogut actualitzar la configuració de la sala". Si l'`UPDATE` de `max_jugadors` va bé però una validació posterior fallés, la BD i la memòria quedarien desalineades (no passa amb l'ordre actual, però no hi ha transacció que ho garanteixi).

`room:ready`:

- Només al `lobby`; el host no pot marcar ready; `ready` ha de ser un booleà explícit; la identitat ha d'estar a `room.players`.
- Desa `player.ready`, envia xat de sistema ("está listo" / "ya no está listo") i `room:players` a tota la sala.
- Llindar `canStart`: `countReady >= max(1, floor(room.players.size * 0.4))`. `players.size` inclou els observadors que hi hagi al lobby; el host no compta com a ready. Per això una sala només amb el host no pot començar (cal almenys un altre membre que faci ready).

### 4.12 Comptadors de connexió: `connectedCount()` vs `playersCount()`

- `connectedClients` (`connections/broadcast.js`) és un `Set` amb **tots** els sockets registrats, inclosos els del panell d'admin. `registerClient` s'executa a cada connexió; `unregisterClient`, al `close`.
- `connectedCount()` = `connectedClients.size`, admins inclosos. Només s'usa als logs de connexió/desconnexió.
- `playersCount()` recorre el mateix `Set` i **exclou** els sockets amb `rolAdmin === "admin"`. És el valor `jugadors` de `admin:live` i `admin:live:get`.
- Un socket d'admin compta com a jugador fins que envia un `admin:auth` correcte (`registraAdmin` fixa `rolAdmin`); si el token és invàlid, continua comptant com a jugador.
- `adminState.sales[].jugadors` és un altre número: `room.players.size`, que inclou jugadors **i** observadors de la sala.

### 4.13 Forma de l'estat en memòria

`roomStorage.members` és `Map<roomId, room>`. L'objecte `room` que crea `createRoom` i que muta el joc té aquests camps:

| Camp | Tipus / valors |
|---|---|
| `roomId`, `nameRoom`, `hostId` | string (el `roomId` també es guarda dins l'objecte) |
| `players` | `Map<identityId, {id,nickname,score,ready,role,userId?,avatarColor?}>`; `role` és `player` o `observer` |
| `maxPlayers`, `rounds`, `totalRounds` | enters; `totalRounds` passa a ser `questions.length` en començar |
| `isPrivate`, `password` | boolean i string de 6 dígits o `null` |
| `category`, `difficulty` | strings de configuració (no validats contra el catàleg) |
| `roundDurationMs` | ms (20000 per defecte) |
| `state` | `lobby` \| `playing` \| `finished` |
| `questionOrder`, `questionsById` | array d'ids i `Map<id, question>` carregats del catàleg |
| `roundIndex`, `currentQuestionId`, `currentRoundId`, `roundEndsAt` | índex de ronda (comença a -1), pregunta/ronda actuals i epoch ms de fi |
| `roundAnswers` | `Map<playerId, {answer,points}>` de la ronda oberta |
| `roundOpen`, `rankingVisible` | booleans de fase |
| `roundTimer` | handle de `setTimeout` o `null` |
| `gamePlayers` | `Map` només amb els `player` de la partida, o `null` al lobby |
| `finalRanking`, `currentRanking` | arrays de rànquing o `null` |

Altres estats globals: `guestStorage.guests` (`Map<guestId, {id,type:"guest",nickanme,userId?}>`) amb el contador `guestCounter`; `pendingLeaves` (`Map<identityId, timer>`); `queues` (`Map<roomId, Promise>`); `connectedClients` (`Set<ws>`); `adminSockets` (`Set<ws>`); `pendingRoomNames` (`Set<string>` normalitzat). Cap d'aquests estats no es persisteix ni es reconstrueix en arrencar.

---

## 5. Contracte de comunicació

### 5.1 Convencions

- Tots els missatges són **JSON amb `type` obligatori**; les dades van a l'arrel, no dins d'un `payload`.
- El servidor no valida JSON Schema: cada handler valida els camps que necessita.
- JSON invàlid → `{ "type": "error", "message": "JSON no vàlid" }` i la connexió continua oberta.
- `type` desconegut → `{ "type": "error", "message": "Missatge enviat per el client no gestionable!" }`.
- `data === null` o no-objecte → s'ignora sense resposta.
- Els missatges `admin:*` es desvien abans del router de joc.
- Les operacions de sala (`room:join`, `room:leave`, `room:configuration`, `room:ready`, `game:start`, `answer:submit`, `round:next`) s'encuen a `rooms/roomQueue.js` per `roomId`: una operació alhora per sala. Les que no tenen `roomId` vàlid comparteixen la clau buida `""`. `room:create`, `rooms:list`, `chat:message`, `identity:declare` i `nickname:update` **no** passen per la cua.
- Si una operació encuada llança una excepció no capturada, el router respon al socket que la va originar amb `{type:"round:error", message:"No s'ha pogut actualitzar la partida."}`, encara que el `type` fos `room:join`, `room:ready`, etc. No hi ha error específic per a aquest cas.
- El router no fa `await` de la majoria de handlers de joc (només `handleAdminMessage` s'espera); els handlers de joc gestionen els seus propis errors i promeses.

### 5.2 Client → servidor (joc)

Tots els tipus que arriben al router de joc, amb handler, payload, resposta, abast i errors. "Abast" indica qui rep la resposta.

| `type` | Handler | Payload acceptat | Resposta i abast | Errors |
|---|---|---|---|---|
| `identity:declare` | `guests/identityDeclareHandler.js` → `handleIdentityDeclare` | `identity: {type:"new"\|"restore", id?, nickname?, token?}` | `identity:confirmed` només al socket | `identity:confirmed {error}` (camp absent/ tipus invàlid / `restore` sense `id`) |
| `nickname:update` | `handleNicknameUpdate` | `nickname: string` | `nickname:updated` només al socket | `nickname:error` (sense identitat, regex `^[a-zA-Z0-9_]{3,15}$` incomplert, dins d'una sala, duplicat normalitzat) |
| `catalog:options` | `catalog/catalogOptions.js` → `sendCatalogOptions` | — | `catalog:options` només al socket (`ok:true` o `ok:false`) | `catalog:options {ok:false, reason}` |
| `rooms:list` | `rooms/roomsListHandler.js` → `roomsListHandler` | — | `rooms:list` al socket; **només sales `isPrivate:false`** | — |
| `room:create` | `rooms/createRoomHandler.js` (sense cua) | `nickname`, `maxPlayers`, `isPrivate`, `nameRoom?` | `room:created` al creador; `room:new` a **tots els altres sockets connectats** (`broadcastExcept`); `admin:live` als admins | `room:create:error`; excepció → `round:error` al socket |
| `room:join` | `rooms/joinRoomHandler.js` (cua per `roomId`) | `roomId?`, `nickname`, `password?` | `room:joined` al socket; snapshot de partida; `room:players` a la resta de la sala; xat de sistema a la sala (només si no és reconnexió); `rooms:list` global; `admin:live` | `room:join:error`; si falta `roomId` i `password` és un string que no correspon a cap sala privada (el router només accepta 6 dígits), el router respon "El codi de la sala privada és incorrecte"; si `password` no és string, l'error ve de `joinRoom` ("Falten el codi...") |
| `room:leave` | `rooms/leaveRoomHandler.js` (cua per `message.roomId`) | `roomId` | `room:left` al socket; `room:players` a la resta o `room:removed` global si la sala queda buida; xat de sistema a la sala | `room:leave:error`; excepció → `round:error` |
| `room:configuration` | `rooms/roomConfigurationHandler.js` (cua per `ws.roomId`) | `configuration: {category?, difficulty?, maxPlayers?, rounds?, durationSeconds?}` | `room:configuration:updated` al host i a la resta; `rooms:list` global; `admin:live` | `room:configuration:error` |
| `room:ready` | `rooms/readyHandler.js` (cua per `ws.roomId`) | `ready: boolean` | xat de sistema + `room:players` a tota la sala | `room:ready:error` |
| `game:start` | `game/gameStartHandler.js` (cua per `ws.roomId`) | — (configuració i sala surten de `ws.roomId`) | `room:players` a la sala; `room:state {state:"playing"}`; `round:started`/`round:spectator`; `rooms:list`; `admin:live` | `round:error` al socket (no hi ha `game:start:error`) |
| `answer:submit` | `game/answerSubmitHandler.js` (cua per `ws.roomId`) | `questionId`, `answer` (number o string numèrica) | `answer:ack` només al socket; si tots els `player` han respost, desencadena `round:results` a la sala | `answer:error` |
| `round:next` | `game/roundNextHandler.js` (cua per `ws.roomId`) | — | Obre la ronda següent o acaba la partida; els missatges van a la sala | `round:next:error` |
| `chat:message` | `routers/messageRouter.js` (inline, sense cua) | `text: string` no buit després de `trim()` | `chat:message` a tota la sala, **inclòs l'emissor** | `chat:error` (sense sala / text buit o no string) |
| qualsevol altre | — | — | `error` al socket | `{type:"error", message:"Missatge enviat per el client no gestionable!"}` |

Detalls de validació que no es veuen a la taula:

- `identity:declare` només accepta `type` `"new"` o `"restore"`; `restore` amb un `id` desconegut **crea un guest nou** en lloc de fallar. El `token` opcional es valida amb `verifyAuthToken` (HMAC-SHA256, `sub` enter positiu i `exp` futur); si és vàlid, `identity.userId` és el número; si no, `null`. La identitat resultant sempre té `type:"guest"`, encara que el token sigui d'un usuari registrat. Errors exactes: "Camp identity obligatori", `Tipus de declaració invàlid. Ha de ser "restore" o "new"`, "ID obligatori per declaració restore".
- `nickname:update` no es pot fer mentre `ws.roomId` no és `null`; només actualitza la identitat (`ws.identity.nickanme`), no el nickname del jugador a la sala.
- `room:create` valida nickname 3–15 (`^[a-zA-Z0-9_]+$`, paraules `admin`/`hack`/`spam`), `nameRoom` 3–20 (`^[\p{L}\p{N}_ ]+$/u`, únic entre sales actives, normalitzat), `maxPlayers` enter 2–20 i `isPrivate` booleà. Si `nameRoom` falta o és buit, s'usa el nickname.
- `room:join` valida nickname 3–15 i regex; la comparació de nickname a la sala és **exacta** (case-sensitive), mentre que la BD pot rebutjar duplicats per col·lació (`ER_DUP_ENTRY`).
- `answer:submit` accepta `questionId` comparable com a string, `answer` numèrica amb coma decimal, `|answer| < 1e14`, dins de `roundEndsAt`, i una sola resposta per jugador i ronda.

Motius d'error més habituals (el text és el camp `reason` o `message`):

- `room:create:error`: validacions de nickname/nom de sala/`maxPlayers`/`isPrivate`, "Ja existeix una sala amb aquest nom", o "No s'ha pogut crear la partida. Torna-ho a provar." si falla la BD.
- `room:join:error`: "La sala no existeix", "La sala és plena", "No has introduït la contrasenya", "La contrasenya de la sala és incorrecta", "Aquest nom d'usuari ja està en ús", longitud/regex/paraules prohibides, "El codi de la sala privada és incorrecte" (router), o error genèric de BD.
- `room:leave:error`: "Falten el codi de la sala o la identitat", "El codi de la sala no és vàlid", "La sala no existeix", "El jugador no és a la sala", "No s'ha pogut sortir de la partida. Torna-ho a provar.".
- `room:ready:error`: "La sala no existeix", "La partida ja ha començat", "Falta la identitat", "El host no ha de marcar ready", "No ets a la sala", "El camp ready ha de ser cert o fals".
- `room:configuration:error`: "No estàs dins de cap sala", "La sala no existeix", "Només el host pot canviar la configuració", "La partida ja ha començat", "Falta la configuració", rangs de cada camp, "La sala ja té més jugadors que el nou màxim".
- `round:error` (game:start): "La sala no existeix", "Només el host pot iniciar la partida", "La partida ja ha començat", "Falten jugadors a punt per començar", o el `message` d'error del catàleg/BD.
- `round:next:error`: "La sala no existeix", "Falta la identitat", "Només el host pot avançar la ronda", "La partida no està en curs", "La ronda encara no ha acabat".
- `answer:error`: "La sala no existeix", "La partida no està en curs", "La ronda ja ha acabat", "Falta la identitat", "No ets a la sala", "Els observadors no poden respondre", "Payload invàlid: falten questionId o answer", "Aquesta pregunta no és la ronda actual", "El temps de la ronda s'ha acabat", "Ja has respost aquesta ronda", "La resposta ha de ser un número", "La resposta supera el límit permès", "No s'ha pogut desar la resposta", o errors de BD (`ANSWER_ALREADY_EXISTS`, `ROUND_CLOSED`, `PARTICIPANT_NOT_IN_GAME`).
- `chat:error`: "Necessites entrar a una sala per enviar missatges." o "El missatge no pot estar buit.".

> El client Vue també envia `observer:select` i `gameplay:update`; **el router del backend no els gestiona** i respon `{type:"error",message:"Missatge enviat per el client no gestionable!"}`. El servidor tampoc no emet mai `observer:selected` ni `gameplay:update`.

### 5.3 Servidor → client (joc)

| `type` | Payload (camps o exemple) | Origen / abast |
|---|---|---|
| `connection:stablished` | `{"type":"connection:stablished","message":"Connexió establerta"}` | En connectar; només al socket |
| `identity:confirmed` | `{"type":"identity:confirmed","identity":{"id":"guest_3","type":"guest","nickname":"Ann"}}` | Resposta a `identity:declare` |
| `identity:confirmed` (error) | `{"type":"identity:confirmed","error":"Tipus de declaració invàlid. Ha de ser \"restore\" o \"new\""}` | Mateix type, camp `error` |
| `nickname:updated` | `{"type":"nickname:updated","nickname":"Ann_2"}` | Al socket |
| `nickname:error` | `{"type":"nickname:error","message":"Aquest nom d'usuari ja existeix"}` | Al socket |
| `catalog:options` | `{"type":"catalog:options","ok":true,"categories":["Ciencia","Futbol"],"difficulties":["facil","media"]}` | Al socket que el demana o broadcast |
| `catalog:options` (error) | `{"type":"catalog:options","ok":false,"reason":"No s'han pogut carregar les opcions del catàleg"}` | Al socket |
| `rooms:list` | `{"type":"rooms:list","ok":true,"rooms":[{"id":"sala_a1b2c3d4e5","name":"Ciencia","maxPlayers":4,"players":2,"category":"mix","state":"lobby","isPrivate":false}]}` | Al socket o broadcast global |
| `room:new` | `{"type":"room:new","id":"sala_a1b2c3d4e5","name":"Ciencia","maxPlayers":4,"players":1,"category":"mix","state":"lobby","isPrivate":false}` | Broadcast a tots excepte el creador |
| `room:created` | `{type,ok,roomId,hostId,nameRoom,category,difficulty,rounds,maxPlayers,isPrivate,password,players[],state,durationSeconds,readyCount,readyRequired,canStart}` | Al creador |
| `room:create:error` | `{"type":"room:create:error","ok":false,"reason":"Ja existeix una sala amb aquest nom"}` | Al creador |
| `room:joined` | `{type,ok,roomId,nameRoom,isPrivate,password,category,difficulty,rounds,players[],hostId,maxPlayers,role,state,durationSeconds,readyCount,readyRequired,canStart}` | Al socket que entra |
| `room:join:error` | `{"type":"room:join:error","ok":false,"reason":"La sala és plena"}` | Al socket |
| `room:left` | `{"type":"room:left","ok":true,"roomId":"sala_a1b2c3d4e5","players":[]}` | Al socket que surt; `players` són els membres restants (objectes sencers) |
| `room:leave:error` | `{"type":"room:leave:error","ok":false,"reason":"El jugador no és a la sala"}` | Al socket |
| `room:players` | `{type,roomId,nameRoom,maxPlayers,category,difficulty,rounds,players[],hostId,state,durationSeconds,readyCount,readyRequired,canStart}` | A tota la sala |
| `room:removed` | `{"type":"room:removed","roomId":"sala_a1b2c3d4e5"}` | Broadcast global quan la sala queda buida |
| `room:state` | `{"type":"room:state","roomId":"sala_a1b2c3d4e5","state":"playing"}` | A la sala (playing/finished/lobby) |
| `room:configuration:updated` | `{"type":"room:configuration:updated","ok":true,"changed":["rounds"],"configuration":{"category":"mix","difficulty":"mix","maxPlayers":4,"rounds":8,"durationSeconds":20,"state":"lobby"}}` | Al host i a la resta |
| `room:configuration:error` | `{"type":"room:configuration:error","ok":false,"reason":"Només el host pot canviar la configuració"}` | Al socket |
| `room:ready:error` | `{"type":"room:ready:error","ok":false,"reason":"El host no ha de marcar ready"}` | Al socket |
| `chat:message` | vegeu 5.6 | A la sala |
| `chat:error` | `{"type":"chat:error","message":"El missatge no pot estar buit."}` | Al socket |
| `round:started` | `{type,round,totalRounds,durationMs,question{id,text,min,max,step,unit,difficulty}}` | A cada jugador |
| `round:spectator` | `{"type":"round:spectator","roomId":"sala_a1b2c3d4e5","round":2,"totalRounds":5,"phase":"question","remainingMs":15320,"durationMs":20000}` | A cada observador |
| `round:results` | `{type,round,totalRounds,correctAnswer,unit,explanation,you{answer,roundPoints,totalScore,position}\|null}` | A cada jugador |
| `round:ranking` | `{type,round,totalRounds,you{position,totalScore}\|null,ranking[]{position,id,nickname,score,userId,avatarColor}}` | A cada socket de la sala |
| `round:error` | `{"type":"round:error","message":"No s'ha pogut actualitzar la partida."}` | Al socket o broadcast de sala |
| `round:next:error` | `{"type":"round:next:error","message":"La ronda encara no ha acabat"}` | Al socket |
| `answer:ack` | `{"type":"answer:ack","questionId":12}` | Al socket |
| `answer:error` | `{"type":"answer:error","message":"Ja has respost aquesta ronda"}` | Al socket |
| `game:finished` | `{type,roomId,you{position,score}\|null,ranking[]{position,id,nickname,score,userId,avatarColor}}` | A cada socket de la sala |
| `error` | `{"type":"error","message":"Missatge enviat per el client no gestionable!"}` | Al socket |

Camps exactes i casos límit:

- `room:created` porta `players` amb l'objecte del creador **sense** `userId` ni `avatarColor` (el creador encara no ha passat per `joinRoom`). Els jugadors que entren després sí que els porten (poden ser `null`).
- `room:joined` **no** inclou mai el camp `reconnected`, encara que `joinRoom` l'hagi calculat; el handler no el copia. El client no pot distingir una reconnexió d'una entrada nova per aquest camp.
- `room:players` envia els objectes de `room.players` tal qual: `id`, `nickname`, `score`, `ready`, `role`, i `userId`/`avatarColor` si aquell membre va entrar per `room:join`.
- `round:spectator.phase` pot ser `waiting` (encara no hi ha ronda), `question` (ronda oberta) o `results` (ronda tancada); `remainingMs` només és > 0 a `question`; `round` pot ser `0` a `waiting`.
- `round:ranking.ranking[]` i `game:finished.ranking[]` porten `position,id,nickname,score,userId,avatarColor`. Les entrades provinents de la BD que ja no són a la sala fan servir `id:"participant_<id>"` i no tenen `userId`/`avatarColor` (queden absents al JSON).
- `round:results.you` i `round:ranking.you` són `null` per a observadors i per a sockets sense identitat; `game:finished.you` també.
- `room:state` només envia `playing`, `finished` o `lobby`; no hi ha `state:"ranking"`.
- `round:error` també s'envia quan falla una operació encuada de qualsevol tipus (vegeu 5.1), no només en el joc.
- `rooms:list` s'envia al socket que el demana o en broadcast global; només conté sales públiques i el camp `players` és `room.players.size` (inclou observadors).
- Els broadcasts globals (`rooms:list`, `room:new`, `room:removed`, `catalog:options`) arriben també als sockets d'admin, perquè comparteixen el mateix `connectedClients`; `broadcastToRoom` només arriba als sockets amb aquell `roomId`.

### 5.4 Client → servidor (admin) i respostes

Totes les respostes d'admin inclouen `requestId` (el mateix que envia el client; `null` si no n'hi ha) i `ok`. Excepte `admin:auth`, la resposta té **el mateix `type`** que la petició.

| `type` | Camps d'entrada | Resposta (mateix `type`) | Proxy / notes |
|---|---|---|---|
| `admin:auth` | `token` | `admin:auth:ok {"ok":true,"usuari":"<username>"}` / `admin:auth:error {"ok":false,"reason":"Token invalid o sense permisos"}` | JWT HS256, `rol=admin` |
| `admin:live:get` | — | `{ok:true,jugadors,sales,partidesEnCurs}` | Estat local |
| `admin:preguntes:list` | — | `{ok,preguntes,reason}` | `GET {CATALOG_URL}/internal/admin/preguntes` |
| `admin:preguntes:create` | `dades` (objecte pregunta) | `{ok,pregunta,reason}` | `POST .../preguntes`; si ok → broadcast catàleg |
| `admin:preguntes:update` | `id`, `dades` | `{ok,pregunta,reason}` | `PATCH .../preguntes/:id`; si ok → broadcast |
| `admin:preguntes:delete` | `id` | `{ok,reason}` | `DELETE .../preguntes/:id`; si ok → broadcast |
| `admin:categories:list` | — | `{ok,categories,reason}` | `GET .../internal/admin/categories` |
| `admin:categories:create` | `dades` (`{nom}`) | `{ok,categoria,reason}` | `POST`; si ok → broadcast |
| `admin:categories:update` | `id`, `dades` (`{nom}`) | `{ok,categoria,reason}` | `PATCH .../:id`; si ok → broadcast |
| `admin:categories:delete` | `id` | `{ok,reason}` | `DELETE .../:id`; si ok → broadcast |
| `admin:usuaris:list` | — | `{ok,usuaris,reason}` | `GET {AUTH_URL}/internal/admin/usuaris` |
| `admin:usuaris:create` | `dades` (`{nom,email,password}`) | `{ok,usuari,reason}` | `POST`; auth-service fa servir `nom` |
| `admin:usuaris:update` | `id`, `dades` | `{ok,usuari,reason}` | `PATCH .../:id` |
| `admin:usuaris:delete` | `id` | `{ok,reason}` | `DELETE .../:id` |
| `admin:estadistiques:get` | `sala` (opcional) | `{ok,general,sales,reason}` | `GET {STATS_URL}/internal/admin/estadistiques?sala=` |
| `admin:registre:get` | `periode` (`avui`\|`setmana`\|`mes`; def. `avui`) | `{ok,total,encerts,errors,percentatgeEncerts,percentatgeErrors,reason}` | `GET .../internal/admin/registre?periode=` |
| `admin:usage:get` | `periode` (def. `dia`) | `{ok,usage,reason}` | `GET .../internal/admin/usage?periode=` |
| `admin:live` (servidor→client) | — | `{type:"admin:live",jugadors,sales:[{id,nom,jugadors,estat,categoria}],partidesEnCurs}` | Push del servidor |

Errors comuns d'admin:

- Sense sessió: `{type:"<mateix type>",requestId,ok:false,reason:"Cal autenticar-se com a admin"}`.
- Tipus desconegut: `{type:"<mateix type>",requestId,ok:false,reason:"Missatge d'admin desconegut"}`.
- Excepció (fetch/JSON): `{type:"<mateix type>",requestId,ok:false,reason:"Error intern del servei"}`.
- El codi HTTP del servei de destí **no es comprova**; es propaga el camp `ok`/`reason` del cos JSON.
- `requestId` és `message.requestId || null`: si el client envia `0` o cadena buida, es converteix en `null`.
- `admin:auth:ok.usuari` és `payload.username` del JWT; si el token no porta aquest camp, el camp s'omet al JSON (no és un error d'autenticació).
- `admin:auth` és l'únic missatge admin que es pot enviar sense sessió; qualsevol altre, sense `rolAdmin`, rep el **mateix `type`** amb `{ok:false, reason:"Cal autenticar-se com a admin"}`.
- `admin:live` (push) no porta `ok` ni `requestId`; només `jugadors`, `sales`, `partidesEnCurs`.
- Es fa `enviaAdminLive()` a: nova connexió, desconnexió, crear sala, entrar sala, sortir sala explícita, canvi de configuració, inici de partida, fi de partida, retorn al lobby, reset a lobby perquè no queden jugadors, i mutació de catàleg correcta. **No** es fa en `room:ready` (el ready no forma part de l'estat publicat) ni quan expira la gràcia d'una desconnexió (el socket ja s'havia desregistrat i l'admin va rebre el push en aquell moment; el recompte de la sala queda endarrerit fins al següent esdeveniment).

### 5.5 Payloads complets (exemples reals del codi)

`room:created`:

```json
{
  "type": "room:created",
  "ok": true,
  "roomId": "sala_a1b2c3d4e5",
  "hostId": "guest_3",
  "nameRoom": "Ciencia",
  "category": "mix",
  "difficulty": "mix",
  "rounds": 5,
  "maxPlayers": 4,
  "isPrivate": true,
  "password": "123456",
  "players": [
    { "id": "guest_3", "nickname": "Ann", "score": 0, "ready": false, "role": "player" }
  ],
  "state": "lobby",
  "durationSeconds": 20,
  "readyCount": 0,
  "readyRequired": 1,
  "canStart": false
}
```

`room:joined`:

```json
{
  "type": "room:joined",
  "ok": true,
  "roomId": "sala_a1b2c3d4e5",
  "nameRoom": "Ciencia",
  "isPrivate": false,
  "password": null,
  "category": "mix",
  "difficulty": "mix",
  "rounds": 5,
  "players": [
    { "id": "guest_3", "nickname": "Ann", "score": 0, "ready": false, "role": "player" },
    { "id": "guest_4", "nickname": "Bob", "score": 0, "ready": false, "role": "player", "userId": 7, "avatarColor": "#22c55e" }
  ],
  "hostId": "guest_3",
  "maxPlayers": 4,
  "role": "player",
  "state": "lobby",
  "durationSeconds": 20,
  "readyCount": 0,
  "readyRequired": 1,
  "canStart": false
}
```

`room:players` (mateix lobby que `room:joined`; cada jugador porta el seu `role`, però no hi ha un `role` global del socket):

```json
{
  "type": "room:players",
  "roomId": "sala_a1b2c3d4e5",
  "nameRoom": "Ciencia",
  "maxPlayers": 4,
  "category": "mix",
  "difficulty": "mix",
  "rounds": 5,
  "players": [
    { "id": "guest_3", "nickname": "Ann", "score": 0, "ready": false, "role": "player" },
    { "id": "guest_4", "nickname": "Bob", "score": 0, "ready": true, "role": "player" }
  ],
  "hostId": "guest_3",
  "state": "lobby",
  "durationSeconds": 20,
  "readyCount": 1,
  "readyRequired": 1,
  "canStart": true
}
```

`round:started` (mai inclou `correctAnswer` ni `explanation`):

```json
{
  "type": "round:started",
  "round": 1,
  "totalRounds": 5,
  "durationMs": 20000,
  "question": {
    "id": 12,
    "text": "Quants habitants té Andorra?",
    "min": 0,
    "max": 200000,
    "step": 1000,
    "unit": "habitants",
    "difficulty": "facil"
  }
}
```

`round:results`:

```json
{
  "type": "round:results",
  "round": 1,
  "totalRounds": 5,
  "correctAnswer": 80000,
  "unit": "habitants",
  "explanation": "Andorra té aproximadament 80.000 habitants.",
  "you": { "answer": 79000, "roundPoints": 450, "totalScore": 450, "position": 1 }
}
```

`round:ranking`:

```json
{
  "type": "round:ranking",
  "round": 1,
  "totalRounds": 5,
  "you": { "position": 1, "totalScore": 450 },
  "ranking": [
    { "position": 1, "id": "guest_4", "nickname": "Bob", "score": 450, "userId": 7, "avatarColor": "#22c55e" },
    { "position": 2, "id": "guest_3", "nickname": "Ann", "score": 300, "userId": null, "avatarColor": null }
  ]
}
```

`game:finished`:

```json
{
  "type": "game:finished",
  "roomId": "sala_a1b2c3d4e5",
  "you": { "position": 1, "score": 2100 },
  "ranking": [
    { "position": 1, "id": "guest_3", "nickname": "Ann", "score": 2100, "userId": null, "avatarColor": null },
    { "position": 2, "id": "guest_4", "nickname": "Bob", "score": 1850, "userId": 7, "avatarColor": "#22c55e" }
  ]
}
```

`you` és `null` per als observadors. A `round:results`, si el jugador no va respondre, `you.answer` és `null` i `you.roundPoints` és `0`.

### 5.6 Xat

| Direcció | `type` | Payload |
|---|---|---|
| C→S | `chat:message` | `{"type":"chat:message","text":"hola"}` |
| S→C | `chat:message` | `{"type":"chat:message","senderId":"guest_3","senderName":"Ann","text":"hola","timestamp":1730000000000}` |
| S→C (sistema) | `chat:message` | `{"type":"chat:message","senderId":null,"senderName":"SISTEMA","text":"Bob se ha unido a la sala.","timestamp":1730000000000,"system":true}` |
| S→C (error) | `chat:error` | `{"type":"chat:error","message":"Necessites entrar a una sala per enviar missatges."}` |

No hi ha límit de longitud ni sanejament del text al servidor. El `senderName` d'un missatge d'usuari és el nickname de la **identitat** (`ws.identity.nickanme`), no el nickname de la sala; si no n'hi ha, `"Anònim"`. El text s'envia amb `trim()` i el `chat:message` arriba també a l'emissor.

### 5.7 Persistència (taules que toca)

Base de dades `howmuch` (MariaDB/MySQL). El servei **no crea l'esquema**; l'esquema és `backend/database/sql/schema.sql`.

| Taula | Operacions del game-service | Columnes rellevants |
|---|---|---|
| `partida` | `INSERT` en crear sala; `SELECT ... FOR UPDATE`; `UPDATE estat/data_inici/data_fi/max_jugadors`; `DELETE` si la sala queda buida a lobby | `id`, `tipus` (`publica`/`privada`), `codi` (unique), `estat` (`esperant`/`en_curs`/`acabada`), `max_jugadors`, `dificultat` (mai escrita: default `media`), `data_inici`, `data_fi` |
| `participant` | `INSERT` (crear/unir/reset); `DELETE` (sortir a lobby, observadors en iniciar, reset); `SELECT` | `id`, `partida_id`, `nickname`; unique `(partida_id, nickname)`; FK cascade |
| `ronda` | `INSERT` (inici i cada ronda); `UPDATE estat`; `SELECT ... FOR UPDATE`; `DELETE` en reset | `id`, `partida_id`, `pregunta_id`, `numero`, `estat` (`oberta`/`tancada`); unique `(partida_id, numero)` i `(partida_id, pregunta_id)` |
| `resposta` | `INSERT` en respondre; `UPDATE posicio, punts` en tancar ronda; `SELECT` per rànquing; `DELETE` en cascada | `id`, `ronda_id`, `participant_id`, `valor DECIMAL(20,6)`, `posicio`, `punts`; unique `(ronda_id, participant_id)` |
| `usuaris` | `SELECT avatar_color` (només lectura, per `identity.userId`) | `id`, `avatar_color` |
| `pregunta` | Només lectura a l'export CSV (`JOIN` per text) | `id`, `text`, etc. |
| `partides` (stats) | **No directament**: s'escriu via `POST /stats/partides` al `stats-service` | `usuari_id`, `nom_sala`, `categoria`, `posicio`, `encerts`, `data_partida` |

> Nota: `schema.sql` defineix `partides` **sense** la columna `rondes` (columnes: `usuari_id`, `nom_sala`, `categoria`, `posicio`, `encerts`, `data_partida`), però el `stats-service` envia `rondes`; si s'usa aquest esquema, l'`INSERT` del stats-service falla. El game-service no ho detecta perquè no comprova la resposta.

Quan s'escriu i què s'esborra:

| Moment | Operació de BD |
|---|---|
| Crear sala | `INSERT partida` (`tipus`, `codi`, `estat='esperant'`, `max_jugadors`) + `INSERT participant` del host. `dificultat` **no** s'escriu: queda el default `media` de l'esquema. No hi ha columna de categoria a `partida`. |
| Entrar com a `player` | `INSERT participant`. Observador o reconnexió: cap escriptura. |
| Sortir de sala | `DELETE participant` només si `partida.estat='esperant'`; si el comptador de participants queda a 0, `DELETE partida`. Amb `en_curs` o `acabada` no s'esborra res (la fila es conserva per a l'historial). |
| Canviar `maxPlayers` | `UPDATE partida.max_jugadors` (només `esperant`). |
| `game:start` | Transacció: `SELECT partida FOR UPDATE`; `DELETE participant` dels observadors (per nickname); `INSERT ronda` 1 `oberta`; `UPDATE partida` a `en_curs` amb `data_inici`. |
| Obrir una ronda | `INSERT ronda` `oberta` amb `numero = roundIndex + 2`. |
| Respondre | `INSERT resposta` amb `valor` arrodonit a 6 decimals. |
| Tancar ronda | Transacció: `SELECT ronda FOR UPDATE`; `SELECT resposta ... FOR UPDATE` ordenada per proximitat; `UPDATE resposta` (`posicio`, `punts`); `UPDATE ronda` a `tancada`; `SELECT` del rànquing agregat. |
| Acabar partida | `SELECT partida FOR UPDATE`; comprova que no quedi cap ronda `oberta`; `UPDATE partida` a `acabada` amb `data_fi`; `SELECT` del rànquing final. |
| Tornar al lobby | Transacció: `DELETE ronda`; `DELETE participant` (cascada de `resposta`); `INSERT participant` dels nicknames actuals; `UPDATE partida` a `esperant` amb `data_inici`/`data_fi` a `NULL`. |
| Estadístiques | Fora de la BD local: `POST /stats/partides` per usuari registrat. |
| Export CSV | Només `SELECT`. |

Conseqüències: la partida **no s'esborra** en acabar; queda `esperant` després del reset i es pot reutilitzar. El reset és destructiu per a l'historial detallat (`ronda`/`resposta`/`participant`), que només sobreviu durant la finestra de 15 s entre `finished` i `returnToLobby` (vegeu 9.3). L'esquema confirma les claus úniques que el codi assumeix: `partida.codi`, `participant(partida_id,nickname)`, `ronda(partida_id,numero)`, `ronda(partida_id,pregunta_id)`, `resposta(ronda_id,participant_id)`, i les FK `ON DELETE CASCADE` de `participant`/`ronda`/`resposta`.

---

## 6. Comunicació amb altres serveis i BD

> Els contractes implementats pels serveis de destí (`catalog-service`, `auth-service`, `stats-service`) no formen part de les fonts revisades; les afirmacions sobre què validen o retornen es marquen **no verificat** quan no es poden comprovar des d'aquest repositori. Sí que és verificable el que el game-service envia i com tracta la resposta.

### 6.1 Variables d'entorn (només noms)

| Variable | Ús | Valor per defecte al codi |
|---|---|---|
| `PORT` | Port del WebSocket | `3000` |
| `GRACE_MS` | Gràcia de desconnexió (ms) | `10000` |
| `NEXT_ROUND_DELAY_MS` | Espera entre rànquing i ronda següent (ms) | `10000` (si 0/NaN) |
| `DB_HOST` | Host MariaDB | `localhost` |
| `DB_PORT` | Port MariaDB | `3306` |
| `DB_USER` | Usuari BD | `root` |
| `DB_PASSWORD` | Contrasenya BD | `root` |
| `DB_NAME` | Base de dades | `howmuch` |
| `CATALOG_URL` | Base URL del catàleg | `http://localhost:3001` |
| `AUTH_URL` | Base URL d'autenticació | `http://localhost:3011` |
| `STATS_URL` | Base URL d'estadístiques | `adminClient.js`: `http://localhost:3012`; **`reportStats.js`: `http://stats-service:3012`** (valors per defecte diferents) |
| `AUTH_SECRET` | Secret JWT admin i HMAC del token de jugador | — (si falta, no hi ha admin ni `userId`) |
| `INTERNAL_SECRET` | Secret de servei a les crides internes | — (sense valor: `catalogOptions`/`fetchQuestions` llancen `INTERNAL_SECRET_MISSING`; `adminClient` envia capçalera buida i deixa decidir el destí; `reportStats` s'omet) |

`backend/game-service/.env` declara: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `PORT`, `GRACE_MS`, `INTERNAL_SECRET`. `.env.example` afegeix `CATALOG_URL`, `AUTH_URL`, `STATS_URL`, `AUTH_SECRET` i **no** inclou `GRACE_MS` ni `NEXT_ROUND_DELAY_MS`. El `.env` de l'arrel només aporta `PORT`, `INTERNAL_SECRET` i `AUTH_SECRET` (els valors els injecta `docker compose`).

Detalls de lectura:

- Cada mòdul llegeix `process.env` **en importar-se** (`websocketConfig`, `pool`, `fetchQuestions`, `catalogOptions`, `adminClient`, `reportStats`, `roundEngine`). Per això `npm start` carrega `.env` amb `--env-file-if-exists` abans de qualsevol import; el CLI d'export no ho fa (vegeu 7.1).
- `PORT` i `GRACE_MS` es passen per `Number()` sense validar: un valor no numèric dona `NaN` (port invàlid o timer immediat).
- `DB_PORT` cau a `3306` si és `0` o `NaN`.
- `AUTH_SECRET` s'usa per a dues coses diferents: JWT HS256 de l'admin (`jsonwebtoken`) i HMAC-SHA256 del token de jugador (`verifyAuthToken`).
- `AUTH_SECRET` i `INTERNAL_SECRET` són **secrets compartits**: el primer ha de coincidir amb l'`auth-service` (JWT i token de jugador) i el segon amb tots els serveis que exposen `/internal/*` i `/stats/partides`. `docker compose` els injecta des del `.env` de l'arrel, no des del `.env` del game-service.

### 6.2 `catalog-service`

**Obtenir opcions** (`catalog/catalogOptions.js`):

```http
GET {CATALOG_URL}/internal/catalog/options
x-internal-secret: <INTERNAL_SECRET>
```

Resposta esperada: `{ "categories": ["Ciencia", ...], "difficulties": ["facil", ...] }`. Timeout 5 s (`AbortSignal.timeout(5000)`). Si falla, `catalog:options {ok:false}` i no es revalida cap sala.

Revalidació (només sales en `lobby`):

- `revalidateLobbyRooms(options)` s'executa després de `broadcastCatalogOptions()` (mutació d'admin correcta): recorre les sales en `lobby`, i si `category` no és al catàleg la canvia a `"Mix"` i si `difficulty` no hi és la canvia a `"mix"`; per cada sala canviada envia `room:configuration:updated` i, si n'hi ha alguna, un `rooms:list` global.
- `revalidateRoomAgainstCatalog(roomId)` s'executa en tornar al lobby (`returnToLobby` i `resetToLobbyIfNoPlayers`): fa el mateix per a una sola sala i envia `room:configuration:updated`; si el catàleg falla, manté la configuració i no bloqueja el retorn.
- La categoria es compara **exacta** (case-sensitive) excepte `"mix"`, que sempre és vàlida; la dificultat es compara sense distingir majúscules. Això vol dir que `room:configuration` pot desar `"ciencia"` i la revalidació el canviarà a `"Mix"` al següent retorn al lobby.

**Obtenir preguntes** (`game/fetchQuestions.js`):

```http
POST {CATALOG_URL}/internal/preguntas/get
Content-Type: application/json
x-internal-secret: <INTERNAL_SECRET>

{ "numQuestions": 5, "category": "mix", "difficulty": "mix" }
```

Resposta: `{ "questions": [ { "id": 12, "text": "...", "correctAnswer": 80000, "min": 0, "max": 200000, "step": 1000, "unit": "habitants", "difficulty": "facil", "explanation": "..." } ] }`.

Errors del catàleg: HTTP no-ok → `Error` amb `statusCode` i `code` (p. ex. `CATEGORY_NOT_FOUND`, `NO_QUESTIONS_FOUND`); el handler els envia com a `round:error` amb el `message`. Sense timeout explícit.

**Proxy admin**: `GET/POST/PATCH/DELETE {CATALOG_URL}/internal/admin/preguntes[/:id]` i `/internal/admin/categories[/:id]`, amb `x-internal-secret` i `Authorization: Bearer <tokenAdmin>`. Que el catàleg només comprovi el secret intern i delegui el rol al game-service és **no verificat** en aquesta revisió; el game-service sí que comprova `rolAdmin` abans de fer la crida.

### 6.3 `stats-service`

**Registrar resultat** (`game/reportStats.js`), només per a jugadors amb `userId`:

```http
POST {STATS_URL}/stats/partides
Content-Type: application/json
x-internal-secret: <INTERNAL_SECRET>

{
  "userId": 7,
  "nomSala": "Ciencia",
  "posicio": 1,
  "encerts": 3,
  "rondes": 5
}
```

Resposta esperada: `201 { "ok": true, "partidaId": 123 }` (**no verificat**: el game-service no llegeix la resposta). El game-service **no comprova `response.ok`** ni el cos; només captura errors de xarxa. Els enviaments són seqüencials, un per jugador registrat; `finishGame` no els espera.

**Proxy admin**: `GET {STATS_URL}/internal/admin/estadistiques[?sala=]`, `/internal/admin/registre?periode=`, `/internal/admin/usage?periode=` amb `x-internal-secret` i `Authorization: Bearer <tokenAdmin>`. Que el `stats-service` validi tots dos és **no verificat** en aquesta revisió.

### 6.4 `auth-service`

No hi ha crides directes fora del panell d'admin. El token del jugador es valida **localment** amb HMAC-SHA256 (`AUTH_SECRET`), no per HTTP.

**Proxy admin**: `GET/POST/PATCH/DELETE {AUTH_URL}/internal/admin/usuaris[/:id]` amb `x-internal-secret` i `Authorization: Bearer <tokenAdmin>`. El cos de creació ha de portar `{ "nom", "email", "password" }` (l'`auth-service` llegeix `req.body.nom`); aquest requisit és **no verificat** aquí, però és el que el panell envia.

### 6.5 Base de dades

- Pool `mysql2/promise`: `connectionLimit: 10`, `queueLimit: 0`, `waitForConnections: true`, `charset: utf8mb4`.
- Totes les escriptures crítiques de partida/ronda/resposta usen **transaccions** amb `SELECT ... FOR UPDATE` sobre `partida`, `ronda` o `resposta` (també `roomRepository`: crear sala, afegir participant, canviar `max_jugadors`, treure participant). `getCorrectRoundsByNickname` i l'export CSV fan servir el pool sense transacció.
- El servei llegeix directament `usuaris.avatar_color` (acoblament amb l'esquema de l'auth-service).

### 6.6 Diagrama resum

```text
Navegador / Unity
      │ WebSocket (ws://host:PORT)
      ▼
game-service ──HTTP──▶ catalog-service :3001   (preguntes, opcions, CRUD admin)
      │        ──HTTP──▶ stats-service   :3012   (resultats, admin stats)
      │        ──HTTP──▶ auth-service    :3011   (CRUD usuaris admin)
      │
      └──SQL──▶ MariaDB :3306 (howmuch: partida, participant, ronda, resposta, usuaris)
```

No hi ha crides entrants d'altres serveis cap al game-service.

### 6.7 Rutes HTTP: exposades i consumides

**Exposades: cap.** El servei no crea cap servidor HTTP; només `WebSocketServer({port: PORT})`. No hi ha `/ws`, `/health`, `/stats`, `/internal/*` ni `/admin*` atesos per aquest procés. El CSV és un comandament de CLI, no una ruta.

**Consumides** (totes sortints):

| Ús | Mètode i ruta | Autenticació | Cos | Resposta / tractament | Timeout |
|---|---|---|---|---|---|
| Opcions de catàleg | `GET {CATALOG_URL}/internal/catalog/options` | `x-internal-secret` | — | `{categories:string[], difficulties:string[]}`; si no és 2xx, `Error` amb `statusCode` | 5000 ms (`AbortSignal.timeout`) |
| Preguntes | `POST {CATALOG_URL}/internal/preguntas/get` | `x-internal-secret` + `Content-Type: application/json` | `{numQuestions, category, difficulty}` | `{questions:[...]}`; si no és 2xx, `Error` amb `statusCode` i `code` extrets del cos | cap |
| Admin preguntes (llista) | `GET {CATALOG_URL}/internal/admin/preguntes` | `x-internal-secret` + `Authorization: Bearer <tokenAdmin>` | — | JSON amb `{ok,preguntes,reason}` | cap |
| Admin preguntes (alta) | `POST {CATALOG_URL}/internal/admin/preguntes` | ídem | `message.dades` | JSON amb `{ok,pregunta,reason}`; si `ok` → catàleg revalidat | cap |
| Admin preguntes (edició/esborrat) | `PATCH`/`DELETE {CATALOG_URL}/internal/admin/preguntes/:id` | ídem | `dades` (PATCH) / — (DELETE) | ídem | cap |
| Admin categories | `GET`/`POST {CATALOG_URL}/internal/admin/categories`, `PATCH`/`DELETE .../:id` | ídem | `dades` on cal | `{ok,categoria(s),reason}` | cap |
| Admin usuaris | `GET`/`POST {AUTH_URL}/internal/admin/usuaris`, `PATCH`/`DELETE .../:id` | ídem | `dades` on cal (`{nom,email,password}` a l'alta) | `{ok,usuari(s),reason}` | cap |
| Resultat de partida | `POST {STATS_URL}/stats/partides` | `x-internal-secret` + `Content-Type` (sense `Authorization`) | `{userId, nomSala, posicio, encerts, rondes}` | **No es llegeix**: ni `response.ok` ni el cos; només s'capturen errors de xarxa | cap |
| Admin estadístiques | `GET {STATS_URL}/internal/admin/estadistiques[?sala=]` | `x-internal-secret` + `Authorization: Bearer` | — | `{ok,general,sales,reason}` | cap |
| Admin registre | `GET {STATS_URL}/internal/admin/registre?periode=` | ídem | — | `{ok,total,encerts,errors,percentatgeEncerts,percentatgeErrors,reason}` | cap |
| Admin usage | `GET {STATS_URL}/internal/admin/usage?periode=` | ídem | — | `{ok,usage,reason}` | cap |

`adminClient.cridaInterna` no comprova l'estat HTTP: fa `await resposta.json()` i retorna el cos. Un cos no-JSON o un error de xarxa provoca l'excepció que `adminRouter` converteix en `{ok:false, reason:"Error intern del servei"}`. El `reason` del destí es propaga si el cos el porta.

Les rutes `/stats/partides` i `/internal/admin/*` són contractes dels altres serveis; aquest document no en verifica la implementació (marcat com a **no verificat** en aquesta revisió).

---

## 7. Configuració i arrencada

### 7.1 Comandes

```bash
# dins backend/game-service
npm install                 # instal·lació (hi ha package-lock.json)
npm start                   # node --env-file-if-exists=.env src/server.js
node src/server.js          # sense carregar .env
npm test                    # node --test (descobreix *.test.js)
npm run export:csv -- sala_a1b2c3d4e5   # CSV a stdout (només partida 'acabada')
```

`npm start` carrega `.env`; `node src/server.js` i `npm run export:csv` **no** (el script no porta `--env-file-if-exists`). L'export necessita `DB_*` a l'entorn del procés o agafa els defaults del pool (`localhost:3306`, `root`/`root`, `howmuch`). `npm test` descobreix tots els `*.test.js` del projecte (`sendRound.test.js`, `catalogOptions.test.js`).

Des de l'arrel:

```bash
docker compose up --build game-service
docker compose up --build   # mariadb + catalog + auth + stats + game + client
```

### 7.2 Ports

| Servei | Port intern | Publicat |
|---|---|---|
| game-service (WS) | `PORT` (def. 3000) | `"${PORT}:${PORT}"`: el costat esquerre surt del `.env` de l'arrel i el dret del `PORT` del contenidor (`env_file`). Si els dos `PORT` no coincideixen, el mapping és incorrecte. |
| catalog-service | 3001 | 3001 |
| auth-service | 3011 | 3011 |
| stats-service | 3012 | 3012 |
| MariaDB | 3306 | 3306 |
| client-vue | 5173 | 5173 |

### 7.3 Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 3000
CMD ["node", "src/server.js"]
```

`docker-compose.yml` afegeix `env_file: ./backend/game-service/.env` i sobreescriu `CATALOG_URL`, `AUTH_URL`, `STATS_URL`, `AUTH_SECRET`, `INTERNAL_SECRET`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. El servei és a la xarxa `tr1-network`, amb `restart: unless-stopped`, **sense `depends_on`** i sense healthcheck; el contenidor no espera la BD ni els altres serveis. `PORT` i `GRACE_MS` no es sobreescriuen al compose: surten del `env_file`.

### 7.4 Ordre d'arrencada

El servei arrenca encara que la BD o els altres serveis no estiguin disponibles; els errors apareixen en la primera operació que en depengui (crear/entrar a sala, demanar preguntes, admin). No hi ha reintents ni migracions a l'arrencada.

### 7.5 Tests

`npm test` executa `node --test` i descobreix tots els `*.test.js`:

| Fitxer | Què comprova |
|---|---|
| `src/game/sendRound.test.js` | `buildRoundStartedMessage` envia els paràmetres del slider i **no** inclou `correctAnswer` ni `explanation`. |
| `src/catalog/catalogOptions.test.js` | `getCatalogOptions` amb `fetch` mockejat (URL i `x-internal-secret`), revalidació de categoria/dificultat eliminades, que `revalidateLobbyRooms` no toca una sala `playing`, i que `revalidateRoomAgainstCatalog` emet `room:configuration:updated`. |

No hi ha tests de creació/entrada/sortida de sala, respostes, puntuació, admin, temporitzadors ni persistència. El `README.md` del servei diu el contrari (reconnexió de `joinRoom` i control del host), i és incorrecte.

---

## 8. Fitxers clau

| Path | Responsabilitat |
|---|---|
| `src/server.js` | Punt d'entrada; crea el `WebSocketServer` i connecta `handleConnection`. |
| `src/config/websocketConfig.js` | `PORT` i `GRACE_MS`. |
| `src/handlers/connectionHandler.js` | Cicle de vida del socket i `connection:stablished`. |
| `src/handlers/messageHandler.js` | Parseig JSON i separació admin/joc. |
| `src/routers/messageRouter.js` | Taula de rutes dels missatges de joc. |
| `src/handlers/disconnectionHandler.js` | Sortida amb gràcia i neteja. |
| `src/connections/broadcast.js` | Tots els enviaments (global, per sala, per socket). |
| `src/rooms/roomEvents.js` | `pendingLeaves`, `GRACE_MS`, notificacions de sortida. |
| `src/rooms/createRoom.js` / `joinRoom.js` / `leaveRoom.js` | Regles de sala i accés a BD. |
| `src/rooms/createRoomHandler.js` / `joinRoomHandler.js` / `leaveRoomHandler.js` | Handlers WS de creació, entrada i sortida. |
| `src/rooms/roomNames.js` | Reserva temporal i unicitat normalitzada de noms de sala. |
| `src/rooms/lobbyState.js` | Llindar de `ready` i `canStart`. |
| `src/rooms/updatePlayerReady.js` / `readyHandler.js` | Regla i handler de `room:ready`. |
| `src/rooms/sendRoomPlayers.js` | Payload únic de `room:players`. |
| `src/rooms/roomConfiguration.js` / `roomConfigurationHandler.js` | Vista pública de configuració i handler de `room:configuration`. |
| `src/rooms/updateRoomConfiguration.js` | Validació de configuració (categoria 1–100, dificultat 1–32, 2–20 jugadors, 1–50 rondes, 5–60 s). |
| `src/rooms/roomQueue.js` | Serialització d'operacions per sala. |
| `src/guests/createGuest.js` | Crea `guest_N` i el desa a `guestStorage`. |
| `src/guests/identityDeclareHandler.js` | Identitat de convidat i nickname. |
| `src/guests/verifyAuthToken.js` | Validació HMAC del token de jugador. |
| `src/game/gameStartHandler.js` | `game:start`: host, ready, preguntes, registre i primera ronda. |
| `src/game/fetchQuestions.js` | `POST /internal/preguntas/get` al catàleg. |
| `src/game/roundNextHandler.js` | `round:next`: només host i ronda tancada. |
| `src/game/sendRound.js` / `sendAnswer.js` | Builders i enviaments de ronda/resposta. |
| `src/game/ranking.js` | `buildRanking` i `findPosition`. |
| `src/game/roundEvents.js` | Temporitzadors i totes les emissions de ronda/fi de partida. |
| `src/game/roundEngine.js` | Regles pures de ronda. |
| `src/game/answerSubmitHandler.js` | Validació i puntuació de respostes. |
| `src/game/scoring.js` | Corba de punts. |
| `src/game/persistence/gameRepository.js` | Transaccions de partida/ronda/resposta/rànquing. |
| `src/repositories/roomRepository.js` | CRUD de `partida`/`participant`; `markRoomStarted` i `joinRoomWithLock` no s'importen enlloc (codi mort). |
| `src/catalog/catalogOptions.js` | Opcions del catàleg i revalidació de sales. |
| `src/admin/adminRouter.js` | Contracte complet `admin:*`. |
| `src/admin/adminAuth.js` | JWT admin i registre de sockets. |
| `src/admin/adminClient.js` | Crides internes a catalog/auth/stats. |
| `src/admin/adminLive.js` / `adminState.js` | Push `admin:live`. |
| `src/game/reportStats.js` | `POST /stats/partides`. |
| `src/game/files/exportGameCsv.js` | Implementació de l'export CSV (consultes + `csv-stringify`); vegeu 3.1. |
| `src/cli/exportGameCsv.js` | Wrapper CLI de l'export; `npm run export:csv`. |
| `frontend/client-vue/src/services/websocket.js` | Client de referència: identitat, sales, joc, admin i hardcoded `ws://localhost:3000`. |

---

## 9. Riscos i punts febles

### 9.1 Arquitectura i disponibilitat

1. **Una sola instància per disseny**. Sales i partides viuen a `roomStorage.members` (memòria). Un reinici o un segon contenidor perd totes les sales; les files `partida` queden en `esperant`/`en_curs` sense conciliació a l'arrencada. El `README` ho reconeix ("Només pot haver-hi una instància").
2. **Sense heartbeat ni timeout de socket**. Un client mort per xarxa (sense `close`) continua comptant i ocupant plaça fins que el TCP es tanqui.
3. **Doble socket per identitat**. `room:join` amb la mateixa identitat es tracta com a reconnexió, però no tanca ni desvincula el socket anterior. Si el socket antic es tanca, programa una sortida amb gràcia encara que el nou segueixi actiu; `cancelPendingLeave` només s'executa en tornar a entrar o sortir explícitament.
4. **`pendingLeaves` per `identity.id`**, no per `(identity, room)`. Dues sales amb la mateixa identitat (possible amb dos sockets) comparteixen timer i la cancel·lació d'una afecta l'altra.

### 9.2 Identitat i seguretat

5. **Suplantació de convidats**. Els IDs són seqüencials (`guest_0`, `guest_1`, …) i `identity:declare restore` només necessita l'ID; no hi ha secret ni prova de propietat. Qualsevol pot declarar l'ID d'un altre guest i, si ja és a una sala, `joinRoom` el tracta com a reconnexió i n'ocupa la plaça.
6. **Col·lisió d'IDs després d'un reinici**. `guestCounter` torna a 0; els `guest_N` desats al `localStorage` poden coincidir amb guests nous diferents creats després del reinici, restaurant una identitat aliena.
7. **`guestStorage` sense caducitat** → creix indefinidament.
8. **El nickname de `identity:declare` no valida format** (només no buit i no duplicat normalitzat). Els handlers de sala validen el seu propi `nickname`, però el camp d'identitat pot quedar amb espais o >15 caràcters i el xat el mostra.
9. **El nickname de crear/entrar no s'ha de correspondre amb `ws.identity`**. Es pot jugar amb un nickname diferent del de la identitat; la unicitat a la sala és *case-sensitive* (`"Pep"` i `"pep"` conviuen en memòria), tot i que la BD pot rebutjar-ho per col·lació (error `ER_DUP_ENTRY` traduït a "Aquest nom d'usuari ja està en ús").
10. **Password de sala privada exposada**. S'envia a tots els membres a `room:joined`/`room:created` i viatja en clar pel WebSocket. És de 6 dígits i es pot enumerar amb `room:join` per password, sense rate limiting.
11. **`AUTH_SECRET` absent ⇒ degradació silenciosa**: `verifyAuthToken` retorna `null` i tothom és convidat; `comprovaTokenAdmin` retorna `null` i el panell no pot autenticar-se. No hi ha error d'arrencada.
12. **`admin:auth` sense límit d'intents** i verificació JWT a cada intent (cost CPU). El token s'emmagatzema a `ws.tokenAdmin` i es reenvia als serveis.
13. **`reportStats` s'omet silenciosament** si falta `INTERNAL_SECRET`; a més, no comprova la resposta HTTP, de manera que un 4xx/5xx del `stats-service` no genera cap avís.

### 9.3 Integritat de dades

14. **La tornada al lobby esborra l'historial relacional**. `returnToLobby` crida `resetAbandonedGameRecord`, que fa `DELETE FROM ronda` i `DELETE FROM participant` (amb cascada de `resposta`) i reinsereix només els nicknames actuals a `partida='esperant'`. Els resultats de la partida només existeixen durant els 15 s de `FINAL_RANKING_DELAY_MS`; després, `npm run export:csv` falla ("Només es poden exportar partides acabades") i la informació detallada s'ha perdut. Només sobreviu l'agregat de `partides` (stats).
15. **Desajust d'esquema a `stats-service`**: el game-service envia `rondes`, però `schema.sql` **no** té la columna `rondes` a `partides` (confirmat: només `usuari_id`, `nom_sala`, `categoria`, `posicio`, `encerts`, `data_partida`). Si la BD es crea amb aquest esquema, l'`INSERT` del stats-service falla i el game-service no ho detecta. El model del stats-service no s'ha verificat en aquesta revisió.
16. **Estat en memòria vs BD**. El reintent automàtic cada 5 s (`scheduleRoomOperation`) cobreix les operacions de ronda/final de partida (`finishRound`, `nextRound`/`finishGame`, `returnToLobby`, `resetToLobbyIfNoPlayers`); les altres escriptures (crear sala, entrar, respondre, configurar, iniciar) no es reintenten. Una sortida de sala amb error de BD deixa el jugador dins la memòria i el client rep `room:leave:error`. No hi ha reconciliació en arrencar.
17. **Reassignació d'host no persistida**: el nou `hostId` només viu a memòria; si el procés reinicia, es perd la sala sencera, però no hi ha cap camp d'host a `partida` per recuperar-lo.
18. **Jugadors que marxen durant la partida** continuen a `participant` (correcte per a l'historial) i apareixen al rànquing final de la BD. `applyRanking` els assigna un `id` sintètic `participant_<id>` i `reportStats` els omet perquè construeix el mapa d'usuaris només amb `room.players` (ja no hi són), no perquè els falti `userId`.

### 9.4 Validació i abús

19. **`room:configuration` no valida la categoria/dificultat contra el catàleg**. Accepta qualsevol string (1–100 caràcters) i només es revalida en tornar al lobby o quan l'admin canvia el catàleg. Un host pot deixar la sala amb una categoria inexistent i `game:start` fallarà amb `round:error`.
20. **Sense rate limiting** a cap missatge (xat, respostes, admin, `catalog:options`). `ws` accepta per defecte payloads grans; el xat no té límit de longitud ni sanejament (cal escapar al client per evitar XSS).
21. **`room:leave` usa el `roomId` del client**, no `ws.roomId`; el handler després posa `ws.roomId=null` encara que el socket estigués en una altra sala. Pot deixar l'estat del socket inconsistent en escenaris multi-sala.
22. **`room:create` no passa per la cua per sala** (a diferència de join/leave/config/ready/game/answer): dos clics ràpids poden crear dues sales. La reserva de nom s'allibera al `finally` abans d'inserir la sala a memòria, deixant una finestra molt petita per duplicats.
23. **`round:next` disponible just després de `round:results`**, abans que el client mostri el rànquing; el host pot saltar-se la visualització dels 5 s de resultats/rànquing.
24. **`parseAnswerToNumber` accepta notació científica i hexadecimal** (`Number("0x10")`), tot i que el contracte diu "resposta numèrica".

### 9.5 Contracte client/servidor

25. **Tipus que el client envia i el backend no suporta**: `observer:select` i `gameplay:update` provoquen `error` genèric. El client també espera `observer:selected` i `gameplay:update` del servidor, que no s'emeten mai. Sembla una funcionalitat d'observador a mig fer. (El costat client és **no verificat** en aquesta revisió: no forma part de les fonts analitzades.)
26. **URL hardcoded** `ws://localhost:3000` al client Vue; no es pot canviar per entorn sense tocar codi (**no verificat** en aquesta revisió: el client no forma part de les fonts analitzades).
27. **Textos barrejats català/castellà** als missatges de sistema ("se ha unido", "está listo", "ha salido") i error ortogràfic al type `connection:stablished` (contracte congelat pel client).

### 9.6 Operació i manteniment

28. **`.env` versionat a git** (`git ls-files` inclou `.env` i `backend/game-service/.env`), amb secrets reals. Hauria d'estar a `.gitignore` i rotar-se.
29. **No hi ha endpoint de salut** ni `HEALTHCHECK` al Dockerfile, malgrat que la descripció del paquet esmenta REST de health.
30. **`EXPOSE 3000` fix** al Dockerfile, però el port real és `${PORT}`; si es canvia `PORT`, l'`EXPOSE` queda desactualitzat (no afecta el runtime, només la documentació/inspecció).
31. **Dependències no usades** (`mariadb`, `sequelize`, `nodemailer`) i `npm ci --only=production` (flag obsolet, funciona però emet avís a npm recents).
32. **Logs molt verbosos** (`console.log` per cada missatge del router i per cada connexió/desconnexió), sense nivells ni correlació.
33. **Tests desalineats amb el README**: el README diu que es cobreixen reconnexió de `joinRoom` i control d'host a `round:started`, però els tests reals són `sendRound.test.js` (no filtra la resposta) i `catalogOptions.test.js` (opcions i revalidació). No hi ha tests de sales, respostes, puntuació ni admin.
34. **`NEXT_ROUND_DELAY_MS` no documentada** a `.env.example`; `GRACE_MS` no es valida (un valor no numèric produeix `NaN` i un timer immediat).

### 9.7 Altres troballes d'aquesta revisió

35. **`room:create` no refresca el llistat global**. Envia `room:new` a tots els altres sockets, però no `broadcastRoomsList()`; qualsevol client que no processi `room:new` com una alta de sala veurà el lobby desactualitzat fins al pròxim `room:join`/`room:leave`/canvi d'estat.
36. **La sortida per gràcia expirada no publica `admin:live`**. `leaveRoomAndNotify` fa `broadcastRoomsList()` però no `enviaAdminLive()`; el panell d'admin només va rebre el push en tancar-se el socket, quan el jugador encara era a la sala. El recompte per sala queda endarrerit fins al següent esdeveniment.
37. **`room:joined` perd el camp `reconnected`**. `joinRoom` el calcula, però el handler no el copia al JSON; el client no pot saber si ha reaparegut o si ha entrat de nou.
38. **El camp de nickname de la identitat és `nickanme`** (falta la `c`), no `nickname`. `createGuest`, `identityDeclareHandler` i `nickname:update` escriuen `ws.identity.nickanme`; el xat llegeix `nickanme || nickname`; només `identity:confirmed` el tradueix a `nickname`. Qualsevol codi que llegeixi `ws.identity.nickname` obté `undefined`.
39. **El xat mostra el nickname de la identitat, no el de la sala**. `room:create`/`room:join` accepten un nickname diferent del d'identitat; `chat:message` fa servir `ws.identity.nickanme` (o "Anònim"), de manera que el nom visible al xat pot no coincidir amb el de la llista de jugadors.
40. **`identity:declare` es pot repetir dins d'una sala**. No comprova `ws.roomId`; canviar d'identitat mentre s'és a una sala deixa l'antic `player` a `room.players` i permet que el nou `identity.id` torni a entrar (ocupant una altra plaça). `nickname:update`, en canvi, sí que bloqueja el canvi dins de sala.
41. **`partida.dificultat` no s'escriu mai**: totes les partides queden amb el default `media` de l'esquema, i la categoria configurada no es desa a `partida` (només viu a memòria i, indirectament, a `nom_sala` de les stats). L'export CSV no pot reconstruir la categoria/dificultat reals de la partida.
42. **`npm run export:csv` no carrega `.env`**: el script és `node src/cli/exportGameCsv.js` sense `--env-file-if-exists`, així que en local cal exportar `DB_*` al shell o acceptar els defaults del pool. És fàcil exportar contra la BD equivocada sense adonar-se'n.
43. **Clau de cua buida compartida**: `room:join`/`room:leave` sense `roomId` string fan servir `""` com a clau de `roomQueue`; totes aquestes operacions invàlides se serialitzen entre si, sense efecte pràctic però sense aïllament per sala.
44. **`getCorrectRoundsByNickname` compta com a encert qualsevol resposta amb `punts >= 450`**, no només la resposta exacta; si es canvia la corba de `scoring.js`, el llindar d'encerts de les estadístiques queda desalineat sense cap error.
45. **El creador d'una sala no té `userId` a l'objecte de jugador**. `createRoom` no copia `identity.userId` ni llegeix `avatar_color`; per tant el host no surt amb avatar propi, `reportStats` l'omet i les seves partides no arriben a `partides` encara que hagi iniciat sessió. Només s'arregla si marxa i torna a entrar per `room:join` (o si deixa de ser host i reentra).
