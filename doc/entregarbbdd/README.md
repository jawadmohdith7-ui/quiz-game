# Entrega dels blocs 1 a 4 · How Much?! LIVE

Aquest document respon a cada tasca dels blocs 1 a 4 de la guia d'avaluació i indica on es troba cada cosa al projecte.

Els blocs 5 i 6 no formen part d'aquesta entrega.

**Abans de provar:** si la base de dades ja existia, cal recrear-la per aplicar el nou esquema, perquè `CREATE TABLE IF NOT EXISTS` no modifica taules existents:

```bash
docker compose down -v
docker compose up -d
```

---

## Bloc 1 · Model de dades

### T1 · Diagrama ER i model relacional
**Resposta:** diagrama Mermaid (entitat-relació) i model relacional amb les claus, els `UNIQUE` i les regles d'integritat.
**On:** [doc/model-de-dades.md](../model-de-dades.md)

### T2 · `schema.sql`
**Resposta:** creació de totes les taules amb claus primàries, claus foranes amb `ON DELETE` (`CASCADE` o `RESTRICT`), `UNIQUE` compostos i `CHECK`. Es pot executar sobre una base de dades buida.
- Claus foranes amb `ON DELETE`: [schema.sql](../../backend/database/sql/schema.sql), per exemple `RESTRICT` a `pregunta` (línia 43) i `CASCADE` a `participant` (línia 81).
- `UNIQUE` compostos: `uq_participant_partida_nickname`, `uq_ronda_partida_numero`, `uq_ronda_partida_pregunta` i `uq_resposta_ronda_participant` (línies 72, 92, 93 i 120).
- Integritat de la resposta: `resposta` té claus foranes compostes amb `partida_id`, de manera que una resposta no pot apuntar a una ronda o participant d'una altra partida (línies 94 i 73, i les claus de `resposta` a partir de la línia 120).
- `CHECK`: categoria, pregunta, partida, participant, ronda i usuaris (per exemple `max_jugadors BETWEEN 2 AND 20`, línia 60).

Verificat en un MariaDB 10.11 buit: l'esquema i el seed carreguen, una resposta vàlida s'insereix i una resposta d'una altra partida és rebutjada amb l'error 1452.

### T3 · `dades-inicials.sql` re-executable
**Resposta:** les inserts usen `ON DUPLICATE KEY UPDATE id = id`, de manera que es poden executar més d'una vegada sense duplicar dades ni fallar.
**On:** [dades-inicials.sql](../../backend/database/sql/dades-inicials.sql)

---

## Bloc 2 · Banc de preguntes amb Sequelize

### T4 · Models sense `sync()`
**Resposta:** els models es defineixen amb `tableName` i `timestamps: false` sobre una única instància de Sequelize. No es crea cap taula amb `sync()`; l'esquema el controla `schema.sql`.
**On:** [sequelize.js](../../backend/catalog-service/src/db/sequelize.js) (`tableName` a les línies 38 i 126). No hi ha cap crida a `sync()` a `backend/`.

### T5 · CRUD de categories i preguntes amb validacions del model
**Resposta:** el model té validacions (`validate`) per a la categoria i per a la pregunta (text, rang del slider, etc.), i el repositori fa les operacions de categories i preguntes.
**On:** validacions a [sequelize.js](../../backend/catalog-service/src/db/sequelize.js) (línies 32, 71, 78, 85, 112 i 120); operacions a [preguntas.repository.js](../../backend/catalog-service/src/questions/preguntas.repository.js).

**Pendent:** els endpoints d'administració del CRUD encara no estan completament exposats al client (veure la secció 8 de [EXPLICACIONBBDD.md](./EXPLICACIONBBDD.md)).

### T6 · Associació categoria-preguntes amb `include` i esborrat protegit
**Resposta:** `include` carrega les preguntes d'una categoria i la categoria d'una pregunta. L'esborrat d'una categoria amb preguntes està protegit (`RESTRICT`).
**On:** associacions a [sequelize.js](../../backend/catalog-service/src/db/sequelize.js) (`onDelete: "RESTRICT"`, línies 134 i 140); consultes amb `include` a [preguntas.repository.js](../../backend/catalog-service/src/questions/preguntas.repository.js) (línies 213, 292, 365 i 372).

---

## Bloc 3 · Joc amb mysql2

### T7 · Pool compartit i codi o nicknames únics
**Resposta:** cada servei crea un únic `mysql.createPool` i el reutilitza a tot el codi. El codi de partida és únic (`uq_partida_codi`) i el nickname és únic dins de cada partida (`uq_participant_partida_nickname`).
**On:** pool a [game-service/src/db/pool.js](../../backend/game-service/src/db/pool.js) (línia 42); pool a [catalog-service/src/db/pool.js](../../backend/catalog-service/src/db/pool.js) (línia 3); restriccions a [schema.sql](../../backend/database/sql/schema.sql) (línies 58 i 72).

### T8 · Preguntes no repetides i respostes úniques per ronda
**Resposta:**
- Les respostes són úniques per ronda i participant (`uq_resposta_ronda_participant`, [schema.sql](../../backend/database/sql/schema.sql), línia 120).
- Les preguntes no es repeteixen dins d'una partida (`uq_ronda_partida_pregunta`, línia 93). Les preguntes es trien amb `ORDER BY RAND() LIMIT ?` ([preguntas.repository.js](../../backend/catalog-service/src/questions/preguntas.repository.js), línia 93), en una sola consulta per partida, de manera que ja surten distintes.

**Nota:** no s'ha afegit un paràmetre per excloure preguntes ja usades, perquè el flux actual demana totes les preguntes d'una vegada en començar la partida (`gameStartHandler.js`), i no hi ha cap nova demanda per ronda que el necessiti.

### T9 · Classificació acumulada amb JOIN, SUM i GROUP BY
**Resposta:** la classificació es calcula sense guardar-la, sumant els punts de les respostes amb `JOIN`, `COALESCE(SUM(...))` i `GROUP BY`.
**On:** [gameRepository.js](../../backend/game-service/src/game/persistence/gameRepository.js) (línies 41–46 i 258); [exportGameCsv.js](../../backend/game-service/src/game/files/exportGameCsv.js) (línies 40–43).

---

## Bloc 4 · Transaccions

### T10 · Tancar una ronda en una transacció
**Resposta:** tancar la ronda i puntuar les respostes es fa dins d'una sola transacció: `beginTransaction`, `commit` si tot va bé, `rollback` si falla i `release` de la connexió en acabar.
**On:** [gameRepository.js](../../backend/game-service/src/game/persistence/gameRepository.js) (`beginTransaction` a la línia 24, `rollback` a la 29, `release` a la 32; `closeRoundRecord` a partir de la línia 158). També a [roomRepository.js](../../backend/game-service/src/repositories/roomRepository.js).

### T11 · `SELECT ... FOR UPDATE` per unir-se i respondre
**Resposta:** unir-se a una partida i respondre una ronda bloquegen la fila amb `FOR UPDATE` dins d'una transacció, per evitar carreres entre jugadors.
**On:** unir-se a la partida a [roomRepository.js](../../backend/game-service/src/repositories/roomRepository.js) (línia 57); respondre a [gameRepository.js](../../backend/game-service/src/game/persistence/gameRepository.js) (`saveAnswerRecord`, línia 124); també `FOR UPDATE` a la partida i a la ronda en unir-se i en tancar (línies 59, 93, 103, 171 i 191).

---

## Pendents conegudes

- **Test de puntuació:** la secció 8 de [EXPLICACIONBBDD.md](./EXPLICACIONBBDD.md) indica que un test espera 110 punts i el codi en retorna 530. Encara no s'ha reproduït ni resolt.
- **CRUD d'administració:** els endpoints del CRUD de categories i preguntes encara no estan completament exposats al client.
- **Models i esquema:** el model de dades està a [model-de-dades.md](../model-de-dades.md).
