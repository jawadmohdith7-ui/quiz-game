# catalog-service

Documentació tècnica del microservei `backend/catalog-service`, basada en la lectura del codi (src/**, `package.json`, `Dockerfile`, `.env`, `docker-compose.yml`) i dels consumidors (`backend/game-service`, `frontend/client-vue`).

---

## 1. Resum i responsabilitat

`catalog-service` és un servei HTTP **sense estat propi** (tota l'estat viu a MariaDB) que actua com a **catàleg de preguntes i categories** del joc "How Much?".

**Què fa:**

- Retorna el catàleg d'opcions de configuració d'una sala: noms de categoria i dificultats existents (`GET /internal/catalog/options`).
- Retorna N preguntes aleatòries filtrades per categoria i dificultat (`POST /internal/preguntas/get`).
- Exposa un CRUD intern de preguntes i categories per al panell d'administració (`/internal/admin/*`).
- Sembra el catàleg inicial a l'arrencada: insereix les 8 categories base amb
  `INSERT IGNORE` i, **només si `pregunta` és buida**, importa
  `preguntas.json`. Atenció: en una BD creada amb `dades-inicials.sql` la taula
  ja porta 31 preguntes, així que la importació de les 254 **no s'executa**; per
  carregar-les cal `npm run import:questions` (vegeu §4.5 i §9.15).
- Desa un registre HTTP de cada petició atesa a la taula `registre`.

**Què NO fa:**

- No autentica usuaris ni valida rols. Només comprova un secret compartit de servei (`x-internal-secret`); el rol d'admin el comprova `game-service` abans de reenviar la petició.
- No gestiona partides, rondes, respostes ni puntuacions en el flux real.
- No calcula puntuacions, no fa WebSocket i no parla amb el frontend. El frontend només parla amb `game-service`.
- No serveix fitxers estàtics ni té cap ruta pública.

---

## 2. Stack i dependències

| Element | Valor (evidència) |
|---|---|
| Runtime | Node.js 22 (`Dockerfile`: `node:22-alpine`) |
| Mòduls | ESM (`"type": "module"` a `package.json`) |
| Framework HTTP | Express `^4.19.2` |
| Driver SQL cru | `mysql2` `^3.24.6` (pool de `src/db/pool.js`) |
| ORM | Sequelize `^6.37.8` (models de `src/db/sequelize.js`) |
| BD | MariaDB 11 (`docker-compose.yml`), dialecte `mysql` |
| Test runner | `node --test` (script `npm test`) — **no hi ha cap `*.test.js` al servei** |
| Altres | `node:crypto` (`timingSafeEqual`), `fs/promises`, `fetch` natiu (només al consumidor) |

No hi ha dependències de producció addicionals (ni JWT, ni helmet, ni cors, ni logger).

---

## 3. Estructura de fitxers

```text
backend/catalog-service/
├── .env                       # PORT i INTERNAL_SECRET (noms; sense DB_*)
├── .env.example               # Plantilla: PORT, DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, INTERNAL_SECRET
├── .gitignore                 # Ignora node_modules/, package-lock.json, *.local, logs, dist/... (NO ignora .env)
├── Dockerfile                 # node:22-alpine; npm install --omit=dev; copia src/
├── package.json               # scripts start/dev/import:questions/test + deps
├── package-lock.json          # lock de dependències
├── README.md                  # Resum del servei i de les rutes internes
└── src/
    ├── app.js                 # Crea Express, CORS manual, json, registre, munta rutes, errorHandler
    ├── server.js              # Arrenca: ensureInitialCatalog() i listen(3001) hardcoded
    ├── admin/
    │   └── admin.routes.js    # CRUD intern de preguntes i categories (panell admin)
    ├── cli/
    │   └── importQuestions.js # CLI d'importació: node src/cli/importQuestions.js [path]
    ├── db/
    │   ├── pool.js            # Pool mysql2/promise (opcions, preguntes aleatòries, seed)
    │   └── sequelize.js       # Connexió Sequelize + models Categoria/Pregunta + associacions i hooks
    ├── middleware/
    │   ├── asyncHandler.js    # Wrapper per capturar promeses rebutjades -> next(err)
    │   ├── errorHandler.js    # Resposta JSON { error: { code, message } }
    │   ├── registre.js        # "after response": INSERT a registre (fire-and-forget)
    │   └── requireInternalService.js # Valida x-internal-secret amb timingSafeEqual
    └── questions/
        ├── importQuestions.js # Biblioteca d'importació (seed + CLI), transaccional
        ├── loadQuestions.js   # Resol i llegeix `backend/database/preguntas/preguntas.json`
        ├── preguntas.controller.js # Handlers de les dues rutes internes
        ├── preguntas.repository.js # Consultes SQL/Sequelize: opcions, random, CRUD
        ├── preguntas.routes.js     # GET /catalog/options, POST /preguntas/get
        ├── preguntas.validator.js  # Valida el body de POST /preguntas/get (HTTP)
        └── validarPregunta.js      # Validador de pregunta per a la importació JSON
```

### 3.1 Fitxers duplicats, àlies i codi sense ús

| Fitxer / símbol | Què és | S'usa? |
|---|---|---|
| `src/cli/importQuestions.js` | Script CLI: `importQuestions(process.argv[2])`, imprimeix el resultat en JSON, `process.exitCode = 1` si falla i tanca `sequelize` al `finally`. | Sí: `npm run import:questions` |
| `src/questions/importQuestions.js` | Biblioteca real d'importació; conté tota la lògica (validar + transacció). | Sí: la criden el CLI i `ensureInitialCatalog()` |
| `src/questions/preguntas.validator.js` | `validateGetPreguntas`, middleware del cos HTTP de `POST /internal/preguntas/get`. No valida preguntes individuals. | Sí: `preguntas.routes.js` |
| `src/questions/validarPregunta.js` | `validarPregunta(pregunta) → { valid, errors }` per a la importació JSON; no llança. | Sí: `importQuestions.js` |

Els `validar*` no són duplicats entre si: `preguntas.validator.js` valida el
**body HTTP** (3 camps) i `validarPregunta.js` valida **una pregunta del JSON**
(9 camps). La duplicació real és de regles: `validatePreguntaInput` (CRUD) i
`validarPregunta` (import) implementen el mateix rang `min/max/step` amb
toleràncies i límits de longitud diferents (§9.3).

---

## 4. Flux principal pas a pas

### 4.1 Arrencada (`src/server.js`)

1. `ensureInitialCatalog()` (`preguntas.repository.js`):
   - `INSERT IGNORE INTO categoria (nom) VALUES ('Geografia'), ('Ciencia'),
     ('Historia'), ('Esports'), ('Cultura'), ('Cos Humà'), ('Tecnologia'),
     ('Curiositats')` (8 files; si ja existeixen no fa res).
   - `SELECT COUNT(*) FROM pregunta`. Si és `0`, crida `importQuestions()`
     sense ruta → `loadQuestions()` resol el JSON.
2. Si hi ha hagut importació, fa `console.log("Catàleg inicial carregat: N
   preguntes importades.")`. No registra `updated`/`skipped`/`rejected` ni els
   rebutjos.
3. `app.listen(3001)`. El port és **literal al codi**; la variable `PORT` de
   `.env` s'ignora en aquest servei.
4. Si el seed o la connexió fallen, `console.error` i `process.exit(1)`. En
   Compose (`restart: unless-stopped`) el contenidor es reinicia en bucle fins
   que MariaDB respon. `docker-compose.yml` el fa dependre de `mariadb` sana, però
   no hi ha cap ruta `/health`: la primera petició pot fallar amb `500` mentre la
   BD arrenca.

Nota sobre `dades-inicials.sql`: en una instal·lació Docker neta, el contenidor
de MariaDB executa `02-dades-inicials.sql`, que deixa **31 preguntes**. Per tant
`COUNT(*)` no és 0 i la importació automàtica de les 254 preguntes **no es fa**;
el catàleg queda amb les 31 del seed SQL fins que s'executa el CLI (§4.5).

### 4.2 Obtenir opcions de catàleg (consumit en entrar al lobby)

1. Frontend envia WS `{"type":"catalog:options"}` a `game-service`.
2. `game-service` (`src/catalog/catalogOptions.js`) fa `GET ${CATALOG_URL}/internal/catalog/options` amb capçalera `x-internal-secret` i timeout de 5 s.
3. `requireInternalService` valida el secret (503 si no està configurat, 403 si no coincideix).
4. `listCatalogOptions()`:
   - `SELECT nom FROM categoria ORDER BY nom`
   - `SELECT DISTINCT dificultat FROM pregunta ORDER BY dificultat`
5. Resposta `{ categories, difficulties }`; `game-service` valida que siguin llistes d'strings i retransmet `catalog:options` als clients.

### 4.3 Obtenir preguntes per iniciar partida

1. L'host envia WS `game:start`; `game-service` (`gameStartHandler.js`) crida `fetchQuestions(room.rounds, room.category, room.difficulty)`.
2. `fetchQuestions` fa `POST ${CATALOG_URL}/internal/preguntas/get` amb `{ numQuestions, category, difficulty }` i `x-internal-secret`.
3. Middlewares: secret → `validateGetPreguntas` (400 si el body no és vàlid) →
   controlador. La validació exigeix `numQuestions` enter > 0 (sense màxim),
   `category` string no buit i, si ve, `difficulty` string que, després de
   `trim().toLowerCase()`, ha de fer 1–32 caràcters (per tant `null` o `""` donen
   `INVALID_DIFFICULTY`). El body original es modifica: `difficulty` es desa ja
   normalitzada.
4. `getRandomQuestions` → `getRandomQuestionsFromDatabase`:
   - Si `category.trim().toLowerCase() !== "mix"`: busca `SELECT id FROM
     categoria WHERE nom = ?` amb `category.trim()`. Si no hi és, retorna
     `null`. La comparació depèn de la col·lació de la BD (per defecte
     `utf8mb4_*_ci`, seria insensible a majúscules; **no verificat en viu**).
   - Si `difficulty` existeix i no és `"mix"`: afegeix filtre `p.dificultat = ?`.
   - `SELECT ... ORDER BY RAND() LIMIT ?` amb `LIMIT = numQuestions` (el
     controlador valida que és enter > 0, però no hi ha sostre: un client intern
     pot demanar `numQuestions: 1000000`).
   - Converteix a número `correctAnswer`, `min`, `max`, `step` i renombra columnes al contracte del joc.
5. Controlador: `null` → 404 `CATEGORY_NOT_FOUND`; array buit → 404 `NO_QUESTIONS_FOUND`; si no, `{ questions }`.
6. `game-service` fa `prepareGame` i fixa `totalRounds = questions.length` (si en tornen menys de les demanades, la partida dura menys).

### 4.4 CRUD d'administració

1. Admin autenticat per WS a `game-service` (`admin:auth` amb JWT); `game-service` reenvia per HTTP a `/internal/admin/*` amb `x-internal-secret` **i** `Authorization: Bearer <token>`.
2. `catalog-service` només valida el secret intern; l'`Authorization` s'ignora aquí.
3. Les rutes admin no llancen errors cap a l'`errorHandler`: cada handler fa `try/catch` i respon `{ ok: false, code, reason }`.
4. Després d'una mutació correcta, `game-service` fa `broadcastCatalogOptions()` i revalida les sales en estat `lobby` (si una categoria o dificultat ha desaparegut, la sala passa a `Mix`/`mix`).
5. Validació de preguntes (`validatePreguntaInput`, dins del repositori):
   - `POST` valida l'objecte sencer. `PATCH` fa `{ ...filaActual, ...body }` i
     valida **el resultat combinat**, així que accepta camps parcials però
     rebutja qualsevol combinació que quedi invàlida (per exemple, canviar només
     `min` per sobre de `resposta_correcta`).
   - Àlies acceptats: `text`/`enunciat`; `resposta_correcta`/`respuesta_correcta`/
     `correctAnswer`; `unitat`/`unit`; `dificultat`/`dificultad`/`difficulty`;
     `explicacio`/`explicacion`/`explanation`; `categoria_id`/`categoriaId`.
   - `min < max`, `step > 0`, `(max-min)/step` enter i ≤ 100000, i
     `resposta_correcta` dins del rang. `dificultat` 1–32 caràcters,
     normalitzada a minúscules, i **no pot ser `"mix"`**.
   - `categoria_id` ha d'existir a `categoria` (`CATEGORY_NOT_FOUND`).
   - No es validen longituds de `text`/`explicacio` (només el `TEXT` de MySQL) ni
     la mida de `unitat` (el model Sequelize en declara `STRING(50)`, però no hi
     ha validador de longitud).
6. Categories: `nom` s'elimina d'espais i no pot quedar buit; no es comprova
   longitud (el `VARCHAR(100)` de la BD talla amb error cru si se supera).
   `DELETE` passa pel hook `beforeDestroy` de Sequelize i, si queden preguntes,
   retorna `CATEGORY_HAS_QUESTIONS`; la FK `ON DELETE RESTRICT` n'és la segona
   barrera.

### 4.4.1 Alta d'una pregunta, de punta a punta

1. El panell envia per WS `{"type":"admin:preguntes:create","dades":{...}}` a
   `game-service`, que comprova el JWT admin i fa `POST
   /internal/admin/preguntes` amb `x-internal-secret` i `Authorization`.
2. `requireInternalService` valida el secret. El catalog **no** mira el JWT.
3. `createQuestion(req.body)` → `validatePreguntaInput` normalitza i valida
   (text, categoria existent, resposta numèrica dins de `min/max`, `step > 0`
   divisible, dificultat 1–32 i ≠ `mix`, explicació no buida).
4. `Categoria.findByPk(categoria_id)`; si no existeix → `CATEGORY_NOT_FOUND`.
5. `Pregunta.create(data)`; els hooks `beforeValidate` fan `trim()` de `text`,
   `unitat` i `explicacio`. La BD aplica `chk_pregunta_slider` i la FK.
6. Resposta `201 { ok: true, pregunta }`; `game-service` fa
   `broadcastCatalogOptions()` i revalida les sales `lobby`.
7. Els camps que el client no enviï no s'inventen: `unitat` pot quedar `""`,
   però `text`, `categoria_id`, `resposta_correcta`, `min`, `max`, `step`,
   `dificultat` i `explicacio` són obligatoris (igual que a la importació).

### 4.5 Importació (CLI o seed)

`importQuestions(filePath)`:

1. `loadQuestions(filePath)`: si hi ha ruta, la llegeix; si no, llegeix
   `backend/database/preguntas/preguntas.json`.
   Si falla, llança `QUESTIONS_FILE_ERROR`.
   Estructura: array de 8 grups `{ "category": "...", "questions": [...] }`; cada
   pregunta fa `{ "id", "text", "correctAnswer", "min", "max", "step", "unit",
   "difficulty", "explanation" }` (ids 1–254, dificultats `facil`/`media`/
   `dificil`). Fixa't que el JSON usa els noms anglesos/aliases
   (`unit`/`difficulty`/`explanation`), no els catalans de la BD.
2. Comprova que el JSON sigui un array de grups (`{ category, questions: [] }`);
   si no, llança. Cada pregunta s'expandeix amb `categoria: group.category`
   (només si és un objecte; un element primitiu es valida tal qual i cau com a
   rebutjat) i es passa a `validarPregunta`. Els rebutjos s'acumulen amb
   `{ categoryIndex, questionIndex, errors: [...] }` i **no aturen** la resta.
3. Dins d'una `sequelize.transaction` única:
   - `Categoria.findOrCreate({ where: { nom: group.category.trim() } })` per cada
     pregunta vàlida (no per grup: si el grup té 0 preguntes vàlides no es crea).
   - `Pregunta.findOne({ categoria_id, text })`: si existeix, només compara i
     actualitza `resposta_correcta`, `min`, `max`, `step`; si no existeix, crea
     la fila sencera amb `unitat`, `dificultat` (minúscules) i `explicacio`.
   - El camp `id` del JSON **s'ignora**: la BD assigna `AUTO_INCREMENT`.
4. Retorna `{ imported, updated, skipped, rejected }`. El CLI
   (`src/cli/importQuestions.js`) ho imprimeix amb `JSON.stringify(..., null, 2)`
   i surt amb codi 1 si hi ha excepció; si només hi ha rebutjos, surt amb codi 0.
5. La clau de deduplicació és `categoria_id + text`; `pregunta` **no té cap
   `UNIQUE` per aquesta parella**, així que la idempotència depèn del `findOne`
   dins la transacció (dues instàncies concurrents podrien duplicar files).

---

## 5. Contracte de comunicació

Totes les rutes són **internes**: requereixen `x-internal-secret`. No n'hi ha cap de pública.

### 5.1 Rutes HTTP

| Mètode | Path | Middleware (en ordre) | Body JSON | Resposta 2xx | Errors |
|---|---|---|---|---|---|
| GET | `/internal/catalog/options` | `requireInternalService` → `asyncHandler` | — | `200 { "categories": [...], "difficulties": [...] }` | 503 `INTERNAL_ACCESS_NOT_CONFIGURED`, 403 `INTERNAL_ACCESS_DENIED`, 500 `INTERNAL_ERROR` |
| POST | `/internal/preguntas/get` | `requireInternalService` → `validateGetPreguntas` → `asyncHandler` | `{ "numQuestions": 5, "category": "Geografia", "difficulty": "media" }` | `200 { "questions": [ ... ] }` | 400 `INVALID_NUM_QUESTIONS` / `INVALID_CATEGORY` / `INVALID_DIFFICULTY`; 404 `CATEGORY_NOT_FOUND` / `NO_QUESTIONS_FOUND`; 403/503 de secret; 500 |
| GET | `/internal/admin/preguntes` | `requireInternalService` (només) | — | `200 { "ok": true, "preguntes": [ ... ] }` | 500 `{ ok:false, reason }` (sense `code`); 403/503 de secret |
| POST | `/internal/admin/preguntes` | `requireInternalService` (només) | `{ "text", "categoria_id", "resposta_correcta", "min", "max", "step", "unitat", "dificultat", "explicacio" }` (+ àlies) | `201 { "ok": true, "pregunta": { ... } }` | 400 `QUESTION_*` / `CATEGORY_NOT_FOUND`; 500 no s'hi arriba (tot error és 400) |
| PATCH | `/internal/admin/preguntes/:id` | `requireInternalService` (només) | Camps parcials del mateix objecte | `200 { "ok": true, "pregunta": { ... } }` | 400 `QUESTION_NOT_FOUND` / `QUESTION_*` / `CATEGORY_NOT_FOUND` |
| DELETE | `/internal/admin/preguntes/:id` | `requireInternalService` (només) | — | `200 { "ok": true }` | 400 `QUESTION_NOT_FOUND`; 400 cru si la FK `ronda` la referencia |
| GET | `/internal/admin/categories` | `requireInternalService` (només) | — | `200 { "ok": true, "categories": [ { "id", "nom", "preguntas": [...] } ] }` | 500 `{ ok:false, reason }`; 403/503 de secret |
| POST | `/internal/admin/categories` | `requireInternalService` (només) | `{ "nom": "Nova categoria" }` | `201 { "ok": true, "categoria": { "id", "nom" } }` | 400 `CATEGORY_NAME_REQUIRED` / `CATEGORY_ALREADY_EXISTS` / error de BD |
| PATCH | `/internal/admin/categories/:id` | `requireInternalService` (només) | `{ "nom": "Nom nou" }` | `200 { "ok": true, "categoria": { ... } }` | 400 `CATEGORY_NOT_FOUND` / `CATEGORY_ALREADY_EXISTS` / `CATEGORY_NAME_REQUIRED` |
| DELETE | `/internal/admin/categories/:id` | `requireInternalService` (només) | — | `200 { "ok": true }` | 400 `CATEGORY_NOT_FOUND` / `CATEGORY_HAS_QUESTIONS` |

Ruta completa: `app.js` munta el router de joc a `/internal` (aplicant-hi
`requireInternalService` i després `preguntasRoutes`) i el d'admin a
`/internal/admin` (el router ja porta `requireInternalService` a dins). No hi ha
cap `GET /health` ni cap ruta pública.

**Notes de contracte:**

- Format d'error **no homogeni**: rutes de joc → `{ "error": { "code",
  "message" } }`; rutes d'admin → `{ "ok": false, "code"?, "reason" }`; el
  middleware de secret → `{ "error": { "code", "message" } }`. El camp `code`
  d'admin desapareix del JSON quan val `undefined` (errors de Sequelize o de BD).
- Els `OPTIONS` (preflight) responen `204` sense cos i **no** s'anoten a
  `registre`, perquè el middleware de CORS els talla abans.
- Un path inexistent cau al 404 per defecte d'Express (HTML), perquè
  `errorHandler` només atén errors llançats.
- JSON invàlid: `express.json()` llança amb `status = 400` i sense `code`, així
  que `errorHandler` respon `400 { "error": { "code": "INTERNAL_ERROR",
  "message": "<missatge del parser>" } }`.
- `POST`/`PATCH` d'admin responen `201`/`200` amb l'objecte Sequelize: les claus
  surten com `min`, `max`, `step` (no `min_value`...) i la pregunta porta
  `categoria_id`; a `GET /admin/preguntes` i `GET /admin/categories` s'inclou
  l'objecte relacionat (`categoria` / `preguntas`) i `PATCH` no recarrega la
  relació (el `categoria` pot faltar a la resposta del PATCH).
- `difficulty` és opcional; si s'omet o val `"mix"`, no filtra. Si ve, es
  normalitza a minúscules i es valida entre 1 i 32 caràcters.
- La categoria `"mix"` (qualsevol capitalització) desactiva el filtre. Una
  categoria que no sigui `mix` es busca **exactament** per `nom`
  (`WHERE nom = ?`); el joc envia els noms tal com arriben de
  `/catalog/options`.

**Exemple real de pregunta a la resposta** (fila `id=1` de la BD):

```json
{
  "id": 1,
  "text": "Quants quilòmetres mesura el riu Nil?",
  "correctAnswer": 6650,
  "min": 6350,
  "max": 7350,
  "step": 10,
  "unit": "km",
  "difficulty": "media",
  "explanation": "És el riu més llarg del món."
}
```

**Exemple de petició i resposta completes:**

```json
// POST /internal/preguntas/get
{ "numQuestions": 2, "category": "Mix", "difficulty": "mix" }

// 200
{
  "questions": [
    { "id": 1, "text": "Quants quilòmetres mesura el riu Nil?", "correctAnswer": 6650,
      "min": 6350, "max": 7350, "step": 10, "unit": "km", "difficulty": "media",
      "explanation": "És el riu més llarg del món." }
  ]
}
```

**Exemple d'error de joc:**

```json
{ "error": { "code": "CATEGORY_NOT_FOUND", "message": "Categoria no trobada: Astronomia" } }
```

**Exemple d'error d'admin:**

```json
{ "ok": false, "code": "QUESTION_SLIDER_RANGE_INVALID",
  "reason": "min, max i step han de definir un rang vàlid que inclogui la resposta correcta." }
```

### 5.2 Missatges WebSocket

`catalog-service` **no obre ni consumeix WebSocket**. Els missatges rellevants són de `game-service`, que els deriva de les rutes anteriors:

| Missatge | Direcció | Contingut |
|---|---|---|
| `catalog:options` (request) | client → game-service | `{ "type": "catalog:options" }` |
| `catalog:options` (resposta OK) | game-service → client | `{ "type": "catalog:options", "ok": true, "categories": [...], "difficulties": [...] }` |
| `catalog:options` (error) | game-service → client | `{ "type": "catalog:options", "ok": false, "reason": "No s'han pogut carregar les opcions del catàleg" }` |
| `room:configuration:updated` | game-service → sala | `{ "type": "room:configuration:updated", "ok": true, "changed": ["category"], "configuration": { ... } }` quan una opció deixa d'existir |

---

## 6. Comunicació amb altres serveis i la BD

### 6.1 Serveis

| Origen → Destí | Mitjà | URL interna | Variables |
|---|---|---|---|
| game-service → catalog-service | HTTP GET | `http://catalog-service:3001/internal/catalog/options` | `CATALOG_URL`, `INTERNAL_SECRET` |
| game-service → catalog-service | HTTP POST | `http://catalog-service:3001/internal/preguntas/get` | `CATALOG_URL`, `INTERNAL_SECRET` |
| game-service → catalog-service | HTTP GET/POST/PATCH/DELETE | `http://catalog-service:3001/internal/admin/...` | `CATALOG_URL`, `INTERNAL_SECRET` (+ `Authorization` que el catalog ignora) |
| frontend → game-service | WebSocket | `ws://...:3000` | — |
| frontend → catalog-service | **cap** | — | — |

Variables d'entorn (amb el valor per defecte que aplica el codi):

| Variable | `src/db/pool.js` | `src/db/sequelize.js` | Altres |
|---|---|---|---|
| `DB_HOST` | `mariadb` | `localhost` | — |
| `DB_PORT` | `3306` | `3306` | — |
| `DB_USER` | `root` | `root` | — |
| `DB_PASSWORD` | `root` | `""` (buit) | — |
| `DB_NAME` | `howmuch` | `howmuch` | — |
| `INTERNAL_SECRET` | — | — | Sense default: si falta, totes les rutes `/internal*` responen 503 |
| `PORT` | — | — | **No s'usa**: `server.js` fixa `3001` |

Altres paràmetres fixos: `pool` usa `connectionLimit: 10`, `queueLimit: 0`,
`charset: 'utf8mb4'`, `decimalNumbers: true`; `sequelize` usa dialecte `mysql`,
`logging: false`, `timestamps: false`, `freezeTableName: true`.

El `.env` real del servei només conté `PORT` i `INTERNAL_SECRET`; la resta
arriba per `environment` de `docker-compose.yml`. Com que Compose **no** injecta
`INTERNAL_SECRET` al catalog, el valor del seu `.env` ha de coincidir amb el
`${INTERNAL_SECRET}` del `.env` de l'arrel (que és el que reben `game-service` i
`auth-service`).

Variables que **no** llegeix: `CATALOG_URL` (és del game-service), `AUTH_SECRET`
(no hi ha JWT en aquest servei), `NODE_ENV`.

### 6.2 Base de dades

Taules que toca el servei:

| Taula | Operacions | Columnes reals (`schema.sql`) | Accés |
|---|---|---|---|
| `categoria` | `SELECT`, `INSERT IGNORE` (seed), `INSERT`, `UPDATE`, `DELETE` | `id INT UNSIGNED PK AI`, `nom VARCHAR(100) NOT NULL`, `UNIQUE uq_categoria_nom`, `CHECK CHAR_LENGTH(TRIM(nom)) > 0` | `pool` (opcions/seed) i Sequelize (CRUD) |
| `pregunta` | `SELECT` (aleatòria, opcions), `INSERT`, `UPDATE`, `DELETE`, `COUNT(*)` | `id`, `categoria_id`, `text TEXT`, `resposta_correcta DOUBLE`, `min_value DOUBLE`, `max_value DOUBLE`, `step_value DOUBLE`, `unitat VARCHAR(50) DEFAULT ''`, `dificultat VARCHAR(32)`, `explicacio TEXT`; `CHECK chk_pregunta_slider` (`min < max`, `step > 0`, `resposta_correcta` dins del rang); FK `categoria_id → categoria(id) ON DELETE RESTRICT` | `pool` (joc/seed) i Sequelize (CRUD) |
| `registre` | `INSERT` (una fila per petició HTTP) | `id`, `servei` (`'catalog'`), `metode`, `ruta` (`req.path`), `estat`, `creat_at` | **Sequelize** (`middleware/registre.js`), no el pool |

Columnes i detalls que el codi assumeix:

- Sequelize mapeja `min` → `min_value`, `max` → `max_value`, `step` →
  `step_value` (`field`); a les respostes JSON surten els noms curts.
- `pregunta` **no té `UNIQUE(categoria_id, text)`**: la idempotència de la
  importació és només pel `findOne` previ.
- `partida.dificultat` és `VARCHAR(32)` (ja a `schema.sql`; la migració
  `dynamic-difficulties.sql` ho aplica a bases antigues). Les dificultats del
  catàleg són dinàmiques (`SELECT DISTINCT dificultat FROM pregunta`) i avui
  valen `facil`, `media` i `dificil`.
- `categoria.nom` i `pregunta.dificultat` utilitzen la col·lació per defecte de
  la BD; les comparacions `WHERE nom = ?` / `WHERE dificultat = ?` són, en
  principi, insensibles a majúscules (no verificat en viu).

Migracions i seeders:

- `backend/database/sql/schema.sql` — creat per `docker-compose` a
  `/docker-entrypoint-initdb.d/01-schema.sql`. No fa cap `DROP` de
  `categoria`/`pregunta`; les crea amb `IF NOT EXISTS`.
- `backend/database/sql/dades-inicials.sql` — seed inicial (rols 1/2, usuari
  `admin` verificat, 8 categories i **31 preguntes** amb `id` explícit) muntat com
  `02-dades-inicials.sql`. No és idempotent.
- `backend/database/sql/migrations/add-question-slider-fields.sql` — per a bases
  antigues: converteix `resposta_correcta` a `DOUBLE`, afegeix
  `min_value`/`max_value`/`step_value` (primer `NULL`), calcula el `step` segons
  la unitat i un rang determinista per `id`, els fa `NOT NULL` i crea
  `chk_pregunta_slider`.
- `backend/database/sql/migrations/dynamic-difficulties.sql` — amplia
  `dificultat` a `VARCHAR(32)` a `pregunta` i `partida`.
- `ensureInitialCatalog()` — seeder en codi, idempotent via `INSERT IGNORE` i
  comprovació de `COUNT(*) = 0`. En una BD amb `dades-inicials.sql` no importa
  res (§4.1).

### 6.3 Codis d'error

| Codi | HTTP | Font |
|---|---|---|
| `INVALID_NUM_QUESTIONS` | 400 | `preguntas.validator.js` |
| `INVALID_CATEGORY` | 400 | `preguntas.validator.js` |
| `INVALID_DIFFICULTY` | 400 | `preguntas.validator.js` |
| `CATEGORY_NOT_FOUND` | 404 (joc) / 400 (admin) | controlador i repositori |
| `NO_QUESTIONS_FOUND` | 404 | controlador |
| `INTERNAL_ACCESS_NOT_CONFIGURED` | 503 | `requireInternalService.js` |
| `INTERNAL_ACCESS_DENIED` | 403 | `requireInternalService.js` |
| `INTERNAL_ERROR` | 500 | `errorHandler.js` (quan l'error no porta `code`) |
| `QUESTION_INVALID` | 400 | `validatePreguntaInput` |
| `QUESTION_TEXT_REQUIRED` | 400 | `validatePreguntaInput` |
| `QUESTION_CATEGORY_REQUIRED` | 400 | `validatePreguntaInput` |
| `QUESTION_ANSWER_INVALID` | 400 | `validatePreguntaInput` |
| `QUESTION_SLIDER_RANGE_INVALID` | 400 | `validatePreguntaInput` |
| `QUESTION_DIFFICULTY_INVALID` | 400 | `validatePreguntaInput` |
| `QUESTION_EXPLANATION_REQUIRED` | 400 | `validatePreguntaInput` |
| `QUESTION_NOT_FOUND` | 400 | repositori CRUD |
| `CATEGORY_NAME_REQUIRED` | 400 | `validateCategoriaInput` |
| `CATEGORY_ALREADY_EXISTS` | 400 | repositori CRUD |
| `CATEGORY_HAS_QUESTIONS` | 400 | hook `beforeDestroy` de `Categoria` |
| `QUESTIONS_FILE_ERROR` | 500 (arrencada/CLI) | `loadQuestions.js` |

Notes:

- Tots els codis d'admin viatgen amb HTTP `400` (també `QUESTION_NOT_FOUND` i
  `CATEGORY_NOT_FOUND`), perquè cada handler fa `catch` i respon `400` fix.
- Els errors de Sequelize (`SequelizeUniqueConstraintError`,
  `SequelizeValidationError`) i de MySQL **no porten `code`** a `error.code`
  (Sequelize el deixa a `error.parent.code`), així que la resposta d'admin surt
  sense camp `code` i només amb `reason`.
- `ER_DUP_ENTRY` no es tradueix; en categories la duplicació es detecta abans
  amb un `findOne` (`CATEGORY_ALREADY_EXISTS`), però una cursa concurrent encara
  podria arribar a l'error cru.
- `errorHandler` només s'usa a les rutes de joc (`asyncHandler`); les rutes
  d'admin no hi arriben mai.
- Els missatges exactes dels validadors del joc són: `"numQuestions ha de ser un
  enter positiu major que 0"`, `"category ha de ser un text no buit"` i
  `"difficulty ha de tenir entre 1 i 32 caràcters"`.

---

## 7. Configuració i arrencada

Variables (noms; valors mai documentats aquí):

```dotenv
PORT=3001
DB_HOST=mariadb
DB_PORT=3306
DB_USER=root
DB_PASSWORD=***
DB_NAME=howmuch
INTERNAL_SECRET=***
```

El `.env` real del servei només conté `PORT` i `INTERNAL_SECRET`; la resta
arriba per `environment` de `docker-compose.yml`. Atenció: **`npm start` no
carrega `.env`** (`start` és `node src/server.js`, sense `--env-file`); en local
cal exportar les variables o usar Docker/Compose. A Docker sí que arriben per
`env_file`.

Comandes reals:

```bash
# Des del directori backend/catalog-service
npm install
npm start                       # node src/server.js (port 3001 fix)
npm run dev                     # node --watch src/server.js
npm test                        # node --test (no hi ha cap test al servei)
npm run import:questions        # node src/cli/importQuestions.js (JSON per defecte)
npm run import:questions -- ../database/preguntas/preguntas.json
```

`npm run import:questions` escriu `{ imported, updated, skipped, rejected }` per
stdout i tanca la connexió Sequelize; els rebutjos es poden llegir a
`rejected[].errors`. No hi ha script de seed ni de migració: els SQL
s'executen a mà amb el client de MariaDB.

```bash
# Amb Docker (des de l'arrel del repo)
docker compose up -d --build catalog-service
docker compose logs -f catalog-service
```

Comprovació manual:

```bash
curl -H "x-internal-secret: $INTERNAL_SECRET" http://localhost:3001/internal/catalog/options
```

`docker-compose.yml`: servei `catalog-service`, `container_name`, build des de
`./backend/catalog-service`, `expose: 3001` **i** `ports: 3001:3001`, xarxa
`tr1-network`, `restart: unless-stopped`, `env_file:
./backend/catalog-service/.env` i `environment` amb `DB_HOST=mariadb`,
`DB_PORT=3306`, `DB_USER=root`, `DB_PASSWORD=root`, `DB_NAME=howmuch`. **No té
`depends_on`, ni healthcheck, ni `INTERNAL_SECRET` a `environment`**: el secret
surt del `.env` del servei. Si MariaDB no està a punt, el procés mor i el
`restart` el torna a aixecar. El `frontend` (`client-vue`) té `catalog-service`
al seu `depends_on`.

---

## 8. Fitxers clau

| Path | Responsabilitat |
|---|---|
| `src/server.js` | Punt d'entrada; seed inicial i `listen(3001)`. |
| `src/app.js` | Composició d'Express: CORS manual, `express.json()`, `registre`, muntatge de routers i `errorHandler`. |
| `src/middleware/requireInternalService.js` | Porta d'accés: compara `x-internal-secret` amb `timingSafeEqual`. |
| `src/middleware/registre.js` | Insereix a `registre` després de cada resposta, sense bloquejar. |
| `src/middleware/errorHandler.js` | Normalitza errors a `{ error: { code, message } }`. |
| `src/questions/preguntas.routes.js` | Declara les dues rutes de joc. |
| `src/questions/preguntas.validator.js` | Validació del body de `POST /preguntas/get`. |
| `src/questions/preguntas.controller.js` | Tradueix `null`/llista buida a 404 i retorna `{ questions }`. |
| `src/questions/preguntas.repository.js` | Cor de dades: opcions, selecció aleatòria, validació d'input i CRUD. |
| `src/questions/importQuestions.js` | Importació transaccional idempotent (parcial) des de JSON. |
| `src/cli/importQuestions.js` | Entrada CLI de la importació (`package.json` → `import:questions`); imprimeix el resultat i tanca Sequelize. |
| `src/questions/loadQuestions.js` | Resolució de la ruta del JSON i lectura. |
| `src/questions/validarPregunta.js` | Validador de pregunta per a la importació (retorna `{ valid, errors }`). |
| `src/admin/admin.routes.js` | CRUD intern; aplica `requireInternalService` a tot el router. |
| `src/db/sequelize.js` | Connexió Sequelize, models i hooks (trim, bloqueig d'esborrat de categoria). |
| `src/db/pool.js` | Pool `mysql2` per a consultes ràpides i `registre`. |
| `Dockerfile` | Imatge de producció. |

---

## 9. Riscos i punts febles (basats en el codi)

1. **Dos accessos a BD amb configuracions per defecte diferents.** `sequelize.js` fa fallback a `localhost` i password buit; `pool.js` fa fallback a `mariadb` i `root`. Si s'executa `npm start` fora de Docker sense `DB_*`, les consultes `pool` i les de Sequelize poden apuntar a servidors diferents. A Docker no passa perquè el compose injecta `DB_*`.
2. **`PORT` s'ignora.** `server.js` té `const PORT = 3001`. Canviar `PORT` a `.env` no té cap efecte i el contenidor quedaria inconsistent amb el mapping.
3. **Validació duplicada i divergent.** `validarPregunta.js` (import) i `validatePreguntaInput` (CRUD) implementen les mateixes regles amb toleràncies diferents (p. ex. `validarPregunta` no comprova `categoria_id` obligatori, `validatePreguntaInput` sí; límits de longitud de TEXT només a l'import). Una pregunta pot entrar per una via i ser rebutjada per l'altra.
4. **La reimportació no actualitza text, unitat, dificultat ni explicació.** `importQuestions` només sincronitza `resposta_correcta`/`min`/`max`/`step` quan la fila existeix (clau `categoria_id + text`). Corregir una explicació o una unitat al JSON no té efecte.
5. **Seed en arrencada no és segur amb rèpliques.** `INSERT IGNORE` + `COUNT(*)` + import pot duplicar treball o competir si s'aixequen diverses instàncies alhora. El `findOrCreate` de la importació alleugereix però no elimina la cursa.
6. **`ORDER BY RAND()`** fa filesort complet de `pregunta`. Amb 254 files és irrellevant; a partir de desenes de milers serà el coll d'ampolla.
7. **El log d'accés no té límit ni backpressure.** Cada resposta (incloent-hi 401/403/404 i rutes inexistents) obre una consulta `INSERT` fire-and-forget. Si `registre` falla o la BD va lenta, només s'imprimeix un error i les promeses s'acumulen; no hi ha mostreig, ni purga, ni índex per `servei`.
8. **Errors d'admin aplanats a 400.** Tots els `catch` de `admin.routes.js` responen 400, incloent-hi errors de BD que haurien de ser 500. Els errors de Sequelize porten el codi SQL a `error.parent.code`, no a `error.code`, així que el camp `code` sol sortir absent i el client només veu `reason`.
9. **CORS massa restrictiu i incomplet.** Només s'accepta origen `localhost:5173`/`5174`, i els mètodes anunciats són `GET,POST,PATCH,OPTIONS`: falta `DELETE`. Avui no afecta perquè el navegador no crida el catalog directament, però qualsevol accés directe des del panell trencaria els preflight de DELETE.
10. **`express.json()` sense `limit` explícit** (100 kB per defecte). És adequat
    perquè les preguntes individuals són petites, però un text+explicació molt
    llargs donarien `413` amb el JSON de `errorHandler` (`code:
    "INTERNAL_ERROR"` i el missatge cru del parser), no amb un codi propi.
11. **Timeout només al consumidor d'opcions.** `catalogOptions.js` usa `AbortSignal.timeout(5000)`, però `fetchQuestions.js` no té timeout: si el catalog es penja en `POST /preguntas/get`, l'inici de partida queda bloquejat indefinidament.
12. **`npm test` no prova res.** El script existeix i no hi ha cap fitxer `*.test.js` al servei; els únics tests relacionats són del consumidor (`backend/game-service/src/catalog/catalogOptions.test.js`).
13. **Col·lisió potencial de prefix de rutes.** `app.js` munta `/internal/admin` abans de `/internal`, cosa necessària perquè `adminRoutes` no hereta el middleware del router de joc; l'ordre està comentat al codi i és correcte, però és fràgil davant de futurs canvis de muntatge.
14. **`npm start` no llegeix `.env`.** El script és `node src/server.js` (sense
    `--env-file-if-exists`), així que en local `PORT` i `INTERNAL_SECRET` del
    `.env` no s'apliquen; sense `INTERNAL_SECRET` exportat, totes les rutes
    `/internal*` responen `503`. Dins Docker no passa perquè `env_file` injecta
    les variables.
15. **El seed automàtic no carrega el catàleg complet.** Amb
    `dades-inicials.sql` hi ha 31 preguntes i `COUNT(*) > 0`, així que
    `ensureInitialCatalog()` no importa les 254 del JSON. El catàleg real de
    producció depèn d'executar el CLI a mà.
16. **`numQuestions` no té sostre.** El validador només exigeix enter > 0; un
    client intern pot demanar un `LIMIT` enorme i forçar un `ORDER BY RAND()`
    sobre tota la taula.
17. **Esborrar una pregunta usada en una partida deixa anar un error cru.** Si
    `ronda` la referencia, la FK `ON DELETE RESTRICT` fa fallar el `destroy` i
    l'admin rep `400` amb el missatge de MySQL, sense codi propi.
18. **Respostes de `POST`/`PATCH` sense relació carregada.** Només els `GET`
    inclouen `categoria`/`preguntas`; `createQuestion` i `updateQuestion`
    retornen la instància sense `include`, així que el panell no pot assumir la
    mateixa forma en tots els casos.

---

*Document generat a partir del codi. No s'ha modificat cap fitxer de codi del projecte.*
