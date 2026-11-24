# T6 · Associació categoria-preguntes amb include i esborrat protegit (RA3 · 7%)

## Nota

**10 / 10 — Excel·lent**.

El backend compleix els quatre punts de l'Excel·lent: associació declarada en els dos sentits,
llistats fets amb `include` real (no `where` manual), esborrat bloquejat **al servidor** amb un
missatge en català que explica el motiu i codi propi, i la categoria sense preguntes s'esborra.
I l'`include` ara **es veu a la pantalla**: la taula de preguntes mostra `categoria.nom`
(`AdminPreguntesView.vue:39`), no el número.

## Per què (evidència)

**1. Les dues direccions de l'associació** — `backend/catalog-service/src/db/sequelize.js`

- `Categoria.hasMany(Pregunta, { foreignKey: "categoria_id", as: "preguntas", onDelete: "RESTRICT" })` → línies 131-135.
- `Pregunta.belongsTo(Categoria, { foreignKey: "categoria_id", as: "categoria", onDelete: "RESTRICT" })` → línies 137-141.

Les dues comparteixen `foreignKey: "categoria_id"`, que és el que fa que Sequelize no inventi
una segona columna ni una taula intermèdia.

**2. Llistats amb `include` (eager loading), no `where` manual** — `backend/catalog-service/src/questions/preguntas.repository.js`

- `listCategoriesWithQuestions()` → `Categoria.findAll({ include: [{ model: Pregunta, as: "preguntas" }], order: [...] })`, línies 188-193. Retorna categories amb l'array `preguntas` dins de cada objecte.
- `listQuestions()` → `Pregunta.findAll({ include: [{ model: Categoria, as: "categoria" }] })`, línies 253-258. Retorna cada pregunta amb l'objecte `categoria` (per tant `categoria.nom`).
- Les rutes que els exposen: `GET /internal/admin/categories` (`admin/admin.routes.js:80-87`) i `GET /internal/admin/preguntes` (`admin.routes.js:36-43`).

**3. L'esborrat es decideix al servidor, mirant el recompte a la BD** — `sequelize.js:40-55`

Hook `beforeDestroy` del model `Categoria`:

```js
const count = await Pregunta.count({ where: { categoria_id: categoria.id } });
if (count > 0) {
  const error = new Error("No es pot eliminar una categoria que encara té preguntes associades.");
  error.code = "CATEGORY_HAS_QUESTIONS";
  throw error;
}
```

`deleteCategory()` (`preguntas.repository.js:237-248`) fa `Categoria.findByPk` + `categoria.destroy()`;
el hook salta abans de l'SQL i atura el DELETE. L'error es tradueix a HTTP a
`admin.routes.js:110-117`: `res.status(400).json({ ok: false, code: error.code, reason: error.message })`.
Per la via WebSocket, `backend/game-service/src/admin/adminRouter.js:177` propaga el `reason`, i
`frontend/client-vue/src/services/websocket.js:490` el converteix en `new Error(data.reason || "Error d'admin")`,
que acaba al `v-alert` de `AdminCategoriesView.vue:100`. El missatge que veu l'usuari és el mateix text
en català del hook, no un text genèric.

**4. Segona barrera a la BD** — `backend/database/sql/schema.sql:40-43`

```sql
CONSTRAINT fk_pregunta_categoria
  FOREIGN KEY (categoria_id) REFERENCES categoria (id)
  ON UPDATE CASCADE
  ON DELETE RESTRICT
```

Encara que el codi Node fallés o s'esborrés una categoria per SQL directe, MariaDB rebutja el DELETE.
També està documentat a `doc/catalog-service.md:184-186`.

**5. El front no amaga res (i no cal que ho faci)**

`AdminCategoriesView.vue:104-108` pinta el botó «Esborrar» a **totes** les files; no hi ha cap
`v-if` sobre el nombre de preguntes. El rebuig arriba del servidor, que és exactament el que demana
la rúbrica per no quedar-se en «Suficient».

**6. La categoria sense preguntes sí que s'esborra**

Mateix camí: `deleteCategory` → `destroy()` → el `count` val 0 → no llança → `res.json({ ok: true })`
(`admin.routes.js:113`) → la vista recarrega (`AdminCategoriesView.vue:88-89`).

## Què falta per ser Excel·lent

Res. La tasca està completa.

**Què has de vigilar:**

1. **Commit.** `AdminPreguntesView.vue` té el canvi de columna sense commitejar.
2. **Un test del guard** no existeix (`backend/catalog-service` no té cap `*.test.js`). La rúbrica
   no el demana, però és el primer que preguntaria algú: "això de l'esborrat protegit, està provat?".
   Un test amb un mock de `Pregunta.count` n'hi hauria prou.
3. Detall aliè a T6 però que es veurà a la demo: `AdminCategoriesView.vue` envia i pinta `descripcio`
   (línies 21, 26, 58, 116), però el model `Categoria` (`sequelize.js:20-37`) i `schema.sql:13-19`
   no tenen aquest camp. La columna «Descripcio» sempre surt buida i el camp s'ignora en silenci.

## Fitxers clau

| Fitxer | Per què |
|---|---|
| `backend/catalog-service/src/db/sequelize.js` | Models + `hasMany`/`belongsTo` + hook `beforeDestroy` que bloqueja l'esborrat |
| `backend/catalog-service/src/questions/preguntas.repository.js` | `listCategoriesWithQuestions` (188-193), `listQuestions` (253-258), `deleteCategory` (237-248) |
| `backend/catalog-service/src/admin/admin.routes.js` | Rutes admin; el DELETE de categoria retorna 400 + `reason` (110-117) |
| `backend/database/sql/schema.sql` | FK `fk_pregunta_categoria ... ON DELETE RESTRICT` (40-43) |
| `backend/game-service/src/admin/adminRouter.js` | Pont WS → HTTP; propaga `reason` (169-179) |
| `frontend/client-vue/src/services/websocket.js` | Converteix `{ok:false, reason}` en `Error` (489-491) |
| `frontend/client-vue/src/views/admin/AdminCategoriesView.vue` | Botó esborrar sempre visible + `v-alert` amb l'error (100-108) |
| `frontend/client-vue/src/views/admin/AdminPreguntesView.vue` | Taula de preguntes (columna `categoria_id`, línia 39) |

## Explicació dels fitxers

- **`sequelize.js`** és el nucli de T6. Defineix els dos models i, just després, les dues
  associacions amb el mateix `foreignKey` i àlies explícits (`preguntas` / `categoria`). L'àlies és
  el que fan servir els `include` després. El hook `beforeDestroy` del model `Categoria` és la
  política de negoci: compta preguntes i, si n'hi ha, llança un error amb `code` perquè la capa HTTP
  el pugui mapar. El `count` va dins de la mateixa transacció que el `destroy` quan n'hi ha
  (`options.transaction`), evitant una cursa entre comptar i esborrar.
- **`preguntas.repository.js`** concentra l'accés a dades. Dues funcions de lectura fan eager loading
  en direccions oposades: categories→preguntes i preguntes→categoria. `deleteCategory` no fa cap
  comprovació pròpia: confia en el hook del model, de manera que la regla viu en un sol lloc i
  s'aplica a qualsevol camí que esborri una categoria.
- **`admin.routes.js`** és la frontera HTTP interna. Cada handler embolcalla l'error del repositori
  i retorna `{ ok:false, code, reason }` amb 400. El comentari de la línia 109 deixa explícita la
  intenció de la FK `RESTRICT`.
- **`schema.sql`** és la xarxa de seguretat independent de l'aplicació: `ON DELETE RESTRICT` fa que
  el motor SQL rebutgi el DELETE encara que el codi no hi sigui.
- **`adminRouter.js` (game-service)** és el proxy del panell: comprova JWT d'admin, crida el servei
  de catàleg amb el secret intern i reenvia `reason` tal qual cap al navegador.
- **`websocket.js`** tanca el cercle: si `ok === false`, rebutja la promesa amb `reason`, i la vista
  el pinta a l'alerta. Per això l'usuari llegeix «No es pot eliminar una categoria que encara té
  preguntes associades» i no «Error 400».
- **`AdminCategoriesView.vue`** no implementa cap lògica de bloqueig: només `confirm()` i `try/catch`.
  Aquesta absència és deliberada i correcta segons la rúbrica.
- **`AdminPreguntesView.vue`** mostra el llistat de preguntes, però amb la clau forana crua; és
  l'única peça on l'`include` no arriba a l'usuari.

## Preguntes probables

1. **Per què declarem les dues associacions si amb una ja n'hi hauria prou?**
   Perquè `include` només funciona des del model on està declarada l'associació. `hasMany` et deixa
   fer `Categoria.findAll({ include: Pregunta })`; `belongsTo` et deixa fer
   `Pregunta.findAll({ include: Categoria })`. Necessitem els dos llistats, així que necessitem les dues.

2. **Què passaria si traguéssim el `belongsTo`?**
   `listQuestions()` petaria amb un error de Sequelize (`Categoria is not associated to Pregunta`).
   Hauríem de fer un `JOIN` a mà o un `where` per cada pregunta.

3. **Quin és el `foreignKey` i per què es repeteix als dos costats?**
   És `categoria_id`. Si no coincidís, Sequelize crearia una columna nova (per exemple `CategoriaId`)
   i la FK de la BD i la del model apuntarien a columnes diferents.

4. **Què és eager loading i en què es diferencia de lazy loading?**
   Eager loading és demanar les dades relacionades dins de la mateixa consulta (`include`), i Sequelize
   ho resol amb un `JOIN` o amb una segona consulta `WHERE categoria_id IN (...)`. Lazy loading seria
   `categoria.getPreguntas()` després, una consulta per cada categoria: l'anti-patró N+1.

5. **El llistat fa servir `include` o un `where` manual? Ensenya'l.**
   `include` de veritat: `preguntas.repository.js:190` i `:255`. Cap dels dos llistats filtra per
   `categoria_id` a mà; el filtre per categoria del joc és una altra cosa (`getRandomQuestions`).

6. **On es decideix que no es pot esborrar una categoria amb preguntes?**
   Al hook `beforeDestroy` del model `Categoria` (`sequelize.js:41-54`), que fa un `Pregunta.count`.
   No és al frontend i no és una comprovació dins de la ruta: és al model, així que val per a qualsevol
   camí d'esborrat.

7. **Per què no n'hi ha prou amb la FK `ON DELETE RESTRICT`?**
   Perquè MariaDB retornaria un error genèric de constraint (`ER_ROW_IS_REFERENCED_2`), que acabaria
   a l'usuari com un 500 o un text tècnic. El hook ens dona un codi estable
   (`CATEGORY_HAS_QUESTIONS`) i un missatge en català que diu **per què**. La FK queda com a segona
   barrera per si algú escriu per fora de l'aplicació.

8. **Quin codi HTTP retorna i per què 400 i no 409 o 500?**
   Retorna 400 amb `{ ok:false, code:"CATEGORY_HAS_QUESTIONS", reason:"..." }`
   (`admin.routes.js:115`). És una petició que no es pot complir per l'estat de les dades; 409 seria
   més fi semànticament, però 400 és coherent amb la resta del servei i el client no en depèn.

9. **Com arriba el missatge fins a la pantalla?**
   Hook → `error.message`/`error.code` → `res.status(400).json({ reason })` → `adminRouter.js:177`
   reenvia `reason` pel WS → `websocket.js:490` fa `reject(new Error(data.reason))` →
   `AdminCategoriesView.vue:91` `admin.setErrorCategories(error.message)` → `v-alert` (línia 100).

10. **Què passa exactament quan esborres una categoria buida?**
    `count` val 0, el hook no llança, es fa el `DELETE`, la ruta respon `200 { ok:true }` i la vista
    recarrega la taula. No cal cap confirmació extra ni cap tractament especial.

11. **Es poden esborrar les preguntes en cascada?**
    No. `onDelete: "RESTRICT"` a les dues associacions i `ON DELETE RESTRICT` a `schema.sql:43`
    impedeixen explícitament l'esborrat en cascada. Si algú volgués esborrar una categoria amb
    preguntes, primer ha d'esborrar o reassignar les preguntes.

12. **Quina és la feblesa d'aquesta implementació?**
    Que no hi ha test automàtic del guard i que la UI mostra `categoria_id` en lloc de
    `categoria.nom`: l'`include` existeix i funciona, però no es veu a la pantalla.

## Guió de demostració (90 s)

1. **(10 s) Obre `sequelize.js` a les línies 131-141.** «Aquí hi ha les dues direccions:
   `Categoria.hasMany` i `Pregunta.belongsTo`, mateixa `foreignKey` i mateix `onDelete: RESTRICT`.»
2. **(15 s) Obre `preguntas.repository.js:188` i `:253`.** «Els dos llistats es fan amb `include`,
   no amb un `where` a mà. Un retorna categories amb `preguntas`, l'altre preguntes amb `categoria`.»
3. **(20 s) Al panell, obre Categories i esborra una que tingui preguntes** (per exemple la que
   tinguis carregada). Apareix l'alerta amb «No es pot eliminar una categoria que encara té
   preguntes associades.» Comenta que el text ve del hook del servidor i que la fila continua a la taula.
4. **(15 s) Obre DevTools → Xarxa/WS o el log del servei** i ensenya que la resposta és
   `{ ok:false, code:"CATEGORY_HAS_QUESTIONS" }` i que la petició HTTP subjacent ha estat un 400.
   «No és el frontend qui amaga el botó: el botó hi és a totes les files.»
5. **(10 s) Crea una categoria nova sense preguntes i esborra-la.** «Aquesta sí: `200 {ok:true}` i
   desapareix.»
6. **(10 s) Obre `schema.sql:40-43`.** «I si algú saltés el codi Node, `ON DELETE RESTRICT` atura
   el DELETE igualment.»
7. **(10 s) Tanca amb la feblesa:** «L'`include` retorna `categoria.nom`, però la taula de preguntes
   encara pinta `categoria_id`; és l'únic detall que ens separa del 10.»

---

*Revisió feta només llegint codi (sense executar res) el 22/11/2026. Cap fitxer del projecte
modificat llevat d'aquest informe.*
