# T14a · Mòduls mysql2 reutilitzables des de REST i WebSockets; errors per `error.code`

## Nota

**7 / 10 — Bé.**

La capa mysql2 del `game-service` està ben separada: els gestors de WebSocket no fan SQL, les consultes viuen a `repositories/` i `game/persistence/`, i els errors esperats es tradueixen per `error.code`. Al `catalog-service` passa el mateix: la ruta i el controlador no tenen SQL; tot és al `preguntas.repository.js`.

No arriba a Excel·lent per dos motius concrets:

1. **No hi ha cap funció del mòdul cridada literalment des d'una ruta REST i des d'un gestor de WebSocket dins del mateix procés.** El `game-service` només té WebSockets (no Express). La reutilització REST ↔ WS existeix, però és indirecta: el WS del joc crida el REST del catàleg per HTTP (`fetchQuestions.js:69`), i el panell admin WS crida el REST del catàleg (`adminRouter.js:105`). La funció del repositori s'executa al procés del catàleg, no al del WebSocket.
2. **Hi ha SQL fora dels mòduls de dades:** `joinRoom.js:17` fa un `pool.execute` directe dins d'un mòdul de domini, i el `stats-service` fa SQL cru dins de les rutes (`stats.routes.js:135`, `admin/admin.routes.js:74,170,184,212`). A més, un error esperat queda sense traduir al PATCH d'usuaris de l'admin (`auth/admin.routes.js:56`).

Si la correcció és estricta i compta el `stats-service` (Sequelize, no mysql2), la nota baixa a **6 / 10 — Suficient**, perquè hi ha diverses rutes amb SQL directe. Si es mira només el nucli mysql2 (`game-service`, `catalog-service`, `auth-service`), és un **Bé alt** (7,5).

---

## Per què (evidència)

### 1. Cerca completa de `query(` i `execute(` (69 coincidències, sense `node_modules`)

#### `game-service` — 42 coincidències

**Mòdul de dades OK — `src/repositories/roomRepository.js` (15)**
`:23, :29, :53, :74, :85, :90, :122, :137, :147, :169, :177, :185, :190, :197, :203`
Totes són `connection.execute(...)` o `pool.getConnection()` + `execute` dins de transaccions. Cap rep `req`, `res`, `ws` ni fa `console.log`. Retornen dades pures (`insertId`, array de nicknames, `undefined`) o llancen errors amb `error.code`.

**Mòdul de dades OK — `src/game/persistence/gameRepository.js` (24)**
`:40, :58, :69, :74, :78, :92, :102, :109, :123, :133, :141, :170, :187, :200, :206, :218, :228, :235, :252, :273, :289, :290, :292, :297`
Igual: SQL parametritzat amb `?`, transaccions, retorn de files o `Map`/objectes. No rep transports.

**Mòdul d'exportació (acceptable, no és ruta ni handler) — `src/game/files/exportGameCsv.js`**
`:23, :35`
És un mòdul de lectura que accepta una `connection` opcional i retorna un CSV. Es crida des del CLI (`src/cli/exportGameCsv.js:5`), no des de REST/WS.

**SQL fora del repositori — `src/rooms/joinRoom.js`**
`:17` — `pool.execute("SELECT avatar_color FROM usuaris WHERE id = ? LIMIT 1", [userId])` dins de `findAvatarColor()`. És un mòdul de domini, no un repositori. A més, la funció empassa l'error amb `console.error` i retorna `null` (`joinRoom.js:19-22`).

**Gestors WS: cap SQL.** `joinRoomHandler.js`, `answerSubmitHandler.js`, `roomConfigurationHandler.js`, `gameStartHandler.js`, `messageHandler.js`, `adminRouter.js` no contenen cap `query(` ni `execute(`.

#### `catalog-service` — 7 coincidències

**Mòdul de dades OK — `src/questions/preguntas.repository.js` (6)**
`:11, :23, :34, :37, :51, :64`
`pool.query` / `pool.execute` / `conn.execute` amb `?`. Retorna objectes plans (`{categories, difficulties}`, array de preguntes) o llança errors amb `error.code` (`:94`, `:104`, `:111`, `:118`, `:127`, `:148`, `:159`, `:168`, `:204`, `:216`, `:228`, `:242`, `:266`, `:278`, `:288`, `:303`).

**Middleware de registre — `src/middleware/registre.js:19`**
`sequelize.query("INSERT INTO registre ...")`. No és una ruta ni un handler, però és SQL fora d'un mòdul de dades.

**Rutes i controladors: cap SQL.** `preguntas.routes.js` només declara rutes (`:23`, `:33`); `preguntas.controller.js` només crida el servei/repositori (`:13`, `:24`).

#### `auth-service` — 14 coincidències

**Mòdul de servei amb SQL — `src/authService.js` (13)**
`:173, :205, :223, :243, :249, :264, :320, :330, :347, :361, :381, :392, :404`
No rep `req`/`res` i no fa `console.log`, però barreja lògica de negoci (hash, validacions, correu) amb accés a dades. És reutilitzable, però no és un repositori pur. Usat només des de REST.

**Middleware de registre — `src/middleware/registre.js:19`**
`sequelize.query("INSERT INTO registre ...")`.

**Rutes: cap SQL.** `server.js` i `admin/admin.routes.js` només criden funcions del servei.

#### `stats-service` — 6 coincidències

**SQL dins de rutes (no OK) — `src/stats.routes.js:135`**
`sequelize.query(...)` per al rànquing, directament dins del handler `GET /stats/ranking`.

**SQL dins de rutes (no OK) — `src/admin/admin.routes.js`**
`:74, :170, :184, :212`
`sequelize.query(...)` dins dels handlers d'estadístiques i del gràfic. És el contraexemple més clar del projecte.

**Middleware de registre — `src/middleware/registre.js:20`**
`sequelize.query("INSERT INTO registre ...")`.

> Resum: 45 consultes en mòduls de dades purs, 15 en mòduls de servei/exportació, 4 en domini/middleware i **5 en rutes del `stats-service`**.

### 2. Els mòduls no reben `req`/`res`/`socket` ni fan `console.log`

- `roomRepository.js`: només imports de `pool` (`:6`). Firmes amb objectes plans: `createRoomRecord({ roomId, isPrivate, maxPlayers, nickname })` (`:11`), `addRoomParticipant({ roomId, nickname })` (`:47`). Retorna `insertId` (`:35`) o `nicknames` (`:105`). Cap `console.` al fitxer.
- `gameRepository.js`: imports de `pool` i `calculatePoints` (`:6-7`). Firmes amb escalars: `saveAnswerRecord(roundId, nickname, value)` (`:121`), `closeRoundRecord(roundId, question)` (`:158`). Retorna `{ ranking, scoredAnswers }` (`:208`) o un `Map` (`:265`). Cap `console.` ni `ws.`.
- `preguntas.repository.js`: imports de models i `pool` (`:6-8`). Retorna objectes/arrays o llança errors amb `code`. Cap `console.` ni `req`/`res`.
- `authService.js`: no rep `req`/`res`; llança `authError(code, status, message)` (`:30-35`). Sí que fa servir `status` HTTP al servei, la qual cosa barreja capes, però no rep el transport.

### 3. Una mateixa funció des de REST i WebSockets

**No hi ha una crida directa compartida.** Evidència:

- Els repositoris del joc només s'importen des de dominis/gestors WS:
  - `createRoomRecord` → `rooms/createRoom.js:233` → `rooms/createRoomHandler.js`.
  - `addRoomParticipant` → `rooms/joinRoom.js:244` → `rooms/joinRoomHandler.js:32`.
  - `saveAnswerRecord` → `game/answerSubmitHandler.js:124`.
- El `game-service` no té Express: `server.js:17` crea només `new WebSocketServer(...)`; no hi ha cap `app.get/post` al servei.
- La reutilització que sí que existeix és **indirecta via HTTP**:
  - `gameStartHandler.js:62` (WS) → `fetchQuestions.js:65-69` → `POST /internal/preguntas/get` → `preguntas.routes.js:33` → `preguntas.controller.js:24` → `preguntas.service.js:4` → `preguntas.repository.js:64`.
  - `adminRouter.js:105` (WS) → `adminClient.js:41-42` → `GET /internal/admin/preguntes` → `catalog-service/src/admin/admin.routes.js:38` → `preguntas.repository.js:253` (`listQuestions`).
- Això demostra que el mòdul és reutilitzable, però **no compleix literalment** el punt “la mateixa funció es fa servir des de REST i des de WebSockets”: el WS no importa la funció, crida el REST.

### 4. Traducció d'errors per `error.code`

**`game-service` — traducció correcta al repositori**

`gameRepository.js:140-149`:

```js
try {
  const [result] = await connection.execute(
    "INSERT INTO resposta (ronda_id, partida_id, participant_id, valor) VALUES (?, ?, ?, ?)",
    [roundId, rounds[0].partida_id, participants[0].id, value]
  );
} catch (error) {
  if (error.code === "ER_DUP_ENTRY") {
    throw gameError("ANSWER_ALREADY_EXISTS", "Ja has respost aquesta ronda.");
  }
  throw error;
}
```

El handler tradueix el codi a un missatge clar per al client: `answerSubmitHandler.js:130-138` envia `error.message` per `ANSWER_ALREADY_EXISTS`, `ROUND_CLOSED` i `PARTICIPANT_NOT_IN_GAME`; qualsevol altre error cau al missatge genèric `"No s'ha pogut desar la resposta"`.

**`joinRoom.js:248-256` — traducció al domini**

```js
} catch (error) {
  if (error.code === "ER_DUP_ENTRY") {
    return { ok: false, reason: "Aquest nom d'usuari ja està en ús" };
  }
  if (["ROOM_NOT_FOUND", "ROOM_NOT_WAITING", "ROOM_FULL"].includes(error.code)) {
    return { ok: false, reason: error.message };
  }
  throw error;
}
```

El handler WS envia un missatge genèric si l'error no és reconegut (`joinRoomHandler.js:38-46`), i un `reason` clar si ho és (`:50-57`).

**`createRoom.js:240-255` — `ER_DUP_ENTRY` com a reintent**

Quan el codi de sala aleatori xoca amb `uq_partida_codi` (`schema.sql:58`), es reintenta fins a 3 vegades. És un ús legítim del codi, no una traducció a missatge.

**`authService.js:178-186` — traducció correcta, però fràgil**

```js
} catch (error) {
  if (error.code === "ER_DUP_ENTRY") {
    if (error.message.includes("uq_usuaris_email")) {
      throw authError("EMAIL_TAKEN", 409, "Aquest correu electrònic ja està registrat.");
    }
    throw authError("USERNAME_TAKEN", 409, "Aquest nom d'usuari ja existeix.");
  }
  throw error;
}
```

La traducció és per `error.code`, però per saber **quin** índex ha petat mira el text del missatge (`includes("uq_usuaris_email")`). Això és justament el que la rúbrica vol evitar: el text del missatge pot canviar entre versions de MariaDB o segons l'idioma del servidor.

**Error esperat sense traduir — `auth-service/src/admin/admin.routes.js:51-57`**

`updateUserByAdmin` fa `UPDATE usuaris SET nom = ?, email = ?` (`authService.js:381-384`) sense `try/catch`. Si l'email ja existeix, `error.code` és `ER_DUP_ENTRY` i el missatge és del tipus `Duplicate entry '...' for key 'uq_usuaris_email'`. La ruta el retorna tal qual:

```js
res.status(400).json({ ok: false, code: error.code, reason: error.message });
```

Resultat: al client li arriba `code: "ER_DUP_ENTRY"` i un missatge tècnic amb el nom de l'índex. És l'incompliment més clar del criteri “els errors es tradueixen per `error.code`”.

**`catalog-service` — traducció parcial**

`errorHandler.js:11-17` retorna `err.code` i `err.message`. Els errors de domini ja porten codi i missatge català (`CATEGORY_ALREADY_EXISTS`, `QUESTION_NOT_FOUND`, etc.). Però `createCategory` (`preguntas.repository.js:195-209`) comprova el duplicat amb un `findOne` previ i després fa `create`. Si dues peticions concurrents passen el `findOne`, la segona rep `SequelizeUniqueConstraintError` amb `error.parent.code === "ER_DUP_ENTRY"`, que no es tradueix i acabaria mostrant el missatge de Sequelize.

**Altres errors per codi**

- `auth-service/src/server.js:242-250`: `ECONNREFUSED` i `PROTOCOL_CONNECTION_LOST` → HTTP 503 amb `"No hi ha connexió amb la base de dades."`.
- `roomConfigurationHandler.js:66-88`: `ROOM_NOT_FOUND`, `ROOM_NOT_WAITING`, `ROOM_CAPACITY_BELOW_PARTICIPANTS` → missatge del domini; qualsevol altre → missatge genèric i `console.error`.
- `catch` global del panell admin: `adminRouter.js:259-262` → `"Error intern del servei"`, sense detalls.

### 5. Els missatges que arriben al client són clars?

- **WS del joc: sí.** `joinRoomHandler.js:40-45` no exposa l'error de MariaDB; `answerSubmitHandler.js:128-138` tradueix els codis esperats; `roomConfigurationHandler.js:78-87` fa el mateix.
- **REST del catàleg: sí en el cas normal.** `errorHandler.js` retorna els missatges de domini en català.
- **REST d'auth: sí en el cas normal, no en l'admin.** El middleware (`server.js:228-232`) amaga el missatge quan és 500, però les rutes admin retornen `error.message` amb estat 400; per tant, un `ER_DUP_ENTRY` hi passa cru.
- **Stats: sí.** Les rutes retornen `"Error intern al ..."` i deixen el detall al `console.error` (`stats.routes.js:64, :123, :165`).

### 6. Detall positiu: consultes parametritzades

Totes les consultes mysql2 del projecte fan servir `?`:
`roomRepository.js:25, :30, :56, :75, :86, :93, :123, :138, :148, :170, :178, :186, :191, :198, :204`;
`gameRepository.js:45, :59, :70, :75, :79, :93, :103, :110, :124, :134, :142, :171, :190, :191, :201, :206, :219, :229, :237, :257, :274, :289, :290, :293, :298`;
`preguntas.repository.js:52, :56, :60, :70`;
`authService.js:175, :208, :224, :243, :250, :267, :303, :308, :319, :331, :347, :382, :395, :404`.
No hi ha concatenació de valors d'usuari. Els únics fragments dinàmics són noms de columna fixos (`authService.js:303-319`) i noms de taula/camp provinents de codi, no de la petició (`stats-service/src/admin/admin.routes.js:63-74`).

---

## Què falta per ser Excel·lent

1. **Moure `findAvatarColor` a un repositori.**
   Ara `joinRoom.js:17` fa SQL directe. Hauria de ser, per exemple, `userRepository.findAvatarColor(userId)` i el domini només cridar-lo. Així tot el SQL del `game-service` quedaria a `repositories/` i `persistence/`.

2. **Demostrar una funció compartida REST + WS de veritat.**
   Opcions mínimes:
   - Exposar al `game-service` una ruta REST interna (per exemple `GET /internal/rooms/:codi/ranking`) que cridi `getRanking`/`getCorrectRoundsByNickname`, i fer que el gestor WS d'admin també la cridi directament; o
   - Fer que un gestor WS del `catalog-service` (si n'hi hagués) importi `listQuestions`; o
   - Documentar i defensar que la reutilització és via HTTP (WS → REST → repositori), que és certa però no és el que demana literalment la rúbrica.
   Sense això, aquest punt de la rúbrica queda coix.

3. **Traduir `ER_DUP_ENTRY` a l'admin d'usuaris.**
   A `updateUserByAdmin` (`authService.js:371-400`) cal capturar l'error i llançar `EMAIL_TAKEN`/`USERNAME_TAKEN` amb missatge català, igual que fa `registerUser`. I la ruta ha de retornar aquest codi, no `ER_DUP_ENTRY`.

4. **No distingir l'índex pel text del missatge.**
   A `authService.js:180`, `error.message.includes("uq_usuaris_email")` és fràgil. MariaDB pot canviar el text o l'idioma. Alternativa: consultar prèviament quin camp existeix (com ja fa el catàleg) o separar els `INSERT`/comprovacions, o inspeccionar `error.sqlMessage` amb una comprovació més estable. El codi ha de ser el criteri principal.

5. **Traduir l'error de cursa al catàleg.**
   `createCategory` i `createQuestion` haurien de capturar `SequelizeUniqueConstraintError` i comprovar `error.parent.code === "ER_DUP_ENTRY"` per retornar `CATEGORY_ALREADY_EXISTS`. Ara el `findOne` previ no protegeix de dues peticions simultànies.

6. **Trec el SQL de les rutes del `stats-service`.**
   `stats.routes.js:135` i `admin/admin.routes.js:74,170,184,212` haurien d'anar a un `stats.repository.js`. Encara que el `stats-service` faci servir Sequelize i no mysql2, la rúbrica diu “cap SQL a les rutes”.

7. **Opcional: moure el SQL del middleware `registre`.**
   `catalog-service/src/middleware/registre.js:19`, `auth-service/src/middleware/registre.js:19` i `stats-service/src/middleware/registre.js:20` fan `INSERT` directe. És infraestructura de logging, però si es vol ser pur, hauria de ser un `registreRepository.insert(...)`.

8. **Unificar el criteri de resposta d'errors.**
   El `game-service` fa servir `reason`; el `catalog-service`, `error.message`; l'`auth-service`, `reason`; i les rutes admin, `reason`/`code`. No és un problema de T14a, però dificulta demostrar que tots els errors surten per `error.code`.

---

## Fitxers clau

| Fitxer | Per què mirar-lo |
|---|---|
| `backend/game-service/src/repositories/roomRepository.js` | Mòdul de dades de sales: transaccions, `?`, errors per `error.code`, sense transport. |
| `backend/game-service/src/game/persistence/gameRepository.js` | Mòdul de dades de partides/rondes/respostes; traducció d'`ER_DUP_ENTRY` a `ANSWER_ALREADY_EXISTS`. |
| `backend/game-service/src/rooms/joinRoomHandler.js` | Gestor WS: rep `ws`, delega al domini, envia missatges clars. |
| `backend/game-service/src/rooms/joinRoom.js` | Domini de `room:join`; única consulta fora de repositori (`:17`). |
| `backend/game-service/src/game/answerSubmitHandler.js` | Gestor WS que tradueix codis a missatges d'error del joc. |
| `backend/game-service/src/rooms/roomConfigurationHandler.js` | Un altre exemple de `switch` per `error.code`. |
| `backend/catalog-service/src/questions/preguntas.repository.js` | Mòdul de dades del catàleg usat per les rutes REST. |
| `backend/catalog-service/src/questions/preguntas.routes.js` | Ruta sense SQL. |
| `backend/catalog-service/src/questions/preguntas.controller.js` | Controlador sense SQL. |
| `backend/catalog-service/src/middleware/errorHandler.js` | `err.code` → JSON `{ error: { code, message } }`. |
| `backend/auth-service/src/authService.js` | SQL al servei; traducció d'`ER_DUP_ENTRY` al registre. |
| `backend/auth-service/src/admin/admin.routes.js` | Contraexemple: `ER_DUP_ENTRY` sense traduir al PATCH. |
| `backend/stats-service/src/stats.routes.js` | Contraexemple: SQL cru dins d'una ruta. |
| `backend/database/sql/schema.sql` | Índexs únics que produeixen `ER_DUP_ENTRY`. |
| `backend/game-service/src/db/pool.js` | Pool mysql2 (`mysql2/promise`). |

---

## Explicació dels fitxers

### `game-service/src/repositories/roomRepository.js`
És el mòdul de dades de sales. `createRoomRecord` obre connexió, `beginTransaction`, insereix `partida` i `participant`, fa `commit` i retorna `insertId`; si falla, `rollback` i torna a llançar (`:12-41`). `addRoomParticipant` bloqueja la partida amb `FOR UPDATE`, comprova estat i capacity, insereix el participant i retorna els nicknames (`:47-112`). Els errors de negoci són `ROOM_NOT_FOUND`, `ROOM_NOT_WAITING`, `ROOM_FULL` (`:62-82`). No rep `ws` ni `req`: el handler li passa un objecte pla.

### `game-service/src/game/persistence/gameRepository.js`
És el mòdul de dades de partides. Té una funció `transaction(work)` que centralitza `beginTransaction`/`commit`/`rollback`/`release` (`:21-34`). Les funcions `startGameRecord`, `openRoundRecord`, `closeRoundRecord`, `finishGameRecord` i `resetAbandonedGameRecord` fan diverses operacions dins d'una transacció. `saveAnswerRecord` és el punt on es tradueix `ER_DUP_ENTRY` a `ANSWER_ALREADY_EXISTS` (`:145-149`). Retorna dades pures: `insertId`, `{ ranking, scoredAnswers }`, o un `Map` de nickname → encerts.

### `game-service/src/rooms/joinRoomHandler.js`
És el gestor del missatge WS `room:join`. No fa SQL: llegeix `message.roomId`, `nickname`, `password`, i crida `joinRoom(...)` (`:32-37`). Si el domini llança un error no reconegut, envia un missatge genèric i no el text de MariaDB (`:38-46`). Si el domini retorna `{ ok: false, reason }`, envia el `reason` (`:50-57`). Després fa la resposta `room:joined`, els broadcasts i actualitza el lobby.

### `game-service/src/rooms/joinRoom.js`
És el domini de l'entrada a sala. Valida paràmetres, comprova sales a memòria, crida `addRoomParticipant` (repositori) i tradueix `ER_DUP_ENTRY` a “Aquest nom d'usuari ja està en ús” (`:244-258`). El problema és `findAvatarColor` (`:12-23`): fa un `pool.execute` directe i, a més, converteix qualsevol error en `null` amb `console.error`, de manera que un error de BD es confon amb “usuari sense avatar”.

### `game-service/src/game/answerSubmitHandler.js`
És el gestor WS de `answer:submit`. Valida la resposta, calcula punts i crida `saveAnswerRecord` amb escalars (`:124`). Al `catch`, només exposa el missatge del domini per als codis coneguts (`ANSWER_ALREADY_EXISTS`, `ROUND_CLOSED`, `PARTICIPANT_NOT_IN_GAME`) i per a la resta envia “No s'ha pogut desar la resposta” (`:128-138`). És un bon exemple de handler que no fa SQL i tradueix per `error.code`.

### `game-service/src/rooms/roomConfigurationHandler.js`
Gestor WS de configuració. Comprova que qui ho demana és el host (`:50-60`), crida el domini `updateRoomConfiguration` (`:65`) i tradueix els codis `ROOM_NOT_FOUND`, `ROOM_NOT_WAITING`, `ROOM_CAPACITY_BELOW_PARTICIPANTS` a missatges del domini (`:66-89`). La resta es loga i es respon amb un missatge genèric.

### `catalog-service/src/questions/preguntas.repository.js`
Mòdul de dades del catàleg. `ensureInitialCatalog` fa `INSERT IGNORE` de categories i, si no hi ha preguntes, importa el catàleg (`:10-31`). `listCatalogOptions` retorna `{ categories, difficulties }` (`:33-45`). `getRandomQuestionsFromDatabase` construeix filtres amb `?` i retorna files numèriques (`:47-80`). La resta és CRUD amb models Sequelize i validacions que llancen errors amb `error.code` (`:89-309`). No rep `req`/`res`.

### `catalog-service/src/questions/preguntas.routes.js` i `preguntas.controller.js`
La ruta només declara `GET /catalog/options` i `POST /preguntas/get` amb validació i `asyncHandler`. El controlador llegeix `req.body`, crida el servei i retorna JSON; no hi ha SQL. Això és exactament el que demana la rúbrica: la ruta no sap com es consulta la BD.

### `catalog-service/src/middleware/errorHandler.js`
Converteix qualsevol error en `{ error: { code, message } }` amb `err.statusCode || 500`, `err.code || "INTERNAL_ERROR"` i `err.message`. És el punt on el client veu el codi. El risc: si un error de Sequelize arriba sense traduir, el `message` és tècnic.

### `auth-service/src/authService.js`
Barreja negoci i dades. `registerUser` fa `INSERT` i tradueix `ER_DUP_ENTRY` a `EMAIL_TAKEN`/`USERNAME_TAKEN` (`:172-186`). `loginUser`, `verifyEmailCode`, `updateUserAvatar`, etc. fan `execute` amb `?`. `updateUserByAdmin` (`:371-400`) i `deleteUserByAdmin` (`:402-409`) fan `pool.query` sense traduir duplicats. No rep `req`/`res`, però assigna `status` HTTP al servei.

### `auth-service/src/admin/admin.routes.js`
Rutes REST del panell. La de PATCH (`:51-58`) retorna `error.code` i `error.message` directament. Si `updateUserByAdmin` peta per email duplicat, el client veu `ER_DUP_ENTRY` i el text de MariaDB. És el forat més fàcil de tancar.

### `stats-service/src/stats.routes.js`
Ruta REST amb SQL cru al handler de rànquing (`:135-150`). També fa servir models Sequelize a `/me` (`:74-104`). No és mysql2, però és el mateix anti-patró: la ruta sap SQL.

### `backend/database/sql/schema.sql`
Defineix els índexs que provoquen els errors que s'han de traduir: `uq_categoria_nom` (`:17`), `uq_partida_codi` (`:58`), `uq_participant_partida_nickname` (`:72`), `uq_ronda_partida_numero` (`:92`), `uq_ronda_partida_pregunta` (`:93`), `uq_resposta_ronda_participant` (`:120`), `uq_usuaris_nom` (`:158`), `uq_usuaris_email` (`:159`). Sense aquests índexs, `ER_DUP_ENTRY` no existiria; amb ells, la BD és l'última defensa contra duplicats concurrents.

### `backend/game-service/src/db/pool.js`
Crea el pool `mysql2/promise` amb `connectionLimit: 10`, `charset: utf8mb4` i config per variables d'entorn (`:42-52`). És l'única porta d'entrada a la BD del joc.

---

## Preguntes probables

### 1. Per què separem el SQL de la ruta?
Perquè la ruta només ha de traduir HTTP (llegir `req`, decidir estat, retornar JSON) i el repositori només ha de parlar amb la BD. Així el mateix codi de dades es pot cridar des de REST, des d'un WebSocket o des d'un CLI, i es pot provar sense arrencar Express ni `ws`. Al projecte, `preguntas.routes.js` no té cap `query(`; tot és a `preguntas.repository.js`.

### 2. Què és `error.code` i per què no fer servir `if (err.message.includes(...))`?
`error.code` és el codi estable que afegeix mysql2 quan MariaDB retorna un error (`ER_DUP_ENTRY`, `ER_NO_REFERENCED_ROW_2`, `ECONNREFUSED`...). El `message` és text lliure: pot canviar de versió, d'idioma o incloure el valor que ha provocat l'error. Comparar-lo amb `includes` és fràgil i pot filtrar dades. Al projecte es fa bé a `gameRepository.js:146`, i malament a `authService.js:180`, on es decideix l'índex pel text.

### 3. On es tradueix `ER_DUP_ENTRY` en aquest projecte?
A `gameRepository.js:145-149`: `ER_DUP_ENTRY` → `ANSWER_ALREADY_EXISTS` amb “Ja has respost aquesta ronda.”. A `joinRoom.js:248-251`: `ER_DUP_ENTRY` → `{ ok: false, reason: "Aquest nom d'usuari ja està en ús" }`. A `createRoom.js:242`: es tracta com a reintent del codi de sala. A `authService.js:179`: `EMAIL_TAKEN`/`USERNAME_TAKEN`. I falta a `updateUserByAdmin` i a la cursa de `createCategory`.

### 4. Per què el mòdul de dades no ha de rebre `req`, `res` o el socket?
Perquè llavors el mòdul dependria del transport: no es podria cridar des d'un CLI, ni des d'un test, ni des d'un altre servei. A més, barrejaria responsabilitats: el mòdul ha de retornar files o llançar errors, i el handler ha de decidir si allò és un `res.status(409).json(...)` o un `safeSend(ws, ...)`. Exemple correcte: `addRoomParticipant({ roomId, nickname })` (`roomRepository.js:47`) no sap que existeix un WebSocket.

### 5. Com es reutilitza el mòdul des de REST i des de WebSockets?
Al projecte, de manera **indirecta**: el WS del joc crida el REST del catàleg (`gameStartHandler.js:62` → `fetchQuestions.js:69` → `preguntas.routes.js:33` → `preguntas.repository.js:64`), i el panell admin WS crida el REST del catàleg (`adminRouter.js:105` → `admin.routes.js:38` → `preguntas.repository.js:253`). El mòdul és el mateix, però la crida directa la fa el REST. **No hi ha cap funció importada alhora per una ruta Express i un handler `ws`.** Això és el que falta per a l'Excel·lent.

### 6. Per què el `game-service` no té rutes REST?
Perquè el joc en temps real va per WebSocket: `server.js:17` crea `WebSocketServer` i no Express. Les consultes que necessita (preguntes, estadístiques) les demana per HTTP als altres serveis. Això és una decisió d'arquitectura respectable, però té com a conseqüència que el punt “funció usada des de REST i WS” no es pugui ensenyar dins del mateix procés.

### 7. Què passa si dos jugadors envien la mateixa resposta alhora?
L'índex únic `uq_resposta_ronda_participant` (`schema.sql:120`) deixa passar només un `INSERT`. El segon rep `ER_DUP_ENTRY`, i `saveAnswerRecord` el tradueix a `ANSWER_ALREADY_EXISTS`. El handler envia “Ja has respost aquesta ronda” (`answerSubmitHandler.js:130-131`). La BD és la font de veritat; la comprovació prèvia a memòria (`answerSubmitHandler.js:103`) és només una optimització.

### 8. Per què `execute` i no `query`?
`execute` fa servir prepared statements al servidor: envia la plantilla i els paràmetres per separat, reutilitza el pla i evita que un valor es converteixi en SQL. `query` interpola al client (mysql2 escapa, però no prepara al servidor). Al projecte la majoria de consultes amb valors variables fan servir `execute`; les poques `query` són `INSERT`/`UPDATE` sense paràmetres o amb paràmetres que també s'escapen. El més important, però, és que **totes** fan servir `?`, no concatenació.

### 9. Per què les transaccions són al repositori i no al handler?
Perquè la unitat atòmica és de dades: crear `partida` + `participant` ha de ser tot o res. Si el handler obrís la transacció, hauria de conèixer taules i connexions, i el repositori deixaria de ser reutilitzable. `roomRepository.createRoomRecord` (`:14-41`) i `gameRepository.transaction` (`:21-34`) ho encapsulen, amb `rollback` al `catch` i `release` al `finally`.

### 10. Per què no hi ha `console.log` als mòduls de dades?
Perquè un mòdul de dades ha de ser una funció pura respecte del transport: mateixa entrada, mateixa sortida, sense efectes secundaris. Els logs són responsabilitat del handler o del middleware d'errors, que sí que saben el context (quin usuari, quina ruta, quin socket). Al projecte, els repositoris no tenen `console.`; en canvi, `joinRoom.js:20` sí que en té, i això és part del problema d'aquest fitxer.

### 11. Per què és important que el missatge al client no sigui tècnic?
Perquè `Duplicate entry 'joan@x.com' for key 'uq_usuaris_email'` dona informació interna (nom de l'índex, valor exacte) i no ajuda l'usuari. El client ha de rebre “Aquest correu electrònic ja està registrat.” i un codi estable (`EMAIL_TAKEN`). El detall tècnic ha d'anar al log del servidor, no al JSON de resposta. Al `stats-service` es fa bé: missatge genèric + `console.error`; a l'admin d'auth no.

### 12. Què faries amb `ER_LOCK_DEADLOCK` o `ECONNREFUSED`?
`ECONNREFUSED` i `PROTOCOL_CONNECTION_LOST` són errors d'infraestructura: no s'han de convertir en 400, sinó en 503 amb “No hi ha connexió amb la base de dades.” (`auth-service/src/server.js:242-250`). `ER_LOCK_DEADLOCK` és reintentable: el repositori pot reintentar la transacció un nombre limitat de vegades o traduir-lo a un codi `RETRY_LATER` i que el handler respongui amb un missatge temporal. El que no s'ha de fer és ensenyar el text de MariaDB.

### 13. Com demostraries que no hi ha SQL a les rutes?
Amb una cerca: `rg -n "query\(|execute\(" backend --glob '!**/node_modules/**'`. Després es classifica cada resultat: `repositories/` i `persistence/` són mòduls; els que cauen a `*.routes.js` o `*Handler.js` són l'incompliment. Al projecte, les úniques rutes amb SQL són les del `stats-service`.

---

## Guió de demostració (60 s)

**0-10 s — Ensenya la cerca**
```powershell
rg -n "query\(|execute\(" backend --glob '!**/node_modules/**'
```
Digues: “69 coincidències. Miro si cauen a `repositories`/`persistence` o a `routes`/`Handler`.”

**10-25 s — Ensenya el mòdul net**
Obre `backend/game-service/src/repositories/roomRepository.js:11-41`. Assenyala:
- `createRoomRecord({ roomId, isPrivate, maxPlayers, nickname })`: objecte pla, sense `req`/`res`/`ws`.
- `beginTransaction` / `commit` / `rollback` / `release`.
- `?` a l'`INSERT` i retorn de `gameResult.insertId`.

**25-40 s — Ensenya el camí WS**
Obre `joinRoomHandler.js:32-37` → `joinRoom.js:244-247` → `roomRepository.js:47`.
Digues: “El handler té el socket, però al mòdul només li passa `roomId` i `nickname`. El mòdul no sap que existeix un WebSocket.”
Afegeix la part honesta: “La reutilització REST ↔ WS és via HTTP: `fetchQuestions.js:69` crida el REST del catàleg, que acaba a `preguntas.repository.js:64`. No hi ha una funció importada per tots dos transports.”

**40-50 s — Ensenya la traducció d'errors**
Obre `gameRepository.js:140-149`: `error.code === "ER_DUP_ENTRY"` → `ANSWER_ALREADY_EXISTS`.
Després `answerSubmitHandler.js:128-138`: el codi es converteix en “Ja has respost aquesta ronda” i la resta en un missatge genèric.
Tanca amb el forat: “A `auth/admin.routes.js:56` això no està fet; un email duplicat retorna `ER_DUP_ENTRY` i el text de MariaDB.”

**50-60 s — Conclusió**
“Nota: 7/10, Bé. El nucli mysql2 està ben separat; falta moure `joinRoom.js:17` a un repositori, demostrar una funció compartida REST+WS de veritat i traduir el duplicat de l'admin d'usuaris. Si comptem el `stats-service`, baixa a Suficient perquè té SQL dins de les rutes.”
