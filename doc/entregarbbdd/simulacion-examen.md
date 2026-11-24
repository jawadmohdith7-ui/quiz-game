# Simulación del examen de BBDD · How Much?! LIVE

Guion paso a paso para enseñar las tareas T1–T15. Está pensado para seguirlo
desde la raíz del proyecto y combinar la aplicación, el terminal, phpMyAdmin y
el código.

> **Importante:** no ejecutes comandos que borren la base de datos si contiene
> información que quieras conservar. El ejemplo de T2 elimina `howmuch` para
> probar el esquema desde cero. Para las demostraciones del juego, utiliza una
> base de datos de pruebas.

## Preparación

1. Abre un terminal en la raíz del repositorio.
2. Arranca los servicios:

   ```bash
   docker compose up -d
   docker compose ps
   ```

3. Abre:
   - La aplicación: <http://localhost:5173>
   - phpMyAdmin: <http://localhost:8081>, base de datos `howmuch`
   - [Este guion](./simulacion-examen.md), [el modelo de datos](../model-de-dades.md)
     y los scripts [schema.sql](../../backend/database/sql/schema.sql) y
     [dades-inicials.sql](../../backend/database/sql/dades-inicials.sql).
4. Ten a mano dos clientes/navegadores para jugar con dos participantes.
   Para la importación JSON, prepara un archivo de prueba siguiendo T12.
5. Si el profesor pide una prueba que modifica o elimina datos, avisa que estás
   usando una base de datos de demostración.

## Bloque 1 · Modelo de datos

### T1 · Diagrama ER y modelo relacional

1. Abre [model-de-dades.md](../model-de-dades.md).
2. Enseña el diagrama Mermaid y luego la sección «Model relacional».
3. Elige una relación del diagrama, por ejemplo `CATEGORIA 1 — N PREGUNTA`.
4. Busca la clave foránea correspondiente en `schema.sql`:

   ```bash
   grep -n "fk_pregunta_categoria" backend/database/sql/schema.sql
   ```

5. Explica que el diagrama, las claves y las reglas de borrado corresponden al
   esquema SQL.

### T2 · Ejecutar `schema.sql` en una base vacía

**Solo si se puede borrar la base de datos de pruebas:**

```bash
docker exec mariadb mariadb -uroot -proot -e "DROP DATABASE IF EXISTS howmuch;"
docker exec -i mariadb mariadb -uroot -proot < backend/database/sql/schema.sql
```

La segunda orden debe terminar sin errores. Después, en phpMyAdmin ejecuta:

```sql
SHOW TABLES;
```

Enseña en `schema.sql` ejemplos de PK/FK, `UNIQUE`, `NOT NULL` y `CHECK`.
Para probar el `CHECK` de jugadores máximos:

```bash
docker exec mariadb mariadb -uroot -proot howmuch -e \
"INSERT INTO partida (tipus, codi, max_jugadors) VALUES ('publica', 'ERR01', 1);"
```

Debe fallar porque `max_jugadors` tiene que estar dentro del rango permitido.
La fila no válida no se debe crear.

### T3 · Reejecutar `dades-inicials.sql`

Ejecuta el seed dos veces:

```bash
docker exec -i mariadb mariadb -uroot -proot < backend/database/sql/dades-inicials.sql
docker exec -i mariadb mariadb -uroot -proot < backend/database/sql/dades-inicials.sql
```

En phpMyAdmin compara antes y después el resultado de:

```sql
SELECT COUNT(*) AS preguntas, MIN(id) AS primera, MAX(id) AS ultima
FROM pregunta;
```

Debe conservar el mismo número de filas y los mismos identificadores. Enseña
los `ON DUPLICATE KEY UPDATE` del seed: permiten reejecutarlo sin duplicar
registros.

## Bloque 2 · Banco de preguntas con Sequelize

### T4 · Conexión y modelos sin `sync()`

Desde la raíz, muestra que no se crean tablas desde Sequelize:

```bash
grep -rn "sync(" backend --include='*.js' --exclude-dir=node_modules
```

No debería haber llamadas a `sync()`. Abre
[sequelize.js](../../backend/catalog-service/src/db/sequelize.js) y enseña la
instancia, los modelos `Categoria` y `Pregunta`, sus `tableName`,
`timestamps: false` y las asociaciones. Explica que las tablas las crea
`schema.sql`, no los modelos.

### T5 · CRUD y validaciones de categorías/preguntas

1. En [sequelize.js](../../backend/catalog-service/src/db/sequelize.js), enseña
   las validaciones del modelo.
2. Desde el cliente de administración, si está disponible, crea una categoría
   y una pregunta válidas; intenta repetir el nombre de categoría o enviar una
   pregunta con un rango inválido.
3. Comprueba en phpMyAdmin que la válida se guardó y la inválida no.
4. Si el panel no ofrece estas operaciones, se pueden enseñar las rutas
   internas del catálogo con `curl`. Usa el `INTERNAL_SECRET` local sin escribir
   su valor en el documento ni en la terminal compartida. Las rutas están en
   `backend/catalog-service/src/admin/admin.routes.js`; el alta de categoría es
   `POST /internal/admin/categories` y el alta de pregunta es
   `POST /internal/admin/preguntes`.

**Transparencia sobre la demo:** la documentación del proyecto indica que el
CRUD no está completamente conectado a una pantalla del cliente. Si no aparece
en la aplicación, no afirmes que funciona desde la UI: muestra el modelo y la
ruta disponible, y señala esta limitación.

### T6 · Asociación, `include` y borrado protegido

1. Abre `preguntas.repository.js` y muestra las consultas que usan `include`
   para cargar la categoría y sus preguntas.
2. En phpMyAdmin intenta borrar una categoría que tenga preguntas:

   ```sql
   DELETE FROM categoria WHERE id = 1;
   ```

   La FK con `ON DELETE RESTRICT` debe rechazarlo.
3. Si has creado una categoría vacía en T5, elimínala por su ruta de
   administración y comprueba que sí se borra.

No uses para la prueba una categoría con datos que quieras conservar.

## Bloque 3 · Juego con mysql2

Para T7–T11 inicia una partida desde la aplicación y anota su código interno
`partida.codi` (no necesariamente coincide con el código que se muestra para
unirse). Usa dos clientes y, si está disponible, un tercero.

### T7 · Pool compartido, código único y participantes

1. Enseña los pools de mysql2:

   ```bash
   grep -rn "createPool" backend --include='*.js' --exclude-dir=node_modules
   ```

   Hay un pool por proceso/servicio; los procesos distintos no comparten una
   misma conexión en memoria.
2. En el primer cliente crea una sala y en el segundo únete con un nickname
   distinto.
3. Intenta entrar otra vez en esa sala con el mismo nickname. Debe rechazarse.
4. En phpMyAdmin comprueba las filas:

   ```sql
   SELECT p.codi, pa.nickname
   FROM partida p
   JOIN participant pa ON pa.partida_id = p.id
   ORDER BY p.id DESC, pa.id;
   ```

5. Enseña en `schema.sql` la unicidad del código de partida y de
   `(partida_id, nickname)`. La base de datos también protege frente a
   duplicados aunque una petición llegue simultáneamente.

### T8 · Preguntas distintas y respuesta única por ronda

1. Juega al menos dos rondas de la misma partida.
2. Consulta las preguntas asignadas:

   ```sql
   SELECT r.numero, r.pregunta_id, r.estat
   FROM ronda r
   JOIN partida p ON p.id = r.partida_id
   WHERE p.codi = 'CODIGO_INTERNO'
   ORDER BY r.numero;
   ```

   Sustituye `CODIGO_INTERNO` por el código real. Las preguntas de las rondas
   deben ser diferentes.
3. Haz que un jugador responda una ronda e intenta enviar otra respuesta para
   esa misma ronda. La segunda debe rechazarse (`ANSWER_ALREADY_EXISTS` o el
   mensaje equivalente de la aplicación).
4. Enseña en `schema.sql` `uq_ronda_partida_pregunta` y
   `uq_resposta_ronda_participant`.

### T9 · Clasificación acumulada con `JOIN`, `SUM` y `GROUP BY`

1. Tras responder una o más rondas, abre la clasificación en el juego.
2. En phpMyAdmin ejecuta:

   ```sql
   SELECT pa.nickname, COALESCE(SUM(r.punts), 0) AS punts
   FROM participant pa
   LEFT JOIN resposta r ON r.participant_id = pa.id
   WHERE pa.partida_id = (
     SELECT id FROM partida WHERE codi = 'CODIGO_INTERNO'
   )
   GROUP BY pa.id, pa.nickname
   ORDER BY punts DESC, pa.nickname ASC;
   ```

3. Compara los totales con los puntos de las respuestas individuales:

   ```sql
   SELECT pa.nickname, ro.numero, re.punts
   FROM resposta re
   JOIN participant pa ON pa.id = re.participant_id
   JOIN ronda ro ON ro.id = re.ronda_id
   WHERE pa.partida_id = (
     SELECT id FROM partida WHERE codi = 'CODIGO_INTERNO'
   )
   ORDER BY pa.nickname, ro.numero;
   ```

4. Enseña `getRanking` en
   [gameRepository.js](../../backend/game-service/src/game/persistence/gameRepository.js):
   la clasificación se calcula sumando los puntos guardados, no se guarda como
   un total separado.

## Bloque 4 · Transacciones

### T10 · Cerrar una ronda con commit/rollback

1. Antes de cerrar una ronda, consulta su estado y las respuestas:

   ```sql
   SELECT numero, estat FROM ronda
   WHERE partida_id = (SELECT id FROM partida WHERE codi = 'CODIGO_INTERNO')
   ORDER BY numero;
   ```

2. Cierra la ronda desde el juego (responde el último jugador o espera a que
   termine el tiempo).
3. Vuelve a consultar. La ronda debe aparecer cerrada y las respuestas deben
   tener posición y puntos:

   ```sql
   SELECT pa.nickname, ro.numero, re.posicio, re.punts
   FROM resposta re
   JOIN participant pa ON pa.id = re.participant_id
   JOIN ronda ro ON ro.id = re.ronda_id
   WHERE pa.partida_id = (
     SELECT id FROM partida WHERE codi = 'CODIGO_INTERNO'
   )
   ORDER BY ro.numero, re.posicio;
   ```

4. Abre `closeRoundRecord` en
   [gameRepository.js](../../backend/game-service/src/game/persistence/gameRepository.js)
   y enseña `beginTransaction`, `commit`, `rollback` y `release`.

La prueba normal enseña el commit. Para demostrar un rollback real hace falta
provocar un fallo dentro de una prueba aislada; no fuerces errores ni modifiques
la base de datos de la demo del examen.

### T11 · `FOR UPDATE`, unirse y responder solo con ronda abierta

1. Enseña las consultas bloqueantes:

   ```bash
   grep -rn "FOR UPDATE" backend/game-service/src --include='*.js'
   ```

2. Intenta entrar a una partida después de que ya haya comenzado: el servidor
   debe rechazar la unión.
3. Con una ronda cerrada, intenta enviar una respuesta tardía desde el cliente
   (si la interfaz lo permite). Debe rechazarse con un error equivalente a
   `ROUND_CLOSED`.
4. En el repositorio, enseña que `addRoomParticipant` y el guardado de respuesta
   leen/bloquean la fila dentro de una transacción antes de comprobar su estado.

## Bloque 5 · Ficheros

### T12a · Leer JSON, validar y listar todas las descartadas

1. Abre `validarPregunta.js` y enseña que devuelve `valid` y una lista `errors`.
2. Prepara un JSON de prueba con dos preguntas bajo una categoría: una válida y
   otra con varios problemas (por ejemplo, texto vacío, respuesta no numérica,
   rango inválido y sin explicación). Usa el formato:

   ```json
   [
     {
       "category": "Demo examen",
       "questions": [
         {
           "text": "Pregunta de prueba",
           "correctAnswer": 10,
           "min": 0,
           "max": 20,
           "step": 1,
           "unit": "unidades",
           "difficulty": "facil",
           "explanation": "Dato de prueba"
         },
         {
           "text": "",
           "correctAnswer": "no-numero",
           "min": 10,
           "max": 0,
           "step": 0,
           "unit": "",
           "difficulty": "facil",
           "explanation": ""
         }
       ]
     }
   ]
   ```

3. Desde el directorio del servicio ejecuta el importador con la ruta al archivo:

   ```bash
   cd backend/catalog-service
   npm run import:questions -- /ruta/absoluta/al/json-de-prueba.json
   ```

4. Enseña la salida JSON: la pregunta incorrecta debe figurar en `rejected` con
   sus índices y **todos** los mensajes de error. Una sintaxis JSON rota debe
   mostrar `Error d'importació`.

### T12b · Guardar las preguntas válidas con Sequelize

1. En la misma importación, comprueba que `imported` aumenta para la pregunta
   válida y que su categoría es `Demo examen`.
2. En phpMyAdmin verifica el registro:

   ```sql
   SELECT c.nom, p.text
   FROM pregunta p
   JOIN categoria c ON c.id = p.categoria_id
   WHERE c.nom = 'Demo examen';
   ```

3. Ejecuta el mismo importador de nuevo. Debe informar `skipped` si la pregunta
   no cambió, en vez de insertar otra copia. La categoría se busca/crea con
   `Categoria.findOrCreate`.
4. Explica la limitación actual: el guardado válido se hace dentro de una
   transacción única; si ocurre un error de base de datos durante el guardado,
   se revierte la importación completa. No digas que un error de escritura se
   aísla por pregunta.

La importación afecta a la base de datos. Usa el nombre de categoría de prueba
y limpia esos datos solo si estás en una base desechable.

### T13 · Exportar una partida terminada a CSV

1. Termina una partida y anota el valor interno de `partida.codi`.
2. Ejecuta el exportador en el contenedor:

   ```bash
   docker compose exec -T game-service npm run --silent export:csv -- CODIGO_INTERNO > partida.csv
   ```

3. Abre `partida.csv` con LibreOffice Calc o una hoja de cálculo y enseña las
   columnas de clasificación, jugador, ronda, pregunta, respuesta y puntos.
4. Repite con una partida no terminada. Debe rechazar la exportación con
   `Només es poden exportar partides acabades`.

El exportador documentado es de línea de comandos. La auditoría también señala
que no añade BOM UTF-8 y que `resposta` puede exportarse con ceros decimales;
comprueba los acentos en el programa que vayas a usar y no prometas formato
regional concreto si no lo has verificado.

## Bloque 6 · Capa de datos

### T14a · Módulos mysql2, REST/WebSockets y errores por `error.code`

1. Enseña que la persistencia principal del juego está en
   `backend/game-service/src/repositories/roomRepository.js` y
   `backend/game-service/src/game/persistence/gameRepository.js`, y que los
   handlers delegan en esas funciones.
2. Busca el manejo de errores:

   ```bash
   grep -rn "ER_DUP_ENTRY\\|ANSWER_ALREADY_EXISTS" backend/game-service/src
   ```

   Explica que los errores de base de datos se traducen usando su `code`.
3. **Límite importante:** según la auditoría actual, `game-service` solo expone
   WebSockets y no tiene una ruta REST que reutilice esos mismos módulos. Por
   tanto, no es posible demostrar honestamente la parte «la misma función se
   reutiliza desde REST y WebSockets» con la estructura actual. Preséntala como
   pendiente, no como completada.

### T14b · Módulos Sequelize y traducción de errores por tipo

1. Enseña que las operaciones Sequelize del catálogo están en los módulos de
   preguntas, no directamente en los handlers.
2. Busca el manejo por tipo de error:

   ```bash
   grep -rn "UniqueConstraintError\\|ForeignKeyConstraintError\\|ValidationError" \
     backend/catalog-service/src
   ```

3. **Límite importante:** la auditoría actual indica que no hay traducción
   centralizada de `UniqueConstraintError`, `ForeignKeyConstraintError` y
   `ValidationError` hacia errores HTTP. El requisito no está completo; no
   confundas las validaciones declaradas en los modelos con una traducción de
   esos errores en las rutas. Si el profesor lo pregunta, enseña el estado real
   y explica qué falta.

### T15 · Justificar qué se guarda y qué no

Abre la tabla siguiente como justificación de diseño (coherente con
`schema.sql`) y recorre cada fila:

| Dato | ¿Se guarda? ¿Dónde? | Criterio / justificación |
|---|---|---|
| Categorías y preguntas | Sí, `categoria` y `pregunta` | Son el catálogo persistente que se reutiliza entre partidas. |
| Código, tipo y estado de partida | Sí, `partida` | Identifican la partida y permiten consultar y conservar su estado/historial. |
| Nickname y pertenencia a partida | Sí, `participant` | Identifican a cada participante y permiten relacionarlo con sus respuestas. |
| Pregunta, número y estado de ronda | Sí, `ronda` | Conservan qué pregunta se usó y si la ronda sigue abierta o ya se cerró. |
| Valor, posición y puntos de respuesta | Sí, `resposta` | Conservan las respuestas y la puntuación de cada ronda; sustentan el ranking. |
| Clasificación acumulada | No como total independiente | Se calcula a partir de las respuestas con `JOIN`, `SUM` y `GROUP BY`, evitando duplicar un dato derivable. |
| Conexión WebSocket / estado visual en directo | No en estas tablas | Es estado temporal en memoria; no forma parte del historial relacional actual. |
| Contraseña/código de acceso a sala | No como texto en `partida.codi` | El código interno identifica la partida; el acceso privado se gestiona aparte. |

Termina mostrando en `schema.sql` las tablas y columnas citadas, y en
`gameRepository.js` la consulta que calcula el ranking. La documentación general
está en [bbdd.md](../bbdd.md) y [EXPLICACIONBBDD.md](./EXPLICACIONBBDD.md).

## Resumen rápido

| Tarea | Evidencia principal |
|---|---|
| T1–T3 | Diagrama/modelo, esquema en base vacía, seed repetido |
| T4–T6 | Modelos Sequelize, validaciones, `include` y FK `RESTRICT` |
| T7–T9 | Dos clientes, restricciones únicas y consulta de ranking |
| T10–T11 | Transacciones, `FOR UPDATE` y rechazo de operaciones fuera de estado |
| T12a–T12b | JSON mixto válido/inválido, informe y filas importadas |
| T13 | CSV de partida acabada y rechazo de partida en curso |
| T14a–T14b | Enseñar módulos y tratamiento actual; declarar claramente los dos límites |
| T15 | Tabla de criterio de persistencia y consulta que calcula el ranking |
