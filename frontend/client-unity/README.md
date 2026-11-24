# client-unity

Client del joc fet amb Unity. La comunicació amb el `game-service` és per WebSocket i passa tota per `Assets/Scripts/Services/Realtime/`:

| Fitxer | Responsabilitat |
|---|---|
| `GameClient.cs` | Connexió, `Tick`, `Send` i els 11 enviaments |
| `GameClient.Receive.cs` | `DispatchMessage` i els mètodes `Handle...` de cada tipus |
| `GameClient.Events.cs` | Declaració dels events i els `Invoke...` |

`GameClient` no coneix cap pantalla: només tradueix JSON a events de C#. Els events es llancen sempre al fil principal, perquè els entrega `Tick()`, que s'ha de cridar a cada `Update`. Un tipus que no és a la taula de recepció no es perd: arriba a `OnOther(type, data)`. El text dels errors es llegeix de `reason` i, si no hi és, de `message`.

## Protocol

### Client → servidor (11 tipus)

| Tipus | Payload | Mètode a `GameClient` |
|---|---|---|
| `identity:declare` | `{ identity: { type: "new"\|"restore", id?, nickname? } }` | `DeclareIdentity` (privat; s'envia sol quan arriba `connection:stablished`) |
| `rooms:list` | `{ type }` | `RequestRooms()` |
| `room:create` | `{ nickname, maxPlayers, isPrivate, nameRoom }` | `CreateRoom(nickname, maxPlayers, isPrivate, nameRoom)` |
| `room:join` | `{ roomId, nickname, password, maxPlayers, isPrivate }` | `JoinRoom(roomId, nickname, password, maxPlayers, isPrivate)` |
| `room:leave` | `{ roomId }` | `LeaveRoom(roomId)` |
| `nickname:update` | `{ nickname }` | `UpdateNickname(nickname)` |
| `room:ready` | `{ ready }` | `SetReady(ready)` |
| `room:configuration` | `{ configuration: { category, difficulty, maxPlayers, rounds, durationSeconds, state } }` | `UpdateConfiguration(configuration)` |
| `game:start` | `{ type }` | `StartGame()` |
| `answer:submit` | `{ questionId, answer }` | `SubmitAnswer(questionId, answer)` |
| `round:next` | `{ type }` | `NextRound()` |

`questionId` i `answer` viatgen com a enters. Els camps amb valor `null` no s'envien (per exemple el `password` d'una sala pública o el `maxPlayers` quan no es coneix). `RoomConfigurationData` és la mateixa classe per enviar i per llegir, per això també porta `state`.

### Servidor → client (28 tipus)

| Tipus | Payload | Event |
|---|---|---|
| `connection:stablished` | `{ type }` | Cap; el client declara la identitat tot seguit |
| `identity:confirmed` | `{ identity: { id\|guestId, type, nickname } }` o `{ error }` | `OnIdentity(ServerIdentity)`; si és un error, reintenta amb `new` o llança `OnServerError` |
| `rooms:list` | `{ rooms: [{ id, name, maxPlayers, players, category, state, isPrivate }] }` | `OnRoomsList(List<RoomListItem>)` |
| `room:new` | `{ roomId \| id, name, maxPlayers, players, category, state, isPrivate }` | `OnRoomAdded(RoomListItem)` |
| `room:removed` | `{ roomId }` | `OnRoomRemoved(string roomId)` |
| `room:created` | `{ roomId, hostId, nameRoom, category, difficulty, rounds, maxPlayers, isPrivate, password, players[], state, durationSeconds, readyCount, readyRequired, canStart, role }` | `OnRoomCreated(RoomCreatedData)` |
| `room:joined` | `{ roomId, hostId, nameRoom, category, difficulty, rounds, maxPlayers, state, durationSeconds, readyCount, readyRequired, canStart, isPrivate, password, role, players[] }` | `OnRoomJoined(RoomPlayersData)` |
| `room:players` | Igual que `room:joined` | `OnRoomPlayers(RoomPlayersData)` |
| `room:left` | `{ roomId }` | `OnRoomLeft(string roomId)` |
| `room:state` | `{ roomId, state }` | `OnRoomState(RoomStateData)` |
| `nickname:updated` | `{ nickname }` | `OnNicknameUpdated(string nickname)` |
| `room:ready:error` | `{ reason }` o `{ message }` | `OnReadyError(string)` i `OnServerError` |
| `room:configuration:updated` | `{ ok, changed, configuration: { category, difficulty, maxPlayers, rounds, durationSeconds, state } }` | `OnConfigurationUpdated(RoomConfigurationData)`; només es fa cas del bloc `configuration` |
| `room:configuration:error` | `{ reason }` o `{ message }` | `OnConfigurationError(string)` i `OnServerError` |
| `round:started` | `{ round, totalRounds, durationMs, question: { id, text, unit, difficulty, ... } }` | `OnRoundStarted(RoundStartedData)` |
| `round:spectator` | `{ roomId, round, totalRounds, phase, remainingMs, durationMs }` | `OnSpectatorRound(SpectatorRoundData)` |
| `round:results` | `{ round, totalRounds, correctAnswer, unit, explanation, you: { answer, roundPoints, totalScore, position } }` | `OnRoundResults(RoundResultsData)` |
| `round:ranking` | `{ round, totalRounds, you: { position, totalScore }, ranking: [{ position, nickname, score }] }` | `OnRoundRanking(RoundRankingData)` |
| `game:finished` | `{ roomId, you: { position, score }, ranking: [{ position, nickname, score }] }` | `OnGameFinished(GameFinishedData)` |
| `answer:ack` | `{ questionId }` | `OnAnswerAck(int questionId)` |
| `round:next:error` | `{ reason }` o `{ message }` | `OnRoundNextError(string)` i `OnServerError` |
| `room:create:error` | `{ reason }` o `{ message }` | `OnServerError(type, text)` |
| `room:join:error` | `{ reason }` o `{ message }` | `OnServerError(type, text)` |
| `room:leave:error` | `{ reason }` o `{ message }` | `OnServerError(type, text)` |
| `nickname:error` | `{ reason }` o `{ message }` | `OnServerError(type, text)` |
| `round:error` | `{ reason }` o `{ message }` | `OnServerError(type, text)` |
| `answer:error` | `{ reason }` o `{ message }` | `OnServerError(type, text)` |
| `error` | `{ reason }` o `{ message }` | `OnServerError(type, text)` |

Notes:

- `players[]` és una llista de `{ id, nickname, score, ready, role }`.
- El bloc `you` pot ser `null` quan el jugador és observador. Per això viu en classes pròpies (`YouRoundResult`, `YouRanking`, `YouFinal`) i es pot comprovar amb `== null`.
- `QuestionData` també declara `correctAnswer`, `explanation` i `timeLimitSeconds`; si el servidor no els envia, queden al valor per defecte.
- `round:next:error`, `room:ready:error` i `room:configuration:error` tenen event propi i, a més, passen pel canal general `OnServerError`.
- `OnDisconnected(string reason)` no correspon a cap tipus: arriba quan es tanca el socket.

## Persistència

El client guarda molt poques coses i les reparteix en dos llocs:

| Dada | On viu | Clau / camp | Durada |
|---|---|---|---|
| Nickname | `PlayerPrefs` | `nickname_editor` a l'editor, `nickname_build` a la build | Es llegeix a l'arrencada i es desa quan l'usuari el canvia. Sobrevviu al tancament |
| Guest id | `SessionStore` (memòria) | `GuestId` | S'omple a `identity:confirmed` i s'esborra si el servidor rebutja la identitat. Mor amb l'aplicació |
| Sala activa | `SessionStore` (memòria) | `ActiveRoomId`, `ActiveRoomPassword` | Es desa en crear o entrar a una sala i s'esborra a `room:left` i `room:removed`. Mor amb l'aplicació |

`PlayerPrefs` no guarda res més. Les claus antigues del guest id (`guestId_editor` i `guestId_build`) s'esborren a l'arrencada de `GameClient` per no deixar residus.

Com que el guest id i la sala activa només viuen a memòria, en tornar a obrir l'aplicació el client no pot restaurar la identitat ni reprendre la sala: demana una identitat nova i torna a la pantalla principal. Només el nickname sobreviu, perquè és l'única dada que val la pena conservar entre execucions.
