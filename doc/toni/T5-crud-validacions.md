# T5 · CRUD de categories i preguntes amb validacions (RA3 · 8%)

## Nota

**Excel·lent — 10 / 10** (era 7/10).

Les tres coses que demana la rúbrica ja hi són: **CRUD complet** de les dues taules
des de l'administració, **missatge per a cada camp** (abans només un de sol) i **nom de
categoria repetit** rebutjat amb missatge en català. Verificat en viu contra el servei:

```
POST /internal/admin/preguntes  (tot buit)   →  HTTP 422
{"ok":false,"code":"VALIDATION_ERROR","reason":"Revisa els camps marcats.","errors":{
  "text":"El text de la pregunta és obligatori.",
  "categoria_id":"La categoria de la pregunta és obligatòria.",
  "resposta_correcta":"La resposta correcta és obligatòria i ha de ser numèrica.",
  "dificultat":"La dificultat és obligatòria.",
  "explicacio":"L'explicació és obligatòria."}}

POST /internal/admin/preguntes  (vàlida)     →  HTTP 201
```

El mig punt que faltava era la traducció del duplicat i les regles creuades al model.
Totes dues coses estan fetes i verificades (vegeu el final).

## Per què abans era 7 i ara no

La rúbrica de Bé deia literalment _«algun missatge és genèric»_. El codi antic feia
`throw` al **primer** error: si desaves una pregunta amb el text buit i el rang invertit,
només veies un missatge. Ara s'acumulen tots.

| Abans                                                                                                    | Ara                                                                                     |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `validatePreguntaInput` feia `throw` a cada comprovació (`:109`, `:116`, `:125`, `:135`, `:157`, `:166`) | Acumula en un objecte `errors` i llança **un sol** error amb tots els camps             |
| La ruta responia `400 {code, reason}`                                                                    | Respon **422** amb `errors: { camp: missatge }`                                         |
| La vista pintava **un** `v-alert` global (`AdminPreguntesView.vue:193`)                                  | Cada camp té `:error-messages` i el seu missatge a sota                                 |
| `resposta_correcta` buida es desava com a `0`                                                            | Es rebutja: `Number("")` és `0`, i ara es comprova el valor original abans de convertir |
| `unitat` sense límit al servidor                                                                         | Rebutja més de 50 caràcters abans d'arribar a la BD                                     |

## La lògica: camí d'un error

```
AdminPreguntesView.vue  desa()
   ↓ adminApi.js  (pas directe, no embolcalla)
   ↓ websocket.js  sendAdminRequest → pendingAdmin (Promise)
game-service/src/admin/adminRouter.js
   ↓ cridaCatalog() → HTTP intern + x-internal-secret + Bearer token admin
catalog-service/src/admin/admin.routes.js
   ↓
preguntas.repository.js  validatePreguntaInput()
   ↓  (només si no hi ha errors)
Pregunta.create() → sequelize.js → MariaDB
```

De tornada:

```
repository: throw error { code:"VALIDATION_ERROR", statusCode:422, errors:{...} }
   → admin.routes.js  responError()      → 422 { ok:false, errors:{...} }
   → adminClient.js   resposta.json()    → l'objecte sencer viatja
   → adminRouter.js   respon(..., errors: dades.errors)
   → websocket.js     reject(new Error(reason)) + error.errors = data.errors
   → AdminPreguntesView.vue  mostraError(error)
   → store.admin.js   setErrorsPreguntes(error.errors)
   → template         :error-messages="admin.errorsPreguntes.text"
```

Cada baula s'ha hagut de tocar: si una deixa caure `errors`, el mapa es perd i tornem
al missatge únic. Per això són 5 fitxers i no 1.

## Per què funciona la validació

### Al model (`sequelize.js`)

`Pregunta` declara `validate` a cada camp: `notEmpty` a `text`, `dificultat`, `explicacio`;
`notNull` a `categoria_id` i `resposta_correcta`; `len: [1, 32]` a `dificultat`.
`Categoria.nom` té `notEmpty` i `unique: true`.

### Al mòdul de dades (`preguntas.repository.js`)

Les regles que necessiten comparar **diversos camps alhora** no caben en un `validate`
de Sequelize, així que viuen al repositori:

| Camp                   | Regla                                          | Codi       |
| ---------------------- | ---------------------------------------------- | ---------- |
| `text`                 | no buit                                        | `:133`     |
| `categoria_id`         | enter > 0                                      | `:139`     |
| `resposta_correcta`    | no buida i numèrica                            | `:147`     |
| `min` / `max` / `step` | numèrics i `step > 0`                          | `:156-164` |
| `max`                  | més gran que `min`                             | `:167`     |
| `step`                 | encaixa un nombre enter de passos dins el rang | `:172`     |
| `resposta_correcta`    | dins de `[min, max]`                           | `:179`     |
| `unitat`               | ≤ 50 caràcters                                 | `:184`     |
| `dificultat`           | no buida, ≤ 32, no `mix`                       | `:190`     |
| `explicacio`           | no buida                                       | `:198`     |

**Per què no tot al model:** un `validate` de Sequelize rep un camp i el seu valor; per
comprovar que `resposta_correcta` cau dins de `[min, max]` cal veure tres camps alhora,
i per això es fa al mòdul. És la resposta honesta si el professor pregunta "per què no
tot al model?".

### Duplicat de categoria

`createCategory` (`:205-220`) normalitza el nom i fa `findOne`. Si existeix:

```js
error.code = "CATEGORY_ALREADY_EXISTS";
error.message = "Ja existeix una categoria amb aquest nom.";
```

`updateCategory` (`:231-241`) fa el mateix però permet desar si el duplicat és la mateixa
fila (`duplicate.id !== Number(id)`).

## Què falta per ser Excel·lent rodó (10)

Res. La tasca està completa.

### El duplicat de categoria, tancat

El `findOne` dona el missatge, però entre el `findOne` i el `create` hi ha una finestra on
dos admins poden passar tots dos. Ara el `create`/`save` van dins un `try/catch` que
reconeix `UniqueConstraintError` i el reconverteix al mateix error de negoci amb mapa:

```js
catch (error) {
  if (error instanceof UniqueConstraintError) {
    throw categoryAlreadyExistsError();   // code + statusCode 409 + errors.nom
  }
  throw error;
}
```

Provat en viu:

```
1a creació  → HTTP 201 {"ok":true,"categoria":{"id":41,"nom":"ZZProvaCategoria"}}
2a creació  → HTTP 409 {"ok":false,"code":"CATEGORY_ALREADY_EXISTS",
                        "reason":"Ja existeix una categoria amb aquest nom.",
                        "errors":{"nom":"Ja existeix una categoria amb aquest nom."}}
```

### Les regles creuades, al model

`sequelize.js` té ara un `validate` **de model** (no d'atribut) amb les quatre regles que
necessiten veure diversos camps: `min < max`, `step > 0`, passos enters dins el rang,
`resposta_correcta` dins de `[min, max]` i `unitat ≤ 50`. Provat:

| Cas | Resultat |
|---|---|
| rang coherent | ✅ passa |
| `min=10, max=1` | `SequelizeValidationError: El valor màxim ha de ser més gran que el mínim.` |
| resposta fora de rang | `SequelizeValidationError: La resposta correcta ha d'estar entre el mínim i el màxim.` |
| `step=0` | `SequelizeValidationError: L'increment ha de ser més gran que 0.` |
| `step=3` en `0..10` | `SequelizeValidationError: L'increment ha de fer un nombre enter de passos dins del rang.` |
| `unitat` de 51 caràcters | `SequelizeValidationError: La unitat no pot passar de 50 caràcters.` |

Per què importa: `importQuestions.js:65` fa `Pregunta.create()` **directament**, sense
passar pel repositori. Abans, una importació amb `unitat` massa llarga petava amb
`ER_DATA_TOO_LONG` en anglès. Ara la rebutja el model abans d'arribar a la BD.

**Què has de vigilar:**

1. **Commit.** Els 6 fitxers de codi tenen canvis no commitejats.
2. **`descripcio`** a `AdminCategoriesView.vue` (`:21`, `:26`, `:57-58`, `:116`) encara hi
   és: camp que no existeix ni al model ni a l'esquema, i columna buida a la taula. És
   cosmètic i no afecta cap clàusula de la rúbrica, però es veu.
3. `categoria_id` és text lliure (`AdminPreguntesView.vue:208`). Un `v-select` seria més
   sòlid, però no és cap requisit.

## Fitxers clau

| Fitxer                                                          | Per què                                 |
| --------------------------------------------------------------- | --------------------------------------- |
| `backend/catalog-service/src/questions/preguntas.repository.js` | Validació + CRUD. És on es concentra T5 |
| `backend/catalog-service/src/db/sequelize.js`                   | `validate` del model i associacions     |
| `backend/catalog-service/src/admin/admin.routes.js`             | Les 8 rutes i el `responError`          |
| `backend/game-service/src/admin/adminRouter.js`                 | Pont WS → HTTP intern                   |
| `frontend/client-vue/src/services/websocket.js`                 | Rebuig de la Promise amb `errors`       |
| `frontend/client-vue/src/stores/admin.js`                       | `errorsPreguntes`                       |
| `frontend/client-vue/src/views/admin/AdminPreguntesView.vue`    | Formulari i missatges per camp          |
| `frontend/client-vue/src/views/admin/AdminCategoriesView.vue`   | CRUD de categories (té `descripcio`)    |

## Explicació dels fitxers

**`preguntas.repository.js`** — Mòdul de dades del catàleg. Conté les funcions de
validació (`validateCategoriaInput`, `validatePreguntaInput`) i el CRUD de les dues
taules. No rep `req`/`res`: retorna dades o llança errors amb `code`.

**`admin.routes.js`** — 8 rutes (`GET/POST/PATCH/DELETE` × 2 taules). Totes passen per
`requireInternalService` i `requireAdmin` (`:47-48`). El `responError` distingeix un error
de validació (422 amb mapa) d'un error de negoci (400 amb `reason`).

**`adminRouter.js` (game-service)** — Tradueix missatges WS (`admin:preguntes:create`…) a
crides HTTP internes. Després d'un canvi correcte fa `broadcastCatalogIfOk` per refrescar
els catàlegs dels clients connectats.

**`AdminPreguntesView.vue`** — Taula + diàleg. Té una validació local del rang (`:99-141`)
per no fer el viatge al servidor si el formulari és evidentment dolent; el servidor valida
igual.

## Preguntes probables

1. **On estan les validacions, al client o al servidor?**
   A les dues bandes, i és a propòsit. Al client (`validarRang`) per resposta immediata;
   al servidor (`validatePreguntaInput` + `validate` del model) perquè és l'única que no
   es pot saltar. Si el professor pregunta "i si crido l'API directament?", la resposta és
   "no passa, perquè el servidor valida el mateix".

2. **Per què retorneu 422 i no 400?**
   `400` és "la petició està mal formada" (JSON trencat); `422` és "el JSON és correcte però
   les dades no". És la distinció que fa que el client sàpiga que pot corregir el formulari.

3. **Per què `throw` i no retornar l'objecte d'errors?**
   Perquè el CRUD (`createQuestion`, `updateQuestion`) ha de continuar essent cridable sense
   comprovar un valor de retorn a cada línia: `const data = validate(...)` i si falla, no
   s'executa res més. L'error porta el mapa a `error.errors`.

4. **Per què la validació del rang no és al model?**
   Perquè compara tres camps (`min`, `max` i `resposta_correcta`) i un
   `validate` de Sequelize només veu un camp. Les regles d'un sol camp sí que són al model.

5. **Com arriba el missatge al camp del formulari?**
   `errorsPreguntes` és un objecte al store. Cada `v-text-field` té
   `:error-messages="admin.errorsPreguntes.camp"`. Quan el camp no té error, la clau no
   existeix i Vuetify no pinta res.

6. **Què passa si deso dues vegades el mateix nom de categoria?**
   El `findOne` el detecta i retorna `CATEGORY_ALREADY_EXISTS` amb el missatge en català.
   El que **no** està cobert és la cursa de dos admins simultanis (T14b).

7. **La categoria repetida, la impedeix la BD o el codi?**
   Les dues: `schema.sql:17` té `UNIQUE (nom)`, i el codi ho comprova abans per donar un
   missatge clar. La BD és la xarxa; el codi és el missatge.

8. **Per què `trim()` del text abans de desar?**
   Perquè `"   "` no és una pregunta vàlida. Es fa a `normalizeText` (`:85-87`) i també al
   `beforeValidate` del model (`sequelize.js:144+`), així que val per als dos camins.

9. **Què passa amb una pregunta que ja existeix i vols editar-ne només la dificultat?**
   `updateQuestion` (`:279`) fusiona `{...pregunta.toJSON(), ...input}` i revalida el
   conjunt. És el que permet un `PATCH` parcial sense haver d'enviar tots els camps.

10. **Per què `resposta_correcta` buida era un bug?**
    `Number("")` és `0` i `Number.isFinite(0)` és `true`. Amb un rang per defecte `0..100`,
    una pregunta sense resposta es desava amb `0` i qualsevol jugador que respongués `0`
    encertava. Ara es comprova el valor original (`isBlank`) abans de convertir.

11. **Què impedeix desar una pregunta amb una categoria que no existeix?**
    Es fa `Categoria.findByPk` abans del `create` (`:263-268`) i es retorna
    `CATEGORY_NOT_FOUND`. A més la FK `fk_pregunta_categoria` ho tornaria a impedir.

12. **Com demostres que rebutja diverses dades invàlides alhora?**
    Desa una pregunta amb el text buit i el rang invertit: surten **dos** missatges, un
    sota cada camp. Amb el codi anterior només en sortia un.

## Guió de demostració (120 s)

**0-20 s — CRUD.** A `AdminPreguntesView`, crea una pregunta, edita-la i esborra-la. Fes el
mateix a Categories. Comprova a phpMyAdmin que la fila hi és i després no.

**20-40 s — Nom de categoria repetit.** Crea "Geografia" dues vegades. Surt _"Ja existeix
una categoria amb aquest nom."_

**40-75 s — Diversos errors alhora.** Obre "Nova pregunta" i deixa el text buit, la
resposta buida i posa el mínim `10` i el màxim `1`. Desa. Han de sortir **quatre**
missatges, cadascun sota el seu camp:

- _El text de la pregunta és obligatori._
- _La resposta correcta és obligatòria i ha de ser numèrica._
- _El valor màxim ha de ser més gran que el mínim._
- _L'explicació és obligatòria._

Aquest és el punt que et dona l'Excel·lent: abans només sortia el primer.

**75-100 s — On són les validacions.** Obre `preguntas.repository.js:129-210`
(`validatePreguntaInput`) i `sequelize.js:75-123` (els `validate` del model). Digues:
"un camp sol → al model; tres camps alhora → al mòdul de dades".

**100-120 s — Tancar.** "El servidor retorna 422 amb un mapa de camps; el front pinta cada
missatge sota el seu camp. I la unicitat té doble barrera: `findOne` per al missatge i
`UNIQUE` a la BD per a la cursa."
