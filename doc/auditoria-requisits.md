# Auditoría de requisitos · How Much?! LIVE

**Proyecto:** `tr1-dam-equip6`
**Commit auditado:** `a692ff6` (2026-11-21)
**Fecha de auditoría:** 21/11/2026
**Alcance:** enunciado común, Accés a Dades (RAD-1..RAD-6 + rúbrica oral T1–T15), M9 Processos i Serveis, Unity/UI Toolkit y M6 Interfícies.

---

## 0. Cómo leer este documento

- Los porcentajes de **Accés a Dades** se calculan sobre la rúbrica oficial, que sí tiene pesos publicados (suman 100 %). Cada apartado muestra el porcentaje continuo estimado y el **nivel de rúbrica** que probablemente asignará el profesor (Excel·lent 100 %, Bé 75 %, Suficient 50 %, Insuficient 25 %).
- Las demás asignaturas **no tienen rúbrica numérica publicada** en el site. Los pesos que verás en esas secciones son una propuesta mía, proporcional a lo que el enunciado marca como obligatorio y como «especialment valorat». Están señalados como *(peso propuesto)*.
- Solo se valora lo que se puede **ejecutar en la sesión**. Un apartado implementado pero que no arranca baja automáticamente a Insuficient.
- No hay porcentajes inventados: cada valor sale de comparar requisito → archivo concreto.

### Resumen de notas

| Asignatura | Nota estimada | Riesgo principal |
|---|---|---|
| Accés a Dades | **~87 / 100** | T8 (selección de preguntas), T14b (errores Sequelize), T12b (import atómico) |
| M9 Processos i Serveis | **~6,2 / 10** | Sin Nginx, sin herramienta de microservicios, game-service sin REST |
| Unity / UI Toolkit | **~5,9 / 10** | UnityWebRequest es un mock, no hay herramienta de microservicios ni ejecutable |
| M6 Interfícies | **~7,4 / 10** | Electron es un esqueleto, WS no está dentro del store Pinia |
| Enunciat / transversal | **~3,3 / 10** | README sin rellenar, `.env` con secretos commiteados, sin URL de producción |

---

# 1. ACCÉS A DADES

## 1.1 Criterios globales (RAD-1..RAD-6)

| Requisito | Estado |
|---|---|
| MariaDB en contenedor Docker | ✅ `docker-compose.yml` servicio `mariadb`, volumen `mariadb_data` |
| Node.js + async/await | ✅ |
| mysql2 con `execute()` y `?` y **un pool** | ⚠️ `execute()` sí en todo el código; hay 3–4 `createPool` (uno por microservicio) |
| Sequelize **solo** para banco de preguntas | ✅ modelos solo en `catalog-service` |
| `fs.promises` + import JSON | ✅ `loadQuestions.js` |
| Export CSV con `csv-stringify` | ✅ `exportGameCsv.js` |
| Tablas creadas **solo** por `schema.sql` | ✅ no hay ningún `sync()` en el proyecto |
| Datos justificados en `/docs` | ⚠️ está en `doc/`, no en `docs/`, y repartido en varios archivos |

---

## 1.2 Bloc 1 · Model de dades

### T1 · Diagrama ER i model relacional · RA2 · 8 %

**Requisitos:** documento en `/docs` coherente con `schema.sql`; todas las clases, asociaciones con nombre y multiplicidad, claves y restricciones; modelo relacional completo. El profesor elegirá dos asociaciones y habrá que localizarlas en el esquema.

**Estado actual**
- ✅ `doc/model-de-dades.md`: diagrama Mermaid `erDiagram` con 7 relaciones nombradas (`agrupa`, `es fa servir en`, `té`, `rep`, `envia`, `assigna`), cardinalidades `||--o{`, PK/FK/UK y bloque de reglas de integridad.
- ✅ Modelo relacional textual de las 10 tablas, con UK compuestos y FKs compuestas de `resposta`.
- ⚠️ En el bloque Mermaid, `RESPOSTA` no muestra `partida_id`, aunque sí aparece en el modelo relacional y en el esquema.
- ⚠️ La entidad `USUARIS` del diagrama omite `avatar_image`, `avatar_color`, `codi_verificacio`, `codi_expira`.
- ⚠️ La carpeta se llama `doc/`, no `docs/` como pide la rúbrica.

**Qué falta / qué hacer**
1. Añadir `partida_id` a `RESPOSTA` en el Mermaid (2 min).
2. Completar las columnas de `USUARIS` o anotar «columnas de perfil omitidas».
3. Renombrar `doc/` → `docs/` o añadir un `docs/README.md` que enlace (riesgo de que el profesor no lo encuentre).

**Cumplimiento: 85 % → 6,8 / 8** (nivel probable **Bé**, por la incoherencia menor). Pendiente: **1,2 pts**.

---

### T2 · `schema.sql` · RA2 · 8 %

**Requisitos:** se ejecuta sin errores en BD vacía; PK, FK con `ON DELETE` coherente, UNIQUE (código de partida, nombre por partida, respuesta por ronda+participante), NOT NULL y CHECK; el CHECK debe rechazar una fila insertada a mano.

**Estado actual — todo presente**
- ✅ `backend/database/sql/schema.sql` crea la BD `howmuch` y 10 tablas con `IF NOT EXISTS`.
- ✅ PK autoincrementales en todas.
- ✅ FKs: `pregunta→categoria ON DELETE RESTRICT`, `participant→partida CASCADE`, `ronda→partida CASCADE`, `ronda→pregunta RESTRICT`, `resposta→ronda/participant CASCADE` con **FKs compuestas** `(id, partida_id)` que impiden mezclar partidas.
- ✅ UNIQUE compuestos: `uq_partida_codi`, `uq_participant_partida_nickname`, `uq_ronda_partida_numero`, `uq_ronda_partida_pregunta`, `uq_resposta_ronda_participant`.
- ✅ CHECK: nombre no vacío, slider coherente (`min<max`, `step>0`, respuesta dentro del rango), `max_jugadors BETWEEN 2 AND 20`, nickname 3–15, fechas coherentes, `posicio>0`.
- ✅ Sin `sync()`: verificado con búsqueda global, 0 resultados.

**Qué falta:** nada funcional. Solo preparar la demo: `DROP DATABASE howmuch;` + ejecutar el script, y tener a mano un INSERT que viole `chk_partida_max_jugadors` (p. ej. `max_jugadors = 1`).

**Cumplimiento: 100 % → 8 / 8** (nivel probable **Excel·lent**).

---

### T3 · `dades-inicials.sql` · RA2 · 4 %

**Requisitos:** re-ejecutable y siempre deja el mismo estado (mismas filas y mismos `id`); datos suficientes para jugar.

**Estado actual**
- ✅ `ON DUPLICATE KEY UPDATE id = id` en `rol`, `usuaris`, `categoria` y `pregunta`.
- ✅ `id` explícitos en categorías (1–8) y preguntas (31 preguntas), así que la segunda ejecución no mueve el autoincremento.
- ✅ 8 categorías y 31 preguntas con respuesta, unidad, dificultad, explicación y rango de slider → suficiente para varias partidas.
- ✅ Todo dentro de `START TRANSACTION … COMMIT`.

**Qué falta:** nada. Ensayar la doble ejecución y comparar `SELECT id,nom FROM categoria` y `SELECT id,text FROM pregunta` antes/después.

**Cumplimiento: 100 % → 4 / 4** (nivel probable **Excel·lent**).

---

## 1.3 Bloc 2 · Banc de preguntes amb Sequelize

### T4 · Conexión y modelos, sin `sync()` · RA3 · 5 %

**Requisitos:** columnas y tipos idénticos al esquema, `tableName`, `timestamps: false`, la FK; **una sola instancia de Sequelize**; ningún `sync()`.

**Estado actual**
- ✅ `backend/catalog-service/src/db/sequelize.js`: instancia única exportada, `define: { timestamps: false, freezeTableName: true }`.
- ✅ `Categoria` → `tableName: "categoria"`, `timestamps: false`.
- ✅ `Pregunta` → `tableName: "pregunta"`, `timestamps: false`, `categoria_id` con `allowNull:false`, y mapeo correcto de `min/max/step` a `min_value/max_value/step_value` con `field`.
- ✅ Asociación `hasMany` + `belongsTo`.
- ✅ Cero `sync()` en todo el repo.
- ⚠️ `stats-service` define sus propios modelos (`Usuari.js`, `Partida.js`) con otra instancia de Sequelize. Si el profesor busca «una sola instància» en todo el proyecto, es un punto débil; si lo interpreta por servicio, es correcto.

**Qué falta / qué hacer**
1. En la demo, abrir `Pregunta` junto a la tabla `pregunta` del `schema.sql` y remarcar el mapeo `min→min_value`.
2. Tener preparada la respuesta: «una instancia por microservicio; el servicio de catálogo es el único que usa Sequelize para el banco de preguntas». Si se quiere eliminar el riesgo, mover los modelos de `stats-service` a mysql2 (no es necesario para la nota).

**Cumplimiento: 90 % → 4,5 / 5** (nivel probable **Excel·lent**, con riesgo de Bé). Pendiente: **0,5 pts**.

---

### T5 · CRUD de categorías y preguntas con validaciones en el modelo · RA3 · 8 %

**Requisitos:** CRUD completo de las dos tablas desde la administración; datos inválidos rechazados con mensaje claro **por campo**; nombre de categoría repetido rechazado; validaciones declaradas en el modelo.

**Estado actual**
- ✅ CRUD completo: `listCategoriesWithQuestions`, `getCategoryById`, `createCategory`, `updateCategory`, `deleteCategory` y el equivalente de preguntas en `preguntas.repository.js`.
- ✅ Expuesto al panel Vue por WS → `adminRouter.js` → REST interno `catalog-service/src/admin/admin.routes.js`.
- ✅ Vistas de administración existentes: `AdminPreguntasView.vue`, `AdminCategoriesView.vue`, más dashboard, salas, usuarios y estadísticas.
- ✅ Validaciones en el modelo Sequelize: `notEmpty` en `nom`, `text`, `explicacio`; `len:[1,32]` en `dificultat`; `notNull` en `categoria_id` y `resposta_correcta`.
- ✅ Validación de negocio en el repositorio con códigos y mensajes en catalán: `CATEGORY_NAME_REQUIRED`, `QUESTION_TEXT_REQUIRED`, `QUESTION_SLIDER_RANGE_INVALID`, `CATEGORY_ALREADY_EXISTS`, etc.
- ⚠️ El nombre repetido se comprueba con un `findOne` en el repositorio, no con un validador `unique` del modelo.
- ⚠️ La API devuelve **un solo** `reason` por petición, no un mapa de errores por campo.

**Qué falta / qué hacer**
1. Añadir `validate: { notEmpty: ... }` ya está; para el «por campo», devolver `{ errors: { nom: "...", text: "..." } }` desde `createQuestion`/`createCategory` y pintarlo en la vista (≈30 líneas).
2. Opcional: mover la comprobación de duplicado a un validador del modelo o dejar el `findOne` y explicar que el `UNIQUE` de la BD es la garantía final.
3. Ensayar en la demo: categoría repetida, `text` vacío, `step = 0`, `min > max`, respuesta fuera del rango.

**Cumplimiento: 78 % → 6,2 / 8** (nivel probable **Bé**, por el mensaje único y la validación de unicidad fuera del modelo). Pendiente: **1,8 pts**.

---

### T6 · Asociación categoría–preguntas con `include` y borrado protegido · RA3 · 7 %

**Requisitos:** asociación en los dos sentidos, listado con `include`, no se puede borrar una categoría con preguntas y el mensaje explica por qué, una vacía sí se borra.

**Estado actual — completo**
- ✅ `Categoria.hasMany(Pregunta, { as: "preguntas" })` y `Pregunta.belongsTo(Categoria, { as: "categoria" })`.
- ✅ `listCategoriesWithQuestions()` usa `include` y ordena por pregunta; `listQuestions()` devuelve cada pregunta con su categoría; `getQuestionsByCategoryId()` filtra por FK **e** incluye la categoría.
- ✅ Doble protección del borrado:
  - Hook `beforeDestroy` que cuenta preguntas y lanza `CATEGORY_HAS_QUESTIONS` con el mensaje «No es pot eliminar una categoria que encara té preguntes associades.»
  - `ON DELETE RESTRICT` en la FK.
- ✅ Una categoría sin preguntas se borra sin problema.

**Qué falta:** nada. En la demo, borrar una categoría con preguntas (mensaje claro) y luego una creada al momento.

**Cumplimiento: 95 % → 6,7 / 7** (nivel probable **Excel·lent**). Pendiente: **0,3 pts**.

---

## 1.4 Bloc 3 · Joc amb mysql2

### T7 · Pool compartido, partidas con código único y participantes · RA2 · 7 %

**Requisitos:** un solo pool; código único garantizado por UNIQUE con reintento; nombre repetido rechazado con mensaje claro.

**Estado actual**
- ✅ `game-service/src/db/pool.js` es el único pool del servicio de juego y lo importan todos los módulos (`roomRepository`, `gameRepository`, `joinRoom`, `exportGameCsv`, `reportStats`…). Búsqueda `createPool`: 3 resultados en todo el backend (auth, catalog, game).
- ✅ Código `sala_<10 hex>` generado con `randomBytes`.
- ✅ `createRoom.js` reintenta **hasta 3 veces** si `ER_DUP_ENTRY`, y relanza si se agotan.
- ✅ Nombre repetido: comprobación en memoria **y** `UNIQUE (partida_id, nickname)` en BD; en `joinRoom.js` se traduce `ER_DUP_ENTRY` → «Aquest nom d'usuari ja està en ús».
- ⚠️ Hay un pool en cada microservicio (4 en total). Arquitectónicamente es correcto, pero la rúbrica literalmente dice «un sol pool»; si el profesor lo aplica al proyecto entero, puede bajar a Suficient.

**Qué falta / qué hacer**
1. Preparar la demo enseñando que **dentro del game-service** solo hay un `createPool` y todos los módulos importan `db/pool.js`.
2. Si se quiere blindar: unificar el pool de `catalog-service` (hoy tiene mysql2 + Sequelize) o justificar explícitamente el pool por servicio en `/docs`.
3. Ensayar: crear partida, unir dos clientes, intentar unirse con el mismo nombre, y explicar el reintento del código.

**Cumplimiento: 85 % → 6,0 / 7** (nivel probable **Bé** por el recuento literal de pools). Pendiente: **1,0 pts**.

---

### T8 · Rondas sin preguntas repetidas y respuestas con UNIQUE · RA2 · 8 %

**Requisitos:** la pregunta se elige **con SQL excluyendo las ya usadas en la partida**; una segunda respuesta a la misma ronda la rechaza el UNIQUE y el jugador recibe un mensaje claro.

**Estado actual**
- ✅ Segunda respuesta: `UNIQUE (ronda_id, participant_id)` + `saveAnswerRecord` traduce `ER_DUP_ENTRY` → `ANSWER_ALREADY_EXISTS` → mensaje «Ja has respost aquesta ronda». También hay cortafuegos en memoria (`room.roundAnswers.has`).
- ✅ La ronda se bloquea con `SELECT … FROM ronda WHERE id = ? FOR UPDATE`.
- ❌ **La no-repetición no se hace con SQL.** `getRandomQuestionsFromDatabase()` es `ORDER BY RAND() LIMIT ?`; `game-service` pide N preguntas por HTTP al catálogo y las guarda en `room.questionOrder`. No hay `NOT IN (SELECT pregunta_id FROM ronda WHERE partida_id = ?)`.
- ⚠️ La única barrera es `uq_ronda_partida_pregunta`: si el azar repite pregunta, el `INSERT` de la ronda falla y se reintenta el cierre, pero no se vuelve a elegir pregunta.

**Qué falta / qué hacer**
1. Añadir al catálogo (o al game-service) una consulta del estilo:
   `SELECT id FROM pregunta p WHERE p.categoria_id=? AND p.id NOT IN (SELECT pregunta_id FROM ronda WHERE partida_id=?) ORDER BY RAND() LIMIT 1`.
2. Excluir también las preguntas ya servidas en esa partida antes de abrir cada ronda.
3. En la demo, enseñar la consulta y el `UNIQUE`, y forzar el duplicado con un INSERT en phpMyAdmin.

**Cumplimiento: 55 % → 4,4 / 8** (nivel probable **Suficient/Bé**). Pendiente: **3,6 pts** — es el mayor agujero de Accés a Dades.

---

### T9 · Clasificación acumulada y final (JOIN, SUM, GROUP BY) · RA2 · 10 %

**Requisitos:** acumulada y final calculadas con SQL (JOIN, SUM, GROUP BY), ordenadas, coincidentes con la suma manual; un jugador sin respuestas aparece con 0.

**Estado actual — completo**
- ✅ `gameRepository.getRanking()`:
  `participant LEFT JOIN resposta … GROUP BY p.id, p.nickname ORDER BY score DESC, p.nickname ASC` con `COALESCE(SUM(a.punts), 0)`.
- ✅ El `LEFT JOIN` + `COALESCE` hace que un jugador sin respuestas salga con 0.
- ✅ Acumulada: se devuelve en `closeRoundRecord()` tras cada ronda.
- ✅ Final: `finishGameRecord()` reutiliza la misma consulta al marcar `acabada`.
- ✅ Los puntos se guardan por respuesta (`resposta.punts`), así que la suma manual en phpMyAdmin coincide.
- ⚠️ No hay desempate por posición compartida (la rúbrica no lo pide; el enunciado sí habla de empates).

**Qué falta:** nada para la rúbrica. Ensayar la comprobación manual de un jugador.

**Cumplimiento: 95 % → 9,5 / 10** (nivel probable **Excel·lent**). Pendiente: **0,5 pts**.

---

## 1.5 Bloc 4 · Transaccions

### T10 · Cerrar una ronda (puntos y estado, con rollback) · RA2 · 7 %

**Requisitos:** transacción con **una sola conexión del pool**, `rollback` y `release` correctos; posiciones y puntos correctos; demostrar o explicar con precisión que un fallo no deja nada a medias.

**Estado actual — completo**
- ✅ Helper `transaction(work)` en `gameRepository.js`: `getConnection()` → `beginTransaction()` → `work(connection)` → `commit()`; `catch` → `rollback()`; `finally` → `release()`.
- ✅ `closeRoundRecord()` usa **solo** `connection.execute()` (nunca `pool.query()`), bloquea la ronda con `FOR UPDATE`, ordena respuestas por proximidad, actualiza `posicio` y `punts` una a una y marca `ronda.estat='tancada'`.
- ✅ Si cualquier UPDATE falla → rollback completo; la ronda sigue `oberta` y las respuestas sin puntuar.
- ✅ Devuelve el ranking ya calculado.

**Qué falta:** preparar la explicación del fallo (p. ej. «si el UPDATE de `punts` de la tercera respuesta falla, el rollback deshace los dos anteriores y el `estat` no cambia»).

**Cumplimiento: 100 % → 7 / 7** (nivel probable **Excel·lent**).

---

### T11 · Unirse y responder con la ronda abierta (`FOR UPDATE`) · RA2 · 8 %

**Requisitos:** las dos operaciones (unirse y responder) usan transacción con `SELECT … FOR UPDATE`; respuesta a ronda cerrada y entrada a partida empezada se rechazan con mensaje claro; saber explicar por qué.

**Estado actual — completo**
- ✅ Unirse: `roomRepository.addRoomParticipant()` → `SELECT id, estat, max_jugadors FROM partida WHERE codi=? FOR UPDATE`, rechaza `estat != 'esperant'` con `ROOM_NOT_WAITING` («La partida ja no accepta més jugadors»), cuenta plazas y hace el INSERT en la misma transacción.
- ✅ Responder: `gameRepository.saveAnswerRecord()` → `SELECT id, partida_id, estat FROM ronda WHERE id=? FOR UPDATE`, rechaza `estat != 'oberta'` con `ROUND_CLOSED` («La ronda ja està tancada»), resuelve el participante e inserta.
- ✅ Además, la respuesta comprueba que la pregunta es la de la ronda, que el jugador pertenece a la partida y que no ha respondido ya.
- ✅ Documentado en `doc/bbdd.md` y `doc/entregarbbdd/simulacio-entrega.md` con el guion de la demo.

**Qué falta:** nada. Ensayar los dos rechazos en vivo.

**Cumplimiento: 100 % → 8 / 8** (nivel probable **Excel·lent**).

---

## 1.6 Bloc 5 · Fitxers

### T12a · Leer y validar el JSON con `validarPregunta()` e informe de descartes · RA1 · 5 %

**Requisitos:** todas las preguntas inválidas se descartan y el informe dice el motivo de cada una, **incluyendo todos los errores de la misma pregunta**; un archivo con sintaxis rota da un mensaje claro y el servidor sigue vivo.

**Estado actual**
- ✅ `validarPregunta()` devuelve `{ valid, errors: [] }` y **acumula todos** los errores: texto, respuesta, rango del slider, unidad, dificultad, explicación, categoría, `categoria_id`.
- ✅ `importQuestions()` recorre categorías y preguntas, valida con `validarPregunta()` y añade a `rejected` con `categoryIndex`, `questionIndex` y el array completo de `errors`.
- ✅ `loadQuestions()` lee con `fs/promises` y envuelve el error de `JSON.parse` en `QUESTIONS_FILE_ERROR` con mensaje legible.
- ✅ El CLI `npm run import:questions -- <fitxer>` imprime el resultado en JSON (`imported`, `updated`, `skipped`, `rejected`); un JSON roto imprime «Error d'importació: …» y no tumba ningún servidor.
- ⚠️ La importación **no está expuesta en el panel de administración**: es un script de consola. La rúbrica permite mostrarla ejecutándola, pero no se puede «subir un fitxer» desde la UI.

**Qué falta / qué hacer**
1. Nada obligatorio; tener preparado un JSON con 3–4 errores distintos en la misma pregunta y otro con una coma de más.
2. Opcional (recomendado): añadir un botón de importación en `AdminPreguntasView` que llame a un endpoint REST; evita discusiones sobre «des de l'administració».

**Cumplimiento: 95 % → 4,75 / 5** (nivel probable **Excel·lent**). Pendiente: **0,25 pts**.

---

### T12b · Guardar las válidas con Sequelize · RA3 · 2 %

**Requisitos:** exactamente las válidas, con su categoría, usando el módulo de datos Sequelize; si una falla al guardar se descarta y se continúa; justificar categoría inexistente e importación repetida.

**Estado actual**
- ✅ Guarda con `Categoria.findOrCreate` + `Pregunta.create` / `save` (Sequelize puro).
- ✅ Asigna la categoría por nombre (`group.category`), y crea la categoría si no existe.
- ✅ Importación repetida: busca por `(categoria_id, text)`; si existe y cambian los valores numéricos, actualiza; si no, cuenta como `skipped`.
- ❌ **Todo el guardado va dentro de un único `sequelize.transaction`.** Si una pregunta falla, la transacción revierte **todas** y la importación se detiene: no se descarta la mala y se continúa.
- ⚠️ Los dos casos especiales (categoría inexistente, import repetida) no están justificados por escrito en `/docs`.

**Qué falta / qué hacer**
1. Cambiar el bucle para que cada pregunta tenga su propio `try/catch` (y, si se quiere atomicidad por pregunta, una transacción por pregunta); acumular los fallos en `rejected` con motivo `SAVE_ERROR`.
2. Añadir a `doc/` un párrafo: «categoría inexistente → se crea con `findOrCreate`; import repetido → se compara por texto y se actualizan solo los valores numéricos».

**Cumplimiento: 70 % → 1,4 / 2** (nivel probable **Bé**, por la parada de la importación). Pendiente: **0,6 pts**.

---

### T13 · Exportación CSV de una partida acabada · RA1 · 5 %

**Requisitos:** se abre bien en hoja de cálculo, con columnas separadas, acentos y decimales correctos; contiene participantes, respuestas, puntos y clasificación final; hecho con `csv-stringify`; una partida no acabada no se exporta.

**Estado actual**
- ✅ `csv-stringify/sync` con `header: true`, `columns` explícitas y `escape_formulas: true`.
- ✅ Columnas: `posicio`, `nickname`, `punts_totals`, `ronda`, `pregunta`, `resposta`, `punts_ronda` → participantes, respuestas, puntos y ranking final.
- ✅ Rechaza si `estat !== 'acabada'`: «Només es poden exportar partides acabades.»
- ✅ `LEFT JOIN` para que los jugadores sin respuestas también aparezcan.
- ⚠️ **No se añade BOM UTF-8** al fichero. `process.stdout.write` + redirección en Windows hará que Excel interprete el CSV como ANSI y los acentos («Geografía», «ó») salgan corruptos → criterio literal de **Bé**.
- ⚠️ Solo hay exportación por CLI (`npm run export:csv -- sala_xxx`), no desde la UI ni por REST.
- ⚠️ `resposta` sale como `DECIMAL` en string (`42195.000000`) y el decimal es punto, no coma.

**Qué falta / qué hacer**
1. Anteponer `"\uFEFF"` al string antes de escribirlo (1 línea) o guardar con `fs.writeFile(..., "utf8")` incluyendo BOM.
2. Formatear `resposta` y `punts` como número (quitar ceros) y decidir decimal coma/punto.
3. Opcional: endpoint `GET /export/:codi` y botón en el panel.

**Cumplimiento: 80 % → 4,0 / 5** (nivel probable **Bé** por acentos). Pendiente: **1,0 pts**.

---

## 1.7 Bloc 6 · Capa de dades

### T14a · Módulos mysql2 reutilizables desde REST y WebSockets; errores por `error.code` · RA2 · 3 %

**Requisitos:** todo el SQL en módulos; las funciones no imprimen ni reciben `req/res/socket`; una misma función se usa desde REST y desde WebSockets; errores traducidos por `error.code`.

**Estado actual**
- ✅ El SQL de juego está concentrado en `repositories/roomRepository.js` y `game/persistence/gameRepository.js` (39 llamadas) + `game/files/exportGameCsv.js`.
- ✅ Las funciones devuelven datos o lanzan errores con `code`; no reciben `req/res/ws` (los handlers traducen).
- ✅ `ER_DUP_ENTRY` traducido a `ANSWER_ALREADY_EXISTS` y a «Aquest nom d'usuari ja està en ús»; también hay traducción en `catalog-service/src/errors/AppError.js` y `auth-service`.
- ❌ `rooms/joinRoom.js` ejecuta una consulta directa (`SELECT avatar_color FROM usuaris`) fuera de un módulo de datos.
- ❌ **No se puede enseñar una función usada desde REST y desde WS**: el `game-service` no expone ninguna ruta REST (solo `new WebSocketServer`). Los servicios con REST (catalog/auth/stats) no tienen WS. El requisito de reutilización cruzada no es demostrable.
- ⚠️ `authService.js` acumula 17 consultas en un archivo que no es un módulo de datos puro (fuera del alcance de la rúbrica, pero se ve en la búsqueda global de `query(`/`execute(`).

**Qué falta / qué hacer**
1. Mover `findAvatarColor` a `repositories/` (5 min).
2. Añadir al `game-service` un endpoint REST mínimo que use una función existente: p. ej. `GET /api/rooms/:codi/ranking` → `getRanking`/`finishGameRecord`, o `GET /health`. Con eso ya se puede enseñar la misma función desde HTTP y desde el handler WS.
3. Si se añade Express al game-service, cuidado con el puerto: hoy el WS escucha en `${PORT}`; montar HTTP en el mismo servidor (`new WebSocketServer({ server })`).

**Cumplimiento: 60 % → 1,8 / 3** (nivel probable **Bé/Suficient**). Pendiente: **1,2 pts**.

---

### T14b · Módulos Sequelize reutilizables; errores por tipo · RA3 · 2 %

**Requisitos:** los modelos solo se usan en los módulos; `UniqueConstraintError` **antes** que `ValidationError`, y también `ForeignKeyConstraintError`; saber explicar el orden.

**Estado actual**
- ✅ `findAll(`, `create(`, `destroy(` solo aparecen en `questions/preguntas.repository.js` y `questions/importQuestions.js`; ni rutas ni handlers WS tocan modelos.
- ✅ Una única capa de módulos para el banco de preguntas.
- ❌ **No existe ninguna traducción por tipo de error de Sequelize.** Búsqueda global: 0 apariciones de `UniqueConstraintError`, `ValidationError` o `ForeignKeyConstraintError`.
- ⚠️ Los duplicados se evitan con un `findOne` previo, así que el `UniqueConstraintError` casi nunca llega; si llega, el cliente recibe `error.message` crudo en inglés.
- ⚠️ `errorHandler.js` del catálogo hace `console.error` y devuelve `err.message`; las rutas admin devuelven `reason: error.message`.

**Qué falta / qué hacer**
1. Crear `mapSequelizeError(error)` con este orden exacto:
   `if (error instanceof UniqueConstraintError) → 409 "Ja existeix…"`;
   `else if (error instanceof ForeignKeyConstraintError) → 409 "No es pot esborrar: hi ha registres relacionats"`;
   `else if (error instanceof ValidationError) → 400` con un mensaje por campo (`error.errors.map(e => e.path + ": " + e.message)`).
2. Usarlo en el `catch` de las rutas admin y en `createCategory`/`createQuestion`.
3. Poder explicar: «UniqueConstraintError antes que ValidationError porque el duplicado también es una violación de validación y quedaría con mensaje genérico».

**Cumplimiento: 45 % → 0,9 / 2** (nivel probable **Suficient**). Pendiente: **1,1 pts**.

---

### T15 · Justificación de qué datos se guardan y qué no · RA2 · 3 %

**Requisitos:** tabla en `/docs` con criterios coherentes; cada dato guardado tiene el requisito que lo justifica (durabilidad, SQL lo calcula, o una transacción lo bloquea); coherente con el esquema.

**Estado actual**
- ✅ `doc/bbdd.md` justifica tabla por tabla qué se guarda y por qué, con las tres categorías (durabilidad, cálculo SQL, bloqueo pesimista), y dedica secciones a «qué NO se guarda»: clasificación, estado en vivo, contraseña de sala.
- ✅ `doc/entregarbbdd/EXPLICACIONBBDD.md` y `README.md` tienen las respuestas T1–T15, incluida la de clasificación calculada.
- ✅ Coherente con `schema.sql`: `resposta.punts` existe precisamente para que `SUM` calcule el ranking; `ronda.estat` y `partida.estat` existen para el `FOR UPDATE`.
- ⚠️ No hay **una única tabla** `dato → requisito → por qué`, que es exactamente lo que pide la rúbrica; está en prosa repartida.
- ⚠️ Está en `doc/` y no en `docs/`.

**Qué falta / qué hacer**
1. Crear `doc/justificacio-dades.md` con una tabla de ~15 filas: `partida.estat` (transacción/`FOR UPDATE`), `participant.nickname` (UNIQUE por partida), `ronda.estat` (bloqueo), `resposta.valor` (cálculo), `resposta.posicio`/`punts` (SQL calcula el ranking, no se recalcula en JS), `categoria`/`pregunta` (durabilidad + admin), `usuaris` (histórico/estadísticas), y una sección «no se guarda» con clasificación y estado en vivo.
2. Enlazarla desde el README.

**Cumplimiento: 85 % → 2,6 / 3** (nivel probable **Excel·lent/Bé**). Pendiente: **0,4 pts**.

---

## 1.8 Cuadro final · Accés a Dades

| Tarea | Peso | % est. | Nivel probable | Puntos | Pendiente |
|---|---:|---:|---|---:|---:|
| T1 Diagrama ER | 8 | 85 % | Bé | 6,8 | 1,2 |
| T2 schema.sql | 8 | 100 % | Excel·lent | 8,0 | 0 |
| T3 dades-inicials | 4 | 100 % | Excel·lent | 4,0 | 0 |
| T4 Models sense sync | 5 | 90 % | Excel·lent | 4,5 | 0,5 |
| T5 CRUD + validacions | 8 | 78 % | Bé | 6,2 | 1,8 |
| T6 include + borrado | 7 | 95 % | Excel·lent | 6,7 | 0,3 |
| T7 Pool + codi únic | 7 | 85 % | Bé | 6,0 | 1,0 |
| T8 Rondes sense repetir | 8 | 55 % | Suficient | 4,4 | 3,6 |
| T9 Ranking SQL | 10 | 95 % | Excel·lent | 9,5 | 0,5 |
| T10 Tancar ronda | 7 | 100 % | Excel·lent | 7,0 | 0 |
| T11 FOR UPDATE | 8 | 100 % | Excel·lent | 8,0 | 0 |
| T12a Validar JSON | 5 | 95 % | Excel·lent | 4,75 | 0,25 |
| T12b Guardar amb Sequelize | 2 | 70 % | Bé | 1,4 | 0,6 |
| T13 Export CSV | 5 | 80 % | Bé | 4,0 | 1,0 |
| T14a Mòduls mysql2 | 3 | 60 % | Bé | 1,8 | 1,2 |
| T14b Errors Sequelize | 2 | 45 % | Suficient | 0,9 | 1,1 |
| T15 Justificació dades | 3 | 85 % | Excel·lent | 2,6 | 0,4 |
| **TOTAL** | **100** | | | **87,2** | **12,8** |

**Escenario realista aplicando los niveles de rúbrica (100/75/50/25): ≈ 86,75 / 100.**
**Mejor escenario si se corrigen T8, T12b, T13 y T14b: ≈ 95 / 100.**

---

# 2. M9 · PROCESSOS I SERVEIS

*(pesos propuestos por mí sobre 10; el site no publica rúbrica numérica)*

| Apartado | Peso | Estado | Nota |
|---|---:|---|---:|
| Núcleo en tiempo real: protocolo JSON, salas, fases, validación, duplicados, desconexiones | 3,5 | Muy completo | 3,2 |
| Microservicios en Docker + Docker Compose | 1,5 | Completo | 1,4 |
| Nginx como reverse proxy (HTTP + WS) | 1,5 | Solo un README | 0,2 |
| Herramienta de microservicios (start/stop, logs, alertas, contraseña) | 1,5 | Parcial (solo panel de estado) | 0,4 |
| Separación juego / WebSocket / REST | 1,0 | Parcial: no hay REST en game-service | 0,5 |
| Documentación y justificación del reparto | 1,0 | `ARCHITECTURE.md` y `doc/*.md` muy buenos; README raíz vacío | 0,5 |
| **TOTAL** | **10** | | **6,2 / 10** |

**Implementado**
- `ws` nativo (`WebSocketServer`) con un router de mensajes (`routers/messageRouter.js`) y ~23 tipos de mensaje (`room:*`, `round:*`, `answer:*`, `game:finished`, `chat:*`, `catalog:options`…).
- Estado de sala en memoria (`roomStorage`), un `Map` por sala → aislamiento entre partidas; `broadcastToRoom` / `broadcastToRoomEach`.
- Fases `lobby` → `playing` (con subfase `rankingVisible`) → `finished`, con temporizadores, cierre automático de ronda, avance de ronda, retorno al lobby y reinicio.
- Validación de respuestas en servidor (`parseAnswerToNumber`, límite de magnitud, pregunta de la ronda, tiempo, rol de observador, duplicado).
- Desconexión y reconexión (`disconnectionHandler`, rejoin por `identity.id`), expulsión, salida, traspaso de host.
- Cuatro microservicios (`auth`, `catalog`, `game`, `stats`) + módulo de BD compartido + MariaDB + phpMyAdmin en `docker-compose.yml`, red `tr1-network`.
- Guía de demo T1–T15 en `doc/entregarbbdd/simulacio-entrega.md` (muy útil para la sesión oral).

**Qué falta y qué hacer**
1. **Nginx (1,3 pts):** crear `dev/nginx/nginx.conf` y un servicio `nginx` en `docker-compose.yml` con `proxy_pass` para `/ws`, `/api/rooms`, `/api/catalog`, `/api/stats`. Hoy `dev/nginx/` solo contiene un README que dice qué *iría* ahí.
2. **Herramienta de microservicios (1,1 pts):** no existe start/stop de contenedores, ni visor de logs, ni alertas de error. El panel admin de Vue muestra estado en vivo y estadísticas con JWT, pero no gestiona servicios. Para M9 y para Unity hace falta: botones start/stop por servicio, tail de logs y aviso cuando un servicio cae. Con Docker puede hacerse por `dockerode` o `docker compose` desde el backend.
3. **REST en game-service (0,5 pts):** añadir Express (o el `http` server compartido con `ws`) con al menos `/health`, `/api/rooms` y `/api/rooms/:codi/ranking`.
4. **README raíz (0,5 pts):** hoy es la plantilla original sin nombre, miembros, URL ni despliegue.

**Riesgo:** sin Nginx ni URL de producción, el bloque de despliegue del enunciado queda prácticamente a cero aunque Docker funcione.

---

# 3. UNITY / UI TOOLKIT

*(pesos propuestos por mí sobre 10)*

| Requisito | Peso | Estado | Nota |
|---|---:|---|---:|
| 1. Pantalla de acceso (nombre, código, conectar, errores) | 0,7 | Implementada | 0,65 |
| 2. Lobby (sala, participantes, auto-update, espera) | 0,7 | Implementado | 0,65 |
| 3. Votación (pregunta, input, bloqueo, confirmación, estado) | 0,8 | Implementado | 0,75 |
| 4. Resultados (correcta, estimaciones, diferencia, gráfico) | 1,5 | Parcial: sin representación gráfica clara | 1,0 |
| 5. Ranking por ronda y final | 0,8 | Implementado | 0,75 |
| 6. **UnityWebRequest (mín. 3 usos reales)** | 1,5 | **No implementado: `RoomApi` devuelve datos falsos** | 0,1 |
| 7. WebSockets (servicio separado, hilo principal, cierre) | 2,0 | Muy completo | 1,9 |
| 8. Organización (UXML/USS, modelos, servicios, controladores) | 1,0 | Muy buena | 0,95 |
| Ejecutable conectado al backend | 0,5 | No hay build en el repo | 0,05 |
| Herramienta de microservicios (start/stop, logs, alertas, contraseña) | 1,5 | **No existe** | 0,0 |
| **TOTAL** | **10** | | **5,9 / 10** |

**Implementado**
- `Assets/UI/UXML/`: `MainScreen.uxml`, `RoomScreen.uxml`, `ProfileScreen.uxml`, `CreateRoomDialog.uxml`; estilos en `Assets/UI/USS/ScreensUss.uss`.
- `Assets/Scripts/` separado por responsabilidad: `Models/` (Game, Rooms, Identity, Profile, Common), `Services/Realtime/` (`GameClient`, `.Receive`, `.Events`), `Services/WebSocketService.cs`, `Controllers/` (`MainScreenController`, `RoomScreenController` + parciales `.Game`, `.Ranking`, `.Chat`, `CreateRoomDialogController`, `ProfileScreenController`), `Router/ScreenRouter.cs`, `App/AppBootstrap.cs`.
- 23 tipos de mensaje gestionados en `GameClient.Receive.cs`, incluidos `round:started`, `round:results`, `round:ranking`, `game:finished`, `answer:ack/error`, `room:players`, `chat:message`.
- `WebSocketService` usa una cola (`pending`) que se vacía en el hilo principal → cumple el requisito de UI Toolkit en main thread.
- Pantalla de votación con bloqueo y confirmación («Resposta enviada») y estado de respuesta.

**Qué falta y qué hacer**
1. **UnityWebRequest (1,4 pts, obligatorio):** `Assets/Scripts/Api/RoomApi.cs` es un mock explícito («ARA MATEIX RETORNA UNA LLISTA DE SALES D'EXEMPLE, NO CRIDA CAP SERVIDOR»). Implementar con `UnityWebRequest`:
   - `GET` catálogo/opciones (`/api/catalog/options`),
   - `GET` lista de salas o info de sala,
   - `GET` ranking/estadísticas.
   Manejar `result == Success`, `responseCode`, `DownloadHandlerBuffer` y errores de red. Es el fallo más grave de la asignatura.
2. **Herramienta de microservicios (1,5 pts, obligatorio):** no hay ningún script de administración en `Assets/Scripts`. Añadir una pantalla con contraseña, listado de servicios, start/stop y logs. Se puede reutilizar el WS admin existente (`admin:auth`, `admin:live:get`) para el estado y añadir mensajes `admin:service:start/stop/logs`.
3. **Resultados con gráfico (0,5 pts):** hay respuesta correcta, tus puntos y posición; falta el listado de estimaciones de todos con su diferencia y una barra/gráfico comparativo.
4. **Ejecutable (0,45 pts):** no hay carpeta `Builds/` versionada. Generar el build de Windows y dejarlo accesible (o documentar cómo generarlo y llevarlo a la defensa).

---

# 4. M6 · INTERFÍCIES (Vue + Vuetify + Pinia + Electron)

*(pesos propuestos por mí sobre 10)*

| Requisito | Peso | Estado | Nota |
|---|---:|---|---:|
| Pantallas: Inici, Lobby, Votació, Resultats, Gestió | 2,0 | Todas presentes | 1,9 |
| Estructura de componentes reutilizables | 1,5 | Buena, con vistas grandes | 1,35 |
| Pinia para estado global (jugador, partida, participantes, pregunta, puntos, conexión) | 1,5 | Completo | 1,4 |
| WebSocket centralizado **en el store Pinia** | 1,5 | En un módulo `services/websocket.js` que importa el store | 0,9 |
| Peticiones HTTP necesarias | 0,5 | `authApi`, `statsApi`, `adminApi` | 0,45 |
| Electron: ventana, título, icono, ejecutable | 1,5 | Esqueleto | 0,3 |
| Calidad visual, animaciones y transiciones | 1,0 | Parcial (2 vistas con `Transition`) | 0,55 |
| Tiempo real sin recargar | 0,5 | Sí | 0,5 |
| **TOTAL** | **10** | | **7,35 / 10** |

**Implementado**
- `vue-router` con `/` (Home), `/lobby`, `/room`, `/stats` y `/admin` con 6 subvistas.
- Vistas y componentes: `HomeView`, `LobbyView`, `RoomView`, `PlayerRoomView`, `ObserverRoomView`, `StatsView`, `CreateRoomDialog`, `RoundSetup`, `RoomList`, `RoomRanking`, `RoundTimer`, `PlayerAvatar`, `PlayerProfile`, `AdminSidebar`, `AdminTargeta`, `AdminUsageChart`.
- `stores/game.js` centraliza jugador, sala, participantes, pregunta actual, resultados, ranking, estado de conexión y catálogo.
- `services/websocket.js` gestiona toda la conexión y el despacho de mensajes; las vistas consumen el store y helpers, no abren sockets.
- Vuetify 4 + Chart.js + MDI instalados; admin con dashboard, salas, preguntas, categorías, usuarios y estadísticas.
- Actualización en tiempo real sin recargar.

**Qué falta y qué hacer**
1. **Electron (1,2 pts):** `electron/main.js` solo crea una `BrowserWindow` 1200×800 y carga `http://localhost:5173`. No hay `title`, ni `icon`, ni `electron` en `package.json`, ni `electron-builder`, ni script de empaquetado. Para cumplir:
   - añadir `"electron"` y `"electron-builder"` a devDependencies,
   - `title: "How Much?! LIVE"` y `icon`,
   - cargar `dist/index.html` en producción y `localhost:5173` en desarrollo,
   - script `build` + configuración `build` de electron-builder y generar el `.exe`.
2. **WS dentro de Pinia (0,6 pts):** mover `connectSocket`, `send*` y `onmessage` a `stores/game.js` (o a un store `connection.js`) y que `services/websocket.js` desaparezca o sea un detalle interno. Hoy las vistas importan `requestCatalogOptions`, `disconnectSocket`, `selectObservedPlayer` directamente del servicio.
3. **Animaciones (0,45 pts):** solo `PlayerRoomView` y `ObserverRoomView` usan `<Transition>`. Añadir transiciones entre lobby → pregunta → resultados → ranking (Vuetify `v-slide-y-transition` / `v-fade-transition`) y al cambiar de ranking.
4. **URL del WS hardcodeada** (`ws://localhost:3000`): usar `import.meta.env` para que el build de Electron y el despliegue funcionen.

---

# 5. ENUNCIAT / TRANSVERSAL

*(pesos propuestos por mí sobre 10)*

| Requisito | Peso | Estado | Nota |
|---|---:|---|---:|
| README raíz: grupo, miembros, descripción, estado, ejecución Unity/Electron, Docker, URL, wireframes | 4,0 | **Plantilla original sin rellenar** | 0,2 |
| Estructura de repositorio sugerida | 1,0 | `frontend/`, `backend/` sí; faltan `unity/`, `database/` en raíz y `docs/` | 0,7 |
| `.gitignore` y ausencia de credenciales | 1,5 | **`.env` de los 4 servicios y raíz commiteados** | 0,4 |
| Documentación técnica | 2,0 | `ARCHITECTURE.md` (52 KB) + `doc/*.md` muy completos | 1,8 |
| Despliegue en `dam.inspedralbes.cat` | 1,5 | Sin URL ni Nginx | 0,2 |
| **TOTAL** | **10** | | **3,3 / 10** |

**Riesgo alto:** `git ls-files` confirma que están versionados `.env`, `backend/auth-service/.env`, `backend/catalog-service/.env`, `backend/game-service/.env` y `backend/stats-service/.env`. El enunciado prohíbe explícitamente subir credenciales. Hay que rotar secretos, añadir `.env` al `.gitignore`, dejar solo los `.env.example` y limpiar el historial si el profesor lo revisa.

Además, `doc/bbdd.md` documenta un bug real: `stats-service` inserta una columna `rondes` que no existe en `schema.sql`, por lo que el INSERT falla con 500 y no se guardan estadísticas. No afecta a la rúbrica de Accés a Dades, pero sí a la demo de estadísticas.

---

# 6. Plan de acción por puntos/hora

| Prioridad | Acción | Asignatura | Puntos recuperables | Esfuerzo |
|---|---|---|---:|---|
| 1 | Poner BOM UTF-8 al CSV + formatear decimales | AdD T13 | 0,75 | 20 min |
| 2 | `mapSequelizeError` con Unique → FK → Validation | AdD T14b | 1,1 | 40 min |
| 3 | Consulta SQL que excluya preguntas ya usadas | AdD T8 | 3,6 | 1 h |
| 4 | Import: try/catch por pregunta + justificar casos | AdD T12b | 0,6 | 40 min |
| 5 | `GET /health` + `/api/rooms/:codi/ranking` en game-service | AdD T14a + M9 | 1,5 | 1 h |
| 6 | Quitar `avatar_color` de `joinRoom` a un repositorio | AdD T14a | 0,3 | 10 min |
| 7 | Errores por campo en create/update de categoría y pregunta | AdD T5 | 1,2 | 1 h |
| 8 | Tabla `dato → requisito` en `doc/justificacio-dades.md` | AdD T15 | 0,4 | 30 min |
| 9 | Añadir `partida_id` al ER y completar `USUARIS` | AdD T1 | 1,0 | 15 min |
| 10 | **UnityWebRequest real (3 llamadas)** | Unity | 1,4 | 2 h |
| 11 | **Pantalla de gestión de microservicios en Unity** | Unity + M9 | 2,6 | 4 h |
| 12 | **Nginx + servicio en compose** | M9 | 1,3 | 1 h |
| 13 | **Electron: título, icono, builder y `.exe`** | M6 | 1,2 | 2 h |
| 14 | Mover WS a Pinia | M6 | 0,6 | 1 h |
| 15 | README raíz completo + URL | Transversal | 3,8 | 1 h |
| 16 | Sacar `.env` del repo y rotar secretos | Transversal | 1,1 | 30 min |
| 17 | Build de Unity versionado | Unity | 0,45 | 30 min |

Las cinco primeras acciones de Accés a Dades suman **~7 puntos** y caben en una tarde. Las de Unity/M9 son las que más pesan y las que hoy están a cero.

---

# 7. Riesgos para la sesión oral

1. **T8**: si el profesor pide ver «la consulta que tria una pregunta no feta», no existe. Es el punto que más fácilmente baja de nivel.
2. **T14a**: pedirá «una funció del mòdul que es crida des d'una ruta REST i des d'un gestor de WebSockets». Hoy no hay ninguna ruta REST en el servicio de juego.
3. **T14b**: pedirá abrir la función que convierte errores de Sequelize; no existe.
4. **T13**: abrir el CSV en Excel delante del profesor con acentos rotos convierte un Excel·lent en Bé.
5. **M9/Unity**: sin Nginx y sin herramienta de microservicios, dos bloques obligatorios se quedan casi a cero aunque el resto funcione.
6. **`.env` commiteados**: puede contaminar la valoración transversal y es un problema de seguridad real (secretos de JWT, correo y BD en el historial de Git).

---

*Auditoría basada en el commit `a692ff6`. Los porcentajes son estimaciones justificadas, no una nota oficial.*
