# T10 · Tancar una ronda (punts i estat, amb rollback) (RA2 · 7%)

## Nota

**Excel·lent — 10 / 10.**

Transacció amb una sola connexió del pool, `commit`/`rollback`/`release` correctes, totes
les consultes amb `connection.execute`, i la memòria del joc avança **només després** del
commit. La fallada es pot demostrar en directe amb un trigger d'SQL, sense tocar codi.

## Per què (evidència)

### El helper (`gameRepository.js:21-34`)

```js
async function transaction(work) {
  const connection = await pool.getConnection();   // una sola connexió
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();                          // sempre
  }
}
```

Els tres elements que la rúbrica mira: `getConnection` (no `pool.query`), `rollback` al
`catch`, `release` al `finally`.

### Les cinc escriptures, en ordre (`closeRoundRecord`, `:169-209`)

| # | Operació | Línia |
|---|---|---|
| 1 | `SELECT ... FROM ronda WHERE id = ? FOR UPDATE` | `:170-173` |
| 2 | Comprova que existeix, que és `oberta` i que la pregunta coincideix | `:174-184` |
| 3 | `SELECT ... FROM resposta ... FOR UPDATE` ordenat per distància a la resposta | `:187-193` |
| 4 | `UPDATE resposta SET posicio = ?, punts = ?` per cada resposta | `:200-203` |
| 5 | `UPDATE ronda SET estat = 'tancada'` | `:206` |
| 6 | `getRanking(connection, ...)` amb la **mateixa** connexió | `:207`, `:39-51` |

L'únic `pool.` del fitxer és `getConnection` (`:22`). No hi ha cap `pool.query` dins la
transacció.

### La memòria avança després del commit

`roundEvents.js:219-229`:

```js
try {
  result = await closeRoundRecord(room.currentRoundId, question);
} catch (error) {
  ...scheduleRoomOperation(roomId, operacioReintent, 5000);   // reintent al cap de 5 s
  throw error;
}

const question = closeRound(room);   // ← la memòria només es toca aquí
```

`closeRoundRecord` retorna **després** del `commit` (`:27`), així que si la transacció
falla, el `catch` no arriba mai a `closeRound(room)`: la sala continua a la ronda oberta i
programa un reintent als 5 segons. No hi ha estat de memòria avançat amb BD endarrerida.

## La fallada: què passaria si no hi hagués transacció

Cada escriptura pot fallar. Aquesta és la taula que has de saber recitar:

| Falla a… | Sense transacció quedaria… | Amb `rollback` |
|---|---|---|
| 4, amb el 3r de 5 jugadors | 2 jugadors amb punts i 3 sense; ronda oberta | Res: cap `punts`, cap `posicio` |
| 5 (`UPDATE ronda`) | Tots els punts escrits i la ronda oberta | Res: tot desfet |
| 6 (`getRanking`) | Punts i estat `tancada` escrits, client sense rànquing | Res: tot desfet |
| `commit` | — | No s'aplica res |

El cas 5 és el més espectacular perquè quan falla, **els punts ja s'havien escrit**. És la
prova que el `rollback` fa feina de veritat.

## Demostració de la fallada (SQL, sense tocar codi)

### Abans

Amb dos jugadors que ja han respost a la ronda, i **sense tancar-la**:

```sql
SELECT id, punts, posicio FROM resposta WHERE ronda_id = <RONDA>;
-- punts = 0, posicio = NULL   (encara no s'ha puntuat res)
SELECT estat FROM ronda WHERE id = <RONDA>;
-- 'oberta'
```

### Forçar la fallada

```sql
CREATE TRIGGER zz_falla_ronda BEFORE UPDATE ON ronda FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falla simulada per provar el rollback';
```

### Tancar la ronda des de la interfície

El `UPDATE ronda SET estat = 'tancada'` (`:206`) peta. El `catch` fa `rollback()` i el
client rep un error. La sala programa el reintent als 5 s (`roundEvents.js:225`).

### Comprovar que no ha quedat res a mitges

```sql
SELECT id, punts, posicio FROM resposta WHERE ronda_id = <RONDA>;
-- punts = 0, posicio = NULL   ← els UPDATE s'havien executat i s'han desfet
SELECT estat FROM ronda WHERE id = <RONDA>;
-- 'oberta'                    ← la ronda no ha quedat mig tancada
```

### Netejar i tancar bé

```sql
DROP TRIGGER zz_falla_ronda;
```

Ara tanques la ronda des de la interfície i sí: `punts` assignats, `posicio` 1..n,
`estat = 'tancada'`.

**Avís:** si t'oblides del `DROP TRIGGER`, cap ronda es podrà tancar mai més. Tingues el
`DROP` escrit abans de començar.

## L'explicació de 60 segons (memoritzar)

> "El tancament fa cinc escriptures en una sola connexió, dins d'una transacció. La primera
> bloqueja la ronda amb `FOR UPDATE` i comprova que estigui oberta. La segona bloqueja les
> respostes. La tercera escriu posició i punts. La quarta posa la ronda a `tancada`. La
> cinquena calcula el rànquing amb la mateixa connexió.
>
> Si falla la tercera, per exemple amb el tercer de cinc jugadors, els dos primers ja tenen
> punts dins la transacció. El `catch` fa `rollback` i la BD torna a l'estat anterior: cap
> `punts`, cap `posicio`, i la ronda segueix `oberta`. Sense transacció, dos jugadors
> tindrien punts, tres no, i la ronda quedaria en un estat que no és ni oberta ni tancada.
>
> Si falla la cinquena, els punts i l'estat ja estaven escrits, i també es desfan. I si falla
> el `commit`, no es desa res.
>
> El `release` és al `finally` perquè el pool té 10 connexions: si una fallada no la tornés,
> deu fallades deixarien el servei sense connexions i totes les peticions esperarien a la
> cua per sempre."

Aquesta última frase és la que demostra que entens el `release()`, no que l'has posat
"perquè toca".

## Què falta per ser Excel·lent

Res. La tasca està completa.

**Què has de vigilar:**

1. **Commit.** El codi de T10 no s'ha tocat (és a `b8c8eee`), però recorda que el treball
   de T5/T6/T8 està sense commitejar.
2. **El trigger.** Només per a la demo, i sempre amb el `DROP` al costat.
3. `doc/entregarbbdd/simulacio-entrega.md:332` encara té la frase genèrica. Si l'ensenyes,
   substitueix-la per l'explicació de dalt.
4. El `rollback` no té `try/catch` propi (`:29`). Si la connexió ja és morta, el `rollback`
   llança i tapa l'error original. És menor: el pool descarta la connexió igualment.

## Fitxers clau

| Fitxer | Què hi ha |
|---|---|
| `backend/game-service/src/game/persistence/gameRepository.js` | `transaction` (`:21-34`) i `closeRoundRecord` (`:158-211`) |
| `backend/game-service/src/game/roundEvents.js` | La crida i l'avanç de memòria (`:219-229`) |
| `backend/game-service/src/game/roundEngine.js` | `calculatePoints` i el consum de preguntes |
| `backend/database/sql/schema.sql` | `resposta.punts` i `posicio` (`:116-118`), `ronda.estat` (`:91`) |

## Explicació dels fitxers

**`gameRepository.js`** — Tot el SQL del joc. `transaction()` és l'única manera d'escriure
de manera atòmica; `closeRoundRecord` és qui l'usa per tancar. `saveAnswerRecord`
(`:121-147`) i `openRoundRecord` (`:90-119`) també fan servir la mateixa transacció.

**`roundEvents.js`** — L'orquestrador. Decideix quan es tanca la ronda (timer, tots han
respost), crida el repositori i, **si ha anat bé**, avança la memòria (`closeRound(room)`).
Si falla, programa un reintent als 5 s i manté la ronda com estava.

**`roundEngine.js`** — La lògica pura: puntuació per distància a la resposta correcta i
índex de preguntes. No toca la BD.

## Preguntes probables

1. **Per què `getConnection()` i no `pool.query()`?**
   Una transacció és per **sessió**. `pool.query()` agafa qualsevol connexió lliure i cada
   consulta podria anar a una sessió diferent: el `BEGIN` no afectaria les altres. Amb
   `getConnection()` totes les consultes van per la mateixa connexió.

2. **Què passa si falla el `commit`?**
   La transacció no s'aplica. El `catch` fa `rollback()` (no-op, no hi ha res pendent) i el
   client rep un error. No queda res a mitges.

3. **Per què `rollback` i no deixar que la connexió es tanqui?**
   Perquè la connexió torna al pool, no es destrueix. Sense `rollback`, la següent operació
   que l'agafi hereta una transacció oberta amb locks.

4. **Què passaria si traguéssiu el `finally`?**
   Amb `connectionLimit: 10` (`pool.js:49`), deu errors seguits deixarien el pool sense
   connexions. `waitForConnections: true` fa que les peticions esperin a la cua
   indefinidament: el servei es penja sense donar error.

5. **El `rollback` no té `try/catch` propi. És un problema?**
   Menor: si la connexió és morta, el `rollback` llança i tapa l'error original. El pool
   descarta aquella connexió igualment i no afecta la integritat de les dades.

6. **Per què `FOR UPDATE` a la ronda?**
   Perquè dos tancaments simultanis no es trepitgin. El segon espera, veu `estat =
   'tancada'` i surt amb `ROUND_CLOSED` (`:177-179`) en lloc de puntuar dues vegades.

7. **I si el commit s'aplica però la resposta al client es perd?**
   És l'únic cas ambigu. El client reintentaria i rebria `ROUND_CLOSED`. No es dupliquen
   punts; com a molt, no veu el rànquing i cal refrescar.

8. **Què passa a la memòria si la transacció falla?**
   No avança. `closeRound(room)` (`roundEvents.js:229`) només s'executa si
   `closeRoundRecord` retorna, i només retorna després del `commit`. I a sobre es programa
   un reintent als 5 s (`:225`).

9. **On es guarden els punts de cada ronda?**
   A `resposta.punts` (`schema.sql:118`), no en una taula de ronda. És el que permet que la
   classificació acumulada sigui un `SUM` (T9).

10. **Qui decideix la posició d'una resposta?**
    `closeRoundRecord`: ordena les respostes per `ABS(valor - correctAnswer)`, i la posició
    és l'índex + 1 (`:200-203`). El desempat és valor més alt i després id.

11. **Per què es fa el `UPDATE` de les respostes abans de l'estat de la ronda?**
    Perquè si l'estat es posés primer i després fallés un `UPDATE`, la ronda estaria
    tancada amb punts a mitges. Amb transacció és igual, però l'ordre deixa l'estat com a
    "confirmació final".

12. **Com demostres el rollback?**
    Amb un trigger `BEFORE UPDATE ON ronda` que faci `SIGNAL SQLSTATE '45000'`, tanques la
    ronda, i comproves que `resposta.punts` segueix a 0 i `ronda.estat` segueix `oberta`.

## Guió de demostració (120 s)

**0-15 s — El helper.** Obrir `gameRepository.js:21-34` i assenyalar `getConnection`,
`beginTransaction`, `commit`, `rollback`, `release al finally`.

**15-40 s — Les cinc escriptures.** `:169-209`. Dir l'ordre: bloqueig de la ronda, bloqueig
de les respostes, `UPDATE` de punts, `UPDATE` de l'estat, rànquing amb la mateixa connexió.

**40-60 s — Tancar la ronda de debò.** A la interfície, tancar la ronda 2 i ensenyar a
phpMyAdmin:

```sql
SELECT pa.nickname, a.valor, a.posicio, a.punts
FROM resposta a JOIN participant pa ON pa.id = a.participant_id
WHERE a.ronda_id = <RONDA>;
```

Posicions 1..n i punts assignats.

**60-90 s — Forçar la fallada.** Amb una altra ronda oberta:

```sql
CREATE TRIGGER zz_falla_ronda BEFORE UPDATE ON ronda FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Falla simulada';
```

Tancar la ronda → error. Ensenyar que `punts` segueix a 0 i `estat` segueix `oberta`.

**90-105 s — Netejar.**

```sql
DROP TRIGGER zz_falla_ronda;
```

Tancar la ronda i veure que ara sí funciona.

**105-120 s — Tancar amb la frase del `release`.** "El `finally` no és decoratiu: amb 10
connexions al pool, deu fallades sense `release` deixarien el servei penjat."
