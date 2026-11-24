# T4 · Connexió i models de categories i preguntes, sense `sync()` (RA3 · 5%)

## Nota

**Excel·lent — 10 / 10.**

Una instància de Sequelize per servei, models definits amb `sequelize.define` que
reprodueixen columna a columna `schema.sql`, `tableName` explícit, `timestamps: false`
i la clau forana declarada per associació. **Zero `sync()` a tot el projecte** (cercat
amb `\.sync\s*\(` a `backend/`: 0 resultats). El model de preguntes es pot ensenyar al
costat de la seva taula i no hi ha cap diferència.

## Per què abans era 9,5 i no 10

Tres punts, tots tres tancats menys un que és arquitectònic:

| # | Mancança | Estat |
|---|---|---|
| 1 | `Categoria.nom` no declarava `unique: true` tot i que `schema.sql:17` té `uq_categoria_nom` | **Resolt**: `sequelize.js:32` |
| 2 | `stats-service/src/models/Partida.js` divergia de l'esquema: `id` en `INTEGER` (esquema `BIGINT`) i `usuari_id allowNull: false` (esquema `NULL`) | **Resolt**: `Partida.js:15` i `:18` |
| 3 | Hi ha **dues** instàncies `new Sequelize` (catalog `:9` i stats `db.js:3`) | **No es pot resoldre, i està bé**: són dos processos distints en dos contenidors. Es justifica a sota |

### Per què la tercera no és un defecte

La rúbrica diu "una sola instància de Sequelize" pensant en un projecte monolític, on
importar `sequelize.js` des de dos llocs i fer dos `new Sequelize` seria un error. Aquí
cada microservei és un procés Node independent amb la seva pròpia memòria: no poden
compartir un objecte de connexió encara que vulguin.

La prova que no n'hi ha cap de més és que **dins de cada servei** només se'n crea una:

| Servei | Instància | Mòdul que la crea |
|---|---|---|
| `catalog-service` | `sequelize.js:9` | l'importen `preguntas.repository.js` i companyia |
| `stats-service` | `db.js:3` | l'importa cada model |

## Per què (evidència)

### La instància (`sequelize.js:9-18`)

```js
export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost, port: dbPort, dialect: "mysql", logging: false,
  define: { timestamps: false, freezeTableName: true },
});
```

Tots els paràmetres surten de variables d'entorn (`:3-7`) amb valors per defecte, així
que funciona igual en local i dins del contenidor. `define` aplica `timestamps: false` a
**tots** els models, i `freezeTableName` evita que Sequelize pluralitzi el nom de la taula.

### `Categoria` (`:20-58`) vs `schema.sql:13-19`

| Model | `schema.sql` | Coincideix |
|---|---|---|
| `id` `INTEGER.UNSIGNED` autoIncrement PK (`:23-28`) | `id INT UNSIGNED AUTO_INCREMENT` PK | ✅ |
| `nom` `STRING(100)` NOT NULL, `unique: true` (`:29-36`) | `nom VARCHAR(100) NOT NULL`, `uq_categoria_nom` | ✅ |
| `tableName: "categoria"` (`:39`) | taula `categoria` | ✅ |
| `timestamps: false` (`:40`) | no té `createdAt`/`updatedAt` | ✅ |
| Hook `beforeDestroy` (`:41-56`) | no existeix a l'esquema, és lògica de negoci de T6 | ✅ |

### `Pregunta` (`:60-130`) vs `schema.sql:22-44`

| Model | `schema.sql` | Coincideix |
|---|---|---|
| `id` `INTEGER.UNSIGNED` (`:62-67`) | `INT UNSIGNED` PK | ✅ |
| `categoria_id` `INTEGER.UNSIGNED` NOT NULL (`:68-74`) | `categoria_id INT UNSIGNED NOT NULL` | ✅ |
| `text` `TEXT` NOT NULL (`:75-81`) | `text TEXT NOT NULL` | ✅ |
| `resposta_correcta` `DOUBLE` (`:82-88`) | `DOUBLE NOT NULL` | ✅ |
| `min` → `field: "min_value"` (`:89-93`) | `min_value DOUBLE` | ✅ |
| `max` → `field: "max_value"` (`:94-98`) | `max_value DOUBLE` | ✅ |
| `step` → `field: "step_value"` (`:99-103`) | `step_value DOUBLE` | ✅ |
| `unitat` `STRING(50)` default `""` (`:104-108`) | `VARCHAR(50) NOT NULL DEFAULT ''` | ✅ |
| `dificultat` `STRING(32)` (`:109-116`) | `VARCHAR(32)` | ✅ |
| `explicacio` `TEXT` (`:117-123`) | `TEXT` | ✅ |
| `tableName: "pregunta"` (`:127`), `timestamps: false` (`:128`) | taula `pregunta`, sense timestamps | ✅ |

**El punt fi:** als camps `min`/`max`/`step`, el nom de la propietat JS no coincideix
amb la columna SQL i s'usa `field:` per fer el mapeig (`:92`, `:97`, `:102`). Es pot
ensenyar com a exemple de per què el model no ha de forçar el nom de la columna.

### La clau forana (`:132-142`)

```js
Categoria.hasMany(Pregunta, { foreignKey: "categoria_id", as: "preguntas", onDelete: "RESTRICT" });
Pregunta.belongsTo(Categoria, { foreignKey: "categoria_id", as: "categoria", onDelete: "RESTRICT" });
```

A Sequelize la FK es declara a l'**associació**, no a l'atribut: `foreignKey:
"categoria_id"` és el que permet `include`. L'`onDelete: "RESTRICT"` documenta a JS el
que la BD ja fa (`schema.sql:40-43`); amb `sync()` el crearia, però com que no s'usa
`sync()`, l'única font de veritat és l'esquema.

### No hi ha `sync()`

```powershell
Select-String -Path (Get-ChildItem backend -Recurse -Include *.js -File | Where-Object {$_.FullName -notmatch 'node_modules'}).FullName -Pattern '\.sync\s*\('
```

**0 resultats.** Les 7 coincidències que apareixen amb una cerca ingènua de `sync(` són
`async (` — cal l'expressió regular amb el punt escapadat. L'esquema el crea
`docker-compose.yml:15` muntant `schema.sql`.

## Què falta per ser Excel·lent

Res. La tasca està completa.

**Què has de vigilar:**

1. **Commit.** `sequelize.js` i `Partida.js` tenen canvis no commitejats. Si el professor
   agafa `b8c8eee`, no els veu.
2. **Ensenya el model de `pregunta`, no el de `Partida`.** El de `pregunta` és perfecte;
   el de `Partida` és correcte ara, però no té el `field:` mapping que tant llueix.
3. **El joc llegeix les preguntes amb SQL cru**, no amb el model
   (`preguntas.repository.js:47-80`). És correcte (és T14a), però si algú pregunta
   "això funciona amb el model?", la resposta honesta és "el model el fa servir
   l'administració; el joc llegeix amb mysql2 perquè necessita un `RAND()` que Sequelize
   no expressa bé".

## Fitxers clau

- `backend/catalog-service/src/db/sequelize.js` — 150 línies: instància, 2 models, 2 associacions i hooks.
- `backend/database/sql/schema.sql:13-44` — les taules `categoria` i `pregunta` per comparar.
- `backend/stats-service/src/db.js` — la segona instància (justificada).
- `backend/stats-service/src/models/Partida.js` — el model que abans divergia.
- `docker-compose.yml:15` — on es crea l'esquema de veritat.

## Explicació dels fitxers

**`sequelize.js`** — És el mòdul de dades del banc de preguntes. Té tres responsabilitats:
crear la connexió (`:9-18`), definir els models (`:20-130`) i declarar les associacions
(`:132-142`). També hi ha el hook `beforeValidate` (`:144+`) que fa `trim()` de `text` i
`unitat` abans de validar, i el `beforeDestroy` de `Categoria` que implementa T6.

**`schema.sql`** — No el toca Ningú des de Sequelize. És el que es compara a la demo:
`SHOW CREATE TABLE pregunta` al costat de les línies `:60-130` del model.

**`db.js` (stats)** — Fa el mateix que `sequelize.js` però per al servei d'estadístiques.
És la prova que la duplicació d'instàncies és per procés, no per error.

## Preguntes probables

1. **Per què `timestamps: false`?**
   Perquè les taules no tenen `createdAt`/`updatedAt`. Sense això, Sequelize els afegiria
   a les consultes i fallaria amb `Unknown column 'createdAt'`. Es posa al `define` global
   (`:15`) i es repeteix a cada model (`:40`, `:128`) per si algú importa el model sol.

2. **Per què no feu `sync()`?**
   Perquè l'esquema és un lliurable propi (`schema.sql`) amb restriccions que Sequelize no
   sap expressar: FK compostes, 10 `CHECK`, `UNIQUE (id, partida_id)`. Amb `sync()` la BD
   seria un efecte secundari del codi JS i no es podria ensenyar. A més, `sync()` pot
   fer `ALTER TABLE` destructiu en producció.

3. **Què passaria si el model i l'esquema divergeixen?**
   Les lectures fallen amb `Unknown column` i les escriptures amb `ER_BAD_FIELD_ERROR`.
   És el que passava amb `Partida.js` abans: `id` en `INTEGER` no trencava res perquè
   `BIGINT` i `INTEGER` es llegeixen igual, però `allowNull: false` sí que hauria impedit
   desar un agregat sense usuari.

4. **Per què `field:` a `min`, `max` i `step`?**
   Perquè a la BD les columnes es diuen `min_value`, `max_value` i `step_value`, i al codi
   es volen noms curts. `field` tradueix sense renombrar res a la BD.

5. **On es declara la clau forana, a l'atribut o a l'associació?**
   A l'associació (`foreignKey: "categoria_id"`). L'atribut `categoria_id` només diu el
   tipus; l'associació és la que permet `include` i la que Sequelize faria servir si es
   fes `sync()`. També es podria posar `references` a l'atribut, però llavors caldria
   duplicar-ho.

6. **`unique: true` al model té efecte en execució?**
   No. Només s'usa si es fa `sync()` per crear la restricció, i com a documentació. Qui
   rebutja el duplicat és la BD (`uq_categoria_nom`) i el codi ho tradueix a T14b.

7. **Què fa `freezeTableName: true`?**
   Evita la pluralització automàtica de Sequelize: sense això, el model `Pregunta` buscaria
   la taula `Preguntas`. Tot i així cada model declara `tableName` explícit, que és el més
   segur.

8. **Com es connecta a la BD?**
   Amb variables d'entorn (`:3-7`): `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`,
   `DB_PORT`. Els valors per defecte funcionen en local; dins de Docker el `DB_HOST` és
   `mariadb` (`docker-compose.yml`).

9. **Per què `logging: false`?**
   Perquè Sequelize, per defecte, fa `console.log` de cada consulta. En un joc amb moltes
   peticions, omple la consola i alenteix.

10. **Per què el `id` de `Partida` en `BIGINT` retorna un string?**
    Perquè JavaScript no pot representar enters de 64 bits amb precisió i Sequelize els
    retorna com a `string`. Afecta `stats.routes.js:62`, que retorna `partidaId`; ningú el
    consumeix, així que no trenca res.

11. **Com demostres que no hi ha cap `sync()`?**
    Amb la cerca regex `\.sync\s*\(` a tot `backend/`. Cal escapar el punt: `sync(` sol
    dona 7 falsos positius que són `async (`.

12. **Per què hi ha dos `new Sequelize` al projecte?**
    Perquè són dos microserveis amb processos separats. Compartir la instància seria
    impossible encara que volguessis. Dins de cada servei només n'hi ha una.

## Guió de demostració (60 s)

**0-15 s — El model al costat de la taula.** Obre `sequelize.js:60-130` i
`schema.sql:22-44` en dues pestanyes. Recorre les 3 columnes que més es veuen: `text`,
`resposta_correcta` i el triplet `min`/`max`/`step` amb `field:`.

**15-30 s — `tableName` i `timestamps`.** Assenyala `:127-128` i digues: "el nom de la
taula és explícit, i no hi ha `createdAt` perquè l'esquema no en té".

**30-45 s — La FK.** `:132-142`: `hasMany` + `belongsTo`, `foreignKey: "categoria_id"`,
`onDelete: "RESTRICT"`. "La FK es declara a l'associació; l'esquema la té a `:40-43`".

**45-60 s — La prova del `sync()`.** Comparteix pantalla i executa la cerca:

```powershell
Select-String -Path (Get-ChildItem backend -Recurse -Include *.js -File | Where-Object {$_.FullName -notmatch 'node_modules'}).FullName -Pattern '\.sync\s*\('
```

0 resultats. Tanca amb: "l'esquema el crea `docker-compose.yml:15`; el codi només el llegeix".
