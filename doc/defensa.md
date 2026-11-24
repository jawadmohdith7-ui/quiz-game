# Defensa oral · How Much?! LIVE

> Guió de 25 min. Per a cada tasca: **què ensenyo**, **què dic** i **preguntes trampa**.
> La carpeta real és `doc/` (el profe diu `/docs`: obre-la tu).
> Regla d'or: **si no s'executa en directe, com a màxim és Insuficient.** Res de "funciona a casa".

---

## 0. Abans de començar (checklist)

- [ ] `docker compose up` → MariaDB + serveis. `docker compose down -v` **abans**, si la BD en viu és antiga (la FK de `partides` va canviar).
- [ ] phpMyAdmin obert a `howmuch`.
- [ ] Admin Vue/Electron obert + **2 clients de joc** en dues finestres.
- [ ] Editor obert al repo, `doc/`, `schema.sql`, `dades-inicials.sql`, JSON de preguntes.
- [ ] Pestanya de rúbrica amb les contribucions.
- [ ] Un fitxer `preguntes-broken.json` preparat (sintaxi trencada) per a T12a.

**Ordre:** Model (4') → Banc (5') → Joc (5') → Transaccions (4') → Fitxers (4') → Capa de dades (3').
**Els blocs 3, 4 i 5 són UNA sola partida.** No en creïs una altra.

---

## Bloc 1 · Model de dades (4 min)

### T1 · Diagrama ER i model relacional (8%)

**Ensenyo:** `doc/model-de-dades.md`. Que triï dues associacions → les busco a `schema.sql`.

**Dic:** 10 taules = 6 de joc (`categoria, pregunta, partida, participant, ronda, resposta`) + 4 de suport (`rol, usuaris, partides, registre`). `resposta` resol el N:M entre `participant` i `ronda` amb atributs propis (`valor, posicio, punts`).

| Associació | Multiplicitats | A l'esquema |
|---|---|---|
| Categoria–Pregunta | 1 a 0..N | `fk_pregunta_categoria` … `ON DELETE RESTRICT` |
| Partida–Participant | 1 a 2..20 | `fk_participant_partida` … `ON DELETE CASCADE` |
| Partida–Ronda | 1 a 0..N | `fk_ronda_partida` … `ON DELETE CASCADE` |
| Pregunta–Ronda | 1 a 0..N | `fk_ronda_pregunta` … `ON DELETE RESTRICT` |
| Ronda–Resposta | 1 a 0..N | `fk_resposta_ronda (ronda_id, partida_id)` |
| Participant–Resposta | 1 a 0..N | `fk_resposta_participant (participant_id, partida_id)` |
| Usuari–Rol | N a 1 | `fk_usuari_rol` … `ON DELETE RESTRICT` |

**Preguntes trampa**
- *Per què RESTRICT a pregunta i CASCADE a partida?* → Una pregunta té historial de partides: no la pots esborrar. Una partida es pot eliminar sencera, i participant/ronda/resposta no tenen sentit sols.
- *Per què `partida_id` a `resposta` si ja ve per `ronda_id`?* → Redundant a propòsit. Les FK compostes obliguen que la ronda i el participant siguin **de la mateixa partida**. Ho diu el comentari al `schema.sql`.
- *On és el N:M?* → `resposta`: participant × ronda. Es va trencar perquè té dades pròpies.

---

### T2 · schema.sql (8%)

**Ensenyo (en aquest ordre):**
1. `DROP DATABASE howmuch;` → executar `schema.sql` sencer. Sense errors.
2. FK + ON DELETE: `fk_pregunta_categoria … ON DELETE RESTRICT` i `fk_participant_partida … ON DELETE CASCADE`.
3. UNIQUE compost: `uq_participant_partida_nickname (partida_id, nickname)`, `uq_resposta_ronda_participant (ronda_id, participant_id)`, `uq_ronda_partida_pregunta (partida_id, pregunta_id)`.
4. CHECK: `chk_pregunta_slider`.
5. Inserir fila que el violi:
```sql
INSERT INTO pregunta (categoria_id, text, resposta_correcta, min_value, max_value, step_value, dificultat, explicacio)
VALUES (1, 'prova', 500, 0, 100, 1, 'facil', 'prova');
-- ERROR 3819: Check constraint 'chk_pregunta_slider' is violated.
```

**Dic:** `resposta_correcta` ha d'estar dins del rang del slider: el joc mai pot tenir una resposta fora del que el jugador pot moure.

**Preguntes trampa**
- *Per què `DOUBLE` i no `DECIMAL` a la resposta correcta?* → És el valor de referència del slider (continu). A `resposta.valor` sí que hi ha `DECIMAL(20,6)` perquè és el que es compara i es desa.
- *Què passaria si traguéssiu `uq_ronda_partida_pregunta`?* → La mateixa pregunta podria sortir dues vegades a la partida. Aquesta restricció ho impedeix a nivell de BD, no de codi.
- *Com esborres una categoria amb preguntes?* → No es pot (RESTRICT). Primer reassignes o esborres les preguntes.
- *CHECK a MySQL: s'aplica de veritat?* → Sí des de 8.0.16/MariaDB 10.2+. Ho acabem de veure.

---

### T3 · dades-inicials.sql (4%)

**Ensenyo:** executar dues vegades seguides. Comparar `SELECT id, nom FROM categoria` i `SELECT id, nom_sala FROM partides` → mateixes files, mateixos id.

**Dic:** idempotència per dues decisions: **ids explícits** i `ON DUPLICATE KEY UPDATE id = id` (no toca res si ja existeix). Tot dins `START TRANSACTION … COMMIT`. Com que els ids són explícits, l'AUTO_INCREMENT no importa: la segona passada no canvia cap valor.

**Preguntes trampa**
- *Per què `id = id`?* → És un "no-op": si la fila existeix no s'actualitza res, però l'INSERT no falla.
- *I si algú ha modificat una pregunta a mà?* → El seed no la sobreescriu (a propòsit: no volem que una re-execució al mig de la demo destrueixi canvis).
- *Per què hi ha `START TRANSACTION`?* → O entra tot el seed o no entra res.

---

## Bloc 2 · Banc de preguntes amb Sequelize (5 min)

### T4 · Connexió i models, sense sync() (5%)

**Ensenyo:** `backend/catalog-service/src/db/sequelize.js` al costat de `schema.sql` (taula `pregunta`). Després cerca global de `sync(` → **0 resultats**.

**Dic:** una sola instància de Sequelize per servei (`sequelize.js`), `tableName` explícit, `timestamps: false` (l'esquema no té `createdAt/updatedAt`), FK `categoria_id` declarada. L'esquema el crea `schema.sql`, no el codi.

**Preguntes trampa**
- *Per què `timestamps: false`?* → Perquè l'esquema és la font de veritat i no té aquestes columnes. Amb `sync()` Sequelize les afegiria.
- *Hi ha més d'una instància de Sequelize?* → Una per microservei. Són processos separats; no és el mateix cas que dos pools al mateix procés.
- *Què passaria si canviessis un tipus al model i no a l'esquema?* → Res fins que Sequelize intenti desar/convertir. Per això es comprova que coincideixin.

---

### T5 · CRUD + validacions al model (8%)

**Ensenyo (admin):** crear categoria → crear pregunta dins la categoria → modificar-la → esborrar-la → comprovar a phpMyAdmin. Després:
- categoria amb nom buit / nom repetit,
- pregunta sense text / `resposta_correcta` fora de `[min,max]`,
- ensenyar `sequelize.js` (validacions) i `errors/sequelizeErrors.js`.

**Dic:** les validacions són al model (`allowNull`, `validate`), no a la UI. La UI només pinta el que retorna el servidor. `ValidationError` es tradueix a `{ errors: { camp: missatge } }` → missatge per camp. Nom repetit → `UniqueConstraintError` → 409 "Ja existeix…".

**Preguntes trampa**
- *I si deso per API sense passar per la UI?* → També es rebutja: la validació és al model.
- *Per què el nom repetit no surt com a error de validació?* → Perquè el detecta l'UNIQUE de MySQL, no el model. Per això es reconeix `UniqueConstraintError` abans que `ValidationError`.
- *Quin és el pitjor error que podries desar?* → `resposta_correcta` buida que acabi com a `0`: marcaria respostes incorrectes com a correctes. (Si surt, reconeix-ho: és un bug conegut.)

---

### T6 · Associació + include + esborrat protegit (7%)

**Ensenyo:** llistat de preguntes amb el nom de la categoria (ve de l'`include`). Codi: `Categoria.hasMany(Pregunta)` **i** `Pregunta.belongsTo(Categoria)` (els dos sentits). Esborrar categoria **amb** preguntes → missatge que diu per què; una **sense** → s'esborra.

**Dic:** doble barrera: comprovació al mòdul (missatge clar "té N preguntes") i `ON DELETE RESTRICT` a la BD (si algú ho intenta per fora, també falla).

**Preguntes trampa**
- *Per què les dues direccions?* → `hasMany` per llistar preguntes d'una categoria; `belongsTo` per fer l'`include` des de pregunta.
- *Esborrar en cascada les preguntes seria més còmode, no?* → Sí, però destruiria historial de partides. Vam triar protegir.
- *On es veu que no és només la UI?* → Fes l'intent per phpMyAdmin: ERROR 1451.

---

## Bloc 3 · Joc amb mysql2 (5 min)

> **Comença la partida única.** Crea-la aquí; es tanca al bloc 4 i s'exporta al bloc 5.

### T7 · Pool compartit, codi únic, participants (7%)

**Ensenyo:** cerca de `createPool` → un per servei (`game-service/src/db/pool.js`, `catalog-service/src/db/pool.js`, `auth-service/src/pool.js`). Cap connexió solta. Crear partida, unir els dos clients, intentar un nickname repetit.

**Dic:** un pool per procés, compartit per tots els mòduls d'aquell servei (no es creen connexions a les rutes). Codi de partida: `UNIQUE(codi)` a la BD + reintent si `ER_DUP_ENTRY` (fins a 3 intents, codi nou). Nickname repetit: `UNIQUE(partida_id, nickname)` → "Aquest nom ja està en ús en aquesta partida".

**Preguntes trampa**
- *Com garantiu que el codi és únic si dos el generen alhora?* → No es comprova abans: s'intenta inserir i la BD decideix. Si xoca, reintent.
- *Per què no comprovar a memòria el nickname?* → Perquè dos servidors o un reinici el trencarien. La BD és la font de veritat.
- *Què passa si s'esgoten els reintents?* → Error controlat a l'usuari (no un 500 amb stack).

---

### T8 · Rondes sense repetició + UNIQUE (8%)

**Ensenyo:** jugar **dues rondes**. Ensenyar la consulta de selecció (`catalog-service/src/questions/preguntas.repository.js`, `WHERE p.id NOT IN (SELECT pregunta_id FROM ronda WHERE partida_id = ?)` + `ORDER BY RAND() LIMIT 1`). Després, doble resposta: des del client (si es pot) o `INSERT` a phpMyAdmin → `ERROR 1062` + el client rep "Ja has respost aquesta ronda".

**Dic:** la no-repetició és SQL, no memòria: s'exclouen les preguntes que ja tenen ronda en aquesta partida. I encara hi ha la xarxa de seguretat `uq_ronda_partida_pregunta`. La resposta doble la talla `uq_resposta_ronda_participant`.

**Preguntes trampa**
- *Per què dues proteccions?* → La consulta evita repetir; l'UNIQUE ho garanteix encara que dues peticions arribin alhora.
- *I si la partida té més rondes que preguntes?* → No es pot: la consulta no retorna res i el servidor ho ha de dir ("no queden preguntes"). (Comprova que ho diu.)
- *Per què `ORDER BY RAND()`?* → Aleatorietat; amb poques preguntes per ronda és assumible.

---

### T9 · Classificació acumulada i final (10%)

**Ensenyo:** classificació després de les dues rondes + la consulta (`gameRepository.js`):
```sql
SELECT p.id, p.nickname, COALESCE(SUM(a.punts), 0) AS score
FROM participant p
LEFT JOIN resposta a ON a.participant_id = p.id
WHERE p.partida_id = ?
GROUP BY p.id, p.nickname
ORDER BY score DESC;
```
Comprovar a mà a phpMyAdmin els punts d'un jugador: `SELECT SUM(punts) FROM resposta WHERE participant_id = X`.

**Dic:** el total no es desa: es calcula. `LEFT JOIN` + `COALESCE` perquè **un jugador sense cap resposta surti amb 0**. `GROUP BY` per participant, `ORDER BY score DESC`. La final fa el mateix restringint a la partida acabada.

**Preguntes trampa**
- *Per què SUM i no una columna `total`?* → Una columna s'ha de mantenir sincronitzada; el SUM sempre quadra amb les respostes.
- *Per què `COALESCE`?* → `SUM` de zero files retorna `NULL`, no 0.
- *Empats?* → Ordre per punts; es pot afegir criteri (nom/id) perquè sigui estable.

---

## Bloc 4 · Transaccions (4 min)

### T10 · Tancar ronda amb rollback (7%)

**Ensenyo:** tancar la **segona** ronda. A phpMyAdmin: `resposta.posicio`, `resposta.punts`, `ronda.estat = 'tancada'`. Codi: `roomRepository.js` (funció de tancament, ~línies 164-215).

**Dic, assenyalant el codi:** `pool.getConnection()` → `beginTransaction()` → `SELECT … FOR UPDATE` → càlcul de posicions i punts → `UPDATE resposta` → `UPDATE ronda SET estat='tancada'` → `commit()`. Al `catch`: `rollback()`. Al `finally`: `release()`. **Una sola connexió**: si féssim `pool.query()` cada consulta aniria a una connexió diferent i no seria cap transacció.

**Demo de fallada (si la tens preparada):** un trigger que faci `SIGNAL SQLSTATE '45000'` a l'`UPDATE resposta`. Resultat: rollback → la ronda segueix `oberta` i no hi ha punts. Res a mitges.

**Preguntes trampa**
- *Per què `release()` al `finally` i no després del commit?* → Si hi ha error abans, la connexió tornaria al pool o es perdria. El `finally` s'executa sempre.
- *Què passa si falla el segon UPDATE?* → `rollback()` desfà el primer. La BD queda com abans de començar.
- *Per què `FOR UPDATE` aquí?* → Perquè ningú més toqui la ronda mentre la tanquem.

---

### T11 · FOR UPDATE (8%)

**Ensenyo:** intentar respondre amb la ronda tancada → rebutjat amb missatge clar. Intentar entrar a la partida començada (comportament: **observador**, no jugador). Ensenyar els dos `SELECT … FOR UPDATE`: `gameRepository.js:171` (respondre) i `roomRepository.js` (unir-se / estat de la partida).

**Dic:** `FOR UPDATE` bloqueja la fila fins al `commit`. Sense el lock, dos clients podrien llegir "oberta" alhora i tots dos inserir. Amb el lock, el segon espera, torna a llegir i veu "tancada".

**Preguntes trampa**
- *Per què no n'hi ha prou amb comprovar `estat` a memòria?* → Perquè la memòria no és compartida entre connexions ni sobreviu a un reinici, i la cursa existeix igual.
- *Quant de temps queda bloquejada la fila?* → Fins al commit/rollback. Per això la transacció ha de ser curta.
- *Un jugador nou pot entrar a mig partida?* → No com a jugador: entra com a observador. (Si el profe ho vol estricte: és una decisió de producte, no un descuit.)

---

## Bloc 5 · Fitxers (4 min)

### T12a · validarPregunta() + informe de descartades (5%)

**Ensenyo:** amb el JSON obert, afegeixo els errors que em digui (sense `text`, `resposta_correcta` fora de rang, `categoria` inexistent, camps buits) i importo. Després importo `preguntes-broken.json` (sintaxi trencada).

**Dic:** `validarPregunta()` retorna **tots** els errors d'una pregunta, no el primer. Cada descartada surt a l'informe amb el motiu. El JSON mal format es captura al `JSON.parse` i retorna un 400 clar: **el servidor no cau**.

**Preguntes trampa**
- *Per què tots els errors i no el primer?* → Perquè l'usuari corregeixi el fitxer d'una passada.
- *On es captura el JSON trencat?* → Al `try` del `JSON.parse`, no al final del procés. Per això el servidor segueix viu.
- *Valides a la UI o al servidor?* → Al servidor: el fitxer ve de fora.

---

### T12b · Desar les vàlides amb Sequelize (2%)

**Ensenyo:** les preguntes noves a phpMyAdmin amb la seva categoria + el codi (`importQuestions.js`, bucle que crida el repositori de Sequelize).

**Dic:** només les vàlides, amb la categoria resolta pel nom. Categoria inexistent → es descarta la pregunta (no es crea la categoria en silenci). Importació repetida → **crea duplicats**, perquè el text no és UNIQUE; s'ha de decidir si es vol deduplicar (i com).
**Punt fort (verificat al codi):** `desaPregunta()` obre una transacció **per pregunta** dins d'un `try/catch`: si una falla, s'afegeix a `rejected` i el lot continua. A més, `findOrCreate` resol la categoria pel nom (una categoria inexistent es crea, no es perd la pregunta) i `findOne` per `(categoria, text)` fa que reimportar actualitzi o salti en lloc de duplicar.

**Preguntes trampa**
- *Per què no un `bulkCreate`?* → Perquè volem saber exactament quina falla.
- *Per què no crear la categoria si no existeix?* → Perquè un error de picatge al JSON no ha de contaminar el banc.

---

### T13 · Exportació CSV (5%)

**Ensenyo:** acabar la partida (bloc 4) → exportar → **obrir el CSV a Excel**. Després intentar exportar una partida no acabada → no es permet.

**Dic:** `csv-stringify/sync` amb `bom: true` perquè Excel llegeixi UTF-8 i no trenqui accents. Columnes: participant, resposta, punts, posició; hi ha la classificació final. Una partida no `acabada` no s'exporta.

**Preguntes trampa**
- *Per què BOM?* → Sense BOM, Excel obre el fitxer com ANSI i `à/è/í` surten rars.
- *Separador?* → Punt i coma si l'Excel és en català/espanyol; comprova-ho obert de veritat.
- *Decimals?* → Si surten com `42.000000`, cal `Number(valor)` abans d'escriure. **Prova-ho abans de la sessió.**
- *Per què no exportar una partida en curs?* → Les dades encara canvien: el CSV seria fals.

---

## Bloc 6 · Capa de dades i justificació (3 min)

### T14a · Mòduls mysql2 reutilitzables (3%)

**Ensenyo:** cerca de `query(` / `execute(` a tot el projecte → el SQL és als repositoris (`roomRepository.js`, `gameRepository.js`, `preguntas.repository.js`, `partidaRepository.js`). Ensenyar que les funcions no reben `req`/`res`/`socket` ni fan `console.log`. Ensenyar on es tradueix `ER_DUP_ENTRY`.

**Dic:** les funcions retornen dades o llancen; qui les crida (ruta REST o handler WS) decideix com respondre. Els errors esperats es tradueixen per `error.code` (`ER_DUP_ENTRY` → missatge d'usuari).

**Punt feble honest:** a `stats-service/src/admin/admin.routes.js` encara hi ha `sequelize.query` dins de la ruta. Ho reconec i dic com es tanca: moure-ho a `partidaRepository.js` i deixar la ruta en 3 línies.

**Preguntes trampa**
- *Què retorna una funció del mòdul si l'INSERT xoca?* → Llança; el codi cridador tradueix. El mòdul no sap si és HTTP o WebSocket.
- *Per què no `console.log` als mòduls?* → Perquè el mòdul no ha de saber on va la sortida (consola, fitxer, client).

---

### T14b · Mòduls Sequelize + errors per tipus (2%)

**Ensenyo:** cerca de `findAll(`, `create(`, `destroy(` a `backend/` → només a `preguntas.repository.js` (i CLI). Després obrir `catalog-service/src/errors/sequelizeErrors.js`.

**Dic i explico l'ordre:** `UniqueConstraintError` **abans** de `ValidationError` perquè a Sequelize la primera **hereta** de la segona (`UniqueConstraintError extends ValidationError`). Si les invertissim, un nom repetit cauria al cas genèric i el missatge seria pitjor. Després `ForeignKeyConstraintError` (categoria amb preguntes) i finalment `ValidationError`, que retorna un mapa `{ camp: missatge }`.

**Preguntes trampa**
- *Si `UniqueConstraintError` és filla, què passa si poses el pare primer?* → Que mai no s'arriba a la filla: `instanceof ValidationError` també és cert per a un duplicat.
- *I `ForeignKeyConstraintError`?* → És germana, no filla; l'ordre respecte a `ValidationError` és indiferent, però ha d'anar abans del `return null`.
- *Què retorna si no reconeix l'error?* → `null` i el handler genèric respon 500 sense filtrar detalls interns.

---

### T15 · Justificació de quines dades es desen (3%)

**Ensenyo:** aquesta taula. Tres criteris: **R1 durabilitat** (no es pot recalcular), **R2 càlcul SQL** (cal a la BD per consultar/agregar), **R3 bloqueig/atomicitat** (una transacció l'ha de llegir i bloquejar), **R4 auditoria**.

| Dada | Per què es desa | Criteri |
|---|---|---|
| `partida.codi`, `estat` | Cal llegir-los i bloquejar-los (`SELECT … FOR UPDATE`) | R3 |
| `partida.data_inici`, `data_fi` | No es poden reconstruir després | R1 |
| `participant.nickname` | Identitat del jugador dins la partida; UNIQUE per partida | R2 |
| `ronda.pregunta_id`, `numero`, `estat` | Evitar repetició i decidir si s'accepta resposta | R3 |
| `resposta.valor` | És el que va contestar: irreproduïble | R1 |
| `resposta.posicio` | Puntuació per posició, calculada en tancar | R1 |
| `resposta.punts` | Permet `SUM` per classificació i CSV | R2 |
| `resposta.partida_id` (redundant) | FK composta: ronda i participant de la mateixa partida | R3 |
| `pregunta.resposta_correcta`, `min/max/step` | Referència del joc; el CHECK hi depèn | R1 |
| `pregunta.explicacio` | Contingut pedagògic | R1 |
| `categoria.nom` | Agrupació i llistats | R2 |
| `usuaris.password_hash`, `avatar_*` | Credencials i perfil | R1 |
| `partides` (resum) | Consultes ràpides de l'stats-service sense tocar dades vives | R2 |
| `registre` | Traçabilitat HTTP | R4 |
| **NO es desa** l'estat del socket/temporitzador | És efímer: es reconstrueix | — |
| **NO es desa** el total acumulat | Es deriva amb `SUM` | — |
| **NO es desa** la posició parcial | Canvia a cada resposta; es calcula en tancar | — |
| **NO es desa** l'observador | No participa ni puntua | — |

**Preguntes trampa**
- *Per què no deseu els punts totals al participant?* → Seria dada derivada duplicada; el `SUM` sempre quadra.
- *Per què sí `posicio` i `punts` a la resposta?* → Perquè es calculen una vegada en tancar i han de quedar fixos (historial + CSV).
- *Què passaria si no deséssiu `resposta_correcta`?* → No podríem qualificar una partida antiga si la pregunta canvia.
- *Això és el que realment deseu?* → Sí: és columna a columna de `schema.sql`.

---

## Guió de la partida única (blocs 3-4-5)

1. Admin → crear partida privada (2 jugadors) → **codi a la pissarra**.
2. Client A i B → entrar amb el codi, nicknames diferents. Un tercer intent amb el mateix nickname → rebuig (T7).
3. Començar → ronda 1 → respondre els dos. **Ronda 2** → respondre els dos. Ensenyar que la pregunta és diferent (T8).
4. Classificació acumulada (T9) → comprovar un `SUM` a phpMyAdmin.
5. Segona resposta a la ronda 1 per SQL → `1062` (T8).
6. Tancar ronda 2 → `posicio`, `punts`, `estat` (T10). Explicar rollback.
7. Intentar respondre a la ronda tancada → rebuig (T11).
8. Acabar partida → exportar CSV → obrir a Excel (T13). Intentar exportar una no acabada.

---

## Punts febles (si surten, reconeix-los en 5 segons)

| Tasca | Estat real | Frase |
|---|---|---|
| T12b | Cap (ja té try/catch per pregunta) | "Cada pregunta va en la seva transacció: si falla, es descarta i el lot continua." |
| T14a | SQL a `stats admin.routes.js` | "És l'últim lloc per moure; la resta ja és als repositoris." |
| T13 | Separador CSV per confirmar | "Té `bom: true` i `Number()`; només ho obro a Excel per confirmar el separador." |
| T11 | Entrar a partida començada = observador | "És decisió de producte: no juga, només mira." |

---

## Què queda per pujar nota (verificat amb `doc/test`)

1. Moure el SQL de `stats-service/src/admin/admin.routes.js` a `partidaRepository.js` → T14a Bé → Excel·lent.
2. Fer que una ruta i un handler de WS cridin la **mateixa** funció del repositori → T14a.
3. Obrir el CSV a Excel i confirmar el separador (`;` vs `,`) → T13.

---

## Mapa de fitxers (si diu «ensenya'm el codi»)

Tot amb rutes des de l'arrel del repo. Les línies són orientatives: obre el fitxer i busca el símbol.

| Tasca | Fitxers a obrir | Què assenyales |
|---|---|---|
| T1 | `doc/model-de-dades.md` · `backend/database/sql/schema.sql` | §1.1 multiplicitats en text + taula de 10 taules |
| T2 | `backend/database/sql/schema.sql` | `CONSTRAINT fk_pregunta_categoria` (RESTRICT), `uq_participant_partida_nickname`, `chk_pregunta_slider` |
| T3 | `backend/database/sql/dades-inicials.sql` | `ON DUPLICATE KEY UPDATE id = id` + `START TRANSACTION` |
| T4 | `backend/catalog-service/src/db/sequelize.js` | `timestamps: false`, `tableName`, `define("Categoria")`, `define("Pregunta")` |
| T5 | `.../catalog-service/src/db/sequelize.js` · `.../errors/sequelizeErrors.js` · `.../questions/preguntas.repository.js` | `validate`, `allowNull: false`; traducció d'errors; CRUD |
| T6 | `.../catalog-service/src/db/sequelize.js` (final) · `.../questions/preguntas.repository.js` | `hasMany` + `belongsTo` (:167/:173); `include: [{ model: Pregunta }]` |
| T7 | `backend/game-service/src/db/pool.js` · `.../rooms/createRoom.js` · `.../rooms/joinRoom.js` | `createPool` (:42); reintent per `ER_DUP_ENTRY`; rebuig de nickname |
| T8 | `backend/catalog-service/src/questions/preguntas.repository.js` (:66) · `.../game/persistence/gameRepository.js` (:146) | `NOT IN (SELECT … FROM ronda …)`; `ANSWER_ALREADY_EXISTS` |
| T9 | `.../game/persistence/gameRepository.js` (:39 `getRanking`) | `LEFT JOIN` + `COALESCE(SUM(punts),0)` + `GROUP BY` + `ORDER BY` |
| T10 | `.../game/persistence/gameRepository.js` (:21-34 i `closeRoundRecord`) | `getConnection` / `beginTransaction` / `commit` / `rollback` / `release` al `finally`; `UPDATE resposta` + `UPDATE ronda` |
| T11 | `gameRepository.js` (`FOR UPDATE` a la resposta) · `backend/game-service/src/repositories/roomRepository.js` (`FOR UPDATE` a :57/:123/:170) | els dos `SELECT … FOR UPDATE` |
| T12a | `.../catalog-service/src/questions/validarPregunta.js` · `.../questions/loadQuestions.js` | `errors.push` (tots els errors); `JSON.parse` dins `try` + `QUESTIONS_FILE_ERROR` |
| T12b | `.../questions/importQuestions.js` | `desaPregunta()`: `sequelize.transaction` + `Categoria.findOrCreate` + `rejected` |
| T13 | `backend/game-service/src/game/files/exportGameCsv.js` | `csv-stringify/sync` (:6), `bom: true` (:115), `LEFT JOIN` de classificació |
| T14a | `backend/game-service/src/repositories/roomRepository.js` · `.../game/persistence/gameRepository.js` | tot el SQL és aquí; funcions sense `req`/`res`/`socket` |
| T14b | `.../catalog-service/src/errors/sequelizeErrors.js` · `.../questions/preguntas.repository.js` | ordre Unique → ForeignKey → Validation; models només al repositori |
| T15 | aquest mateix document (taula de dalt) | R1 durabilitat · R2 càlcul SQL · R3 bloqueig · R4 auditoria |

### Cerques de 5 segons (les que et farà fer)

| Cerca | Resultat que has de poder ensenyar |
|---|---|
| `sync(` a `backend/` | **0 resultats** |
| `createPool` | 3 fitxers: `auth-service/src/pool.js`, `catalog-service/src/db/pool.js`, `game-service/src/db/pool.js` |
| `pool.query(` / `sequelize.query(` | Tot dins de repositoris… **excepte** `stats-service/src/admin/admin.routes.js` (buit conegut T14a) |
| `findAll(` / `create(` / `destroy(` a `catalog-service` | Només `questions/preguntas.repository.js`, `importQuestions.js` i `cli/` |
| `FOR UPDATE` | Només `gameRepository.js` i `roomRepository.js` (mai rutes ni handlers) |
| `window.confirm` | 0 resultats (ara tot va per `services/alertes.js` amb SweetAlert2) |

### Si pregunta per coses que has canviat aquests dies

| Tema | Fitxer |
|---|---|
| Categoria en directe per WS | `game-service/src/admin/adminLive.js` (`enviaCategories`) + `adminRouter.js` (`broadcastCategories`) + `client-vue/src/services/websocket.js` (`admin:categories:live`) |
| Desplegable de categoria | `client-vue/src/views/admin/AdminPreguntesView.vue` (`v-select` amb `item-value="id"`) |
| Alertes boniques | `client-vue/src/services/alertes.js` |
