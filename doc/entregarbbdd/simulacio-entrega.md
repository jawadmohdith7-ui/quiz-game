# Simulació de la validació · Blocs 1 a 4

Guia pas a pas per demostrar al professor les tasques T1 a T11 (blocs 1 a 4) en els ~18 minuts que dura la part de base de dades. Cada pas indica **què dir**, **què executar** i **què ha de sortir**.

Escenari: dos jugadors (**Ana** i **Bob**) juguen una partida de dues rondes i una tercera persona (**Carla**) entra com a espectadora. Els valors de punts i de respostes són d'exemple; els noms de les taules, les restriccions i les consultes són reals.

Tots els exemples SQL s'han provat en un MariaDB 11 buit.

---

## 0 · Preparació (abans de començar la validació)

1. Reinicia la base de dades perquè s'apliquin `schema.sql` i `dades-inicials.sql` des de zero:

   ```bash
   docker compose down -v
   docker compose up -d
   ```

2. Comprova que el contenidor respon:

   ```bash
   docker exec mariadb mariadb -uroot -proot -e "SELECT VERSION();"
   ```

3. Obre aquests elements:
   - **phpMyAdmin**: <http://localhost:8081> (usuari `root`, contrasenya `root`), amb la base de dades `howmuch` seleccionada.
   - **Un terminal** a l'arrel del projecte (`tr1-dam-equip6`).
   - **Editor** amb [schema.sql](../../backend/database/sql/schema.sql) i [dades-inicials.sql](../../backend/database/sql/dades-inicials.sql).
   - **Dos clients de joc** (dos finestres o dos navegadors) i **un tercer client** per a l'espectadora.
   - Aquest document i [el README de la entrega](./README.md) per tenir a mà l'enllaç a cada tasca.

Si la base de dades ja existia, `docker compose down -v` la buida. Si no, fes el pas 0 igualment: `CREATE TABLE IF NOT EXISTS` no modifica taules existents.

---

## Bloc 1 · Model de dades

### T1 · Diagrama ER i model relacional (4 min en total amb T2 i T3)

**Què dir:** «El model està a `doc/`. Aquí tenim les entitats `categoria`, `pregunta`, `partida`, `participant`, `ronda` i `resposta`. Puc explicar qualsevol associació.»

**Què obrir:** [model-de-dades.md](../model-de-dades.md) (diagrama Mermaid i model relacional).

**Exemple que el professor pot triar:** «`ronda` → `pregunta`» i «`resposta` → `participant`». Busca-les a `schema.sql`:

```bash
grep -n "fk_ronda_pregunta\|fk_resposta_participant" backend/database/sql/schema.sql
```

Sortida esperada: `fk_ronda_pregunta` a la línia 102 i `fk_resposta_participant` a la línia 128.

### T2 · `schema.sql` sobre una base de dades buida

**Pas 1 · Buidar la base de dades i executar l'esquema.**

```bash
docker exec -i mariadb mariadb -uroot -proot -e "DROP DATABASE IF EXISTS howmuch;"
docker exec -i mariadb mariadb -uroot -proot < backend/database/sql/schema.sql && echo "ESQUEMA OK"
```

Sortida esperada: `ESQUEMA OK` sense cap `ERROR`.

**Pas 2 · Comprovar les taules.** A phpMyAdmin, pestanya *SQL* de `howmuch`:

```sql
SHOW TABLES;
```

Han de sortir `categoria`, `pregunta`, `partida`, `participant`, `ronda` i `resposta`, a més de les taules d'usuaris.

**Pas 3 · Mostrar les restriccions** (les pots mostrar a [schema.sql](../../backend/database/sql/schema.sql) o a phpMyAdmin, en *Estructura*, pestanya *Vista de relacions*):

| Requisit | Exemple al projecte | On |
|---|---|---|
| FK amb `ON DELETE` | `fk_pregunta_categoria` té `ON DELETE RESTRICT` | línia 43 |
| FK amb `ON DELETE` (cascada) | `fk_participant_partida` té `ON DELETE CASCADE` | línia 81 |
| `UNIQUE` compost | `uq_participant_partida_nickname (partida_id, nickname)` | línia 72 |
| `UNIQUE` compost | `uq_resposta_ronda_participant (ronda_id, participant_id)` | línia 120 |
| `NOT NULL` | `pregunta.text`, `partida.codi`, `resposta.valor` | línies 25, 50, 116 |
| `CHECK` | `chk_partida_max_jugadors CHECK (max_jugadors BETWEEN 2 AND 20)` | línia 60 |

**Pas 4 · Demostrar que el `CHECK` rebutja dades incorrectes.** Insereix a phpMyAdmin (o per terminal) una partida amb 1 jugador:

```bash
docker exec -i mariadb mariadb -uroot -proot howmuch -e "INSERT INTO partida (tipus, codi, max_jugadors) VALUES ('publica', 'ERR01', 1);"
```

Sortida esperada:

```
ERROR 4025 (23000) at line 1: CONSTRAINT `chk_partida_max_jugadors` failed for `howmuch`.`partida`
```

**Què dir:** «La base de dades ho rebutja encara que el codi de l'aplicació no ho comprovés.»

### T3 · `dades-inicials.sql` executable dues vegades

**Pas 1 · Primera execució.**

```bash
docker exec -i mariadb mariadb -uroot -proot < backend/database/sql/dades-inicials.sql && echo "SEED 1 OK"
docker exec mariadb mariadb -uroot -proot howmuch -e "SELECT COUNT(*) AS preguntes, MIN(id) AS primera, MAX(id) AS ultima FROM pregunta;"
```

Sortida esperada: 31 preguntes, ids de l'1 al 172.

**Pas 2 · Segona execució.** Ha d'acabar sense errors i donar els mateixos valors:

```bash
docker exec -i mariadb mariadb -uroot -proot < backend/database/sql/dades-inicials.sql && echo "SEED 2 OK"
docker exec mariadb mariadb -uroot -proot howmuch -e "SELECT COUNT(*) AS preguntes, MIN(id) AS primera, MAX(id) AS ultima FROM pregunta;"
```

Sortida esperada: `SEED 2 OK` i les mateixes 31 preguntes amb els mateixos ids.

**Què dir:** «Les inserts usen `ON DUPLICATE KEY UPDATE id = id`, de manera que una segona execució no duplica files ni canvia ids.» ([dades-inicials.sql](../../backend/database/sql/dades-inicials.sql))

---

## Bloc 2 · Banc de preguntes amb Sequelize

### T4 · Models sense `sync()`

**Què dir:** «Hi ha una única instància de Sequelize i els models tenen `tableName` i `timestamps: false`. Cap servei crea taules: l'esquema el controla `schema.sql`.»

```bash
grep -rn "sync(" backend --include=*.js --exclude-dir=node_modules
```

Sortida esperada: cap resultat.

```bash
grep -n "tableName\|timestamps" backend/catalog-service/src/db/sequelize.js
```

Sortida esperada: les línies on es defineixen `tableName` i `timestamps: false` (per exemple, les línies 38 i 126).

### T5 · CRUD de categories i preguntes amb validacions del model

**Què dir:** «Les validacions són al model, no a la ruta. Si una dada no és vàlida, la resposta indica quin camp falla.»

Les validacions estan a [sequelize.js](../../backend/catalog-service/src/db/sequelize.js) (línies 32, 71, 78, 85, 112 i 120). Les rutes CRUD estan a [admin.routes.js](../../backend/catalog-service/src/admin/admin.routes.js) (`/categories` i `/preguntes`, amb `GET`, `POST`, `PATCH` i `DELETE`).

**Demostració (catalog-service al port 3001).** Cal `INTERNAL_SECRET` (el del fitxer `.env`):

```bash
# Crear una categoria
curl -s -X POST http://localhost:3001/internal/admin/categories \
  -H "Content-Type: application/json" -H "x-internal-secret: $INTERNAL_SECRET" \
  -d '{"nom":"Simulacio"}'

# Repetir el mateix nom: ha de rebutjar-ho amb un missatge clar
curl -s -X POST http://localhost:3001/internal/admin/categories \
  -H "Content-Type: application/json" -H "x-internal-secret: $INTERNAL_SECRET" \
  -d '{"nom":"Simulacio"}'
```

Sortida esperada de la segona crida: error de validació que indica que el nom de la categoria ja existeix.

Per al cas de la pregunta amb dades no vàlides (per exemple, `min_value` més gran que `max_value`), envia el `POST` a `/internal/admin/preguntes` i mostra el missatge per camp.

Després, a phpMyAdmin, `SELECT * FROM categoria;` ha de mostrar la categoria creada.

> **Limitació coneguda:** el CRUD només és accessible per API. El client no té pantalla per gestionar-lo. Si el professor ho demana, explica-ho així i mostra les crides de dalt.

### T6 · Associacions amb `include` i esborrat protegit

**Què dir:** «Una categoria té moltes preguntes. Si intento esborrar una categoria amb preguntes, la base de dades ho impedeix (`RESTRICT`). Una categoria buida sí que es pot esborrar.»

**Demostració 1 · esborrat bloquejat (phpMyAdmin o terminal):**

```bash
docker exec -i mariadb mariadb -uroot -proot howmuch -e "DELETE FROM categoria WHERE id = 1;"
```

Sortida esperada:

```
ERROR 1451 (23000) at line 1: Cannot delete or update a parent row: a foreign key constraint fails (`howmuch`.`pregunta`, CONSTRAINT `fk_pregunta_categoria` ...)
```

**Demostració 2 · categoria buida (la de l'exemple de T5):**

```bash
curl -s -X DELETE http://localhost:3001/internal/admin/categories/<ID_DE_LA_CATEGORIA_SIMULACIO> -H "x-internal-secret: $INTERNAL_SECRET"
```

**Associacions amb `include`:** [preguntas.repository.js](../../backend/catalog-service/src/questions/preguntas.repository.js) (línies 213, 292, 365 i 372). Associacions a [sequelize.js](../../backend/catalog-service/src/db/sequelize.js) (`onDelete: "RESTRICT"`, línies 134 i 140).

---

## Bloc 3 · Joc amb mysql2

Per a aquest bloc la partida es fa amb els clients reals. Abans de començar, anota el **codi de la partida** que aparegui a la sala. El codi real té el format `sala_` seguit de 10 caràcters hexadecimals (per exemple `sala_3f9a1c07bd`). En els exemples es usa `K7QX2P` com a marcador: substitueix-lo pel codi real.

### T7 · Pool compartit i codi o nicknames únics

**Què dir:** «Cada servei crea un únic pool de mysql2 i el reutilitza. El codi de partida és únic a la base de dades i dins d'una partida no es pot repetir un nickname.»

```bash
grep -rn "createPool" backend --include=*.js --exclude-dir=node_modules
```

Sortida esperada: tres resultats, un per servei (`auth-service`, `catalog-service` i `game-service`), cadascun a `src/.../pool.js`. El de joc és a [game-service/src/db/pool.js](../../backend/game-service/src/db/pool.js) (línia 42).

**Demostració (client de joc):**

1. Ana crea la sala, `K7QX2P`, amb màxim 4 jugadors.
2. Bob s'uneix amb el codi `K7QX2P` i entra al lobby.
3. Ana intenta crear una altra sala o Bob intenta unir-se amb el nickname `Ana`. El servidor ho rebutja.

Ho pots comprovar a la base de dades:

```bash
docker exec mariadb mariadb -uroot -proot howmuch -e "SELECT p.codi, pa.nickname FROM partida p JOIN participant pa ON pa.partida_id = p.id WHERE p.codi = 'K7QX2P';"
```

Sortida esperada: dues files, `Ana` i `Bob`, amb el mateix codi.

**Què dir sobre la col·lisió del codi:** el codi té una restricció `UNIQUE` (`uq_partida_codi`, [schema.sql](../../backend/database/sql/schema.sql), línia 58). Si el codi generat ja existeix, la inserció falla amb `ER_DUP_ENTRY` i [createRoom.js](../../backend/game-service/src/rooms/createRoom.js) (línies 228–252) en genera un de nou fins a 3 intents. Si els 3 fallen, retorna l'error.

**Espectadora (Carla).** Carla entra a la sala i es declara espectadora amb el mode observador. Així queda com a observador i no com a jugadora. Es pot comprovar que el nickname de Carla no té cap resposta:

```bash
docker exec mariadb mariadb -uroot -proot howmuch -e "SELECT COUNT(*) AS respostes_carla FROM resposta r JOIN participant pa ON pa.id = r.participant_id WHERE pa.nickname = 'Carla';"
```

Sortida esperada: `0`.

### T8 · Preguntes no repetides i respostes úniques per ronda

**Què dir:** «Dues rondes d'una partida no poden tenir la mateixa pregunta (`uq_ronda_partida_pregunta`). Un jugador només pot respondre una vegada per ronda (`uq_resposta_ronda_participant`). Les preguntes es trien amb `ORDER BY RAND() LIMIT ?` des de [preguntas.repository.js](../../backend/catalog-service/src/questions/preguntas.repository.js) (línia 93).»

**Demostració de les dues rondes.** A la partida `K7QX2P` (amb la ronda 1 en curs):

1. Ana i Bob juguen la ronda 1 i la ronda 2 des dels clients.
2. Consulta les preguntes de la partida:

   ```bash
   docker exec mariadb mariadb -uroot -proot howmuch -e "SELECT r.numero, r.pregunta_id, r.estat FROM ronda r JOIN partida pa ON pa.id = r.partida_id WHERE pa.codi = 'K7QX2P' ORDER BY r.numero;"
   ```

   Sortida esperada (exemple): dues files, `1` i `2`, amb `pregunta_id` diferents i `estat` = `tancada`.

3. Mostra una pregunta que encara no s'ha usat en la partida:

   ```bash
   docker exec mariadb mariadb -uroot -proot howmuch -e "SELECT q.id, q.text FROM pregunta q WHERE q.id NOT IN (SELECT r.pregunta_id FROM ronda r JOIN partida pa ON pa.id = r.partida_id WHERE pa.codi = 'K7QX2P') LIMIT 2;"
   ```

**Demostració de la resposta repetida.** Ana ja ha respost la ronda 1 i intenta enviar una segona resposta:

- Des del client, el servidor ha de respondre amb `ANSWER_ALREADY_EXISTS` i el missatge «Ja has respost aquesta ronda.» ([gameRepository.js](../../backend/game-service/src/game/persistence/gameRepository.js), `saveAnswerRecord`, línia 121, bloc `ER_DUP_ENTRY`).
- Alternativa a phpMyAdmin: insereix la mateixa resposta a mà i mostra l'error 1062:

  ```sql
  INSERT INTO resposta (ronda_id, partida_id, participant_id, valor)
  SELECT ronda_id, partida_id, participant_id, 1 FROM resposta
  WHERE participant_id = (SELECT id FROM participant WHERE nickname = 'Ana') LIMIT 1;
  ```

  Sortida esperada: `ERROR 1062 (23000) ... Duplicate entry ... for key 'uq_resposta_ronda_participant'`.

### T9 · Classificació acumulada amb JOIN, SUM i GROUP BY

**Què dir:** «La classificació no es guarda: es calcula sumant els punts de les respostes de cada participant. Un jugador sense respostes apareix amb 0.»

Consulta del ranking (la mateixa lògica que [gameRepository.js](../../backend/game-service/src/game/persistence/gameRepository.js), `getRanking`, línies 38–50):

```sql
SELECT p.nickname, COALESCE(SUM(a.punts), 0) AS punts
FROM participant p
LEFT JOIN resposta a ON a.participant_id = p.id
WHERE p.partida_id = (SELECT id FROM partida WHERE codi = 'K7QX2P')
GROUP BY p.id, p.nickname
ORDER BY punts DESC, p.nickname ASC;
```

Exemple de sortida (valors d'exemple):

| nickname | punts |
|---|---|
| Ana | 180 |
| Bob | 120 |
| Carla | 0 |

**Comprovació a mà:** els punts d'Ana són la suma de `punts` de les seves dues files:

```sql
SELECT r.numero, a.valor, a.punts FROM resposta a JOIN ronda r ON r.id = a.ronda_id
JOIN participant pa ON pa.id = a.participant_id WHERE pa.nickname = 'Ana' ORDER BY r.numero;
```

Suma els `punts` d'aquestes files i ha de donar el mateix total que la consulta anterior.

---

## Bloc 4 · Transaccions

### T10 · Tancar una ronda en una transacció

**Què dir:** «Tancar una ronda canvia l'estat de la ronda i puntua totes les respostes. Ho fem en una sola transacció amb una connexió del pool: si falla un pas, es fa `rollback` i no queda res a mitges.»

Codi:
- Helper de transacció: [gameRepository.js](../../backend/game-service/src/game/persistence/gameRepository.js), funció `transaction` (línies 21–34): `getConnection`, `beginTransaction`, `commit` si tot va bé, `rollback` si falla i `release` al `finally`.
- Tancar la ronda: `closeRoundRecord` (línia 158), que usa `transaction` (línia 210).

```bash
grep -n "beginTransaction\|commit()\|rollback()\|release()" backend/game-service/src/game/persistence/gameRepository.js
```

**Demostració (ronda 2 de la partida):**

1. Abans de tancar la ronda, mira l'estat a phpMyAdmin:

   ```sql
   SELECT r.numero, r.estat FROM ronda r JOIN partida pa ON pa.id = r.partida_id WHERE pa.codi = 'K7QX2P' ORDER BY r.numero;
   ```

   La ronda 2 ha d'estar `oberta`.

2. Tanca la ronda des del client (l'últim jugador respon o el temps s'acaba).
3. Torna a executar la consulta: la ronda ha de passar a `tancada`, i les respostes de la ronda han de tenir `posicio` i `punts` assignats:

   ```sql
   SELECT pa.nickname, a.valor, a.posicio, a.punts FROM resposta a
   JOIN ronda r ON r.id = a.ronda_id JOIN participant pa ON pa.id = a.participant_id
   WHERE pa.partida_id = (SELECT id FROM partida WHERE codi = 'K7QX2P') AND r.numero = 2;
   ```

**Què dir sobre el fallada:** «Si al mig del tancament falla una escriptura, el `rollback` desfà tot. Per això la ronda no queda mig tancada amb punts a mitges.»

### T11 · `SELECT ... FOR UPDATE` per unir-se i respondre

**Què dir:** «Dos jugadors poden intentar actuar a la vegada sobre la mateixa fila. `FOR UPDATE` bloqueja la fila dins de la transacció, de manera que una de les dues operacions espera i després veu l'estat correcte.»

```bash
grep -rn "FOR UPDATE" backend/game-service/src --include=*.js
```

Punts a mostrar:
- Unir-se a una partida: [roomRepository.js](../../backend/game-service/src/repositories/roomRepository.js) (línia 57, `FOR UPDATE` sobre `partida`).
- Respondre una ronda: [gameRepository.js](../../backend/game-service/src/game/persistence/gameRepository.js) (`saveAnswerRecord`, línia 124, `FOR UPDATE` sobre `ronda`).
- Tancar una ronda: `closeRoundRecord` (línia 171).

**Demostració 1 · resposta a una ronda tancada.** Ronda 1 ja tancada, Bob envia una resposta tard. El servidor la rebutja amb `ROUND_CLOSED` («La ronda ja està tancada.»), perquè `saveAnswerRecord` comprova `estat` després de bloquejar la fila.

**Demostració 2 · unir-se a una partida ja iniciada.** Amb la partida `K7QX2P` en curs, un tercer jugador intenta unir-se. La unió es comprova dins de la transacció amb `FOR UPDATE` (`roomRepository.js`, línies 48–98) i es rebutja amb `ROOM_NOT_WAITING` («La partida ja no accepta més jugadors») perquè la partida ja no està en estat `esperant` ([roomRepository.js](../../backend/game-service/src/repositories/roomRepository.js), `addRoomParticipant`, línies 46–72).

**Explica-ho així:** «Sense `FOR UPDATE`, dues respostes simultànies podrien llegir l'estat `oberta` i inserir les dues després del tancament. Amb el bloqueig, cada operació veu l'estat actual.»

---

## Pas final · Exportar la partida acabada a CSV

Aquest pas és de la tasca 13 (RA1), però és el final natural de la partida de l'escenari.

**Cas negatiu (partida no acabada):**

```bash
cd backend/game-service
DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASSWORD=root DB_NAME=howmuch npm run export:csv -- K7QX2P
```

Sortida esperada: `Error d'exportació: Només es poden exportar partides acabades.` i codi de sortida 1.

**Cas positiu (partida acabada):** quan la partida arriba a `acabada`, executa la mateixa comanda i desa el resultat:

```bash
DB_HOST=127.0.0.1 DB_PORT=3306 DB_USER=root DB_PASSWORD=root DB_NAME=howmuch npm run export:csv -- K7QX2P > partida-K7QX2P.csv
```

Obre `partida-K7QX2P.csv` amb un full de càlcul. Les columnes són `posicio, nickname, punts_totals, ronda, pregunta, resposta, punts_ronda`.

> **Nota:** el CSV només té una fila per resposta. Un jugador sense cap resposta no apareix al fitxer. El CLI està a [exportGameCsv.js](../../backend/game-service/src/cli/exportGameCsv.js) i la lògica a [files/exportGameCsv.js](../../backend/game-service/src/game/files/exportGameCsv.js).

Els `DB_*` del `.env` apunten a `mariadb` (el nom del contenidor a Docker). Des del terminal de l'amfitrió cal `127.0.0.1` i el port `3306`.

---

## Resum per al professor (una frase per tasca)

| Tasca | Què ensenyar en 10 segons |
|---|---|
| T1 | Diagrama a `doc/model-de-dades.md`, associació `ronda` → `pregunta` a `schema.sql` |
| T2 | `DROP DATABASE` + `schema.sql` sense errors; `CHECK` rebutja `max_jugadors = 1` |
| T3 | `dades-inicials.sql` dues vegades, mateixos 31 ids |
| T4 | `grep sync(` sense resultats; `tableName` i `timestamps: false` al model |
| T5 | `POST` de categoria repetida rebutjada amb missatge clar |
| T6 | `DELETE` de categoria amb preguntes bloquejat (1451); categoria buida esborrada |
| T7 | `createPool` únic per servei; nickname repetit rebutjat |
| T8 | Preguntes de la partida diferents; segona resposta rebutjada (1062 o `ANSWER_ALREADY_EXISTS`) |
| T9 | Ranking amb `JOIN` + `SUM` + `GROUP BY`; Carla apareix amb 0 |
| T10 | `beginTransaction` / `commit` / `rollback` / `release` a `gameRepository.js` |
| T11 | `FOR UPDATE` a unir-se i respondre; resposta a ronda tancada rebutjada |
| Extra | CSV exportat d'una partida acabada; negatiu rebutjat |
