# T8 · Rondes sense preguntes repetides i respostes amb UNIQUE (RA2 · 8%)

## Nota

**Excel·lent — 10 / 10** (era 7/10).

Ara les dues meitats de la rúbrica es poden ensenyar:

1. **La pregunta es tria amb SQL que exclou les ja fetes** a la partida
   (`preguntas.repository.js:66-73`), i s'ha provat en viu.
2. **La segona resposta la rebutja el `UNIQUE`** (`schema.sql:120`) i el jugador rep
   *"Ja has respost aquesta ronda."* (`gameRepository.js:146-147`).

## Per què abans era 7 i ara no

| Abans | Ara |
|---|---|
| `ORDER BY RAND() LIMIT ?` i res més | `... AND p.id NOT IN (SELECT r.pregunta_id FROM ronda r JOIN partida pa ON pa.id = r.partida_id WHERE pa.codi = ?)` |
| El catàleg no sabia de quina partida es tractava | El `game-service` envia `ws.roomId` fins al repositori |
| No hi havia cap consulta que exclogués → no es podia ensenyar | La consulta existeix i és **la que s'executa de veritat** |

L'efecte ja era correcte abans (`LIMIT n` retorna n files distintes i el `UNIQUE` és la
barrera), però el **mecanisme** que demana la rúbrica no hi era. I la rúbrica diu
literalment: *"ensenyar la consulta que tria una pregunta no feta en la partida"*.

## Per què (evidència)

### 1. La consulta amb exclusió

`backend/catalog-service/src/questions/preguntas.repository.js:48-84`:

```js
export async function getRandomQuestionsFromDatabase(
  category, limit, difficulty, partidaCodi = null, conn = pool
) {
  const filters = [];
  const params = [];

  if (category.trim().toLowerCase() !== "mix") {
    filters.push("p.categoria_id = ?");
    params.push(categories[0].id);
  }
  if (difficulty && difficulty !== "mix") {
    filters.push("p.dificultat = ?");
    params.push(difficulty);
  }
  if (partidaCodi) {
    //EXCLOU LES PREGUNTES QUE JA TENEN RONDA EN AQUESTA PARTIDA
    filters.push(`p.id NOT IN (
      SELECT r.pregunta_id
      FROM ronda r
      JOIN partida pa ON pa.id = r.partida_id
      WHERE pa.codi = ?
    )`);
    params.push(partidaCodi);
  }
  params.push(limit);
```

Tres detalls que cal saber defensar:

1. **La condició va dins de `filters`, no després del `WHERE`.** Així s'uneix amb `AND` a
   la categoria i la dificultat, i funciona encara que no hi hagi cap altre filtre (el
   `WHERE` només s'escriu si `filters.length > 0`).
2. **L'ordre dels `?` és: categoria → dificultat → partida → limit.** `LIMIT ?` és sempre
   l'últim `push`. Si canvies l'ordre, MySQL rep els paràmetres desplaçats.
3. **El `JOIN` és per `codi`, no per `partida_id`.** El `game-service` només té
   `ws.roomId = "sala_xxxxx"`; el `partida.id` numèric no surt mai de la transacció de
   `startGameRecord` (`gameRepository.js:74-77`).

### 2. La prova en viu

Es va crear una partida `ZZT8TEST` amb una ronda sobre la pregunta `1`, i es va cridar
l'endpoint intern:

```
POST /internal/preguntas/get
  sense "partida"  → 31 preguntes   (les 31 de la BD)
  amb "partida"    → 30 preguntes   (la 1 queda exclosa)
  la pregunta 1 hi és? → NO
```

La fila de prova es va esborrar després (la ronda cau per `ON DELETE CASCADE`).

### 3. Per què `NOT IN` és segur

`NOT IN` amb un `NULL` dins la subconsulta retorna **cap fila** en silenci — seria un
desastre silenciós. Aquí no pot passar perquè `ronda.pregunta_id` és `NOT NULL`
(`schema.sql:88`). Si mai es fes nullable, caldria passar-ho a `NOT EXISTS`.

### 4. Per què no canvia el comportament d'avui (i per què igualment val la pena)

Quan comença la partida, la fila de `partida` ja existeix (la va crear
`createRoomRecord` amb `estat = 'esperant'`), però `ronda` encara no té cap fila per
aquell codi. Per tant la subconsulta és buida i `NOT IN (buit)` deixa passar totes les
preguntes: **mateix resultat que abans**.

El que guanya:

- La consulta existeix al codi i s'ha ensenyat a la demo.
- Si una partida es reprengués amb rondes ja creades (reinici del servei, rejoin), les
  preguntes ja jugades queden excloses **per SQL**, no per sort.
- És el mecanisme que la rúbrica demana; el `UNIQUE` queda com a segona barrera.

### 5. La segona meitat: resposta doble

`schema.sql:120`:

```sql
CONSTRAINT uq_resposta_ronda_participant UNIQUE (ronda_id, participant_id),
```

`gameRepository.js:146-147`:

```js
if (error.code === "ER_DUP_ENTRY") {
  throw gameError("ANSWER_ALREADY_EXISTS", "Ja has respost aquesta ronda.");
}
```

Es reconeix per `error.code`, no pel text del missatge. El jugador rep l'error per
`answer:error` i el client el mostra.

I a més hi ha `uq_ronda_partida_pregunta` (`schema.sql:93`): la mateixa pregunta no pot
tenir dues rondes dins la mateixa partida, ni tan sols si algú saltés la consulta.

## Què falta per ser Excel·lent

Res. La tasca està completa.

**Què has de vigilar:**

1. **Commit.** Els 6 fitxers del canvi estan sense commitejar.
2. **El document de demo encara té la consulta manual.** `doc/entregarbbdd/simulacio-entrega.md:249`
   mostra un `NOT IN` "de demostració" i `:233` diu que la selecció és a la "línia 93"
   (ara és a la 48-84). Ara la consulta del document **coincideix** amb la del codi, però
   les línies citades estan malament.
3. **No hi ha cap crida per ronda.** Tot el lot es demana a l'inici (`gameStartHandler.js:62-66`).
   És una decisió de disseny: menys latència a mitja partida, a canvi de no poder ajustar
   les preguntes si la partida s'allarga.

## Fitxers clau

| Fitxer | Què s'hi ha canviat |
|---|---|
| `backend/catalog-service/src/questions/preguntas.repository.js:48-84` | El `NOT IN` i el paràmetre `partidaCodi` |
| `backend/catalog-service/src/questions/preguntas.service.js:3-5` | Pas del paràmetre |
| `backend/catalog-service/src/questions/preguntas.controller.js:21-28` | Llegeix `partida` del body |
| `backend/catalog-service/src/questions/preguntas.validator.js:48-62` | Valida `partida` (opcional, ≤ 20 caràcters) |
| `backend/game-service/src/game/fetchQuestions.js:65-78` | Afegeix `partida` al body |
| `backend/game-service/src/game/gameStartHandler.js:62-67` | Passa `ws.roomId` |

## Explicació dels fitxers

**`preguntas.repository.js`** — L'única funció que tria preguntes. Construeix el `WHERE`
per trossos (`filters` + `params`) perquè categoria, dificultat i exclusió són tots
opcionals. Retorna `null` si la categoria no existeix (el controller ho converteix en 404).

**`gameStartHandler.js`** — Quan l'amfitrió prem iniciar, comprova que tots estiguin a punt,
demana **tantes preguntes com rondes** i arrenca la primera (`startGameRecord`) i el motor
(`prepareGame`). És l'únic punt on es demanen preguntes.

**`fetchQuestions.js`** — Fa la crida HTTP interna amb el secret de servei. Tradueix els
errors del catàleg a `error.code` perquè el joc no depengui de missatges.

**`gameRepository.js`** — `openRoundRecord` (`:90-119`) inserta la ronda amb `pregunta_id`;
aquí és on el `UNIQUE (partida_id, pregunta_id)` actuaria com a segona barrera.
`saveAnswerRecord` (`:121-147`) inserta la resposta i tradueix `ER_DUP_ENTRY`.

**`schema.sql`** — `uq_ronda_partida_pregunta` (`:93`) i `uq_resposta_ronda_participant`
(`:120`) són les dues garanties de la BD.

## Preguntes probables

1. **Per què `NOT IN` i no un `LEFT JOIN ... IS NULL`?**
   Funcionalment equivalents. `NOT IN` amb subconsulta és més llegible per a una pregunta;
   el `LEFT JOIN` sol ser més ràpid en alguns plans. Aquí la taula `ronda` és petita.

2. **Què passa si `ronda.pregunta_id` fos `NULL`?**
   `NOT IN` retornaria **cap fila** i la partida no arrencaria. Per això és important que
   sigui `NOT NULL` (`schema.sql:88`). Amb `NOT EXISTS` no passaria.

3. **Això exclou les preguntes d'altres partides?**
   No, i és correcte: la subconsulta filtra per `pa.codi = ?`. Cada partida té les seves.

4. **Per què el `JOIN` amb `partida` si ja tens el codi?**
   Perquè `ronda` no té el codi, té `partida_id` numèric. El `JOIN` tradueix codi → id
   dins la mateixa consulta, sense una consulta prèvia.

5. **Quin ordre tenen els `?` de la consulta?**
   Categoria → dificultat → partida → `LIMIT`. El `LIMIT` és sempre l'últim `push`.

6. **Per què demaneu totes les preguntes al principi i no una per ronda?**
   Perquè la partida no ha de dependre del catàleg a mitja partida: si el `catalog-service`
   cau, el joc continua. El cost és que no pots ajustar les preguntes si la partida
   s'allarga més rondes de les previstes.

7. **Com es garanteix que no es repeteix una pregunta?**
   Tres capes: la consulta exclou les ja jugades; `LIMIT n` retorna n files distintes; i
   `uq_ronda_partida_pregunta` ho impedeix a la BD.

8. **Què passa si un jugador respon dues vegades?**
   El segon `INSERT` a `resposta` falla amb `ER_DUP_ENTRY` per
   `uq_resposta_ronda_participant`, `saveAnswerRecord` el tradueix a `ANSWER_ALREADY_EXISTS`
   i el client veu *"Ja has respost aquesta ronda."*

9. **Per què el `UNIQUE` és `(ronda_id, participant_id)` i no `(ronda_id, nickname)`?**
   Perquè `participant_id` és la clau; el nickname pot canviar i a més és únic només per
   partida. Referenciar la clau és més estable.

10. **La comprovació és al client, al servidor o a la BD?**
    A la BD. El client pot amagar el botó, però si algú envia dues respostes per WebSocket,
    la segona la rebutja el `UNIQUE`.

11. **Què passa si la mateixa pregunta surt dues vegades en una partida?**
    `openRoundRecord` fallaria amb `ER_DUP_ENTRY` per `uq_ronda_partida_pregunta`. No
    s'acceptaria la segona ronda.

12. **Com demostres que l'exclusió funciona?**
    Amb una partida que ja té una ronda: la consulta amb `partida = 'sala_xxx'` retorna una
    pregunta menys, i la jugada no hi és. Provat: 31 → 30.

## Guió de demostració (120 s)

**0-20 s — Jugar dues rondes.** Amb dos clients, començar la partida i respondre la ronda 1
i la 2. Ensenyar que les preguntes són diferents.

**20-50 s — La consulta.** Obrir `preguntas.repository.js:48-84` i assenyalar el `NOT IN`.
Dir: "exclou les preguntes que ja tenen ronda en aquesta partida, per codi de sala".

**50-70 s — La prova en SQL.** A phpMyAdmin:

```sql
SELECT p.id, p.text
FROM pregunta p
WHERE p.id NOT IN (
  SELECT r.pregunta_id FROM ronda r
  JOIN partida pa ON pa.id = r.partida_id
  WHERE pa.codi = 'sala_xxxxx'
)
ORDER BY RAND() LIMIT 3;
```

Cap de les preguntes que han sortit a les rondes no apareix.

**70-95 s — La resposta doble.** Des del client (o amb un `INSERT` a phpMyAdmin):

```sql
INSERT INTO resposta (ronda_id, partida_id, participant_id, valor)
VALUES (<ronda>, <partida>, <participant>, 42);
```

→ `ERROR 1062: Duplicate entry ... for key 'uq_resposta_ronda_participant'`, i al client
*"Ja has respost aquesta ronda."*

**95-120 s — Tancar amb les tres capes.** "Consulta que exclou, `LIMIT n` que retorna files
distintes, i `UNIQUE (partida_id, pregunta_id)` a la BD. Cap repetició és possible."
