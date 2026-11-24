# T14b · Mòduls Sequelize reutilitzables i errors per tipus (RA3 · 2%)

## Nota

**5 / 10 — Suficient.**

Hi ha un mòdul de dades real (`preguntas.repository.js`) i, dins del catalog-service, les rutes
només el criden a ell: cap `findAll(`/`create(`/`destroy(` a `routes` ni a `controller`. Això és
la meitat bona.

Però el segon requisit de la rúbrica **no existeix**: no hi ha cap funció que converteixi errors
de Sequelize en missatges per al client. Buscant `UniqueConstraintError`, `ValidationError`,
`ForeignKeyConstraintError` o `instanceof` a tot `backend/` (sense `node_modules`) **no surt cap
resultat**. El `errorHandler` només llegeix `err.statusCode`/`err.code`/`err.message`, i les rutes
d'admin ni tan sols hi passen (tenen `try/catch` propi).

A més, fora del catalog-service hi ha una ruta que fa servir el model directament:
`stats-service/src/stats.routes.js` crida `Partida.create/findAll/findOne`.

La rúbrica diu: *"Suficient: alguna ruta fa servir els models directament, o només es tradueix una
part dels errors"*. Aquí es donen les dues condicions alhora, i la traducció no és parcial: és
inexistent. Com que sí que hi ha mòduls de dades (no és Insuficient) i no hi ha traducció per tipus
(no pot ser Bé), la nota és Suficient. **Amb una sola funció de ~15 línies i un `asyncHandler` a
les rutes d'admin, puja a Excel·lent.**

## Per què (evidència)

### 1. Cerca literal a `backend/` (sense `node_modules`)

```
findAll( | .create( | .destroy( | findOne( | .update(
```

| Fitxer | Línies | És un mòdul de dades? |
|---|---|---|
| `catalog-service/src/questions/preguntas.repository.js` | 189, 198, 208, 246, 254, 270, 307 | **Sí** — mòdul de dades del banc de preguntes |
| `catalog-service/src/questions/importQuestions.js` | 42, 65 (+ `findOrCreate` 37) | **Sí** — mòdul d'importació massiva, dins `src/questions/` |
| `stats-service/src/stats.routes.js` | 53, 74, 85, 93 | **NO** — és el fitxer de rutes |

No hi ha cap coincidència a `preguntas.routes.js`, `preguntas.controller.js`,
`game-service/src/handlers/*` ni a cap gestor de WebSocket. dins del catalog-service la separació
és neta.

### 2. El mòdul de dades existeix i s'usa

- `preguntas.repository.js:6` — `import { Categoria, Pregunta } from "../db/sequelize.js";`
  és **l'únic** fitxer, juntament amb `importQuestions.js` i `sequelize.js` (els hooks), que toca els models.
- CRUD de categories: `listCategoriesWithQuestions()` 188-193 (`Categoria.findAll` + `include`),
  `createCategory()` 195-209 (`findOne` + `create`), `updateCategory()` 211-235, `deleteCategory()` 237-248
  (`findByPk` + `categoria.destroy()` a la línia 246).
- CRUD de preguntes: `listQuestions()` 253-258, `createQuestion()` 260-271 (`Pregunta.create` línia 270),
  `updateQuestion()` 273-296, `deleteQuestion()` 298-309 (`pregunta.destroy()` línia 307).
- Les rutes només importen el mòdul: `admin/admin.routes.js:18` importa les 8 funcions del repository;
  no hi ha cap `import` del model en aquest fitxer. El controlador públic només crida
  `listCatalogOptions` i `getRandomQuestions` (`preguntas.controller.js:6-7`).

### 3. La traducció d'errors de Sequelize **no hi és**

`catalog-service/src/middleware/errorHandler.js:6-26` sencer:

```js
export function errorHandler(err, req, res, next) {
  console.error("Error:", err.message);
  const statusCode = err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  const message = err.message || "Error intern del servidor";
  res.status(statusCode).json({ error: { code, message } });
}
```

No hi ha cap `instanceof`, ni `err.name`, ni cap `import` de `sequelize`. Conseqüència directa:
si Sequelize llança un `SequelizeValidationError`, el client rep
`code: "SequelizeValidationError"` i el text en anglès de Sequelize (`Validation error: ...`), no un
missatge en català. El `500`/`INTERNAL_ERROR` tampoc no és correcte: un error de validació és `400`.

### 4. Les rutes d'admin ni passen per l'errorHandler

`admin/admin.routes.js` té 8 rutes amb `try/catch` propi (36-43, 46-53, 56-63, 66-73, 80-87, 90-97,
100-107, 110-117). Totes responen `res.status(400).json({ ok: false, code: error.code, reason: error.message })`
(línies 51, 61, 71, 95, 105, 115). Amb un error de Sequelize, `error.code` és el nom intern de la
classe (`SequelizeUniqueConstraintError`, `SequelizeDatabaseError`) i `error.message` el text anglès.
És a dir: encara que s'arreglés només l'`errorHandler`, aquestes rutes no el farien servir.

### 5. El cas que la rúbrica demana provar és real, no teòric

- `backend/database/sql/schema.sql:17` — `CONSTRAINT uq_categoria_nom UNIQUE (nom)`.
  `createCategory()` fa un `findOne` previ (198-206) però és una cursa: dues peticions simultànies
  passen les dues el `findOne` i la segona esclata amb `SequelizeUniqueConstraintError`.
- `schema.sql:41` — `FOREIGN KEY (categoria_id) REFERENCES categoria (id)` sense `ON DELETE CASCADE`.
  `createQuestion()` comprova la categoria a 263-268, però si s'esborra entre la comprovació i
  l'INSERT, salta `SequelizeForeignKeyConstraintError`.
- El model té validacions pròpies (`sequelize.js:32-35`, `71-73`, `78-80`, `85-87`, `112-115`, `120-122`).
  `unitat` és `STRING(50)` (104-108) i `validatePreguntaInput` **no en limita la longitud**
  (només fa `trim`, 152). Una `unitat` de 60 caràcters amb MySQL en mode estricte acaba en
  `SequelizeDatabaseError` → avui el client veu el text anglès de MySQL.

Nota honesta: el validador propi (`validatePreguntaInput`, 101-183) atura abans la majoria de casos
de `ValidationError`, i el duplicat de categoria normalment el caça el `findOne` manual amb un
missatge català correcte (203-205). Per això l'equip no ha notat el forat. Però la rúbrica puntua
la capa de traducció, i la capa no hi és: no hi ha manera d'explicar l'ordre d'`instanceof` perquè
no hi ha cap `instanceof`.

### 6. Detall menor: el model `Partida` fora de mòdul

`stats-service/src/stats.routes.js:4` importa `Partida` i el fa servir a les línies 53, 74, 85 i 93.
No hi ha `stats-service/src/repositories/`. Si la rúbrica s'interpreta només sobre el banc de
preguntes, aquest punt no compta; si s'interpreta sobre tot `backend/`, és una mancança de la
mateixa rúbrica.

## Què falta per ser Excel·lent

1. **Crear la funció de traducció** (per exemple `catalog-service/src/errors/sequelizeErrors.js`),
   amb l'ordre correcte i els tres tipus:

```js
import {
  UniqueConstraintError,
  ValidationError,
  ForeignKeyConstraintError,
} from "sequelize";

export function traduirErrorSequelize(err) {
  // UniqueConstraintError HERETA de ValidationError: ha d'anar PRIMER.
  if (err instanceof UniqueConstraintError) {
    return { statusCode: 409, code: "UNIQUE_CONSTRAINT", message: "Ja existeix un registre amb aquestes dades." };
  }
  if (err instanceof ForeignKeyConstraintError) {
    return { statusCode: 409, code: "FOREIGN_KEY_CONSTRAINT", message: "El registre referenciat no existeix o encara s'està fent servir." };
  }
  if (err instanceof ValidationError) {
    return { statusCode: 400, code: "VALIDATION_ERROR", message: err.errors.map((e) => e.message).join(" ") };
  }
  return null;
}
```

2. **Fer-lo servir a `errorHandler.js`** abans de llegir `err.statusCode`:

```js
const traduit = traduirErrorSequelize(err);
const statusCode = traduit?.statusCode ?? err.statusCode ?? 500;
const code = traduit?.code ?? err.code ?? "INTERNAL_ERROR";
const message = traduit?.message ?? err.message ?? "Error intern del servidor";
```

3. **Passar les rutes d'admin per l'`errorHandler`**: embolcallar els handlers amb `asyncHandler`
   (ja existeix, `middleware/asyncHandler.js:6-12`) i esborrar els 8 `try/catch`. Així hi ha un sol
   lloc que decideix el codi HTTP.
4. **Tancar la cursa de categoria**: deixar que el `UNIQUE` de la BD decideixi i traduir el 409, en
   lloc de confiar només en el `findOne` previ (o mantenir tots dos: el `findOne` per al missatge
   maco i el `UNIQUE` com a xarxa).
5. **Moure les consultes de `stats-service` a un repositori** (`src/repositories/partidaRepository.js`)
   i fer que `stats.routes.js` només el cridi.
6. **Un test** que provi que `new UniqueConstraintError(...)` retorna 409 i no el missatge genèric.
   Avui `catalog-service` no té cap test (`npm test` → `node --test` sense fitxers).

## Fitxers clau

| Fitxer | Per què |
|---|---|
| `backend/catalog-service/src/questions/preguntas.repository.js` | El mòdul de dades. Tots els models del banc de preguntes es toquen aquí. |
| `backend/catalog-service/src/db/sequelize.js` | Connexió, definició de models, validacions, associacions i hook `beforeDestroy`. |
| `backend/catalog-service/src/middleware/errorHandler.js` | **El forat.** No tradueix cap error de Sequelize. |
| `backend/catalog-service/src/admin/admin.routes.js` | Les 8 rutes que consumeixen el mòdul; `try/catch` propi que salta l'`errorHandler`. |
| `backend/catalog-service/src/middleware/asyncHandler.js` | La peça que ja existeix perquè les rutes deleguin errors al middleware. |
| `backend/database/sql/schema.sql` | `uq_categoria_nom` (17) i la FK (41): la font real dels errors que s'han de traduir. |
| `backend/stats-service/src/stats.routes.js` | Ruta que fa servir `Partida` directament (4, 53, 74, 85, 93). |

## Explicació dels fitxers

**`preguntas.repository.js`** és el mòdul de dades del catàleg. Exporta funcions de negoci sobre
dades (`listCategoriesWithQuestions`, `createCategory`, `listQuestions`, `createQuestion`…) que
retornen instàncies de Sequelize o `true`. També conté la validació d'entrada
(`validatePreguntaInput`, 101-183) i llança errors amb `error.code` propi (`CATEGORY_ALREADY_EXISTS`,
`QUESTION_NOT_FOUND`…) perquè la ruta només els reenviï. Barreja accés cru amb `pool` per a les
lectures ràpides (11-79) i Sequelize per al CRUD (188-309); funciona, però són dues portes a la
mateixa taula.

**`sequelize.js`** defineix `Categoria` i `Pregunta`, les validacions de columna, `hasMany`/`belongsTo`
(131-141) i un hook `beforeDestroy` que bloqueja esborrar una categoria amb preguntes (40-55). És
l'únic lloc on es declaren els models, cosa que està bé: la resta del codi no hauria de saber que
existeix Sequelize.

**`errorHandler.js`** és un middleware de 20 línies que assumeix que l'error ja porta
`statusCode`/`code`/`message` posats a mà. Aquest supòsit és cert per als errors propis del
repository, però fals per als errors que genera Sequelize, que porten el nom de la classe i el text
en anglès.

**`admin.routes.js`** demostra la part bona (només importa el repository, línia 18) i la dolenta
(`try/catch` a cada ruta, que impedeix que qualsevol traducció central arribi al client).

**`schema.sql`** és la segona barrera: el `UNIQUE (nom)` de categoria i la FK de pregunta són el
que provoca `UniqueConstraintError` i `ForeignKeyConstraintError`. Sense aquesta línia, els errors
que la rúbrica demana traduir no existirien.

## Preguntes probables

**1. Per què `UniqueConstraintError` s'ha de comprovar ABANS que `ValidationError`?**
Perquè `UniqueConstraintError` **hereta** de `ValidationError` a Sequelize. Si comproves primer
`err instanceof ValidationError`, el duplicat hi entra i et queda el missatge genèric de validació
(«Validation error: …»), no el de conflicte. Comprovant el fill primer, el pare encara rep la resta.

**2. Quina diferència hi ha entre `ValidationError` i `UniqueConstraintError`?**
`ValidationError` el llança Sequelize **abans** d'anar a la BD, quan incompleix una regla del model
(`notEmpty`, `notNull`, `len`). `UniqueConstraintError` ve de la BD, quan un `UNIQUE` o una PK es
viola. El primer és culpa del payload; el segon és un conflicte amb dades existents → `400` contra `409`.

**3. Què és `ForeignKeyConstraintError` i quan el veuríem aquí?**
És l'error de la BD quan insereixes o esborres una fila que trenca una clau forana. Aquí:
`pregunta.categoria_id` apuntant a una categoria que no existeix (si s'esborra entre la comprovació
i l'INSERT), o esborrar una categoria amb preguntes si el hook `beforeDestroy` no hi fos. Es tradueix
a `409` amb un missatge que digui que el registre referenciat no existeix o està en ús.

**4. Per què la ruta no ha de fer servir el model directament?**
Perquè la ruta és HTTP (status, JSON, auth) i el model és persistència. Si la ruta fa `Pregunta.create`,
la validació, les associacions i els errors de Sequelize s'escampen per cada endpoint, i cada canvi
de model obliga a tocar N rutes. Amb el mòdul, la ruta només tradueix el resultat a HTTP.

**5. Què retorna el mòdul?**
Instàncies de Sequelize (`Categoria`, `Pregunta`), o `true` als `delete*`, o `null` quan el filtre no
troba res (`getRandomQuestionsFromDatabase`, 55). La ruta no rep mai un error de Sequelize «cru» si
el middleware el tradueix; si no, sí.

**6. Si el mòdul ja llança errors amb `error.code` en català, per què cal traduir Sequelize?**
Perquè el mòdul només controla els errors que ell mateix crea. Els que genera Sequelize (`UNIQUE`,
FK, longitud de columna, validació de model) neixen dins d'una crida `await` del mòdul i pugen tal
qual, amb el nom de la classe i el text en anglès. El `code` propi no els cobreix.

**7. Per què les rutes d'admin no aprofiten l'`errorHandler`?**
Perquè tenen `try/catch` propi (`admin.routes.js:36-117`). Un `catch` que respon directament talla la
cadena: el middleware global no s'executa mai. Per això hi ha `asyncHandler`: deixa que el `catch`
sigui `next(err)` i centralitza la resposta.

**8. Quin status HTTP tocaria per a cada error?**
`ValidationError` → `400` (payload dolent), `UniqueConstraintError` → `409` (conflicte),
`ForeignKeyConstraintError` → `409` (referència en ús/inexistent), error desconegut → `500`. Avui
tots acaben en `400` a admin (perquè el `catch` ho fixa) o en `500` al handler global, que és pitjor.

**9. Si el validador propi ja atura els casos dolents, no és redundant traduir Sequelize?**
No: el validador és una comoditat per donar missatges bons, no una garantia. No cobreix longituds de
columna (`unitat STRING(50)`), ni cues/dobles clics (duplicat), ni esborrats concurrents (FK). I la
rúbrica demana explícitament la traducció per tipus.

**10. Per què `importQuestions.js` no compta com a violació?**
Perquè viu a `src/questions/`, és codi de dades, no de transport, i s'executa des del CLI
(`src/cli/importQuestions.js`), no des d'una ruta HTTP. Sí que és cert que duplica el camí de
`Pregunta.create` en lloc de cridar `createQuestion()`; seria més net que el repositori tingués una
funció d'importació.

**11. Com demostraries que l'ordre està malament?**
Amb `new UniqueConstraintError({ errors: [...] })`: si el codi comprova `ValidationError` primer,
`err instanceof ValidationError` és `true` i retorna el missatge genèric; si comprova
`UniqueConstraintError` primer, retorna el de conflicte. Es veu en una línia de test.

**12. Què passaria si afegim la traducció només a l'`errorHandler`?**
Que les rutes públiques (`/internal/preguntas/get`) milloren, però les d'admin segueixen igual,
perquè el seu `try/catch` no crida `next`. Calen les dues coses: traduir **i** no interceptar.

## Guió de demostració (60 s)

1. **Cerca (10 s):** `Ctrl+Shift+F` a `backend/`, patró `create\(`. Ensenya que dins del
   catalog-service només surt a `preguntas.repository.js` i `importQuestions.js`; cap a
   `preguntas.routes.js` ni `preguntas.controller.js`.
2. **Mòdul (10 s):** obre `preguntas.repository.js:188-209`. Ensenya que la ruta rep un objecte de
   negoci i mai el model. Obre `admin.routes.js:18` per demostrar que només importa el repositori.
3. **Forat (15 s):** obre `errorHandler.js:6-26` i digues: «aquí no hi ha cap `instanceof`». Justifica
   l'ordre: `UniqueConstraintError extends ValidationError`, per tant el fill va primer.
4. **Cas real (10 s):** `schema.sql:17` (`UNIQUE (nom)`) i `:41` (FK). Explica que el `findOne` previ
   de `createCategory` té una cursa i que la segona petició dona `UniqueConstraintError`.
5. **Demo del defecte (10 s):** `POST /internal/admin/preguntes` amb `unitat` de 60 caràcters →
   resposta amb `code: "SequelizeDatabaseError"` i text anglès. És el que l'usuari veu avui.
6. **Tancament (5 s):** «una funció de 15 línies + `asyncHandler` a admin = Excel·lent; avui és
   Suficient perquè falta la traducció i `stats.routes.js` encara toca `Partida` directament».
