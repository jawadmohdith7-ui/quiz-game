# stats-service — Documentació tècnica

> Basat en el codi de `backend/stats-service/` (commit `a3cf236`). No s'ha executat el servei; tot el que segueix és evidència de codi.
>
> Revisió de completesa (2026-11-21): s'han afegit el contracte exacte de cada ruta, l'alineació real dels buckets de `usage`, l'inventari de qui escriu cada taula (§6.5) i la duplicitat de mètriques amb `auth-service`. Les afirmacions corregides es llisten a §9.12; el que no s'ha pogut verificar està marcat **〔no verificat〕**.

---

## 1. Resum i responsabilitat

`stats-service` és un microservei REST (Express) sense estat propi que llegeix i escriu a la base de dades compartida MariaDB `howmuch`. Responsabilitats:

| Responsabilitat | Origen |
|---|---|
| Registrar el resultat d'una partida per jugador (el crida **game-service** al final de cada partida) | `POST /stats/partides` |
| Estadístiques del perfil del jugador autenticat + historial de les 30 darreres partides | `GET /stats/me` |
| Rànquing global de jugadors | `GET /stats/ranking` |
| Estadístiques agregades per al panell d'administració (totals, per sala) | `GET /internal/admin/estadistiques` |
| Percentatge d'encerts/errors HTTP a partir de la taula `registre` | `GET /internal/admin/registre` |
| Sèries temporals d'usuaris i partides (període actual vs. anterior) per als gràfics | `GET /internal/admin/usage` |
| Auditoria passiva: cada resposta HTTP que passa pel middleware s'insereix a `registre` | `src/middleware/registre.js` |

El servei **no crea l'esquema**: només fa `sequelize.authenticate()` a l'arrencada; l'esquema el crea `backend/database/sql/schema.sql` (muntat a l'entrypoint de MariaDB a `docker-compose.yml`, per tant només s'executa amb el volum `mariadb_data` buit).

També **no llegeix** les taules del joc viu (`partida`, `participant`, `ronda`, `resposta`): només treballa amb `partides`, `usuaris` i `registre`. Les mètriques calculades a partir de les taules de joc les dona `auth-service` (`GET /stats/:id`), que és una segona font de veritat (vegeu §6.5 i §9.11).

---

## 2. Stack i dependències

`package.json`:

| Dependència | Versió | Ús real al codi |
|---|---|---|
| `express` | ^4.19.2 | Servidor HTTP i routers |
| `sequelize` | ^6.37.3 | ORM, `fn/col/literal`, `sequelize.query`, `QueryTypes` |
| `mysql2` | ^3.11.0 | Driver del dialecte `mysql` |
| `jsonwebtoken` | ^9.0.2 | `jwt.verify` amb `HS256` |
| `cors` | ^2.8.5 | `app.use(cors())` sense opcions (obert) |
| `overrides.uuid` | ^11.1.1 | Pin de seguretat |

- `"type": "module"` → tot el codi és ESM (`import`/`export`).
- Només hi ha els scripts `start` i `test`: **no** hi ha `dev`, `lint` ni `build`.
- **No** s'utilitza `moment` ni cap altra llibreria de dates: els períodes es calculen amb `Date` de JS i `TIMESTAMPDIFF`/`DATE_SUB` de MySQL.
- `npm test` → `node --test`, però **no hi ha cap fitxer de test** al directori (vegeu §9.7).
- No hi ha `nodemon`/`dotenv`: l'`.env` es carrega amb el flag natiu `node --env-file-if-exists=.env`. Aquest flag concret existeix des de Node **20.19 / 22.9** (el `--env-file` bàsic és de 20.6): la imatge `node:20-alpine` és flotant i avui el suporta, però un Node local anterior a 20.19 falla en arrencar amb `bad option`.

---

## 3. Estructura de fitxers

```
backend/stats-service/
├── .env                     # variables reals (no versionat): PORT, DB_*, AUTH_SECRET, INTERNAL_SECRET
├── .env.example             # plantilla de les mateixes variables
├── .gitignore
├── Dockerfile               # node:20-alpine, npm install --omit=dev, EXPOSE 3012
├── package.json             # scripts start/test i dependències
├── package-lock.json
├── README.md                # una línia, desactualitzada (parla de /api/stats i CSV)
├── server.js                # arrenca Express, middleware, munta routers, reintents de BD
└── src/
    ├── db.js                # instància única de Sequelize (dialecte mysql)
    ├── auth.middleware.js   # verifyInternalService (x-internal-secret) i verifyToken (JWT HS256)
    ├── stats.routes.js      # rutes públiques/JWT: POST /partides, GET /me, GET /ranking
    ├── admin/
    │   └── admin.routes.js  # rutes /internal/admin: estadistiques, registre, usage + càlcul de sèries
    ├── middleware/
    │   └── registre.js      # res.on("finish") → INSERT a la taula registre
    └── models/
        ├── Partida.js       # model Sequelize de la taula partides (timestamps:false)
        └── Usuari.js        # model Sequelize de la taula usuaris (timestamps:false)
```

No hi ha carpetes `tests/`, `routes/` ni `config/`: la configuració és 100% per variables d'entorn.

Detalls del contingut:

- `.gitignore` conté només `.env`; `.env.example` és la plantilla (valors `root`/`root`, secrets de farciment).
- El `Dockerfile` **no** copia l'`.env` (només `src/` i `server.js`): dins del contenidor les variables arriben de `docker-compose.yml`; l'`.env` només s'usa en arrencar amb `npm start` fora de Docker.
- No hi ha cap fitxer de test ni cap `*.test.js` (vegeu §9.7).

---

## 4. Flux principal pas a pas

### 4.1 Arrencada (`server.js`)

1. `app.use(cors())` i `app.use(express.json())`.
2. `GET /health` respon `{ ok: true, service: "stats-service" }` (**abans** del middleware de registre, així que no s'audita).
3. `app.use(registre("stats"))` → cada resposta posterior s'insereix a `registre` (fire-and-forget).
4. `app.use("/internal/admin", adminRoutes)` i `app.use("/stats", statsRoutes)`.
5. `start()`: bucle de fins a **20 intents** amb 1 s d'espera; `sequelize.authenticate()`; si connecta, `app.listen(PORT)` (per defecte **3012**); si s'esgota, `process.exit(1)`.

Ordre rellevant: `cors()` i `express.json()` es munten **abans** del middleware de registre. Per tant:

- els preflight `OPTIONS` que resol `cors()` i els `400` de `body-parser` per JSON mal format **no** s'auditen a `registre`;
- qualsevol altra petició, incloses les rutes desconegudes (404 per defecte d'Express), sí que s'audita, perquè el middleware és a nivell d'app;
- el `listen()` no té callback d'error: un `EADDRINUSE` acaba en excepció no capturada (procés mort), no en reintent.

### 4.2 Registre d'una partida (game-service → stats-service)

1. En acabar la partida, `backend/game-service/src/game/roundEvents.js` crida `reportGameStats(...)` sense bloquejar el final de partida.
2. `reportStats.js` mapa `nickname → userId` dels jugadors registrats i, per a cada entrada del rànquing amb `userId`, fa un `POST ${STATS_URL}/stats/partides` amb `x-internal-secret` i el cos `{ userId, nomSala, posicio, encerts, rondes }`. Els errors només s'escriuen a `console.error` (sense reintents).
3. `stats.routes.js` valida el cos (vegeu §5.2), neteja `nomSala`/`categoria` (`trim().slice(0,100)`, valors per defecte `"Sala Pública"` / `"General"`) i fa `Partida.create(...)`.
4. Resposta `201 { ok: true, partidaId }`.

Matisos del contracte real:

- `reportStats.js` **no envia `categoria`** (només `userId`, `nomSala`, `posicio`, `encerts`, `rondes`), així que a la pràctica totes les files queden amb `categoria = 'General'` i el gràfic/filtre per categoria de `partides` no aporta informació.
- `reportStats.js` no comprova `resposta.ok`: un `400`/`500` del servei no es distingeix d'un èxit; només els errors de xarxa (`fetch` rebutjat) arriben al `catch`.
- Les peticions són **seqüencials** (un `await` per jugador) i sense reintents; si un jugador falla, els segueixen els altres.
- El mapa `nickname → userId` surt de `room.players` (no de `room.gamePlayers`): un jugador que va sortir de la sala abans del final no es reporta encara que hagués jugat la partida.

### 4.3 Estadístiques de perfil (`GET /stats/me`)

Tres consultes independents, totes filtrades per `usuari_id = req.user.userId` (extret del JWT, mai del query string):

1. **Resum**: `COUNT(id)`, `SUM(posicio = 1)` → victòries, `SUM(posicio IN (2,3))` → podis, `ROUND(AVG(encerts), 2)`.
2. **Categoria top**: `GROUP BY categoria`, `ORDER BY vegades DESC`, `LIMIT 1`.
3. **Historial**: darreres 30 partides (`ORDER BY data_partida DESC`), camps `nomSala`, `categoria`, `posicio`, `data`.

Derivats calculats a JS: `derrotes = partidesJugades - victories`, `percentatgeVictories = round(victories/partidesJugades*1000)/10`.

Detalls que el codi fixa i que no són evidents:

- El resum és una única consulta agregada **sense `GROUP BY`** (Sequelize la genera amb `Partida.findAll`): retorna exactament una fila encara que l'usuari no tingui partides.
- `mitjanaEncerts` és `ROUND(AVG(encerts), 2)`; `podis` compta `posicio IN (2,3)` i **no** inclou la victòria.
- La categoria top desempata **sense criteri**: `ORDER BY vegades DESC` i prou (`findOne` afegeix `LIMIT 1`). Amb dues categories empatades, la triada és la que retorni MySQL.
- L'historial **no té paginació** (`limit: 30` fix) i no retorna `id` ni `rondes`.
- No es verifica que l'usuari existeixi: com que `partides` no té FK, un `sub` de JWT vàlid per a un usuari esborrat retorna el perfil a zero.

### 4.4 Rànquing (`GET /stats/ranking`)

SQL cru amb paràmetre `LIMIT ?` (safe): `INNER JOIN usuaris u ON u.id = p.usuari_id`, agrupat per usuari, ordenat per `victories DESC, podis DESC, encertsTotals DESC, partidesJugades DESC, u.nom ASC`. Afegeix `posicioRanking` a JS i converteix els camps **numèrics** amb `Number()` (MySQL retorna `COUNT`/`SUM` com a string en alguns casos; `username`/`avatarColor` es deixen tal qual).

- Només hi ha `limit` (1..50, per defecte 10): **no hi ha `offset` ni paginació**; el rànquing sempre comença al número 1.
- L'`INNER JOIN` exclou usuaris sense cap fila a `partides` (no apareixen amb zero) i també files òrfenes (`usuari_id` que ja no existeix).
- La clau de desempat final és `u.nom ASC`, que és únic a `usuaris`; per tant l'ordre és determinista.

### 4.5 Càlcul de les sèries de `/internal/admin/usage` (nucli)

`dadesPeriode(periode)` fixa la finestra:

| `periode` | `punts` | `unitat` (TIMESTAMPDIFF) | `dies` | `etiquetaActual` | `etiquetaAnterior` |
|---|---|---|---|---|---|
| `"dia"` (per defecte) | 24 | `HOUR` | 1 | `Avui` | `Ahir` |
| `"setmana"` | 7 | `DAY` | 7 | `Aquesta setmana` | `Setmana anterior` |
| `"mes"` | 30 | `DAY` | 30 | `Aquest mes` | `Mes anterior` |
| qualsevol altre valor | es tracta com `"dia"` (silenciosament) | | | | |

Finestres **mòbils** respecte de `new Date()` (no són setmanes/mesos de calendari):

```
iniciActual   = ara - dies * 24 h        (24 h, 7 dies o 30 dies)
iniciAnterior = ara - 2 * dies * 24 h
```

`seriePerInterval(taula, camp, inici, punts, unitat)` executa:

```sql
SELECT TIMESTAMPDIFF(<unitat>, ?, <camp>) AS etiqueta, COUNT(*) AS total
FROM <taula>
WHERE <camp> >= ?
GROUP BY etiqueta
ORDER BY etiqueta
```

- El primer `?` és `inici` i dona la **posició del bucket** (0 = primer punt de la finestra); el segon filtra. Tots dos reben el mateix valor (`replacements: [inici, inici]`).
- Es crea un array de `punts` zeros i cada fila s'escriu a `valors[index]` només si `0 <= index < punts`. Com que el `GROUP BY` és per `etiqueta`, cada índex s'escriu una sola vegada (no cal sumar).
- Els buckets són **blocs sencers de `unitat` comptats des de l'instant exacte de la consulta**, no hores/dies de rellotge: `TIMESTAMPDIFF(HOUR, ara-24h, camp)` dona 0 per a `[ara-24h, ara-23h)` i 23 per a `[ara-1h, ara)`. Per a `setmana`/`mes` els talls de dia són a l'hora exacta de la consulta (p. ex. 14:37 → 14:37). No hi ha buckets parcials; les files amb timestamp `>= ara` cauen fora del rang (`index >= punts`) i es descarten.
- La sèrie "anterior" es consulta amb `iniciAnterior` i **sense límit superior**: les files del període actual cauen en índexs `>= punts` i es descarten pel filtre anterior. La finestra [ara-2·dies, ara-dies) ocupa els índexs 0..`punts-1`, així que és comparable posició a posició.
- Els arrays `actual`/`anterior` estan alineats **per posició relativa** (índex 0 = inici de cada finestra), no per hora ni data: l'índex 10 d'`actual` i el 10 d'`anterior` són el mateix desplaçament dins de la seva finestra, no la mateixa hora del dia.
- Es fan **4 consultes**: usuaris actual/anterior (`usuaris.data_creacio`) i partides actual/anterior (`partides.data_partida`), una darrere l'altra (no en paral·lel).
- Una resposta per a `periode=dia` conté 24 punts per sèrie; per a `setmana`/`mes`, 7/30. Sense files, tots els arrays són zeros.
- La resposta **no** inclou dates ni etiquetes de l'eix X: només els dos noms de sèrie (`etiquetaActual`/`etiquetaAnterior`).

### 4.6 Registre HTTP i percentatges (`GET /internal/admin/registre`)

1. `periode` ∈ `{avui|setmana|mes}` → `dies` ∈ `{1,7,30}` (qualsevol altre valor ⇒ 1), però el valor original es **retorna tal qual** a `periode` sense normalitzar.
2. `SELECT estat, COUNT(*) FROM registre WHERE creat_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY estat`.
3. A JS: `estat < 400` compta com a encert (inclou 1xx/2xx/3xx), la resta com a error. Percentatges amb `Math.round(x*10)/10` (1 decimal) i `0` si `total === 0` (no `NaN`).

La finestra és mòbil (`NOW() - dies`), no "avui des de les 00:00". El rellotge que mana és el del servidor MariaDB (`NOW()`), no el de Node.

`POST /stats/partides` també queda auditat pel middleware (`servei='stats'`, `metode`, `ruta`, `estat`), igual que `/stats/me` i `/stats/ranking`, però no `/health`. `ruta` és `req.path` (sense query string), així que `?periode=...`/`?limit=...` no es desen. `creat_at` l'omple el `DEFAULT CURRENT_TIMESTAMP` de la taula (no el middleware).

---

## 5. Contracte de comunicació

### 5.1 Taula de rutes

| Mètode | Path | Auth | Query params | Èxit |
|---|---|---|---|---|
| GET | `/health` | cap | — | `200 { ok, service }` |
| POST | `/stats/partides` | `x-internal-secret` (només serveis) | — | `201 { ok, partidaId }` |
| GET | `/stats/me` | `Authorization: Bearer <JWT>` | — | `200 { ok, perfil, historial }` |
| GET | `/stats/ranking` | **cap** | `limit` enter 1..50 (def. 10) | `200 { ok, ranking: [] }` |
| GET | `/internal/admin/estadistiques` | `x-internal-secret` **+** `Bearer <JWT>` | `sala` (string, opcional) | `200 { ok, general, sales }` |
| GET | `/internal/admin/registre` | `x-internal-secret` **+** `Bearer <JWT>` | `periode` (`avui`\|`setmana`\|`mes`, def. `avui`) | `200 { ok, periode, total, encerts, errors, percentatgeEncerts, percentatgeErrors }` |
| GET | `/internal/admin/usage` | `x-internal-secret` **+** `Bearer <JWT>` | `periode` (`dia`\|`setmana`\|`mes`, def. `dia`) | `200 { ok, usage }` |

Notes d'autenticació (`src/auth.middleware.js`):

- Ordre a `/internal/admin`: `verifyInternalService` → `verifyToken`. Sense `INTERNAL_SECRET` tota la branca respon **503** abans de mirar el JWT.
- `verifyInternalService`: sense `INTERNAL_SECRET` configurat → **503** `{ ok:false, error:"Accés intern no configurat." }`. Capçalera absent, no-string o mida diferent → **403** `{ ok:false, error:"Accés denegat: només game-service pot registrar partides." }` (el mateix text també a `/internal/admin/*`, on és enganyós). Comparació amb `crypto.timingSafeEqual`.
- `verifyToken`: sense `AUTH_SECRET` → **503** `{ ok:false, error:"Autenticació no configurada." }`. Sense capçalera o sense prefix `Bearer ` → **401** `"Falta el token d'autenticació."`. Token expirat → **401** `"El token ha caducat."`. Signatura/intepr. → **401** `"Token manipulat o invàlid."`. El subject ha de ser `Number.isSafeInteger(payload.sub)` i `>= 1`; després `req.user = { userId, username }` (`username` pot ser `undefined`, no es valida).
- El token s'accepta només amb `algorithms: ["HS256"]`; no es mira `exp` més enllà del que fa `jwt.verify` ni cap camp de rol.
- `/internal/admin` aplica **els dos** middlewares a nivell de router: el secret primer i el JWT després. Si el JWT no és d'un admin, aquest servei **no ho comprova** (no mira rols): només valida signatura i `sub`. La comprovació d'admin viu a game-service (`comprovaTokenAdmin`), que és l'únic que té la ruta interna exposada cap al client.
- No hi ha cap 404 ni error handler en JSON: una ruta desconeguda (també sota `/internal/admin`, després de passar els middlewares) retorna el 404 HTML per defecte d'Express. Aquestes respostes sí que queden a `registre`.

### 5.2 `POST /stats/partides` — cos i validació

```json
{
  "userId": 12,
  "nomSala": "Sala de prova",
  "categoria": "Història",
  "posicio": 1,
  "encerts": 7,
  "rondes": 10
}
```

Regles reals:

| Camp | Requisit |
|---|---|
| cos | objecte JSON, no array (si no, 400) |
| `userId` | `number` + enter + `>= 1` |
| `posicio` | `number` + enter + `1..100` |
| `encerts` | `number` + enter + `0..100` |
| `rondes` | `number` (per defecte `0`) + enter + `0..100`; si `rondes > 0`, aleshores `encerts <= rondes` |
| `nomSala` | opcional; `trim().slice(0,100)`; buit ⇒ `"Sala Pública"` |
| `categoria` | opcional; `trim().slice(0,100)`; buit ⇒ `"General"` |

Resposta:

```json
{ "ok": true, "partidaId": 341 }
```

Errors: `400 { ok:false, error }` (missatges en català, p. ex. `"rondes invàlid."`), `403` o `503` dels middlewares, `500 { ok:false, error:"Error intern al guardar la partida." }`.

Precisions de validació:

- Missatge del primer `400`: `"userId, posicio i encerts han de ser números."` encara que també comprova `typeof rondes`; el de `posicio` diu `">= 1"` però el rang real és `1..100`; el d'`encerts` diu `">= 0"` però el rang real és `0..100`.
- `rondes` s'accepta com a `0` amb `encerts > 0` (la condició és `encerts > rondes && rondes > 0`): `0` no té significat definit al codi.
- Camps desconeguts del cos s'ignoren; no es fa cap comprovació d'existència de l'usuari ni de coherència `posicio <= nombre de jugadors`.
- Sense `Content-Type: application/json` o sense cos, `express.json()` deixa `req.body = {}` i la petició cau al `400` de tipus (no al primer control d'array).
- Si l'INSERT falla, el `catch` retorna el `500` genèric i la fila no es crea. (La columna `rondes` ja existeix a `schema.sql`; vegeu §9.1.)

### 5.3 `GET /stats/me`

```json
{
  "ok": true,
  "perfil": {
    "partidesJugades": 42,
    "victories": 11,
    "derrotes": 31,
    "percentatgeVictories": 26.2,
    "podis": 19,
    "mitjanaEncerts": 5.43,
    "categoriaMesJugada": "Història"
  },
  "historial": [
    {
      "nomSala": "Sala de prova",
      "categoria": "Història",
      "posicio": 1,
      "data": "2026-11-20T18:12:44.000Z"
    }
  ]
}
```

- Sense partides: `perfil` amb zeros, `mitjanaEncerts: 0`, `categoriaMesJugada: null`, `historial: []` (el `SUM` pot retornar `null`, convertit amb `Number(... || 0)`).
- `historial[].data` és un `Date` de Sequelize serialitzat en ISO-8601 UTC (`...Z`). No s'inclou `id`, `encerts` ni `rondes`.
- `partidesJugades` és `COUNT(id)` de `partides`, no de les taules de joc: si `POST /stats/partides` falla (§9.1), el perfil queda a zero encara que la partida s'hagi jugat.
- Errors: `401`/`503` de `verifyToken`, `500 { ok:false, error:"Error intern al obtenir estadístiques." }`.

### 5.4 `GET /stats/ranking?limit=10`

```json
{
  "ok": true,
  "ranking": [
    {
      "posicioRanking": 1,
      "userId": 7,
      "username": "laia",
      "avatarColor": "#f97316",
      "partidesJugades": 33,
      "victories": 14,
      "podis": 10,
      "encertsTotals": 201
    }
  ]
}
```

Consulta literal (`stats.routes.js:135-150`):

```sql
SELECT u.id AS userId, u.nom AS username, u.avatar_color AS avatarColor,
       COUNT(p.id) AS partidesJugades,
       SUM(CASE WHEN p.posicio = 1 THEN 1 ELSE 0 END) AS victories,
       SUM(CASE WHEN p.posicio IN (2, 3) THEN 1 ELSE 0 END) AS podis,
       SUM(p.encerts) AS encertsTotals
FROM partides p
INNER JOIN usuaris u ON u.id = p.usuari_id
GROUP BY u.id, u.nom, u.avatar_color
ORDER BY victories DESC, podis DESC, encertsTotals DESC, partidesJugades DESC, u.nom ASC
LIMIT ?
```

Errors: `400 { ok:false, error:"limit ha de ser un enter entre 1 i 50." }` (també si `limit` no és numèric, si és `limit=0`, negatiu, decimal o `> 50`), `500 { ok:false, error:"Error intern al obtenir el ranking." }`.

### 5.5 `GET /internal/admin/estadistiques[?sala=...]`

```json
{
  "ok": true,
  "general": { "partides": 128, "jugadors": 24, "encerts": 5.8125 },
  "sales": [
    { "nom_sala": "Sala de prova", "partides": 40, "jugadors": 9, "encerts": 6.1 }
  ]
}
```

- Sense `sala`: una fila per sala (`GROUP BY nom_sala ORDER BY partides DESC`).
- Amb `sala`: només aquella sala (paràmetre enllaçat, `WHERE nom_sala = ?`), **sense `ORDER BY`** (una sola fila). El valor no es fa `trim()`: un espai de més fa que no trobi res.
- `general` **no aplica el filtre `sala`**: sempre és el total global de totes les partides. La vista admin en mostra les targetes com si fossin de la sala filtrada, però no ho són (només la taula `sales` es filtra).
- Els noms de camp provenen directament dels àlies del SQL (`partides`, `jugadors`, `encerts`; `nom_sala` sí que és snake_case) i `AVG` pot arribar com a string decimal: no es normalitzen (a diferència del rànquing).
- Amb la taula `partides` buida, `general` és `{ partides: 0, jugadors: 0, encerts: null }` (`AVG` sobre zero files = `NULL`) i `sales` és `[]`.
- `sala` passa per `String(req.query.sala || "")`: un array (`?sala=a&sala=b`) es converteix en `"a,b"` i no troba res; un valor buit equival a "totes".

SQL literal (`admin.routes.js:162-180`):

```sql
-- general (sempre)
SELECT COUNT(*) AS partides, COUNT(DISTINCT usuari_id) AS jugadors, AVG(encerts) AS encerts FROM partides;
-- sense filtre
SELECT nom_sala, COUNT(*) AS partides, COUNT(DISTINCT usuari_id) AS jugadors, AVG(encerts) AS encerts
FROM partides GROUP BY nom_sala ORDER BY partides DESC;
-- amb filtre
SELECT nom_sala, COUNT(*) AS partides, COUNT(DISTINCT usuari_id) AS jugadors, AVG(encerts) AS encerts
FROM partides WHERE nom_sala = ? GROUP BY nom_sala;
```

Errors: `500 { ok:false, reason: error.message }` — **exposa el text de l'error SQL**.

### 5.6 `GET /internal/admin/registre?periode=avui`

```json
{
  "ok": true,
  "periode": "avui",
  "total": 87,
  "encerts": 79,
  "errors": 8,
  "percentatgeEncerts": 90.8,
  "percentatgeErrors": 9.2
}
```

Errors: `500 { ok:false, reason: error.message }`.

- `periode` no es valida: qualsevol text es retorna tal qual a la resposta i es tracta com `avui` (finestra d'1 dia). `?periode=` (buit) també cau a `avui`.
- `estat` no és mai `NULL` a l'esquema, així que el `GROUP BY estat` no genera cap fila especial; `Number(fila.estat)` s'usa per classificar.
- `total = 0` → `percentatgeEncerts` i `percentatgeErrors` valen `0` (no `NaN`).
- La resposta no porta el detall per estat, només els dos agregats.

### 5.7 `GET /internal/admin/usage?periode=dia`

Estructura exacta retornada per `calculaUsage` dins de `{ ok: true, usage: ... }`:

```
usage = {
  periode,                                 // "dia" | "setmana" | "mes"
  etiquetaActual,                          // "Avui" | "Aquesta setmana" | "Aquest mes"
  etiquetaAnterior,                        // "Ahir" | "Setmana anterior" | "Mes anterior"
  usuaris: { actual: number[], anterior: number[] },
  partides: { actual: number[], anterior: number[] }
}
```

Exemple **il·lustratiu** (no executat; `periode=dia`): 24 posicions, una per bloc d'hora, de la més antiga a la més recent.

```json
{
  "ok": true,
  "usage": {
    "periode": "dia",
    "etiquetaActual": "Avui",
    "etiquetaAnterior": "Ahir",
    "usuaris": {
      "actual":   [0, 0, 1, 0, 0, 0, 2, 3, 0, 0, 0, 0, 1, 0, 0, 0, 4, 2, 0, 0, 0, 1, 0, 0],
      "anterior": [0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0]
    },
    "partides": {
      "actual":   [0, 0, 2, 1, 0, 0, 0, 5, 3, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0],
      "anterior": [0, 0, 1, 0, 0, 0, 3, 2, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]
    }
  }
}
```

Per `setmana` i `mes` els arrays tenen 7 i 30 posicions (una per dia mòbil de 24 h). Errors: `500 { ok:false, reason: error.message }`.

- `usage.periode` **sí** que es normalitza: un valor desconegut retorna `"dia"` (a diferència de `/registre`, que retorna el text original).
- No hi ha etiquetes de dates a la resposta. El frontend (`AdminUsageChart.vue:69-84`) fabrica l'eix X pel nombre de punts: `1h`…`24h` si n'hi ha 24 i `D1`…`Dn` altrament; les úniques etiquetes de l'API són els noms de les dues sèries.
- L'ordre dels arrays és sempre de més antic (índex 0) a més recent (últim índex).

### 5.8 D'interfície: com hi arriben els clients

- **game-service → stats-service** (xarxa Docker, `STATS_URL=http://stats-service:3012`):
  - `src/game/reportStats.js` → `POST /stats/partides` (només `x-internal-secret`, sense JWT).
  - `src/admin/adminClient.js#cridaStats` → `/internal/admin/*` amb **les dues** capçaleres (`x-internal-secret` + `Authorization: Bearer <tokenAdmin>`). Els tipus de missatge WS `admin:estadistiques:get`, `admin:registre:get`, `admin:usage:get` es tradueixen a aquestes rutes a `src/admin/adminRouter.js` (línies 179–213).
- **Vue → stats-service directament** (`VITE_STATS_BASE_URL`, def. `http://localhost:3012`): `src/services/statsApi.js` crida `GET /stats/ranking?limit=n` (sense token) i `GET /stats/me` (amb `Bearer`). `src/views/StatsView.vue` consumeix `ranking` i `perfil`.
- **Vue → game-service → stats-service** (panell admin): `src/services/adminApi.js` (`adminEstadistiquesGet(sala)`, `adminRegistreGet(periode)`, `adminUsageGet(periode)`) envia peticions WS (`admin:estadistiques:get`, `admin:registre:get`, `admin:usage:get`); `adminRouter.js:179-213` les tradueix a `/internal/admin/*` i retorna només els camps que necessita (descarta `periode`). `src/stores/admin.js` desa `general`, `salesStats`, `registre`, `usage`. `AdminDashboardView.vue` passa `etiquetaActual`/`etiquetaAnterior` i `usage.usuaris|partides.actual|anterior` a `AdminUsageChart.vue` (Chart.js), que genera les etiquetes X pel compte de punts (no vénen de l'API); `AdminEstadistiquesView.vue` llegeix `general.partides`, `general.jugadors`, `general.encerts` (sempre globals, encara que hi hagi filtre de sala) i la taula `salesStats`.
- **Duplicitat de mètriques**: `auth-service` exposa `GET /stats/:id` (públic, `authService.js:289-372`) que calcula `gamesPlayed`, `gamesWon`, `answeredQuestions`, `correctAnswers` i `accuracyPercentage` a partir de `partida`/`participant`/`ronda`/`resposta`. El frontend el crida des de `authApi.js:135` per a perfils de tercers, mentre que el perfil propi va a `statsApi.js#getMyStats` (`/stats/me`). Les dues xifres no han de coincidir: una compta files de `partides`, l'altra respostes del joc (vegeu §6.5 i §9.11).

---

## 6. Base de dades

Base `howmuch` (MariaDB 11). El servei en fa servir tres taules:

### 6.1 `partides` (escriptura + lectura)

Definida a `backend/database/sql/schema.sql`:

| Columna | Tipus (schema.sql) | Tipus (model `Partida.js`) | Notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED AUTO_INCREMENT` | `INTEGER.UNSIGNED` | PK; discrepància de tipus (irrellevant sense `sync`) |
| `usuari_id` | `BIGINT UNSIGNED` | `INTEGER.UNSIGNED` | **sense FK** a `usuaris` |
| `nom_sala` | `VARCHAR(100)` | `STRING(100)` | índex `idx_partides_sala` |
| `categoria` | `VARCHAR(100)` def. `'General'` | `STRING(100)` | sense índex |
| `posicio` | `INT UNSIGNED` def. 1 | `INTEGER` | 1 = victòria, 2–3 = podi |
| `encerts` | `INT UNSIGNED` def. 0 | `INTEGER` | |
| `rondes` | `TINYINT UNSIGNED` def. 0 (`schema.sql:173`) | `TINYINT.UNSIGNED` def. 0 | vegeu §9.1 |
| `data_partida` | `DATETIME` def. `CURRENT_TIMESTAMP` | `DATE` def. `NOW` | índex `idx_partides_data`; `DataTypes.DATE` de Sequelize = `DATETIME` a MySQL |

DDL exacte (`schema.sql:160-172`):

```sql
CREATE TABLE IF NOT EXISTS partides (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuari_id BIGINT UNSIGNED NOT NULL,
  nom_sala VARCHAR(100) NOT NULL,
  categoria VARCHAR(100) NOT NULL DEFAULT 'General',
  posicio INT UNSIGNED NOT NULL DEFAULT 1,
  encerts INT UNSIGNED NOT NULL DEFAULT 0,
  data_partida DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_partides_data (data_partida),
  KEY idx_partides_sala (nom_sala),
  KEY idx_partides_usuari (usuari_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

Notes d'alineació:

- **No hi ha cap migració** que toqui `partides`: les dues de `backend/database/sql/migrations/` només alteren `pregunta` i `partida` (joc).
- `partides.usuari_id` és `BIGINT UNSIGNED` i `usuaris.id` és `INT UNSIGNED`: el JOIN funciona, però el rang del primer és més gran que el de la taula referenciada (no hi ha FK que ho impedeixi).
- El model `Partida.js:7-17` declara `rondes` (`INTEGER`, `allowNull:false`, default 0) i `id`/`usuari_id` com a `INTEGER.UNSIGNED`; la resta de columnes coincideixen en nom i tipus. Com que no es fa `sync()`, el model no altera res: només determina l'INSERT.

### 6.2 `usuaris` (només lectura)

`id` (`INT UNSIGNED`, PK), `nom` (VARCHAR 30, UNIQUE), `email` (VARCHAR 255, UNIQUE), `password_hash`, `avatar` (VARCHAR 32), `avatar_image` (LONGTEXT), `avatar_color` (VARCHAR 16), `rol_id` (`BIGINT UNSIGNED`, FK a `rol`), `verificat`, `codi_verificacio`, `codi_expira`, `data_creacio` (DATETIME, def. `CURRENT_TIMESTAMP`). El model `Usuari.js` declara tot això **excepte `rol_id`** — cap consulta del servei llegeix aquestes columnes: el model s'importa només per registrar-lo a Sequelize (`server.js`), i les lectures reals (rànquing, `usage`) van per SQL cru.

Atenció: `schema.sql:138` fa `DROP TABLE IF EXISTS usuaris` abans de tornar-la a crear. Si algú re-executa l'esquema sobre una BD amb dades, **esborra tots els usuaris** però conserva `partides` i `registre` (no hi ha FK) → totes les partides queden òrfenes i desapareixen del rànquing. L'entrypoint de MariaDB només l'executa amb el volum buit, així que en ús normal no passa.

### 6.3 `registre` (escriptura + lectura)

| Columna | Tipus | Origen |
|---|---|---|
| `id` | `BIGINT UNSIGNED` PK | |
| `servei` | `VARCHAR(30)` | middleware: literal `"stats"` |
| `metode` | `VARCHAR(10)` | `req.method` |
| `ruta` | `VARCHAR(200)` | `req.path` |
| `estat` | `SMALLINT UNSIGNED` | `res.statusCode` |
| `creat_at` | `DATETIME` def. `CURRENT_TIMESTAMP` | índexs `idx_registre_data`, `idx_registre_estat` |

- El middleware només envia 4 columnes: `creat_at` l'omple el `DEFAULT CURRENT_TIMESTAMP` del servidor MariaDB (no el rellotge de Node), i per això depèn de la zona horària de la sessió.
- `ruta` és `VARCHAR(200)`: un `req.path` més llarg fa fallar l'INSERT (l'error només va a `console.error`, la resposta HTTP no es veu afectada).
- No hi ha cap índex per `servei` ni cap procés de purga.

### 6.4 Consultes destacades

| Consulta | Ubicació |
|---|---|
| `COUNT`, `SUM(CASE WHEN posicio = 1 ...)`, `ROUND(AVG(encerts),2)` sobre `partides` filtrat per usuari | `stats.routes.js:74-83` |
| `GROUP BY categoria ORDER BY vegades DESC LIMIT 1` | `stats.routes.js:85-91` |
| `INNER JOIN usuaris` + `GROUP BY u.id` + `LIMIT ?` | `stats.routes.js:135-150` |
| `TIMESTAMPDIFF(HOUR\|DAY, ?, camp)` + `GROUP BY etiqueta` | `admin.routes.js:58-74` |
| `COUNT(*)`, `COUNT(DISTINCT usuari_id)`, `AVG(encerts)` global i per sala | `admin.routes.js:162-180` |
| `SELECT estat, COUNT(*) ... WHERE creat_at >= DATE_SUB(NOW(), INTERVAL ? DAY)` | `admin.routes.js:205-208` |
| `INSERT INTO registre (servei, metode, ruta, estat) VALUES (?,?,?,?)` | `middleware/registre.js:16-22` |

Totes les interpolacions de valors usen `replacements` (paràmetres enllaçats). Només s'interpola text fix del codi (`taula`, `camp`, `unitat`), que són constants del mòdul i mai surten de la petició.

SQL literal de `/stats/me` (generat per Sequelize, `stats.routes.js:74-104`):

```sql
SELECT COUNT(`id`) AS `partidesJugades`,
       SUM(CASE WHEN posicio = 1 THEN 1 ELSE 0 END) AS `victories`,
       SUM(CASE WHEN posicio IN (2, 3) THEN 1 ELSE 0 END) AS `podis`,
       ROUND(AVG(`encerts`), 2) AS `mitjanaEncerts`
FROM `partides` AS `Partida` WHERE `Partida`.`usuari_id` = ?;

SELECT `categoria`, COUNT(`id`) AS `vegades`
FROM `partides` AS `Partida` WHERE `Partida`.`usuari_id` = ?
GROUP BY `categoria` ORDER BY vegades DESC LIMIT 1;

SELECT `nom_sala` AS `nomSala`, `categoria`, `posicio`, `data_partida` AS `data`
FROM `partides` AS `Partida` WHERE `Partida`.`usuari_id` = ?
ORDER BY `data_partida` DESC LIMIT 30;
```

### 6.5 Qui escriu cada taula (contracte d'entrada real)

| Taula | Qui hi escriu | Qui la llegeix |
|---|---|---|
| `usuaris` | `auth-service`: registre i `UPDATE` de perfil; `DELETE FROM usuaris WHERE id = ?` (`authService.js:473`) | stats: `usage` (`data_creacio`), `ranking` (`JOIN`); auth-service |
| `partides` | **només** stats-service: `POST /stats/partides` → `Partida.create` | stats: `/stats/me`, `/stats/ranking`, `/internal/admin/estadistiques` |
| `registre` | stats-service: middleware `registre` | stats: `/internal/admin/registre` |
| `partida`, `participant`, `ronda`, `resposta` | `game-service` en actiu (`roomRepository.js`, `gameRepository.js`) | `auth-service` (`GET /stats/:id`); **stats-service no les llegeix mai** |
| `rol`, `categoria`, `pregunta` | `dades-inicials.sql` (i catalog-service per a preguntes) | no les llegeix stats-service |

Conseqüències:

- El flux complet és: `game-service` desa la partida a `partida`/`participant`/`ronda`/`resposta` i, al final, crida `reportStats.js` perquè creï una fila plana a `partides`. Si aquesta crida falla o el servei està caigut, la partida existeix a les taules de joc però **no** a `partides`: `auth-service /stats/:id` la comptarà i `/stats/me` no.
- `dades-inicials.sql` només sembra `rol`, un usuari `admin`, `categoria` i `pregunta`: no hi ha cap fila de `partides` ni de `registre`, així que en una BD nova tots els gràfics i rànquings surten buits fins que es jugui (i fins que l'INSERT de `partides` funcioni, vegeu §9.1).
- `usuari_id` no té FK i `auth-service` pot esborrar usuaris: les files de `partides` d'un usuari esborrat sobreviuen. Compten a `estadistiques` (no fa JOIN) però no a `ranking` (`INNER JOIN`) i sí a `usage` (només mira `data_partida`).

---

## 7. Configuració i arrencada

### 7.1 Variables d'entorn

D'`backend/stats-service/.env` i `.env.example` (mateixes 8 claus; sota hi ha els valors de la plantilla/compose, no els secrets locals):

```
PORT=3012
DB_HOST=mariadb
DB_PORT=3306
DB_NAME=howmuch
DB_USER=root
DB_PASS=root      # db.js també accepta DB_PASSWORD, que té prioritat si no és buit
AUTH_SECRET       # ha de coincidir amb auth-service
INTERNAL_SECRET   # ha de coincidir amb auth-service i game-service
```

`docker-compose.yml` (servei `stats-service`) defineix literalment `PORT=3012`, `DB_HOST=mariadb`, `DB_PORT=3306`, `DB_USER=root`, `DB_PASS=root`, `DB_NAME=howmuch`, i `AUTH_SECRET`/`INTERNAL_SECRET` interpolats de l'`.env` de l'arrel del repo (que només conté `PORT`, `INTERNAL_SECRET` i `AUTH_SECRET`). El port **3012:3012** s'exposa a l'host, xarxa `tr1-network`, `restart: unless-stopped`, `container_name: stats-service`, `depends_on: mariadb` sense `condition` (encara que MariaDB té healthcheck, stats només espera que el contenidor arrenqui i confia en els 20 reintents).

`src/db.js:6` llegeix `DB_PASSWORD || DB_PASS`: el nom canònic a Docker és `DB_PASS`, però un `DB_PASSWORD` no buit tindria prioritat. `DB_PORT` no numèric cau a 3306. No es configura `timezone` ni `dialectOptions`.

### 7.2 Comandes reals

Des de `backend/stats-service/`:

```bash
npm install
npm start          # → node --env-file-if-exists=.env server.js
npm test           # → node --test (no hi ha tests)
```

Dins del contenidor el `CMD ["npm", "start"]` executa el mateix script, però com que l'`.env` no s'ha copiat a la imatge el flag `--env-file-if-exists` no carrega res: totes les variables vénen de `docker-compose.yml`. `EXPOSE 3012` és fix encara que es canviï `PORT`.

Arrencada amb Docker:

```bash
docker compose up -d mariadb stats-service
docker compose logs -f stats-service
```

Sortida esperada:

```
Connectat a MariaDB.
stats-service escoltant al port 3012
```

Comprovació: `curl http://localhost:3012/health` → `{"ok":true,"service":"stats-service"}`.

Si `PORT` no és numèric, `Number(process.env.PORT) || 3012` cau a 3012.

---

## 8. Fitxers clau

| Fitxer | Responsabilitat |
|---|---|
| `backend/stats-service/server.js` | Crea l'app, CORS/JSON, `/health`, middleware de registre, munta `/internal/admin` i `/stats`, bucle de connexió (20×1 s) i `listen(3012)`. |
| `backend/stats-service/src/db.js` | Instància única de `Sequelize` (dialecte `mysql`, `logging:false`), llegeix `DB_*` i `DB_PASSWORD || DB_PASS`. |
| `backend/stats-service/src/auth.middleware.js` | `verifyInternalService` (secret compartit amb `timingSafeEqual`, 503 si no configurat) i `verifyToken` (JWT HS256, `sub` numèric ≥ 1 → `req.user`). |
| `backend/stats-service/src/stats.routes.js` | `POST /partides` (validació + inserció), `GET /me` (resum, categoria top, historial 30), `GET /ranking` (SQL amb join i `LIMIT`). |
| `backend/stats-service/src/admin/admin.routes.js` | `dadesPeriode`, `seriePerInterval`, `calculaUsage`, `percentatge` i les tres rutes `/internal/admin/*`. |
| `backend/stats-service/src/middleware/registre.js` | Escriu a `registre` a `res.on("finish")`; els errors d'inserció només van a consola. |
| `backend/stats-service/src/models/Partida.js` | Mapatge de `partides` (`timestamps:false`), inclou `rondes` (`TINYINT UNSIGNED` a `schema.sql:173`). |
| `backend/stats-service/src/models/Usuari.js` | Mapatge de `usuaris` (`timestamps:false`); s'importa per registre, no es consulta via ORM. |
| `backend/stats-service/Dockerfile` | Imatge `node:20-alpine`, `npm install --omit=dev`, `EXPOSE 3012`, `CMD npm start`. |
| `backend/game-service/src/game/reportStats.js` | Client que envia un `POST /stats/partides` per jugador registrat. |
| `backend/game-service/src/admin/adminClient.js` | `cridaStats()`: capçaleres internes + JWT per a `/internal/admin/*`. |
| `frontend/client-vue/src/services/statsApi.js` | `getRanking(limit)` i `getMyStats(token)` contra `http://localhost:3012`. |
| `frontend/client-vue/src/services/adminApi.js` + `stores/admin.js` | Missatges WS `admin:estadistiques:get`, `admin:registre:get`, `admin:usage:get` i emmagatzematge de resultats. |
| `frontend/client-vue/src/components/admin/AdminUsageChart.vue` | Chart.js; rep les dues sèries i genera les etiquetes X (`1h…24h` o `D1…Dn`) pel nombre de punts. |
| `frontend/client-vue/src/views/admin/AdminEstadistiquesView.vue` | Targetes amb `general.*` (sempre globals) i taula `salesStats` (l'única filtrada per `sala`). |
| `backend/database/sql/schema.sql` | DDL de `partides` (160-172), `usuaris` (139-157) i `registre` (175-185); conté `DROP TABLE IF EXISTS usuaris` (138). |
| `backend/auth-service/src/authService.js#getUserStats` | Càlcul paral·lel de mètriques des de `partida`/`participant`/`ronda`/`resposta` per a `GET /stats/:id`. |
| `backend/stats-service/package.json` | Scripts `start`/`test`, dependències i `overrides.uuid`; no hi ha `dev`. |

---

## 9. Riscos i punts febles (evidència de codi)

### 9.1 `rondes` a `schema.sql` — resolt

`Partida.js` declara la columna `rondes` i `POST /stats/partides` la inclou a `Partida.create(...)`. Abans aquesta columna no existia a l'esquema i l'INSERT fallava amb `Unknown column 'rondes'` → `500`, de manera que cap partida es registrava. Ara `backend/database/sql/schema.sql:173` la defineix com a `rondes TINYINT UNSIGNED NOT NULL DEFAULT 0` i `game-service/src/game/roundEvents.js` hi envia les rondes jugades de veritat.

### 9.2 Finestres mòbils, no períodes de calendari

`usage` i `registre` calculen `ara - dies`, no "avui des de les 00:00" ni "dilluns a diumenge". Les etiquetes (`"Avui"`, `"Aquest mes"`) són doncs enganyoses: `periode=dia` és "les últimes 24 h" i `mes` són 30 dies mòbils. Els buckets de `usage` són blocs sencers d'1 hora o 1 dia comptats des de l'instant de la consulta (p. ex. 14:37 → 14:37), no hores ni dies de rellotge: no hi ha buckets parcials, però una hora "de 14:00 a 15:00" no coincideix amb cap punt. La comparació actual/anterior és alineada per posició relativa, no per hora del dia.

### 9.3 Zona horària en les sèries

`iniciActual`/`iniciAnterior` són `Date` de JS enviats com a paràmetre; Sequelize/mysql2 els serialitza en UTC, mentre `TIMESTAMPDIFF` i `DATE_SUB(NOW(), ...)` s'avaluen amb la zona de la sessió MySQL. Si el contenidor MariaDB no és UTC, els buckets poden desplaçar-se respecte de les hores reals. No hi ha cap configuració de `timezone` a `db.js`.

### 9.4 `GET /stats/ranking` és públic

No té `verifyToken`: qualsevol pot enumerar `username`, `avatarColor` i mètriques de tots els jugadors. És una decisió aparent (el frontend el crida sense token), però és exposició de dades si el servei és accessible.

### 9.5 Errors SQL filtrats al client intern

Les rutes `/internal/admin/*` responen `{ ok:false, reason: error.message }` amb el missatge del driver (taula/columna, sintaxi). Aquest text arriba al panell admin via game-service (`reason: dades.reason`). No hi ha cap filtre.

### 9.6 Middleware de registre: creixement i bloqueig del pool

- S'insereix una fila **per cada resposta** (incloent `/stats/ranking` i `/stats/me`), sense mostreig, retenció ni purga: la taula creix indefinidament.
- La inserció es fa a `res.on("finish")` i no s'espera, però consumeix una connexió del pool per petició. El pool de Sequelize no està configurat: **màxim 5 connexions per defecte**, amb un timeout d'adquisició (`acquire`) de 60 s. Amb càrrega alta els `INSERT` de registre fan cua darrere les lectures (i poden esgotar el temps d'espera).
- `/health` queda fora del registre (muntat abans), igual que els preflight `OPTIONS` i els `400` de JSON mal format (es resolen abans del middleware). El percentatge d'encerts no inclou healthchecks (potser desitjable, però no documentat).
- Només s'auditen respostes HTTP del propi servei; els errors WebSocket de game-service no hi figuren.

### 9.7 Sense tests

`npm test` executa `node --test` però no hi ha cap `*.test.js`. La lògica de sèries (`dadesPeriode`, `seriePerInterval`, descart per índex) i la validació de `/stats/partides` no tenen cobertura.

### 9.8 Sense límit de peticions ni control de mida

`cors()` obert, sense `express-rate-limit` ni `helmet`. `express.json()` sense `limit` explícit (defecte 100 kb). `POST /stats/partides` només el protegeix el secret compartit; si el secret es filtra, es poden injectar partides arbitràries (no hi ha verificació que l'usuari existeixi: no hi ha FK).

### 9.9 Integritat i model desalineat

- `partides.usuari_id` no té FK a `usuaris`; `ranking` fa `INNER JOIN`, així que les partides òrfenes desapareixen del rànquing però compten a `estadistiques` i a `usage` (aquesta última només mira `data_partida`).
- L'`auth-service` **esborra usuaris** (`DELETE FROM usuaris WHERE id = ?`, `authService.js:473`): cada baixa deixa files òrfenes a `partides`. No hi ha esborrat en cascada possible (no hi ha FK).
- A `partides`, `id` i `usuari_id` són `BIGINT UNSIGNED` a l'esquema i `INTEGER.UNSIGNED` al model. A `usuaris`, `id` és `INT UNSIGNED` a tots dos (el model sí que coincideix aquí). `Usuari.js` no inclou `rol_id`. Com que mai es fa `sync()`, no trenca, però el model no és fiable com a documentació de l'esquema.
- `POST /stats/partides` accepta `userId` de qualsevol enter ≥ 1 sense comprovar-lo (ni que existeixi ni que el JWT de la partida hi correspongui).
- Re-executar `schema.sql` fa `DROP TABLE IF EXISTS usuaris`, cosa que deixa totes les `partides` òrfenes de cop (vegeu §6.2).

### 9.10 Fragilitats menors

- `dadesPeriode` converteix qualsevol `periode` desconegut en `"dia"` sense error: un client amb un valor incorrecte rep dades d'unes altres i no ho sap. A `/registre` passa el mateix amb la finestra, però a més el `periode` retornat és el text original (no `"avui"`).
- El rànquing no inclou jugadors amb 0 partides (per l'`INNER JOIN`); el desempat final és `u.nom`, que és únic, així que l'ordre és estable.
- La condició `encerts > rondes && rondes > 0` permet `rondes = 0` amb `encerts > 0`; el significat de `rondes = 0` (partida no reportada) no és explícit.
- `categoria` forma part del contracte de `POST /stats/partides`, però `reportStats.js` no l'envia: totes les files acaben a `'General'` i el camp no és fiable per analitzar per categoria (tot i que `nom_sala` sí que arriba).
- `GET /internal/admin/estadistiques?sala=X` retorna `general` **sense filtrar** per `X`; la vista admin pinta aquestes targetes com si fossin del filtre, de manera que mostra els totals globals al costat d'una taula filtrada.
- `README.md` descriu un contracte (`/api/stats`, exportació CSV) que el codi no implementa.
- `reportStats.js` fa una petició per jugador de forma seqüencial i només loga errors: si stats-service cau, les partides es perden sense cua ni reintent. Tampoc no comprova `resposta.ok`.

### 9.11 Dues fonts de veritat per a les estadístiques

- `GET /stats/me` (aquest servei, port 3012) surt de la taula plana `partides`, escrita només per `POST /stats/partides`.
- `GET /stats/:id` (`auth-service`, port 3011, **públic**) calcula `gamesPlayed`/`gamesWon`/`answeredQuestions`/`correctAnswers`/`accuracyPercentage` des de `partida`, `participant`, `ronda` i `resposta`, i valida l'existència de l'usuari (`USER_NOT_FOUND`, 404).
- Els noms dels camps, les unitats i les definicions no coincideixen (`partidesJugades` ≠ `gamesPlayed`; `encerts` és un recompte per partida, no respostes encertades), i no hi ha cap reconciliació. Un usuari pot veure xifres diferents a `StatsView.vue` (`getMyStats`) i a la fitxa pública que consumeix `authApi.getUserStats`. Stats-service no té cap equivalent per a tercers (només `/stats/me` amb el propi JWT).

### 9.12 Correccions aplicades en aquesta revisió

1. **§9.2 (fals)**: deia que a `periode=dia` els buckets eren "hores de rellotge" i que el primer i l'últim eren parcials. En realitat `TIMESTAMPDIFF` compta blocs sencers d'1 h/1 dia des de l'instant exacte de la consulta i no hi ha buckets parcials (només queda fora el que té timestamp `>= ara`). Corregit a §4.5 i §9.2.
2. **§5.8 (fals)**: deia que `AdminUsageChart.vue` rebia "les etiquetes". L'API no envia cap etiqueta de dates; el component genera `1h…24h`/`D1…Dn` pel nombre de punts (`AdminUsageChart.vue:69-84`). Corregit.
3. **§5.5 (imprecís)**: deia que tots els camps eren snake_case perquè venien del SQL. Només `nom_sala` ho és; `partides`/`jugadors`/`encerts` són àlies. Corregit.
4. **§5.7 (fals)**: l'apartat "Exemple real" no s'havia executat mai. Reetiquetat com a il·lustratiu.
5. **§9.9 (imprecís)**: `BIGINT` a l'esquema només aplica a `partides.id`/`partides.usuari_id`; `usuaris.id` és `INT UNSIGNED` i coincideix amb el model. Aclarit, i afegida la baixa d'usuaris d'auth-service com a origen de files òrfenes.
6. **§7.1 (incomplet)**: els valors de `docker-compose.yml` són literals (`DB_USER=root`, `DB_PASS=root`, `DB_NAME=howmuch`) i els secrets vénen de l'`.env` de l'arrel (`PORT`, `INTERNAL_SECRET`, `AUTH_SECRET`). Completat.
7. **§4.2 (incomplert)**: `reportStats.js` no envia `categoria` ni comprova `resposta.ok`. Afegit, amb la conseqüència que tot queda a `'General'`.
8. **§5.1 (incomplert)**: faltava l'ordre exacte dels errors, que els 404 són HTML i que `OPTIONS`/JSON mal format no s'auditen. Afegit.
9. **§6 (incomplert)**: afegits el DDL literal, el SQL de `/stats/me`, la nota de `DROP TABLE IF EXISTS usuaris` i la taula §6.5 de qui escriu cada taula.
10. **§2/§7.2 (precisió)**: el flag `--env-file-if-exists` requereix Node **20.19+/22.9+**, no 20.6 (aquesta és la versió del `--env-file` bàsic). La imatge `node:20-alpine` flotant el suporta; un Node local antic falla en arrencar.

**〔no verificat〕** No s'ha arrencat el servei ni la BD: no s'ha comprovat empíricament (a) el text exacte de l'error de MySQL per la columna `rondes`, (b) la zona horària efectiva del contenidor MariaDB, (c) el collation de `nom_sala`, ni (d) que `partides.rondes` existeixi a la BD que s'estigui fent servir ara mateix (si algú l'ha afegida a mà, no hi ha rastre al repo).
