# T12b · Desar les preguntes vàlides amb Sequelize

Revisió de la part de **desar** (no de validar) de la importació. Data: 22/11/2026.

## Nota

**Bé — 7/10 (1,4 / 2 punts de la rúbrica).**

Es desa exactament el que ha passat la validació, amb la categoria correcta i amb el mòdul de dades de Sequelize (`Categoria`/`Pregunta`, sense SQL cru al mòdul d'importació). Però **no hi ha `try/catch` per pregunta**: tot el bucle viu dins d'una única `sequelize.transaction` (`src/questions/importQuestions.js:35-75`), així que si falla el `create` de la pregunta 3, la transacció fa `ROLLBACK` de **totes** les files ja desades i la importació s'atura. Això és exactament el supòsit que la rúbrica reserva per a «Bé». A més, els dos casos especials (categoria inexistent i importació repetida) estan **descrits** a `doc/catalog-service.md` §4.5 i `doc/bbdd.md`, però no hi ha un paràgraf que els **justifiqui** (per què crear en lloc de rebutjar, per què només se sincronitzen els camps numèrics). La mateixa auditoria del repo ho deixa com a pendent (`doc/auditoria-requisits.md:288-295`).

No és «Suficient»: no es desa cap pregunta invàlida (es filtra abans de la transacció) i la categoria no es perd (s'assigna `categoria_id` a cada `create`). No és «Insuficient»: tot passa per Sequelize.

## Per què (evidència)

| Requisit de la rúbrica | Evidència | Valoració |
|---|---|---|
| Només les vàlides s'emmagatzemen | `src/questions/importQuestions.js:24-29`: `validarPregunta(input)`; si `!result.valid` va a `rejected` i **no** a `validQuestions`; el bucle de desar (`:36`) només recorre `validQuestions` | ✅ |
| Amb la seva categoria | `importQuestions.js:37-40` resol la categoria pel nom (`group.category`, injectat a `:22`) amb `Categoria.findOrCreate({ where: { nom } })`; `:65-67` desa `categoria_id: category.id` | ✅ |
| Amb el mòdul de dades de Sequelize | `importQuestions.js:1` importa `Categoria, Pregunta, sequelize` de `src/db/sequelize.js`; `:37` `findOrCreate`, `:42` `findOne`, `:58` `existing.save`, `:65` `Pregunta.create`; no hi ha SQL dins del mòdul (el `pool` cru només s'usa a `preguntas.repository.js:10-31` per al seed inicial i a les lectures) | ✅ |
| Si una falla en desar, es descarta i continua | **No.** `importQuestions.js:35` obre una sola transacció i `:36-74` és un `for` sense `try/catch`. Qualsevol excepció surt del `for`, surt del callback i Sequelize fa `ROLLBACK` de tot. No hi ha cap entrada `SAVE_ERROR` a `rejected` | ❌ (límit de la nota) |
| Categoria inexistent justificada | Es **crea** (`findOrCreate`, `:37-40`) i queda documentat a `doc/catalog-service.md:218-229` i `doc/bbdd.md:190`; però no s'argumenta per què crear i no rebutjar | ⚠️ |
| Importació repetida justificada | Es dedueix per `(categoria_id, text)`: `importQuestions.js:42-45` `findOne`; si existeix i canvien els numèrics, `save` (`:52-59`); si no, `skipped` (`:60-62`). Documentat a `doc/catalog-service.md:226-235` i `doc/bbdd.md:190,699`, amb la limitació explícita que **no hi ha UNIQUE** a la BD | ⚠️ (comportament documentat, decisió no justificada del tot) |

### Idempotència, en detall

- **Si s'importa dues vegades el mateix fitxer, no es dupliquen** (en sèrie): la segona passada troba cada `(categoria_id, text)` amb `findOne` (`importQuestions.js:42-45`) i retorna `{ imported: 0, updated: 0, skipped: 254 }` si el JSON no ha canviat.
- **La garantia és només de codi, no de BD.** `schema.sql:22-44` no té `UNIQUE (categoria_id, text)`. Si dues instàncies importen alhora (per exemple, dues rèpliques del `catalog-service` arrencant amb la taula buida via `ensureInitialCatalog`, `preguntas.repository.js:10-31`), les dues poden passar el `findOne` i inserir la mateixa fila. Està reconegut a `doc/catalog-service.md:233-235` i `:561`, però no està resolt.
- Reimportar **no actualitza** `text`, `unitat`, `dificultat` ni `explicacio`: només `resposta_correcta`, `min`, `max`, `step` (`importQuestions.js:46-51,56-58`). Corregir una explicació al JSON no té efecte (limitation a `doc/catalog-service.md:560`).
- Si el text canvia (per exemple, s'arreglen accents), la fila es considera nova i es duplica: la clau és el text, no l'`id` del JSON (que s'ignora, `doc/catalog-service.md:229`).

### Unicitat de la categoria

`schema.sql:17` té `CONSTRAINT uq_categoria_nom UNIQUE (nom)`, i el `findOrCreate` es recolza en aquesta restricció. La FK `fk_pregunta_categoria` (`schema.sql:40-43`) i l'associació Sequelize (`src/db/sequelize.js:131-141`, `onDelete: "RESTRICT"`) garanteixen que una pregunta no pot quedar amb una categoria inexistent. Si s'inserís per SQL cru amb un `categoria_id` inventat, MariaDB retornaria error 1452.

### Estat real de la BD en el moment de la revisió

`SELECT COUNT(*) FROM pregunta` a la MariaDB de Compose dona **31 files**, repartides entre les 8 categories del seed. Són les de `backend/database/sql/dades-inicials.sql`, no les 254 del JSON: la importació **encara no s'ha executat** en aquest entorn (el seed inicial només importa si `COUNT(*) = 0`, `preguntas.repository.js:23-28`). Per a la demo cal executar primer `npm run import:questions`.

## Què falta per ser Excel·lent

1. **Error per pregunta, no per lot.** Moure el `try/catch` dins del `for` i fer una transacció per pregunta (o `SAVEPOINT`), de manera que una fallada faci `rejected.push({ ..., errors: ["SAVE_ERROR: ..."] })` i continuï amb la següent. Mantenir la transacció única només si es vol atomicitat total, però llavors no es compleix el criteri d'Excel·lent.
2. **Justificar per escrit els dos casos**, no només descriure'ls: «categoria inexistent → es crea amb `findOrCreate` perquè el JSON és la font de veritat i una categoria nova no ha de fer fallar la importació» i «import repetit → es dedueix per `(categoria_id, text)`; només se sincronitzen els camps numèrics perquè la resta es considera contingut editorial».
3. **Reforçar la idempotència a la BD** (opcional però és el que separa «funciona» de «garantit»): `UNIQUE (categoria_id, text_hash)` amb una columna hash, perquè dos imports concurrents no puguin duplicar. Alternativa mínima: documentar que la importació és d'un sol procés i que el seed no ha de competir amb el CLI.
4. **Test** del mòdul d'importació (ara `catalog-service` no en té cap; el `npm test` és `node --test` sense fitxers): un cas amb una pregunta invàlida, un amb una de fallada simulada i un amb doble import.

## Fitxers clau

- `backend/catalog-service/src/questions/importQuestions.js` — el mòdul que desa (35-75).
- `backend/catalog-service/src/db/sequelize.js` — models `Categoria`/`Pregunta` i associacions (20-153).
- `backend/catalog-service/src/questions/validarPregunta.js` — filtre previ (5-101).
- `backend/catalog-service/src/questions/loadQuestions.js` — lectura del JSON (30-46).
- `backend/catalog-service/src/cli/importQuestions.js` — entrada `npm run import:questions` (4-11).
- `backend/database/sql/schema.sql` — taula `pregunta`, UNIQUE de categoria i FK (13-44).
- `backend/database/preguntas/preguntas.json` — 8 grups `{ category, questions }` (254 preguntes).
- `doc/catalog-service.md` — §4.5 (206-235) i limitacions (544-561).

## Explicació dels fitxers

- **`importQuestions.js`**: llegeix el JSON, valida cada pregunta (`validarPregunta`), acumula els rebutjos amb `categoryIndex`/`questionIndex`/`errors` i obre una transacció. Per cada pregunta vàlida: `Categoria.findOrCreate` pel nom (crea la categoria si no existeix), `Pregunta.findOne` per `(categoria_id, text)` (si existeix, compara i actualitza només els quatre camps numèrics o compta `skipped`; si no, `Pregunta.create` amb `categoria_id`, text, resposta, min/max/step, unitat, dificultat i explicacio). Retorna `{ imported, updated, skipped, rejected }`. **No hi ha `try/catch` per pregunta**: una excepció fa rollback de tot el lot.
- **`sequelize.js`**: defineix la connexió (`dialect: "mysql"`, `timestamps: false`, `freezeTableName`) i els models amb les validacions (`categoria_id` i `text` obligatoris, `resposta_correcta`/`min`/`max`/`step` no nuls, `dificultat` 1-32). Mapeja `min/max/step` a `min_value/max_value/step_value`. `hasMany`/`belongsTo` amb `onDelete: RESTRICT`. Un hook `beforeValidate` retalla els espais de `text`, `unitat` i `explicacio`.
- **`validarPregunta.js`**: retorna `{ valid, errors }` sense llançar. Comprova text, resposta numèrica, rang `min < max`, `step > 0`, nombre de passos enter, resposta dins del rang, unitat ≤ 50, dificultat 1-32 i diferent de `mix`, explicació i categoria (nom ≤ 100). És el que impedeix que una pregunta invàlida arribi al `create`.
- **`loadQuestions.js`**: llegeix el fitxer indicat o el JSON per defecte; embolcalla qualsevol error amb `code = QUESTIONS_FILE_ERROR`.
- **`cli/importQuestions.js`**: executa la importació amb `process.argv[2]` opcional, imprimeix el resultat en JSON, posa `process.exitCode = 1` si hi ha excepció i tanca `sequelize` al `finally`.
- **`schema.sql`**: `pregunta` té PK autoincrement, FK a `categoria` amb `ON DELETE RESTRICT`, `CHECK` del slider i `CHECK` de text no buit. **No té UNIQUE per `(categoria_id, text)`**; `categoria` sí que té UNIQUE pel nom.

## Preguntes probables

1. **Per què `Pregunta.create` i no `bulkCreate`?**
   Perquè cada fila necessita una decisió individual abans d'inserir: `findOne` per `(categoria_id, text)` i, si existeix, `save` o `skipped` (`importQuestions.js:42-63`). `bulkCreate` no pot fer aquesta actualització selectiva ni retornar els comptadors `imported/updated/skipped` per pregunta; a més, el `create` per fila dona error concret de la fila que falla (que és el que permetria descartar-la i continuar). El cost és una consulta per pregunta, acceptable per a 254 files.

2. **Què passa si falla en desar la tercera pregunta?**
   Amb el codi actual, la transacció única fa `ROLLBACK`: no queda **cap** pregunta nova, ni les dues primeres, i la importació s'atura amb l'excepció. És el punt feble que impedeix l'Excel·lent. La solució és `try/catch` per pregunta i transacció (o savepoint) per fila, afegint el motiu a `rejected`.

3. **Què fa la FK si la categoria no existeix?**
   Al camí d'importació no hi arriba: `findOrCreate` crea la categoria abans del `create` (`:37-40`). Si s'inserís per SQL cru amb un `categoria_id` inexistent, MariaDB rebutjaria la fila amb l'error 1452 (`Cannot add or update a child row`). El CRUD de l'admin sí que comprova explícitament que la categoria existeixi (`preguntas.repository.js:263-268`).

4. **Com eviteu els duplicats en importar dues vegades?**
   Amb `Pregunta.findOne({ where: { categoria_id, text } })` dins de la transacció (`:42-45`). Si existeix i els valors numèrics no canvien, compta `skipped`; si canvien, actualitza només `resposta_correcta/min/max/step`. **No hi ha UNIQUE a la BD**, així que dos imports concurrents podrien duplicar; està documentat com a limitació.

5. **Per què Sequelize i no SQL cru?**
   Perquè el projecte ja té els models i les associacions al mòdul de dades (`sequelize.js`), i així s'hereten les validacions, el mapeig de columnes (`min` → `min_value`), la gestió de la transacció i la FK sense repetir SQL. El SQL cru del `pool` es reserva per a les lectures ràpides del joc i el seed (`preguntas.repository.js`). Barrejar-ho a la importació duplicaria el coneixement de l'esquema.

6. **Què passa amb una importació repetida si canvien els textos?**
   Es tracta com una pregunta nova: la clau és `(categoria_id, text)`, no l'`id` del JSON (que s'ignora). Corregir accents o redactar de nou el text crea una fila nova; els canvis d'`explicacio`, `unitat` o `dificultat` sobre un text idèntic **no** es desen (només se sincronitzen els camps numèrics).

7. **Què passa amb una categoria que no existeix al JSON?**
   Es crea automàticament amb `findOrCreate` i el nom del grup, i la pregunta queda associada a aquesta categoria nova. El risc és que una errata («Geografa») creï una categoria òrfena; per això caldria justificar la decisió o validar-la contra la llista de categories existents.

8. **Com sabeu que només s'han desat les vàlides?**
   `validarPregunta` s'executa abans de la transacció (`:24`) i només les que retornen `valid: true` entren a `validQuestions` (`:27-29`); el bucle de desar només recorre aquest array. Les rebutjades surten al JSON del CLI amb el seu `categoryIndex`, `questionIndex` i la llista d'errors.

9. **Per què una única transacció si després no es vol atomicitat total?**
   Perquè dona atomicitat del catàleg: o s'importa tot o no s'importa res, i no queden catàlegs a mitges. El problema és que la rúbrica demana el contrari (descartar la dolenta i continuar), així que cal triar: atomicitat total (Bé) o tolerància per fila (Excel·lent).

10. **Quin és el resultat d'una segona execució del CLI?**
    `{ "imported": 0, "updated": 0, "skipped": N, "rejected": [] }`, on N és el nombre de preguntes vàlides. Si alguna dada numèrica ha canviat al JSON, aquella fila compta com a `updated` en lloc de `skipped`.

## Guió de demostració (60 s)

1. **Comprovar l'estat inicial** (10 s): a phpMyAdmin, `SELECT COUNT(*) FROM pregunta;` → 31 (seed SQL), i `SELECT * FROM categoria;` → 8 files.
2. **Executar la importació** (10 s): `docker compose exec -T catalog-service npm run import:questions`. Ensenyar la sortida `{ imported, updated, skipped, rejected }`.
3. **Veure les noves preguntes amb categoria** (15 s): a phpMyAdmin,
   `SELECT p.id, LEFT(p.text, 60) AS pregunta, c.nom AS categoria, p.min_value, p.max_value, p.step_value FROM pregunta p JOIN categoria c ON c.id = p.categoria_id ORDER BY p.id DESC LIMIT 10;`
   Ensenyar que `categoria` no és buida i que les files noves tenen `id` alt.
4. **Demostrar que només hi són les vàlides** (10 s): ensenyar `doc`/sortida del CLI amb `rejected` buit o amb els rebutjos; al codi, `importQuestions.js:24-29` (filtre) i `:36` (només `validQuestions`).
5. **Demostrar la idempotència** (10 s): tornar a executar el CLI → `imported: 0, skipped: N`; a phpMyAdmin, el `COUNT(*)` no ha canviat.
6. **Reconèixer el límit** (5 s): ensenyar `:35` (transacció única) i explicar que una fallada fa rollback de tot; dir què faríeu (`try/catch` per pregunta). Aquesta honestedat val més que amagar-ho.
