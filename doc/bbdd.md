# Base de dades (MariaDB) — Documentació tècnica

> Basat en el codi de `backend/`, `docker-compose.yml` i els scripts de `backend/database/sql/` (commit `a3cf236`, 2026-11-21). No s'ha aixecat cap instància: tot el que segueix és evidència de codi; quan una dada depèn de l'estat real d'un servidor, s'indica **no verificat**.

---

## 1. Resum i responsabilitat

El projecte **How Much?** fa servir **una única instància MariaDB 11** amb **una única base de dades, `howmuch`**, compartida per quatre microserveis. No hi ha un servei "amo" de la base de dades: cada servei obre el seu propi pool i toca les taules que li toquen. L'esquema no es crea des del codi (cap `sequelize.sync()`), sinó amb `backend/database/sql/schema.sql`, muntat a l'entrypoint de MariaDB.

| Esquema / objecte | Propietari lògic (escriptures) | Només lectura |
|---|---|---|
| `categoria`, `pregunta` | `catalog-service` (CRUD admin + import JSON) | `catalog-service` (joc), `game-service` via HTTP |
| `partida`, `participant`, `ronda`, `resposta` | `game-service` | res més |
| `usuaris`, `rol` | `auth-service` | `game-service` (`avatar_color`), `stats-service` (join del rànquing) |
| `partides` (agregat per usuari) | `stats-service` | res més |
| `registre` | `auth-service`, `catalog-service`, `stats-service` (middleware d'auditoria) | `stats-service` (`/internal/admin/registre`) |

Responsabilitats que afecten la BD:

| Responsabilitat | On viu |
|---|---|
| Crear l'esquema i les dades inicials | `backend/database/sql/schema.sql`, `dades-inicials.sql` (init de Docker) |
| Migracions manuals puntuals | `backend/database/sql/migrations/*.sql` (no s'executen soles) |
| Persistir sales, rondes i respostes | `game-service` (`roomRepository.js`, `gameRepository.js`) |
| Persistir catàleg | `catalog-service` (Sequelize + pool mysql2) |
| Persistir usuaris i rols | `auth-service` (pool mysql2) |
| Agregar resultats per usuari | `stats-service` (`partides`) |
| Exportar una partida a CSV | `game-service` (`game/files/exportGameCsv.js`, només lectura) |
| Auditoria HTTP | middleware `registre.js` dels tres serveis Express |

Cap servei crea ni migra l'esquema: `stats-service` fa `authenticate()` (amb 20 reintents), `catalog-service` executa `ensureInitialCatalog()` a l'arrencada, i `auth-service`/`game-service` no comproven la connexió (el pool és mandrós i l'error apareix a la primera consulta).

---

## 2. Stack i dependències

| Element | Valor real |
|---|---|
| SGBD | `mariadb:11` (contenidor `mariadb`) |
| Base de dades | `howmuch` (creada per `schema.sql` **i** per `MARIADB_DATABASE`) |
| Jocs de caràcters | `utf8mb4` a l'esquema (collation no fixada) |
| Motor de taules | `InnoDB` a totes les taules |
| Driver A | `mysql2` (`mysql2/promise`) a `auth-service`, `game-service`, `catalog-service` |
| ORM | `sequelize` a `stats-service` i a `catalog-service` (`sequelize.js`) |
| Gestor de migracions | **cap** (ni Sequelize CLI ni Flyway): SQL manual |
| Administració visual | `phpmyadmin` a `http://localhost:8081` |
| Còpies de seguretat | **cap automatitzada** al repo |

`mariadb:11` és un tag mòbil: la versió de patch (11.4, 11.8…) depèn del moment del `pull` i no queda fixada al repo; afecta la collation per defecte (§6.13). **No verificat** en instància.

`docker-compose.yml` (servei `mariadb`):

| Camp | Valor |
|---|---|
| `image` | `mariadb:11` |
| `ports` | `3306:3306` (exposat a l'host) |
| `environment` | `MARIADB_ROOT_PASSWORD: root`, `MARIADB_DATABASE: howmuch` |
| `volumes` | `mariadb_data:/var/lib/mysql` |
| init scripts | `schema.sql → 01-schema.sql`, `dades-inicials.sql → 02-dades-inicials.sql` (read-only) |
| `healthcheck` | `mariadb-admin ping -uroot -proot`, `interval 5s`, `timeout 5s`, `retries 20` |
| xarxa | `tr1-network` (bridge) |
| `restart` | `unless-stopped` |
| `container_name` | `mariadb` (fix; no es pot escalar) |
| `command` | cap: entrypoint per defecte de la imatge |
| `TZ` | no definida (ni al contenidor ni als serveis) |
| `MARIADB_USER` / `MARIADB_PASSWORD` | absents: tots els serveis connecten com a `root` |

No hi ha cap contenidor propi de "migració" ni script de backup. Els serveis depenen de `mariadb` de tres maneres distintes: `auth-service` i `stats-service` amb `depends_on: mariadb` (sense `condition`), `catalog-service` i `game-service` sense `depends_on`, i `phpmyadmin` amb `condition: service_healthy`.

Detalls que afecten la inicialització:

- Els scripts muntats a `/docker-entrypoint-initdb.d` només s'executen **quan el directori de dades és buit** i en ordre alfabètic (`01-schema.sql`, després `02-dades-inicials.sql`).
- `MARIADB_DATABASE=howmuch` crea la base de dades **abans** dels scripts. Per això el `CREATE DATABASE IF NOT EXISTS howmuch CHARACTER SET utf8mb4` de `schema.sql` no canvia res en aquest camí: el charset/collation real és el defecte del servidor (vegeu §6.13).
- El muntatge és read-only (`:ro`), així que editar els `.sql` al host no altera un volum ja inicialitzat.
- `phpmyadmin` no porta tag d'imatge (agafa `latest`); `catalog-service` declara `expose` i `ports` del mateix 3001 (redundant); `game-service` publica `"${PORT}:${PORT}"` i depèn que `PORT` existeixi al `.env` del servei o a l'entorn, si no Compose falla per port buit.
- No hi ha límits de memòria/CPU, ni `tmpfs`, ni healthcheck propi per als serveis Node.

---

## 3. Estructura de fitxers

```text
docker-compose.yml                        # mariadb + phpmyadmin + 4 serveis + volum
backend/
├── database/
│   ├── sql/
│   │   ├── schema.sql                    # CREATE DATABASE howmuch + 10 taules + CHECK/FK/UNIQUE
│   │   ├── dades-inicials.sql            # rols 1/2, usuari admin, 8 categories, 31 preguntes
│   │   └── migrations/
│   │       ├── add-question-slider-fields.sql   # afegeix min/max/step i el CHECK del slider
│   │       └── dynamic-difficulties.sql         # dificultat VARCHAR(32) (ja inclòs a schema.sql)
│   ├── preguntas/preguntas.json          # catàleg font per a la importació
│   └── partides/ participants/ rondes/ respostes/   # només README, no són taules ni codi
├── auth-service/
│   ├── .env / .env.example               # DB_* + AUTH_SECRET + SMTP_*
│   └── src/
│       ├── pool.js                       # pool mysql2 (auth)
│       ├── authService.js                # totes les queries d'usuaris/rol i /stats/:id
│       ├── admin/admin.routes.js         # CRUD usuaris (internal)
│       └── middleware/registre.js        # INSERT a registre
├── catalog-service/
│   ├── .env / .env.example               # PORT + INTERNAL_SECRET (el .env versionat NO té DB_*)
│   ├── preguntas.json                    # còpia idèntica de database/preguntas/preguntas.json (la que s'embarca a Docker)
│   └── src/
│       ├── db/pool.js                    # pool mysql2 (catàleg)
│       ├── db/sequelize.js               # Sequelize + models Categoria/Pregunta
│       ├── questions/preguntas.repository.js  # SELECT de preguntes, opcions, CRUD
│       ├── questions/loadQuestions.js    # localitza i llegeix el JSON (3 rutes possibles)
│       ├── questions/validarPregunta.js  # validació prèvia a la importació
│       ├── questions/importQuestions.js  # import JSON via Sequelize (transacció)
│       ├── cli/importQuestions.js        # entrada de `npm run import:questions`
│       ├── admin/admin.routes.js         # CRUD preguntes/categories (internal)
│       └── middleware/registre.js        # INSERT a registre
├── game-service/
│   ├── .env / .env.example
│   └── src/
│       ├── db/pool.js                    # pool mysql2 (joc), utf8mb4
│       ├── repositories/roomRepository.js        # partida/participant de sala
│       ├── game/persistence/gameRepository.js    # ronda/resposta/rànquing/reset
│       ├── game/files/exportGameCsv.js   # SELECT de partida/participant/ronda/pregunta/resposta → CSV
│       ├── cli/exportGameCsv.js          # entrada CLI de l'exportació
│       └── game/reportStats.js           # POST al stats-service (no SQL directe)
└── stats-service/
    ├── .env / .env.example               # DB_PASS (no DB_PASSWORD)
    ├── server.js                         # authenticate() amb 20 reintents + import dels models
    └── src/
        ├── db.js                         # Sequelize (dialecte mysql)
        ├── models/Partida.js             # model de `partides` (inclou `rondes`)
        ├── models/Usuari.js              # model de `usuaris` (només registre)
        ├── stats.routes.js               # INSERT partides + lectura d'estadístiques
        ├── admin/admin.routes.js         # agregats, registre, usage
        └── middleware/registre.js        # INSERT a registre
```

---

## 4. Flux principal pas a pas

### 4.1 Registre i verificació d'usuari (`auth-service`)

1. `POST /register` → `registerUser`: valida nom (3–30, `[a-zA-Z0-9_]`), email i contrasenya (6–72); `scrypt` amb salt (`salt:hash`).
2. `INSERT INTO usuaris (nom, email, password_hash, avatar_image, avatar_color, verificat, codi_verificacio, codi_expira) VALUES (..., 0, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`.
3. `ER_DUP_ENTRY`: si el missatge conté `uq_usuaris_email` → 409 email; qualsevol altre duplicat → 409 nom.
4. `POST /verify` → `SELECT ... WHERE email = ?`, comprova `verificat`, codi i `codi_expira > NOW()`, i fa `UPDATE usuaris SET verificat = 1, codi_verificacio = NULL, codi_expira = NULL`.
5. `POST /login` → `SELECT ... FROM usuaris u INNER JOIN rol r ON r.id = u.rol_id WHERE u.nom = ? OR u.email = ?`; exigeix `verificat = 1` i genera JWT amb `sub`, `username`, `rol`.
6. `PATCH /avatar` → `UPDATE usuaris SET avatar_image = ?, avatar_color = ? WHERE id = ?` (base64 `data:image/...`, màxim 2.200.000 caràcters).

### 4.2 Creació de sala (`game-service`)

`createRoomRecord` (transacció): `INSERT INTO partida (tipus, codi, estat, max_jugadors) VALUES (?, ?, 'esperant', ?)` i `INSERT INTO participant (partida_id, nickname)`. El `codi` és el `roomId` (`sala_<10 hex>`), no la contrasenya de 6 dígits (que no es desa mai).

### 4.3 Entrada a sala

`addRoomParticipant` (transacció): `SELECT id, estat, max_jugadors FROM partida WHERE codi = ? FOR UPDATE`; rebutja si `estat != 'esperant'`; compta participants i, si hi ha plaça, `INSERT INTO participant`; retorna els nicknames. Els observadors **no** s'insereixen a `participant`.

`joinRoom.js` llegeix `usuaris.avatar_color` quan la identitat té `userId` (única lectura del joc sobre `usuaris`).

### 4.4 Inici de partida

`startGameRecord` (transacció): bloqueja la `partida` per `codi`, esborra `participant` dels observadors, `INSERT INTO ronda (partida_id, pregunta_id, numero, estat) VALUES (?, ?, 1, 'oberta')` i `UPDATE partida SET estat = 'en_curs', data_inici = CURRENT_TIMESTAMP`.

### 4.5 Respostes i tancament de ronda

1. `saveAnswerRecord` (transacció): `SELECT ... FROM ronda WHERE id = ? FOR UPDATE`; comprova `estat = 'oberta'`; resol el `participant_id` per `(partida_id, nickname)`; `INSERT INTO resposta (ronda_id, participant_id, valor)`. L'`UNIQUE (ronda_id, participant_id)` evita duplicats (`ER_DUP_ENTRY` → `ANSWER_ALREADY_EXISTS`).
2. `closeRoundRecord` (transacció): bloqueja la ronda, ordena respostes per `ABS(valor − correcta)` amb desempat `valor DESC, id ASC`, assigna `posicio` (1..n) i `punts` (`calculatePoints`), i `UPDATE ronda SET estat = 'tancada'`. La puntuació va de 0 a 530 (500 exacte + 30 de bonus; 450 dins del 10 %).
3. `openRoundRecord`: rebutja si ja hi ha una ronda `oberta` (`ROUND_STILL_OPEN`) i inserta la ronda `numero + 1`. L'`UNIQUE (partida_id, numero)` i `(partida_id, pregunta_id)` són la xarxa de seguretat.

### 4.6 Fi de partida i estadístiques

1. `finishGameRecord`: `UPDATE partida SET estat = 'acabada', data_fi = CURRENT_TIMESTAMP WHERE codi = ? AND estat = 'en_curs'`; retorna el rànquing (`SUM(punts)` per participant).
2. `getCorrectRoundsByNickname`: compta respostes amb `punts >= 450` per nickname.
3. `reportGameStats` fa un `POST /stats/partides` **per jugador registrat** amb `{ userId, nomSala, posicio, encerts, rondes }`.
4. `stats-service`: `Partida.create(...)` → `INSERT INTO partides (...)` (Sequelize inclou `rondes`).
5. `registre`: cada resposta HTTP dels serveis Express afegeix una fila a `registre`.

### 4.7 Retorn al lobby (operació destructiva)

Al cap de 15 s (`FINAL_RANKING_DELAY_MS`), `returnToLobby` → `resetAbandonedGameRecord` (transacció): `DELETE FROM ronda WHERE partida_id = ?`, `DELETE FROM participant WHERE partida_id = ?` (les respostes cauen per `ON DELETE CASCADE`), reinserció dels nicknames actuals i `UPDATE partida SET estat = 'esperant', data_inici = NULL, data_fi = NULL`.

Conseqüència: **l'historial normalitzat de la partida s'esborra**; només sobreviu l'agregat de `partides` (vegeu §9.7).

### 4.8 Catàleg de preguntes i categories

- Joc: `SELECT p.id, p.text, p.resposta_correcta, p.min_value, p.max_value, p.step_value, p.unitat, p.dificultat, p.explicacio FROM pregunta p [WHERE categoria_id = ? / dificultat = ?] ORDER BY RAND() LIMIT ?`.
- Opcions: `SELECT nom FROM categoria ORDER BY nom` i `SELECT DISTINCT dificultat FROM pregunta`.
- `GET /internal/catalog/options` i `POST /internal/preguntas/get` (secret intern).
- Admin (proxy des de `game-service`): CRUD amb Sequelize (`Categoria.findAll`, `Pregunta.create`, etc.). Esborrar una categoria amb preguntes el bloqueja el hook `beforeDestroy` (missatge propi) i, si s'hi arriba igualment, la FK `RESTRICT`.
- Arrencada del catàleg: `ensureInitialCatalog` fa `INSERT IGNORE INTO categoria (nom)` amb les 8 categories i, si `COUNT(*) FROM pregunta = 0`, importa `preguntas.json`.
- Importació (`importQuestions`): valida amb `validarPregunta` (text ≤ 65.535 bytes, `min < max`, `step > 0`, nombre de passos enter ≤ 100.000, resposta dins del rang, dificultat 1–32 caràcters i diferent de `mix`), fa `findOrCreate` de la categoria pel nom, dedueix duplicats per `(categoria_id, text)` i, si existeix, només actualitza `resposta_correcta`/`min`/`max`/`step`. Tot dins d'una transacció.
- El JSON té **254 preguntes** en 8 categories (19 Geografia, 20 Ciencia, 17 Historia, 12 Esports, 11 Cultura, 15 Cos Humà, 10 Tecnologia, 150 Curiositats). El camp `id` del JSON **s'ignora**: la BD assigna ids nous.

### 4.9 Lectura d'estadístiques

| Funcionalitat | Consulta |
|---|---|
| Perfil (`GET /stats/me`) | `COUNT`, `SUM(posicio = 1)`, `SUM(posicio IN (2,3))`, `ROUND(AVG(encerts),2)` sobre `partides` + `GROUP BY categoria LIMIT 1` + 30 darreres files |
| Rànquing (`GET /stats/ranking`) | `partides INNER JOIN usuaris` + `GROUP BY u.id` + `ORDER BY victories, podis, encertsTotals, partidesJugades, u.nom` |
| Admin totals | `COUNT(*)`, `COUNT(DISTINCT usuari_id)`, `AVG(encerts)` sobre `partides` |
| Admin registre | `SELECT estat, COUNT(*) FROM registre WHERE creat_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY estat` |
| Admin usage | `TIMESTAMPDIFF(HOUR\|DAY, ?, camp)` sobre `usuaris.data_creacio` i `partides.data_partida` |
| Auth `/stats/:id` | `partida` + `participant` + `resposta` filtrant `pt.nickname = <usuaris.nom>` i `p.estat = 'acabada'` |

### 4.10 Exportació CSV d'una partida

`exportGameCsv(roomId)` (`game/files/exportGameCsv.js`, invocable pel CLI `src/cli/exportGameCsv.js`) fa:

1. `SELECT id, estat FROM partida WHERE codi = ?` i exigeix `estat = 'acabada'`.
2. Un `SELECT` amb `participant`, `resposta`, `ronda` i `pregunta` que calcula la suma de `punts` per participant i ordena per puntuació.
3. Genera CSV amb `posicio`, `nickname`, `punts_totals`, `ronda`, `pregunta`, `resposta`, `punts_ronda`.

És només lectura, però depèn de l'historial normalitzat: si s'executa després del `resetAbandonedGameRecord` (15 s), la partida ja no és `acabada` i les files han desaparegut (vegeu §9.15).

### 4.11 Fi de partida per desconnexió

Si la sala es queda sense cap jugador (només observadors o ningú) o el procés ha de reiniciar-se, `roundEvents.js` (línia 581) crida el mateix `resetAbandonedGameRecord` sense passar pels 15 s. És a dir, l'esborrat de l'historial també pot ocórrer immediatament; no és exclusiu del camí feliç.

---

## 5. Contracte de comunicació (servei ↔ BD)

### 5.1 Connexions per servei

| Servei | Mòdul | Tipus | Fallbacks reals al codi |
|---|---|---|---|
| `auth-service` | `src/pool.js` | `mysql2` pool, `connectionLimit: 10`, **sense `charset`** | `localhost`, `3306`, `root`, contrassenya **buida** (`""`), `howmuch` |
| `game-service` | `src/db/pool.js` | `mysql2` pool, `connectionLimit: 10`, `queueLimit: 0`, `utf8mb4` | `localhost`, `3306`, `root`, **`root`**, `howmuch` |
| `catalog-service` (SQL) | `src/db/pool.js` | `mysql2` pool, `10`, `utf8mb4`, `decimalNumbers: true` | **`mariadb`**, `3306`, `root`, **`root`**, `howmuch` |
| `catalog-service` (ORM) | `src/db/sequelize.js` | Sequelize `dialect: mysql`, `timestamps: false`, `freezeTableName: true` | **`localhost`**, `3306`, `root`, contrassenya **buida**, `howmuch` |
| `stats-service` | `src/db.js` | Sequelize `dialect: mysql` | **cap**: `DB_NAME`, `DB_USER`, `DB_HOST` arriben `undefined` si falten |

Variables usades (noms reals):

```
DB_HOST  DB_PORT  DB_NAME  DB_USER  DB_PASSWORD  (auth, game, catalog)
DB_PASS                                        (stats; db.js també accepta DB_PASSWORD)
```

Amb el `docker-compose.yml` actual, tots els serveis acaben a la mateixa BD i credencials; el que canvia és el pool:

| Servei | Host | Port | Usuari | BD | Pool |
|---|---|---|---|---|---|
| `auth-service` | `mariadb` | 3306 | `root` | `howmuch` | mysql2, `connectionLimit: 10` |
| `game-service` | `mariadb` | 3306 | `root` | `howmuch` | mysql2, 10, `queueLimit: 0` |
| `catalog-service` (SQL) | `mariadb` | 3306 | `root` | `howmuch` | mysql2, 10, `queueLimit: 0` |
| `catalog-service` (ORM) | `mariadb` | 3306 | `root` | `howmuch` | Sequelize per defecte (max 5, min 0, idle 10 s) |
| `stats-service` | `mariadb` | 3306 | `root` | `howmuch` | Sequelize per defecte (max 5, min 0, idle 10 s) |

Fora de Compose, els fallbacks divergeixen (taula anterior): el pitjor cas és `catalog-service`, on el pool SQL aniria a `mariadb` i el Sequelize a `localhost`, és a dir, dues BD distintes amb el mateix codi.

`docker-compose.yml` sobreescriu `DB_HOST=mariadb`, `DB_PORT=3306`, `DB_USER=root`, `DB_PASSWORD=root`, `DB_NAME=howmuch` als quatre serveis; `stats-service` hi rep `DB_PASS: root`.

Paràmetres de connexió que canvien el comportament (tots amb els valors per defecte del driver si no s'indiquen):

| Paràmetre | `auth` | `game` | `catalog` SQL | `catalog` ORM | `stats` |
|---|---|---|---|---|---|
| `charset` | **no especificat** | `utf8mb4` | `utf8mb4` | el de Sequelize | **no especificat** |
| `decimalNumbers` | no | no | **sí** | — | — |
| `queueLimit` | defecte | `0` (cua il·limitada) | `0` | — | — |
| `waitForConnections` | `true` | `true` | `true` | — | — |
| `timestamps` | — | — | — | `false` | `false` (a cada model) |
| `timezone` | no | no | no | no | no |
| `dateStrings` | no | no | no | no | no |
| SSL | no | no | no | no | no |
| `connectTimeout` | defecte | defecte | defecte | defecte | defecte |

Conseqüències:

- `auth` i `stats` no fixen charset a la connexió; el que negotii el driver decideix si els emojis/accents de 4 bytes es poden escriure (rellevant per `usuaris.avatar`, `avatar_image` i els noms).
- `catalog` és l'únic que demana `decimalNumbers: true`, però només llegeix `pregunta` (DOUBLE); `resposta.valor` (DECIMAL) no passa per aquest pool.
- Sense `dateStrings` ni `timezone`, mysql2/Sequelize converteixen `DATETIME` a `Date` de JS; les comparacions de dates es fan al servidor (`NOW()`, `CURRENT_TIMESTAMP`), no al client.
- Sense `multipleStatements` (bé per seguretat): els `.sql` d'init i les migracions s'executen amb el client `mariadb`, no des dels serveis.
- Cap servei tanca el pool a l'aturar-se (només el CLI d'importació fa `sequelize.close()`); els respawn de Docker no deixen connexions penjades al servidor més enllà del timeout de la xarxa.

### 5.2 Convencions de les consultes

- **Paràmetres enllaçats sempre**: `pool.execute(sql, [..])`/`pool.query(sql, [..])` a auth/catalog/game; `replacements` a Sequelize. Només s'interpola text fix del codi (`taula`, `camp`, `unitat` a `seriePerInterval`).
- **Transaccions explícites** amb `getConnection()` + `beginTransaction`/`commit`/`rollback` + `release()` a `gameRepository` i `roomRepository`.
- **Bloquejos pessimistes** `SELECT ... FOR UPDATE` sobre `partida`, `ronda` i `resposta` (mai sobre `participant` a `addRoomParticipant`, només `partida`).
- **Serialització addicional al procés**: `roomQueue.js` encua les operacions d'una mateixa sala (no substitueix el bloqueig SQL).
- **Cap `sync()`**: `stats-service` només fa `authenticate()` (20 reintents d'1 s); `catalog-service` no comprova la connexió a l'arrencada, només crida `ensureInitialCatalog()` amb consultes reals. Cap dels dos crea taules.
- **Sense migracions automàtiques**: si el codi espera una columna que l'esquema no té, falla en runtime.

### 5.3 Mapatge ORM respecte de l'esquema

| Model | Taula | Camps que aporta | Desviació respecte de l'esquema |
|---|---|---|---|
| `Categoria` | `categoria` | `id`, `nom` | cap (hook `beforeDestroy` afegeix la protecció que la FK ja fa) |
| `Pregunta` | `pregunta` | `min`→`min_value`, `max`→`max_value`, `step`→`step_value`, la resta igual | cap; Sequelize no valida el CHECK del slider, només `validatePregunta` a la capa de servei |
| `Partida` (stats) | `partides` | `id`, `usuari_id`, `nom_sala`, `categoria`, `posicio`, `encerts`, `rondes`, `data_partida` | `id` declarat `INTEGER.UNSIGNED` (esquema `BIGINT UNSIGNED`); `usuari_id` declarat `INTEGER.UNSIGNED` (esquema `INT UNSIGNED NULL`, FK `ON DELETE SET NULL`); la resta de tipus coincideixen |
| `Usuari` (stats) | `usuaris` | `id`, `nom`, `email`, `password_hash`, `avatar`, `avatar_image`, `avatar_color`, `verificat`, `codi_verificacio`, `codi_expira`, `data_creacio` | **no** inclou `rol_id`; s'importa a `server.js` però no es consulta enlloc (només registra la taula al Sequelize) |

Conclusió: cap model no fa `sync()` ni migra; l'única conseqüència pràctica de les desviacions és que els tipus declarats no protegeixen de res.

### 5.4 Mapa taula ↔ servei ↔ operació real

Verificat sobre les consultes de `authService.js`, `roomRepository.js`, `gameRepository.js`, `exportGameCsv.js`, `registre.js`, `preguntas.repository.js` i `stats.*`:

| Taula | `auth` | `game` | `catalog` | `stats` |
|---|---|---|---|---|
| `categoria` | — | — (via HTTP) | `SELECT`, `INSERT`, `UPDATE`, `DELETE` (ORM) | — |
| `pregunta` | — | — (via HTTP) | `SELECT`, `INSERT`, `UPDATE`, `DELETE` (ORM) | — |
| `partida` | `SELECT` (`/stats/:id`) | `INSERT`, `SELECT … FOR UPDATE`, `UPDATE`, `DELETE` | — | — |
| `participant` | `SELECT` | `INSERT`, `SELECT`, `DELETE` | — | — |
| `ronda` | `SELECT` | `INSERT`, `SELECT … FOR UPDATE`, `UPDATE`, `DELETE` | — | — |
| `resposta` | `SELECT` | `INSERT`, `SELECT … FOR UPDATE`, `UPDATE` | — | — |
| `rol` | `SELECT` (join) | — | — | — |
| `usuaris` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` | `SELECT avatar_color` | — | `SELECT` (rànquing; el model `Usuari` no es consulta) |
| `partides` | — | — | — | `INSERT`, `SELECT`, agregats |
| `registre` | `INSERT` | — | `INSERT` | `INSERT` + `SELECT` |

Cap servei fa `TRUNCATE`, `DROP` ni `ALTER` en runtime. Les úniques escriptures creuades són les lectures d'`auth` sobre `partida`/`participant`/`ronda`/`resposta` i el `SELECT avatar_color` del joc sobre `usuaris`.

---

## 6. Base de dades

### 6.1 Visió general i diagrama

Una sola BD `howmuch` amb **deu taules**: `categoria`, `pregunta`, `partida`, `participant`, `ronda`, `resposta`, `rol`, `usuaris`, `partides` i `registre`.

```text
                        ┌──────────────┐
                        │   categoria  │
                        └──────┬───────┘
                               │ 1
                               │
                               │ N
                        ┌──────┴───────┐
                        │   pregunta   │
                        └──────┬───────┘
                               │ 1
                               │ (ON DELETE RESTRICT)
                               │ N
┌──────────────┐  1     N ┌────────────┐  1     N ┌────────────────┐
│   partida    ├──────────┤   ronda    ├──────────┤    resposta    │
└──────┬───────┘          └────────────┘          └───────┬────────┘
       │ 1                                                │ N
       │                                                  │
       │ N                                                │ 1
┌──────┴───────┐                                          │
│ participant  │◄─────────────────────────────────────────┘
└──────────────┘        (resposta.participant_id)

┌──────────────┐  1     N ┌──────────────┐
│     rol      ├──────────┤   usuaris    │
└──────────────┘          └──────┬───────┘
                                 ┊ 1
                                 ┊ N   (només lògic: partides.usuari_id NO té FK)
                          ┌──────┴───────┐
                          │   partides   │   ← agregat per usuari (stats-service)
                          └──────────────┘

┌──────────────┐
│   registre   │   ← independent: una fila per resposta HTTP dels serveis
└──────────────┘
```

Cardinalitats garantides per la BD:

| Relació | Cardinalitat | Regla |
|---|---|---|
| `categoria → pregunta` | 1:N | FK `fk_pregunta_categoria`, `ON DELETE RESTRICT` |
| `partida → participant` | 1:N | FK `fk_participant_partida`, `ON DELETE CASCADE` |
| `partida → ronda` | 1:N | FK `fk_ronda_partida`, `ON DELETE CASCADE` |
| `pregunta → ronda` | 1:N | FK `fk_ronda_pregunta`, `ON DELETE RESTRICT` |
| `ronda → resposta` | 1:N | FK `fk_resposta_ronda`, `ON DELETE CASCADE` |
| `participant → resposta` | 1:N | FK `fk_resposta_participant`, `ON DELETE CASCADE` |
| `rol → usuaris` | 1:N | FK `fk_usuari_rol` (sense `ON DELETE` ni `ON UPDATE` → `RESTRICT`) |
| `usuaris → partides` | 1:N | FK `fk_partides_usuari` sobre `usuari_id` (`NULL`), `ON DELETE SET NULL`: l'historial sobreviu a l'esborrat de l'usuari |
| `partida/resposta` ↔ `partides` | — | **cap relació**: dos models de dades en paral·lel |

> Nota: `resposta` porta `partida_id` i dues FK **compostes** — `(ronda_id, partida_id)` i `(participant_id, partida_id)` —, de manera que la mateixa columna obliga que la ronda i el participant siguin de la mateixa partida. És redundant a propòsit i ho garanteix la BD, no el codi.

### 6.2 `categoria`

| Columna | Tipus | Null / defecte | Claus i notes |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `AUTO_INCREMENT` | PK |
| `nom` | `VARCHAR(100)` | `NOT NULL` | `uq_categoria_nom` UNIQUE; `chk_categoria_nom` CHECK `CHAR_LENGTH(TRIM(nom)) > 0` |

Per a què serveix: classificar les preguntes. Propietat de `catalog-service`; es llegeix a `listCatalogOptions` i als `JOIN` de la importació. Les vuit files inicials (`Geografia`, `Ciencia`, `Historia`, `Esports`, `Cultura`, `Cos Humà`, `Tecnologia`, `Curiositats`) venen d'`dades-inicials.sql` amb ids 1–8.

### 6.3 `pregunta`

| Columna | Tipus | Null / defecte | Claus i notes |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `AUTO_INCREMENT` | PK |
| `categoria_id` | `INT UNSIGNED` | `NOT NULL` | FK `fk_pregunta_categoria` (RESTRICT); `idx_pregunta_categoria_id` |
| `text` | `TEXT` | `NOT NULL` | `chk_pregunta_text` CHECK no buit |
| `resposta_correcta` | `DOUBLE` | `NOT NULL` | |
| `min_value` | `DOUBLE` | `NOT NULL` | |
| `max_value` | `DOUBLE` | `NOT NULL` | |
| `step_value` | `DOUBLE` | `NOT NULL` | |
| `unitat` | `VARCHAR(50)` | `NOT NULL DEFAULT ''` | |
| `dificultat` | `VARCHAR(32)` | `NOT NULL` | sense CHECK; `dificultat` lliure (abans era ENUM, vegeu `dynamic-difficulties.sql`) |
| `explicacio` | `TEXT` | `NOT NULL` | |
| — | — | — | `chk_pregunta_slider` CHECK `min_value < max_value AND step_value > 0 AND resposta_correcta BETWEEN min_value AND max_value` |

Per a què serveix: banc de preguntes del joc. Es seleccionen aleatòriament amb `ORDER BY RAND() LIMIT ?` (cost O(n) sobre la taula; amb 31 files inicials és irrellevant).

### 6.4 `partida` (partida en directe, singular)

| Columna | Tipus | Null / defecte | Claus i notes |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `AUTO_INCREMENT` | PK |
| `tipus` | `ENUM('publica','privada')` | `NOT NULL` | |
| `codi` | `VARCHAR(20)` | `NOT NULL` | `uq_partida_codi` UNIQUE; `chk_partida_codi` CHECK no buit |
| `estat` | `ENUM('esperant','en_curs','acabada')` | `NOT NULL DEFAULT 'esperant'` | sense índex |
| `max_jugadors` | `INT UNSIGNED` | `NOT NULL` | `chk_partida_max_jugadors` CHECK `BETWEEN 2 AND 20` |
| `dificultat` | `VARCHAR(32)` | `NOT NULL DEFAULT 'media'` | el joc no l'actualitza mai |
| `data_inici` | `DATETIME` | `NULL` | |
| `data_fi` | `DATETIME` | `NULL` | |
| `data_creacio` | `DATETIME` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | |
| — | — | — | `chk_partida_dates` CHECK `data_fi IS NULL OR (data_inici IS NOT NULL AND data_fi >= data_inici)` |

Per a què serveix: fila de la sala/partida viva. El `codi` és el `roomId` intern (`sala_xxxx`), únic, i és la clau que fa servir el joc (`WHERE codi = ?`). No guarda host, contrasenya ni categoria.

### 6.5 `participant`

| Columna | Tipus | Null / defecte | Claus i notes |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `AUTO_INCREMENT` | PK |
| `partida_id` | `INT UNSIGNED` | `NOT NULL` | FK `fk_participant_partida` (CASCADE); `idx_participant_partida_id` (redundant: `uq_participant_partida_nickname` ja comença per aquesta columna) |
| `nickname` | `VARCHAR(15)` | `NOT NULL` | `uq_participant_partida_nickname` UNIQUE `(partida_id, nickname)`; `chk_participant_nickname` CHECK longitud 3–15 |

Per a què serveix: identificar jugadors dins d'una partida. **No té `usuari_id`**: el vincle amb `usuaris` només existeix a la memòria (`room.players.userId`) i, indirectament, pel text del nickname. Els observadors no s'hi desen.

### 6.6 `ronda`

| Columna | Tipus | Null / defecte | Claus i notes |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `AUTO_INCREMENT` | PK |
| `partida_id` | `INT UNSIGNED` | `NOT NULL` | FK (CASCADE); `idx_ronda_partida_id` (redundant: `uq_ronda_partida_numero` comença per `partida_id`) |
| `pregunta_id` | `INT UNSIGNED` | `NOT NULL` | FK (RESTRICT); `idx_ronda_pregunta_id` (redundant: `uq_ronda_partida_pregunta` comença per `partida_id`, no per `pregunta_id`; aquí l'índex sí que serveix per buscar per pregunta) |
| `numero` | `INT UNSIGNED` | `NOT NULL` | `chk_ronda_numero` CHECK `> 0` |
| `estat` | `ENUM('oberta','tancada')` | `NOT NULL DEFAULT 'oberta'` | |
| — | — | — | `uq_ronda_partida_numero` UNIQUE `(partida_id, numero)`; `uq_ronda_partida_pregunta` UNIQUE `(partida_id, pregunta_id)` |

Per a què serveix: pregunta concreta usada en cada torn simultani. La doble UNIQUE impedeix repetir número o pregunta dins d'una partida. No guarda temps d'inici/fi.

### 6.7 `resposta`

| Columna | Tipus | Null / defecte | Claus i notes |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `AUTO_INCREMENT` | PK |
| `ronda_id` | `INT UNSIGNED` | `NOT NULL` | FK (CASCADE); sense índex propi (el cobreix `uq_resposta_ronda_participant`) |
| `participant_id` | `INT UNSIGNED` | `NOT NULL` | FK (CASCADE); `idx_resposta_participant_id` |
| `valor` | `DECIMAL(20,6)` | `NOT NULL` | admet negatius i decimals |
| `posicio` | `SMALLINT UNSIGNED` | `NULL` | `chk_resposta_posicio` CHECK `posicio IS NULL OR posicio > 0` |
| `punts` | `INT UNSIGNED` | `NOT NULL DEFAULT 0` | 0–530 segons la corba de `scoring.js` |
| — | — | — | `uq_resposta_ronda_participant` UNIQUE `(ronda_id, participant_id)` |

Per a què serveix: resposta d'un participant a una ronda i la seva puntuació. `posicio` és el rànquing **dins la ronda** (per proximitat), no la posició final de la partida; la posició final es calcula sumant `punts`.

### 6.8 `rol`

| Columna | Tipus | Null / defecte | Claus i notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `AUTO_INCREMENT` | PK |
| `nom` | `VARCHAR(20)` | `NOT NULL` | `uq_rol_nom` UNIQUE |

Per a què serveix: catàleg de rols. Sembrat amb `(1,'usuari')` i `(2,'admin')`; `usuaris.rol_id` hi apunta i el JWT porta `rol` per no consultar-la a cada petició.

### 6.9 `usuaris`

| Columna | Tipus | Null / defecte | Claus i notes |
|---|---|---|---|
| `id` | `INT UNSIGNED` | `AUTO_INCREMENT` | PK |
| `nom` | `VARCHAR(30)` | `NOT NULL` | `uq_usuaris_nom` UNIQUE; `chk_usuaris_nom` CHECK 3–30 |
| `email` | `VARCHAR(255)` | `NOT NULL` | `uq_usuaris_email` UNIQUE |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | format `salt:scrypt64hex` |
| `avatar` | `VARCHAR(32)` | `NOT NULL DEFAULT '😀'` | emoji; no s'usa al codi actual |
| `avatar_image` | `LONGTEXT` | `NULL` | data URI base64 (fins ~2,2 MB) |
| `avatar_color` | `VARCHAR(16)` | `NOT NULL DEFAULT '#22c55e'` | validat a `#RRGGBB` |
| `rol_id` | `BIGINT UNSIGNED` | `NOT NULL DEFAULT 1` | FK `fk_usuari_rol` (sense `ON DELETE`/`ON UPDATE` → `RESTRICT`); `rol.id` també és `BIGINT` |
| `verificat` | `TINYINT(1)` | `NOT NULL DEFAULT 0` | |
| `codi_verificacio` | `VARCHAR(6)` | `NULL` | s'esborra en verificar |
| `codi_expira` | `DATETIME` | `NULL` | 15 minuts |
| `data_creacio` | `DATETIME` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | font del gràfic `usage` |

Per a què serveix: comptes registrats. **Atenció**: la definició va precedida de `DROP TABLE IF EXISTS usuaris;` (vegeu §9.5).

### 6.10 `partides` (agregat per usuari, plural)

| Columna | Tipus | Null / defecte | Claus i notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `AUTO_INCREMENT` | PK |
| `usuari_id` | `INT UNSIGNED` | `NULL` | FK `fk_partides_usuari` → `usuaris.id`, `ON DELETE SET NULL`; `idx_partides_usuari` |
| `nom_sala` | `VARCHAR(100)` | `NOT NULL` | `idx_partides_sala` |
| `categoria` | `VARCHAR(100)` | `NOT NULL DEFAULT 'General'` | |
| `posicio` | `INT UNSIGNED` | `NOT NULL DEFAULT 1` | sense CHECK |
| `encerts` | `INT UNSIGNED` | `NOT NULL DEFAULT 0` | sense CHECK |
| `rondes` | `TINYINT UNSIGNED` | `NOT NULL DEFAULT 0` | el model la declara `INTEGER` |
| `data_partida` | `DATETIME` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | `idx_partides_data` |

Per a què serveix: una fila per jugador i partida acabada, en format desnormalitzat, per calcular perfil i rànquing sense fer joins amb l'historial. Complementa (no substitueix) `partida`/`resposta`. No té cap `UNIQUE`, `CHECK` ni clau d'idempotència: el mateix resultat es pot inserir dues vegades (vegeu §9.16).

### 6.11 `registre`

| Columna | Tipus | Null / defecte | Claus i notes |
|---|---|---|---|
| `id` | `BIGINT UNSIGNED` | `AUTO_INCREMENT` | PK |
| `servei` | `VARCHAR(30)` | `NOT NULL` | `"auth"`, `"catalog"`, `"stats"` |
| `metode` | `VARCHAR(10)` | `NOT NULL` | `req.method` |
| `ruta` | `VARCHAR(200)` | `NOT NULL` | `req.path` |
| `estat` | `SMALLINT UNSIGNED` | `NOT NULL` | `res.statusCode` |
| `creat_at` | `DATETIME` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` | `idx_registre_data`, `idx_registre_estat` |

Per a què serveix: auditoria HTTP (percentatge d'èxits/errors al panell). No té retenció ni purga. No hi ha índex sobre `servei` (les consultes filtren per `creat_at` i agrupen per `estat`, que sí que tenen índex). `ruta` és `VARCHAR(200)`: una ruta més llarga dependria del mode estricte (error o truncament, **no verificat**).

### 6.12 Inventari d'índexs i restriccions

Tots els índexs declarats (a més de les PK, que no es repeteixen):

| Taula | Índex | Columnes | Per a què |
|---|---|---|---|
| `categoria` | `uq_categoria_nom` | `nom` | UNIQUE; també accelera `WHERE nom = ?` |
| `pregunta` | `idx_pregunta_categoria_id` | `categoria_id` | FK i filtre per categoria |
| `partida` | `uq_partida_codi` | `codi` | UNIQUE; és la clau de totes les consultes del joc |
| `participant` | `uq_participant_partida_nickname` | `partida_id, nickname` | UNIQUE; cobreix els `WHERE partida_id = ?` |
| `participant` | `idx_participant_partida_id` | `partida_id` | redundant (prefix de l'anterior) |
| `ronda` | `uq_ronda_partida_numero` | `partida_id, numero` | UNIQUE |
| `ronda` | `uq_ronda_partida_pregunta` | `partida_id, pregunta_id` | UNIQUE |
| `ronda` | `idx_ronda_partida_id` | `partida_id` | redundant (prefix dels dos UNIQUE) |
| `ronda` | `idx_ronda_pregunta_id` | `pregunta_id` | necessari per la FK i cerques per pregunta |
| `resposta` | `uq_resposta_ronda_participant` | `ronda_id, participant_id` | UNIQUE; cobreix `WHERE ronda_id = ?` |
| `resposta` | `idx_resposta_participant_id` | `participant_id` | necessari (l'UNIQUE no comença per aquesta columna) |
| `rol` | `uq_rol_nom` | `nom` | UNIQUE |
| `usuaris` | `uq_usuaris_nom` | `nom` | UNIQUE |
| `usuaris` | `uq_usuaris_email` | `email` | UNIQUE |
| `usuaris` | (implícit per la FK) | `rol_id` | InnoDB crea l'índex de la FK si no n'hi ha cap |
| `partides` | `idx_partides_data` | `data_partida` | sèries `usage` |
| `partides` | `idx_partides_sala` | `nom_sala` | agrupació per sala |
| `partides` | `idx_partides_usuari` | `usuari_id` | perfil i rànquing |
| `registre` | `idx_registre_data` | `creat_at` | finestres de 1/7/30 dies |
| `registre` | `idx_registre_estat` | `estat` | `GROUP BY estat` |

No hi ha índex sobre `partida.estat`, `partida.tipus`, `ronda.estat`, `pregunta.dificultat` ni `registre.servei`. Amb els volums actuals (31 preguntes inicials, partides d'uns quants jugadors) no és un problema; sí que ho seria amb `registre` i `partides` grans.

### 6.13 Charset, collation, motor i zona horària

| Aspecte | Valor al codi | Efecte |
|---|---|---|
| Base de dades | `CREATE DATABASE ... CHARACTER SET utf8mb4`, **sense `COLLATE`** | El charset és utf8mb4 (si la BD no l'ha creada abans `MARIADB_DATABASE`); la collation és la del servidor |
| Taules | `rol`, `partides` i `registre` amb `DEFAULT CHARSET=utf8mb4`; la resta l'hereten | Cap `COLLATE` explícita |
| Collation real | la del defecte de la imatge `mariadb:11` | MariaDB ≥ 11.4 acostuma a `utf8mb4_uca1400_ai_ci`; versions anteriors, `utf8mb4_general_ci`. **No verificat** en instància |
| Conseqüència | comparacions i UNIQUE **case-insensitive i, segons collation, accent-insensitive** | `WHERE pt.nickname = ?` pot equiparar `Pep`/`pep` (i `Josep`/`Jósèp`); `uq_usuaris_nom` impedeix `Admin` si ja existeix `admin` |
| Longituds | `VARCHAR(n)` compta caràcters, no bytes; `CHAR_LENGTH(TRIM(...))` dels CHECK també | Els emojis ocupen 1 caràcter a `VARCHAR(32)` però 4 bytes a la connexió |
| Connexió | `game` i `catalog` fixen `utf8mb4`; `auth` i `stats` no | Si el driver negocia utf8mb3, un emoji pot fallar o arribar corromput (**no verificat**) |
| Motor | `InnoDB` a totes les taules | Transaccions, `FOR UPDATE` i FK reals; `--single-transaction` és segur per backups |
| Zona horària | ni `TZ` a Compose ni `timezone`/`time_zone` a clients o servidor | `DATETIME` desa l'hora de paret del servidor; `NOW()`/`CURRENT_TIMESTAMP` la del servidor; els `Date` de JS es converteixen amb la configuració del driver. Els gràfics `usage` i `codi_expira` poden desplaçar-se (**no verificat**) |
| `sql_mode` | no fixat | MariaDB valida els `CHECK` des de 10.2.1 encara que el mode sigui lax; els CHECK d'aquest esquema **són reals** |
| Objectes | cap vista, trigger, procediment, event ni columna JSON | Tot el treball és a les taules i al codi |

### 6.14 Migracions vs `schema.sql`

| Migració | Què fa exactament | Ja és a `schema.sql`? | Idempotent? | El codi ho espera? |
|---|---|---|---|---|
| `add-question-slider-fields.sql` | `MODIFY resposta_correcta DOUBLE NOT NULL`; `ADD COLUMN min_value/max_value/step_value DOUBLE NULL`; omple els valors amb una fórmula basada en `id` i `unitat`; els passa a `NOT NULL`; `ADD CONSTRAINT chk_pregunta_slider` | **Sí, estat final** (`min_value`, `max_value`, `step_value` NOT NULL i el CHECK) | **No**: `ADD COLUMN` falla si les columnes ja existeixen | Sí: totes les consultes del joc i el model `Pregunta` llegeixen `min_value`/`max_value`/`step_value` |
| `dynamic-difficulties.sql` | `MODIFY pregunta.dificultat VARCHAR(32) NOT NULL`; `MODIFY partida.dificultat VARCHAR(32) NOT NULL DEFAULT 'media'` | **Sí, estat final** | Sí (`MODIFY` es pot repetir) | Sí: el codi tracta la dificultat com a text lliure (`SELECT DISTINCT`, filtre `= ?`, validació 1–32) |

Conseqüències:

- En una BD creada pel `docker-compose` (schema + dades inicials), **no cal executar cap de les dues migracions**. `add-question-slider-fields.sql` fallaria amb `Duplicate column name 'min_value'`.
- `add-question-slider-fields.sql` només té sentit en una BD anterior al slider. Si s'executés sobre una BD ja sembrada amb `dades-inicials.sql` (sense les columnes), la fórmula **sobreescriuria** els rangs cuinats del seed; el seed ja porta `min`/`max`/`step` coherents.
- `dynamic-difficulties.sql` només cal en bases antigues on `dificultat` era `ENUM`; el seed actual ja insereix `facil`/`media`/`dificil` i el codi permet qualsevol text.
- Cap de les dues crea `partides.rondes`, però `schema.sql` ja la inclou: no cal cap migració per aquesta columna.

### 6.15 Convencions de noms i decisions de disseny

| Convenció | Evidència |
|---|---|
| Taules en **singular** per a entitats de joc (`partida`, `participant`, `ronda`, `resposta`, `pregunta`, `categoria`, `rol`) | `schema.sql` |
| Taules en **plural** per a agregats i logs (`usuaris`, `partides`, `registre`) | `schema.sql` |
| Columnes en **snake_case** català/castellà barrejat (`nom_sala`, `resposta_correcta`, `data_partida`, `max_jugadors`) | `schema.sql` |
| Prefixos de restriccions `fk_`, `uq_`, `chk_`, `idx_` | `schema.sql` |
| Estats com a `ENUM` en comptes de taules auxiliars | `partida.estat`, `ronda.estat` |
| `UNIQUE` compost per a regles de negoci (nickname per partida, número de ronda, resposta per participant) | `schema.sql` |
| Claus foranes amb `ON UPDATE CASCADE` (excepte `fk_usuari_rol`); `ON DELETE CASCADE` cap a baix i `RESTRICT` cap al catàleg | `schema.sql` |
| `fk_usuari_rol` sense `ON DELETE`/`ON UPDATE` explícit (comportament `RESTRICT`) | `schema.sql` |
| Sense taula de migracions ni de versions | `backend/database/sql/migrations/` |
| Sense `created_at`/`updated_at` automàtics: només `data_creacio`, `data_inici`, `data_fi`, `data_partida`, `creat_at` | `schema.sql` |
| Sense esborrat lògic (`deleted_at`): els esborrats són físics i, sovint, en cascada | `schema.sql` |
| Sense vistes, triggers, procediments ni events | `schema.sql` |
| Estat viu del joc a la memòria; la BD és el registre, no la font de veritat de la sala | `roomStorage.js` |

### 6.16 Dades inicials: què sembra cada script

`dades-inicials.sql` s'executa una sola vegada (volum nou) i és l'única font de dades de demostració. Sembra **exactament**:

| Taula | Files | Valors |
|---|---|---|
| `rol` | 2 | `(1,'usuari')`, `(2,'admin')` — fora de la transacció |
| `usuaris` | 1 | `id=1`, `nom='admin'`, `email='admin@gmail.com'`, `verificat=1`, `rol_id=2`; `password_hash` scrypt amb **contrasenya feble** (el comentari del fitxer la indica); `avatar` i `avatar_color` agafen els defaults de la taula |
| `categoria` | 8 | ids 1–8: `Geografia`, `Ciencia`, `Historia`, `Esports`, `Cultura`, `Cos Humà`, `Tecnologia`, `Curiositats` |
| `pregunta` | 31 | ids fixos (no correlatius): 1,2,3,5,20,21,24,25,28,40,41,45,46,52,57,59,65,71,72,76,80,83,90,93,95,96,102,105,113,122,172 |
| `partida`, `participant`, `ronda`, `resposta` | 0 | Sense cap dada de joc |
| `partides` | 0 | Sense cap agregat |
| `registre` | 0 | Sense cap auditoria |

Distribució de les 31 preguntes: 17 `facil`, 9 `media`, 5 `dificil`; per categoria, 4 Geografia, 5 Ciencia, 5 Historia, 3 Esports, 3 Cultura, 4 Cos Humà, 3 Tecnologia, 4 Curiositats. Totes porten `min_value`, `max_value`, `step_value` i `explicacio`; les unitats són `km`, `m`, `km/s`, `m/s`, `°C`, `°F`, `any`, `anys`, `gols`, `tecles`, `pel·lícules`, `obres`, `ossos`, `litres`, `persones`, `segons`, `calories`, `habitants`, `idiomes`, `píxels` i la cadena buida (per a Pi).

El JSON (`preguntas.json`, 254 preguntes) **no** el carrega cap script d'init: només s'importa si algú executa `npm run import:questions` o si `ensureInitialCatalog` troba `pregunta` buida. Per tant, un entorn nou per `docker compose` arrenca amb 31 preguntes, no amb 254.

---

## 7. Configuració i arrencada

### 7.1 Variables d'entorn rellevants per a la BD

| Variable | Qui la llegeix | Valor a `.env` versionat | Valor a Compose |
|---|---|---|---|
| `DB_HOST` | tots | `localhost` (auth, game) · `mariadb` (stats) · absent a catalog | `mariadb` |
| `DB_PORT` | tots | `3306` | `3306` |
| `DB_USER` | tots | `root` | `root` |
| `DB_PASSWORD` | auth, game, catalog | `root` | `root` |
| `DB_PASS` | stats (i `DB_PASSWORD` com a alternativa) | `root` | `root` |
| `DB_NAME` | tots | `howmuch` | `howmuch` |
| `MARIADB_ROOT_PASSWORD` | contenidor | — | `root` |
| `MARIADB_DATABASE` | contenidor | — | `howmuch` |

`catalog-service/.env` (versionat) només té `PORT` i `INTERNAL_SECRET`; en local sense Compose cauria als fallbacks divergents de §5.1.

`stats-service/.env` sí que porta totes les `DB_*`, però amb `DB_HOST=mariadb`: fora de la xarxa de Compose aquest nom no resol i el servei falla a l'arrencada (després dels 20 reintents).

### 7.2 Arrencada

```bash
# des de l'arrel del repo
docker compose up -d mariadb
docker compose logs -f mariadb          # esperar "ready for connections"
docker compose up -d                    # resta de serveis
docker compose ps                       # mariadb ha d'estar healthy
```

Comprovació directa:

```bash
docker compose exec mariadb mariadb -uroot -proot -e "SELECT VERSION(); SHOW DATABASES;"
docker compose exec mariadb mariadb -uroot -proot howmuch -e "SHOW TABLES;"
docker compose exec mariadb mariadb -uroot -proot howmuch -e "SELECT COUNT(*) FROM pregunta;"
docker inspect --format='{{.State.Health.Status}}' mariadb
docker compose exec mariadb mariadb -uroot -proot -e \
  "SELECT @@version, @@character_set_server, @@collation_server, @@time_zone, @@system_time_zone;"
```

L'última consulta resol les incògnites que el codi deixa obertes: versió exacta de la imatge, collation per defecte (§6.13) i zona horària del servidor.

Client des de l'host (port publicat): `mariadb -h 127.0.0.1 -P 3306 -uroot -proot howmuch` o phpMyAdmin a `http://localhost:8081` (`PMA_HOST=mariadb`).

Cicle de vida del contenidor i efecte sobre la BD:

| Acció | Comanda | Què passa amb les dades | S'executen els init? |
|---|---|---|---|
| Arrencar | `docker compose up -d mariadb` | Es crea el volum si no existeix | Només si el volum és nou |
| Reiniciar el procés | `docker compose restart mariadb` | Es conserva tot | **No** |
| Aturar i tornar a arrencar | `docker compose stop mariadb` + `docker compose start mariadb` | Es conserva tot | **No** |
| Recrear el contenidor | `docker compose up -d --force-recreate mariadb` | Es conserva el volum | **No** (el volum no és buit) |
| Esborrar contenidor i xarxa | `docker compose down` | **Es conserva** `mariadb_data` | No |
| Esborrar-ho tot | `docker compose down -v` | **S'esborra** `mariadb_data` | Sí, al següent `up` |
| Esborrar només el volum | `docker volume rm tr1-dam-equip6_mariadb_data` (el nom pot portar prefix del projecte) | S'esborra | Sí, al següent `up` |

Ordre d'arrencada real: `catalog-service` no té `depends_on` i crida `ensureInitialCatalog()` abans de `listen()`. Si MariaDB encara no ha acabat d'executar l'init o el schema no existeix, el procés surt amb error i és `restart: unless-stopped` qui el reintenta. `stats-service`, en canvi, espera fins a 20 s (20 reintents d'1 s) fent `authenticate()`. `auth-service` i `game-service` no comproven res fins a la primera consulta.

### 7.3 Reinicialització

Els scripts d'init només s'executen **amb el volum buit**. Per recrear l'esquema i les dades inicials:

```bash
docker compose down -v                  # ESBORRA mariadb_data (totes les dades)
docker compose up -d mariadb
```

Alternativa sense perdre el volum (destructiva igualment): `docker compose exec -T mariadb mariadb -uroot -proot < backend/database/sql/schema.sql`. Això **no** és idempotent amb dades existents: `schema.sql` fa `DROP TABLE IF EXISTS usuaris` i `dades-inicials.sql` no usa `INSERT IGNORE` (fallaria per duplicats).

**Atenció**: la resta de taules es creen amb `CREATE TABLE IF NOT EXISTS`. Tornar a executar `schema.sql` sobre una BD existent **no aplica canvis d'estructura** a `categoria`, `pregunta`, `partida`, `participant`, `ronda`, `resposta`, `rol`, `partides` ni `registre`: si una columna nova no hi és, es queda sense. Només `usuaris` es recrea (i perd els comptes). Per això, per canviar l'esquema, o bé es fa `down -v`, o bé s'escriu un `ALTER TABLE` (com les migracions).

### 7.4 Migracions manuals

```bash
# PowerShell
Get-Content backend/database/sql/migrations/dynamic-difficulties.sql |
  docker compose exec -T mariadb mariadb -uroot -proot howmuch
```

Ordre i quan cal:

- `dynamic-difficulties.sql`: només en bases anteriors a la dificultat dinàmica. És idempotent.
- `add-question-slider-fields.sql`: només en bases anteriors al slider. **No és idempotent**: sobre una BD creada pel `schema.sql` actual falla amb `Duplicate column name 'min_value'`. No l'executis en un entorn nou.
- Després de qualsevol de les dues, si cal, reimporta el catàleg des del JSON (vegeu més avall). Tingues en compte que la migració del slider recalcula `min`/`max`/`step` amb una fórmula i sobreescriu els valors que ja hagués sembrat `dades-inicials.sql`.

Importació de preguntes des del JSON:

```bash
docker compose exec -T catalog-service npm run import:questions
```

El CLI llegeix `backend/database/preguntas/preguntas.json`. No fa `DELETE`: fa `findOrCreate` per categoria i actualitza només els camps numèrics de les preguntes que ja existeixen amb el mateix `(categoria_id, text)`.

### 7.5 Inspecció habitual

```bash
# estat de les partides en directe
docker compose exec mariadb mariadb -uroot -proot howmuch -e \
  "SELECT id, codi, estat, max_jugadors, data_inici FROM partida ORDER BY id DESC LIMIT 10;"

# rànquing desnormalitzat
docker compose exec mariadb mariadb -uroot -proot howmuch -e \
  "SELECT usuari_id, COUNT(*) partides, SUM(posicio=1) victories FROM partides GROUP BY usuari_id;"

# salut HTTP auditada
docker compose exec mariadb mariadb -uroot -proot howmuch -e \
  "SELECT servei, estat, COUNT(*) FROM registre GROUP BY servei, estat ORDER BY 3 DESC;"

# estructura real (per comparar amb schema.sql)
docker compose exec mariadb mariadb -uroot -proot howmuch -e \
  "SHOW CREATE TABLE partides\G SHOW CREATE TABLE pregunta\G"
```

El client de la imatge és `mariadb`; l'àlies `mysql` també sol existir-hi (**no verificat**). `information_schema` és la font fiable per comprovar collation i columnes reals:

```bash
docker compose exec mariadb mariadb -uroot -proot -e \
  "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='howmuch' ORDER BY TABLE_NAME, ORDINAL_POSITION;"
```

### 7.6 Còpies de seguretat i restauració

No hi ha cap script al repo; el mecanisme estàndard de MariaDB funciona amb el contenidor:

```bash
# backup (SQL)
docker compose exec -T mariadb mariadb-dump -uroot -proot \
  --single-transaction --routines howmuch > backup-howmuch.sql

# restauració
Get-Content backup-howmuch.sql | docker compose exec -T mariadb mariadb -uroot -proot howmuch
```

`--single-transaction` és adequat perquè totes les taules són InnoDB. Els volums Docker (`mariadb_data`) **no** són una còpia de seguretat.

### 7.7 Recarregar només les dades inicials

`dades-inicials.sql` no és idempotent i no esborra res: si s'executa sobre una BD amb files, peta per duplicats. Dues opcions:

1. **Recomanada**: `docker compose down -v` + `up` (recrea esquema i dades, §7.3).
2. Buidar les taules i tornar a carregar el seed, en una sola sessió (les FK obliguen a desactivar comprovacions i l'ordre importa):

```sql
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE resposta;
TRUNCATE TABLE ronda;
TRUNCATE TABLE participant;
TRUNCATE TABLE partida;
TRUNCATE TABLE partides;
TRUNCATE TABLE registre;
TRUNCATE TABLE usuaris;
TRUNCATE TABLE pregunta;
TRUNCATE TABLE categoria;
TRUNCATE TABLE rol;
SET FOREIGN_KEY_CHECKS = 1;
```

```bash
Get-Content backend/database/sql/dades-inicials.sql |
  docker compose exec -T mariadb mariadb -uroot -proot howmuch
```

`TRUNCATE` no és transaccional i reinicia els `AUTO_INCREMENT`. El seed torna a crear `rol` 1/2, l'usuari `admin` i les 8 categories amb ids 1–8, i les 31 preguntes amb ids fixos; qualsevol dada de joc o compte que hi hagués es perd.

### 7.8 Volum, persistència i `down -v`

- El volum és **anomenat** (`mariadb_data` a `docker-compose.yml`); Compose el prefixa amb el nom del projecte (per defecte, el nom de la carpeta; aquí `tr1-dam-equip6_mariadb_data`, **no verificat** perquè depèn de com s'hagi aixecat).
- `docker volume ls` i `docker volume inspect <nom>` mostren el punt de muntatge dins la VM de Docker (Docker Desktop a Windows no exposa els fitxers com una carpeta normal). No copiïs fitxers del volum en calent: fes servir `mariadb-dump` (§7.6).
- `docker compose down` **atura i elimina contenidors i xarxa, però conserva `mariadb_data`**.
- `docker compose down -v` elimina també els volums declarats: **adéu a usuaris, catàleg, partides, registre i historial**. És irreversible. Les imatges i els Dockerfiles no es toquen.
- Si només s'esborra el contenidor (`docker compose rm -f mariadb`), el volum també es conserva.
- No hi ha cap `tmpfs` ni còpia automàtica: la persistència és responsabilitat del volum i dels backups manuals.

---

## 8. Fitxers clau

| Fitxer | Responsabilitat |
|---|---|
| `docker-compose.yml` | Contenidor `mariadb`, port 3306, volum, healthcheck, muntatge dels dos SQL d'init. |
| `backend/database/sql/schema.sql` | Crea `howmuch` i les deu taules amb PK/FK/UNIQUE/CHECK/índexs. |
| `backend/database/sql/dades-inicials.sql` | Rols, usuari `admin`, 8 categories i 31 preguntes. No idempotent. |
| `backend/database/sql/migrations/add-question-slider-fields.sql` | Migració de camps del slider (min/max/step) i CHECK associat. |
| `backend/database/sql/migrations/dynamic-difficulties.sql` | Converteix `dificultat` en `VARCHAR(32)` (ja reflectit a `schema.sql`). |
| `backend/auth-service/src/pool.js` | Pool mysql2 (fallback `root`/contrassenya buida). |
| `backend/auth-service/src/authService.js` | Registre, verificació, login, avatar i `/stats/:id` (join per nickname). |
| `backend/auth-service/src/middleware/registre.js` | `INSERT INTO registre`. |
| `backend/catalog-service/src/db/pool.js` + `sequelize.js` | Doble accés (SQL i ORM) a `categoria`/`pregunta`, amb fallbacks diferents. |
| `backend/catalog-service/src/questions/preguntas.repository.js` | Selecció aleatòria de preguntes, opcions i CRUD. |
| `backend/catalog-service/src/questions/loadQuestions.js` | Localitza el JSON (repo, Docker o arrel del servei) i el parseja. |
| `backend/catalog-service/src/questions/validarPregunta.js` | Validació prèvia a la importació (rang del slider, dificultat, mides). |
| `backend/catalog-service/src/questions/importQuestions.js` | Import transaccional del JSON amb `findOrCreate` per categoria. |
| `backend/catalog-service/src/cli/importQuestions.js` | Entrada de `npm run import:questions`. |
| `backend/database/preguntas/preguntas.json` | Catàleg d'origen que llegeix la importació. |
| `backend/game-service/src/db/pool.js` | Pool mysql2 del joc (`utf8mb4`, 10 connexions). |
| `backend/game-service/src/repositories/roomRepository.js` | `partida` i `participant` de sala, amb `FOR UPDATE`. |
| `backend/game-service/src/game/persistence/gameRepository.js` | `ronda`, `resposta`, rànquing, fi de partida i reset destructiu. |
| `backend/game-service/src/game/files/exportGameCsv.js` + `src/cli/exportGameCsv.js` | Exportació CSV d'una partida `acabada` (només lectura; CLI manual). |
| `backend/game-service/src/game/reportStats.js` | `POST /stats/partides` (només camps per usuari registrat). |
| `backend/stats-service/server.js` | `authenticate()` amb 20 reintents d'1 s; importa els models `Partida` i `Usuari` (sense `sync`). |
| `backend/stats-service/src/db.js` | Sequelize sense valors per defecte. |
| `backend/stats-service/src/models/Partida.js` | Model de `partides`; declara `rondes`. |
| `backend/stats-service/src/stats.routes.js` | `INSERT` d'agregats i consultes de perfil/rànquing. |
| `backend/stats-service/src/admin/admin.routes.js` | Agregats, `registre` i sèries `usage`. |
| `backend/stats-service/src/middleware/registre.js`, `backend/catalog-service/src/middleware/registre.js` | Auditoria HTTP (Sequelize). |

---

## 9. Riscos i punts febles (evidència de codi)

### 9.1 `partides.rondes` — resolt

`schema.sql` declara `rondes TINYINT UNSIGNED NOT NULL DEFAULT 0` a `partides` (línia 173), així que l'`INSERT` de `Partida.create(...)` (`stats.routes.js:53-60`, `reportStats.js:32`) ja troba la columna i les estadístiques es desen. El model `Partida.js:24-28` la declara `TINYINT.UNSIGNED`, com l'esquema.

### 9.2 `partides.usuari_id` — resolt

`partides.usuari_id` és `INT UNSIGNED NULL`, igual que `usuaris.id`, i té `fk_partides_usuari` (`schema.sql:176-178`) amb `ON DELETE SET NULL`. Conseqüències:

- `POST /stats/partides` encara accepta qualsevol `userId >= 1`; qui valida l'existència és la FK (l'`INSERT` falla amb `ER_NO_REFERENCED_ROW_2`).
- En esborrar un usuari, l'agregat **es conserva** amb `usuari_id = NULL`: el rànquing el descarta per l'`INNER JOIN`, però les estadístiques globals no perden la fila.

### 9.3 `participant.nickname` com a clau de join amb `usuaris.nom`

Ni `participant` ni `partides` guarden `usuari_id`. El vincle entre joc i compte és **el text del nickname**:

- `auth-service` (`authService.js:305-352`) fa servir `usuaris.nom` com a `pt.nickname` a `/stats/:id`.
- `usuaris.nom` admet fins a 30 caràcters (`chk_usuaris_nom`), però `participant.nickname` només 15 (`VARCHAR(15)`): un usuari amb nom de 16–30 caràcters no pot coincidir mai.
- El nickname de sala és lliure (3–15 caràcters, únic només dins la sala) i no ha de coincidir amb el nom del compte: un usuari registrat pot jugar com `Pep` i les seves partides s'assignaran a un compte anomenat `Pep` si existeix.
- La comparació depèn de la collation (no fixada a l'esquema; per defecte de MariaDB 11 és case-insensitive, **no verificat en instància**), mentre la memòria del joc compara nicknames de manera exacta.

### 9.4 La categoria de `partides` sempre acaba sent `'General'`

`game-service` envia `userId`, `nomSala`, `posicio`, `encerts` i `rondes` (`reportStats.js:27-33`), **sense `categoria`**. `stats-service` aplica el valor per defecte `'General'` (`stats.routes.js:49-51`, `Partida.js:13`). Per tant:

- `GET /stats/me` retorna sempre `categoriaMesJugada: "General"`.
- Les estadístiques per sala existeixen, però les per categoria no tenen cap dada real.
- El nom de la sala sí que arriba (`room.nameRoom || roomId`).

### 9.5 `schema.sql` esborra `usuaris` si es torna a executar

`schema.sql:138` fa `DROP TABLE IF EXISTS usuaris;` abans del `CREATE TABLE`. Amb el volum nou no passa res, però executar l'script sobre una BD existent (documentat com a alternativa a §7.3) **destrueix tots els comptes** i deixa `partides` òrfena (no hi ha FK que ho impedeixi ni que ho propagui). Cap avís al fitxer.

### 9.6 Credencials febles i secrets versionats

- `docker-compose.yml` publica `3306:3306` amb l'usuari `root` i una contrasenya per defecte feble (la mateixa que porta el `healthcheck` en text pla). Qualsevol equip de la xarxa pot connectar-s'hi.
- `dades-inicials.sql:10-11` sembra l'usuari `admin` amb una contrasenya feble coneguda (el mateix fitxer la indica en un comentari) i `rol_id = 2`. És un compte administratiu real amb JWT de 7 dies.
- `.env` **està versionat**: `git ls-files` inclou `.env`, `backend/*/.env`, amb `AUTH_SECRET`, `INTERNAL_SECRET` i la contrasenya SMTP reals. `backend/auth-service/.env` fins i tot té les línies indentades (funciona només si el parser retalla espais; **no verificat**).
- `stats-service` i `catalog-service` no validen les variables de BD a l'arrencada: amb un `.env` incomplet, l'error és un `undefined` de Sequelize, no un missatge clar.

### 9.7 Dues estadístiques en paral·lel, i una s'esborra

Hi ha dos models de resultats:

1. **Normalitzat** (`partida` + `participant` + `ronda` + `resposta`), que consulta `auth-service /stats/:id` (`estat = 'acabada'`).
2. **Desnormalitzat** (`partides`), que consulta `stats-service`.

`resetAbandonedGameRecord` (`gameRepository.js:289-300`) esborra ronda, participant i respostes 15 s després del final i posa `partida.estat = 'esperant'`. Resultat: **`/stats/:id` d'auth-service només veu partides durant la finestra de 15 s**; passat aquest temps, `gamesPlayed`, `gamesWon` i `accuracyPercentage` tornen a 0. A més, `correctAnswers` es calcula amb `r.posicio = 1` (millor de la ronda), cosa que no equival a "encertar".

### 9.8 `encerts` té tres definicions diferents

| Origen | Definició real |
|---|---|
| `game-service` → `partides.encerts` | respostes amb `punts >= 450` (`getCorrectRoundsByNickname`) |
| `auth-service /stats/:id` | respostes amb `posicio = 1` dins la ronda |
| `stats-service /stats/me` | `AVG(encerts)` de la columna anterior |

Cap de les tres és "resposta exacta" (`punts = 530`). El panell compara mètriques que no són comparables.

### 9.9 `partida.dificultat` no es persisteix

La configuració de sala permet canviar la dificultat, però `roomRepository.js` només actualitza `max_jugadors` (`UPDATE partida SET max_jugadors = ?`) i l'INSERT de creació no envia `dificultat`. Totes les files queden amb el valor per defecte `'media'`, així que no es pot reconstruir amb quina dificultat es va jugar. Tampoc es desa la categoria, el nombre de rondes ni la durada.

### 9.10 Integritat de `resposta` incompleta

Les FK asseguren que `ronda_id` i `participant_id` existeixen, però no que el participant sigui de la partida de la ronda. La comprovació és només al codi de `gameRepository` (`saveAnswerRecord` resol el participant per `(partida_id, nickname)` i `closeRoundRecord` valida `partida_id`); si s'insereix per una altra via, la BD ho accepta. Tampoc no hi ha CHECK que limiti `punts` a la corba real (0–530).

### 9.11 `registre` creix sense límit

Cada resposta HTTP de `auth`, `catalog` i `stats` afegeix una fila (`res.on("finish")`), incloent `/health` d'auth, `/stats/ranking` i totes les rutes admin. No hi ha mostreig, retenció ni purga; el panell només llegeix finestres de 1/7/30 dies. El `game-service` (WebSocket) no hi escriu: els seus errors no compten al percentatge.

### 9.13 Inicialització doble del catàleg

Hi ha dues vies que sembren preguntes: `dades-inicials.sql` (31 files amb ids fixos) i `ensureInitialCatalog` del `catalog-service` (importa `preguntas.json` si `COUNT(*) FROM pregunta = 0`). Si s'esborren totes les preguntes però no les categories, la segona via les torna a importar amb ids nous, de manera que qualsevol referència externa a un `pregunta.id` deixa de ser vàlida (`ronda.pregunta_id` té `ON DELETE RESTRICT`, així que no es poden esborrar preguntes ja jugades).

### 9.14 Detalls menors

- `add-question-slider-fields.sql` marca `min_value`/`max_value`/`step_value` com a `NOT NULL` després d'emplenar-los: en una taula gran, l'ALTER bloqueja i falla si queda alguna fila sense valor. `schema.sql` ja neix amb l'estat final, i la migració **no és idempotent** (vegeu §6.14).
- `dades-inicials.sql` no és idempotent (cap `INSERT IGNORE`/`ON DUPLICATE KEY`); executar-lo dues vegades peta. A més, el `INSERT` de `rol` queda **fora** de la transacció: si falla la part de preguntes, els rols ja hi són i el segon intent peta per duplicat.
- `schema.sql` barreja `CREATE TABLE IF NOT EXISTS` (no actualitza res en una BD existent) amb un `DROP TABLE IF EXISTS usuaris` (destrueix comptes). No hi ha cap eina que garanteixi que una BD antiga acabi amb l'estructura del fitxer.
- `usuaris.avatar_image` és `LONGTEXT` amb imatges de fins a ~2,2 MB en base64: cada consulta `SELECT *` o el `listUsers` d'admin arrossega aquestes dades (el `listUsers` selecciona columnes, però el model `Usuari` de stats inclou el camp).
- `catalog-service` té dues configuracions de connexió amb fallbacks contradictoris (`mariadb`/`root` vs `localhost`/buit); en local, el pool SQL i el Sequelize poden apuntar a servidors diferents.
- `startGameRecord` crea la ronda 1 dins la mateixa transacció que el canvi a `en_curs`, però no desa la configuració de la partida; si el procés cau, queden files `en_curs` sense conciliació a l'arrencada (el joc no llegeix la BD per reconstruir sales).
- MariaDB no té `timezone` configurat ni a `docker-compose` ni als clients; `DATETIME` i `DATE_SUB(NOW(), …)` depenen de la zona del servidor mentre els `Date` de JS viatgen en UTC. Les sèries de `usage` poden desplaçar-se (**no verificat** en instància).
- L'esquema no fixa `COLLATE`: la unicitat de `participant.nickname` i `usuaris.nom` depèn del defecte del servidor.

### 9.15 L'exportació CSV depèn de l'historial que s'esborra

`exportGameCsv` exigeix `partida.estat = 'acabada'` i llegeix `ronda`/`resposta`. Al cap de 15 s (o abans, si tothom es desconnecta: `roundEvents.js:581`), `resetAbandonedGameRecord` deixa la partida a `'esperant'` i esborra l'historial. Resultat: el CSV només es pot generar en aquesta finestra; després falla amb "Només es poden exportar partides acabades" o "La partida no existeix". No hi ha cap ruta HTTP que el dispari: és un CLI manual (`src/cli/exportGameCsv.js`).

### 9.16 `partides` no té clau d'idempotència

No hi ha `UNIQUE` ni comprovació prèvia. `reportGameStats` fa un `POST` per jugador; si el final de partida s'executa dues vegades (o s'hi afegeix un reintent), el perfil i el rànquing compten doble. Tampoc no hi ha `ON DUPLICATE KEY`. El `game-service` no mira la resposta HTTP (`fetch` no llança amb 4xx/5xx), així que un `500` del stats-service passa inadvertit.

### 9.17 El catàleg té dues fonts i dos conjunts de dades

`dades-inicials.sql` sembra **31 preguntes** amb ids fixos; `preguntas.json` en té **254** i el seu `id` s'ignora en importar. `ensureInitialCatalog` només importa si `COUNT(*) FROM pregunta = 0`. Si algú esborra totes les preguntes, la reimportació crea ids nous i qualsevol referència externa a un `pregunta.id` deixa de ser vàlida.

### 9.18 Connexions sense charset ni timezone explícits

`auth-service` i `stats-service` no fixen `charset` al pool; `catalog-service` en canvi té dues configuracions (pool `utf8mb4` i Sequelize sense charset). Si el driver negocia utf8mb3, els emojis d'`usuaris.avatar` i els accents de noms/preguntes poden fallar o corrompre's. Cap servei fixa `timezone`, i el contenidor no té `TZ`: les dates `DATETIME` i els `Date` de JS poden desplaçar-se respecte de l'hora local. **No verificat** en instància.

### 9.19 Resum de punts d'atenció per prioritat

| Prioritat | Problema | Efecte |
|---|---|---|
| — | ~~`partides.usuari_id` sense FK~~ — **resolt**: `INT UNSIGNED NULL` + FK `ON DELETE SET NULL` | Ja no aplica |
| 2 | Estadístiques normalitzades esborrades al lobby | `/stats/:id` torna 0 al cap de 15 s |
| 3 | Join per nickname i `VARCHAR(15)` vs `30` | Estadístiques atribuïdes malament o perdudes |
| 4 | `categoria` sempre `'General'` | Estadístiques per categoria inútils |
| 5 | Credencials per defecte febles + `.env` versionat | Accés total a la BD i al panell |
| 6 | `DROP TABLE usuaris` a `schema.sql` | Pèrdua de comptes si es reexecuta |
| 7 | Export CSV només dins de la finestra de 15 s | L'exportació és impossible en la pràctica |
| 8 | `partides` sense idempotència ni UNIQUE | Doble recompte si es repeteix el report |
| 9 | Connexions sense charset/timezone i collation no fixada | Emojis/accents i dates incorrectes |
| 11 | Migracions no idempotents / schema només `IF NOT EXISTS` | Entorns antics i nous divergeixen |
