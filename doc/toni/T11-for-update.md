# T11 · Unir-se i respondre amb la ronda oberta (`FOR UPDATE`) (RA2 · 8%)

## Nota

**Excel·lent — 10 / 10**, amb una reserva de **disseny** que cal explicar (no és tècnica):
el joc converteix en **espectador** qui intenta entrar en una partida començada, en lloc de
rebutjar-lo. El rebuig dur de la BD existeix i es pot demostrar.

## Per què (evidència)

### Dues operacions, mateixa estructura, files diferents

**Unir-se** — `backend/game-service/src/repositories/roomRepository.js:47-106`:

```js
await connection.beginTransaction();

const [games] = await connection.execute(
  `SELECT id, estat, max_jugadors FROM partida WHERE codi = ? FOR UPDATE`, [roomId]);

if (games.length === 0) → ROOM_NOT_FOUND
if (game.estat !== "esperant") → ROOM_NOT_WAITING   // "La partida ja no accepta més jugadors"

const [countRows] = await connection.execute(
  "SELECT COUNT(*) AS total FROM participant WHERE partida_id = ?", [game.id]);
if (total >= game.max_jugadors) → ROOM_FULL          // "La sala és plena"

INSERT INTO participant (partida_id, nickname) VALUES (?, ?)
commit
```

**Respondre** — `backend/game-service/src/game/persistence/gameRepository.js:121-153`:

```js
await connection.beginTransaction();

const [rounds] = await connection.execute(
  "SELECT id, partida_id, estat FROM ronda WHERE id = ? FOR UPDATE", [roundId]);

if (rounds.length === 0) → ROUND_NOT_FOUND
if (rounds[0].estat !== "oberta") → ROUND_CLOSED     // "La ronda ja està tancada."

const [participants] = await connection.execute(
  "SELECT id FROM participant WHERE partida_id = ? AND nickname = ?", ...);
if (participants.length === 0) → PARTICIPANT_NOT_IN_GAME

INSERT INTO resposta (...)   // ER_DUP_ENTRY → ANSWER_ALREADY_EXISTS
commit
```

Les dues comparteixen el helper `transaction()` (`:21-34`): `getConnection` →
`beginTransaction` → `work(connection)` → `commit` / `rollback` → `release` al `finally`.

### Per què cal el `FOR UPDATE` (la resposta que dona el 10)

El servidor **ja** comprova l'estat a memòria abans d'anar a la BD:

`answerSubmitHandler.js:25-35`:

```js
if (room.state !== "playing")  → "La partida no està en curs"
if (room.roundOpen === false)  → "La ronda ja ha acabat"
```

El problema és que la memòria és una **foto** que es pot quedar vella:

```
Jugador B llegeix memòria: room.roundOpen = true
                          ↓ (aquí el timer tanca la ronda)
Jugador B INSERT resposta     ← sense FOR UPDATE, entraria en una ronda tancada
```

Amb `FOR UPDATE`, el tancament (`closeRoundRecord:170-179`) i la resposta bloquegen **la
mateixa fila de `ronda`**. Un dels dos espera, i el segon veu l'estat real:
- si arriba el tancament primer → la resposta rep `ROUND_CLOSED`;
- si arriba la resposta primer → el tancament la puntua.

El mateix passa amb la partida: entre "la memòria diu lobby" i "insereixo el participant",
algú pot haver començat la partida → `ROOM_NOT_WAITING`.

**Frase per memoritzar:** *"El `FOR UPDATE` no és per comprovar l'estat; és perquè la
comprovació i l'escriptura siguin atòmiques. La memòria és el camí ràpid, la BD és la
garantia."*

### La reserva de disseny: observer, no jugador

`backend/game-service/src/rooms/joinRoom.js:228-241`:

```js
if (room.state === "lobby") {
  role = "player";
} else if (room.state === "playing") {
  role = "observer";        // ← decisió de disseny
} else if (room.state === "finished") {
  role = "observer";
} else {
  return { ok: false, reason: "La partida ja ha començat" };
}

//ELS ESPECTADORS NO S'HAN DE DESAR A participant
if (role === "player") {
  await addRoomParticipant(...);
}
```

**Què fa el joc:** qui intenta entrar en una partida en curs **entra com a espectador**.
Pot veure la partida, però:
- no s'insereix a `participant` (`:240-241`),
- no pot respondre (el handler comprova que sigui a `room.players` i el flux d'usuari no ho
  permet),
- no compta per a la capacitat ni per al rànquing.

**Per què és millor que rebutjar:** un joc en directe vol espectadors. Rebutjar-los és tècnicament
més simple però empitjora el producte.

**Què diu la rúbrica:** *"l'entrada a una partida començada es rebutja"*. Per això cal
explicar-ho en 15 segons, i ensenyar que el rebuig de BD existeix igualment (demo 1). Si el
professor vol el literal, el canvi és a `joinRoom.js:230-238` (retornar `{ ok: false,
reason: "La partida ja ha començat" }` en lloc de `role = "observer"`), unes 4 línies — però
mataria la funcionalitat d'espectador.

## Les dues demos forçades (SQL, sense tocar codi)

Serveixen per ensenyar que el rebuig és a la BD i no només a la memòria. Són les condicions
de cursa reals, reproduïdes a mà.

### Demo 1 — Unió rebutjada per la BD

Amb una sala al lobby, 2 jugadors i **sense començar**:

```sql
UPDATE partida SET estat = 'en_curs' WHERE codi = 'sala_xxxxx';
```

Des d'un tercer client, intentar unir-se amb un nickname nou. La memòria diu lobby → el codi
intenta inserir com a jugador → `addRoomParticipant` → la BD diu `en_curs`:

> **"La partida ja no accepta més jugadors"**

Restaurar:

```sql
UPDATE partida SET estat = 'esperant' WHERE codi = 'sala_xxxxx';
```

### Demo 2 — Resposta tardana rebutjada per la BD

Amb una ronda oberta i sense haver respost:

```sql
UPDATE ronda SET estat = 'tancada' WHERE id = <RONDA>;
```

Respondre des del client. La memòria encara diu `roundOpen = true`, així que arriba a
`saveAnswerRecord`:

> **"La ronda ja està tancada."** (`ROUND_CLOSED`)

Restaurar:

```sql
UPDATE ronda SET estat = 'oberta' WHERE id = <RONDA>;
```

**Avís:** fes-ho dins del temps de la ronda; si el timer la tanca abans, veuràs el missatge
de memòria (*"La ronda ja ha acabat"*) en lloc del de la BD.

## Què falta per ser Excel·lent

Res de codi. La tasca està completa.

**Què has de vigilar:**

1. **Explicar l'observer abans que ho pregunti.** *"Qui entra en una partida en curs queda
   com a espectador: pot mirar, no pot jugar. El rebuig de la BD hi és igualment i és el que
   acabem d'ensenyar forçant l'estat."*
2. **Restaurar sempre.** Si deixes `estat = 'en_curs'`, `startGameRecord` respondrà
   *"La partida ja ha començat"*. I si deixes una ronda `tancada`, no es podrà tancar bé.
3. **El timer.** La demo 2 s'ha de fer amb temps de ronda suficient.
4. **Commit.** El codi de T11 no s'ha tocat (és a `b8c8eee`).
5. `doc/entregarbbdd/simulacio-entrega.md:347-349` té un guió imprecís per a T11. No el facis
   servir tal qual.

## Fitxers clau

| Fitxer | Què hi ha |
|---|---|
| `backend/game-service/src/repositories/roomRepository.js:47-106` | Unió amb `FOR UPDATE` a `partida` |
| `backend/game-service/src/game/persistence/gameRepository.js:121-153` | Resposta amb `FOR UPDATE` a `ronda` |
| `backend/game-service/src/game/persistence/gameRepository.js:21-34` | El helper `transaction()` |
| `backend/game-service/src/game/persistence/gameRepository.js:158-211` | Tancament de ronda (bloqueja la mateixa fila) |
| `backend/game-service/src/game/answerSubmitHandler.js:25-35` | Comprovació ràpida a memòria |
| `backend/game-service/src/rooms/joinRoom.js:228-241` | La decisió observer vs player |
| `backend/database/sql/schema.sql` | `partida.estat` (`:51`), `ronda.estat` (`:91`) |

## Explicació dels fitxers

**`roomRepository.js`** — Tot el SQL de sales. `addRoomParticipant` bloqueja la fila de
`partida` per codi, comprova estat i capacitat, i insereix. La capacitat es compta a la BD
dins la mateixa transacció, no a memòria: si dos jugadors entren alhora a l'última plaça, el
`FOR UPDATE` serialitza i el segon veu el recompte actualitzat → `ROOM_FULL`.

**`gameRepository.js`** — Tot el SQL del joc. `saveAnswerRecord` bloqueja la fila de `ronda`
i comprova `estat === 'oberta'`. `closeRoundRecord` bloqueja la mateixa fila: per això
resposta i tancament no es poden creuar.

**`joinRoom.js`** — Decideix el rol segons l'estat de la sala (memòria) i només desa a la BD
si és jugador. Aquí viu la decisió de l'observer.

**`answerSubmitHandler.js`** — El camí ràpid: comprova que la sala estigui en joc, que la
ronda estigui oberta i que el socket tingui identitat. Si passa, delega a la BD, que torna a
comprovar amb `FOR UPDATE`.

## Preguntes probables

1. **Què fa exactament `FOR UPDATE`?**
   Bloqueja les files que retorna el `SELECT` fins al `commit` o el `rollback`. Un altre
   `SELECT ... FOR UPDATE` sobre les mateixes files espera. No bloqueja lectors normals
   (`SELECT` sense `FOR UPDATE`), perquè l'enginy és InnoDB amb lectura consistent.

2. **Per què cal si ja comproveu l'estat a memòria?**
   Perquè la memòria pot quedar-se vella entre la comprovació i l'`INSERT`. La BD és l'única
   que veu l'estat definitiu en el moment d'escriure.

3. **Per què `FOR UPDATE` sobre `ronda` i no sobre `resposta`?**
   Perquè el que canvia és l'estat de la **ronda**. Bloquejar la ronda serialitza totes les
   respostes d'aquella ronda amb el tancament. Les respostes encara no existeixen quan es
   respon.

4. **I si dos jugadors responen alhora?**
   No es bloquegen entre ells: `FOR UPDATE` sobre la ronda és compartit per a lectura dins
   la mateixa transacció... en realitat cada transacció bloqueja la ronda, així que les
   respostes es serialitzen. És acceptable: són mil·lisegons i el `UNIQUE` impedeix
   duplicats.

5. **El `FOR UPDATE` de la unió, què protegeix?**
   Dues coses alhora: que la partida segueixi `esperant` en el moment d'inserir, i que el
   recompte de participants sigui exacte (ningú entra a l'última plaça dues vegades).

6. **Per què els espectadors no es desen a `participant`?**
   Perquè `participant` és "qui juga": afecta capacitat, rànquing i respostes. Un espectador
   no ha de comptar en cap dels tres.

7. **Com sap el servidor que un espectador no pot respondre?**
   Perquè no és a `room.players` amb rol de jugador, i el flux del client amaga el formulari.
   A més, si arribés una resposta, `saveAnswerRecord` comprovaria `participant` i fallaria
   amb `PARTICIPANT_NOT_IN_GAME`.

8. **Per què el missatge que veu el jugador surt de memòria i no de la BD?**
   Perquè el camí ràpid respon abans d'anar a la BD. El de la BD només apareix en una cursa
   real. Per això les demos forçades: per ensenyar que hi és.

9. **Què és un deadlock i podria passar aquí?**
   Dues transaccions que s'esperen mútuament. Aquí l'ordre és sempre el mateix (bloquejar la
   ronda o la partida i després escriure), així que no hi ha cicles. Si n'hi hagués, MySQL
   en mataria una amb `ER_LOCK_DEADLOCK`.

10. **Per què no feu servir un lock optimista (versió)?**
    Perquè el conflicte és freqüent (tots responen alhora) i el lock pessimista és més simple
    i previsible. L'optimista obligaria a reintentar quan la versió canvia.

11. **Què passa si la transacció triga molt?**
    `innodb_lock_wait_timeout` (50 s per defecte) faria fallar l'espera. Aquí les
    transaccions són de mil·lisegons.

12. **Com demostres que funciona?**
    Amb les dues demos forçades: `UPDATE partida SET estat='en_curs'` → unió rebutjada;
    `UPDATE ronda SET estat='tancada'` → resposta rebutjada. I després restaurant.

## Guió de demostració (120 s)

**0-15 s — Els dos `FOR UPDATE`.** Obrir `roomRepository.js:53-59` i
`gameRepository.js:123-126`. Dir: "files diferents, mateixa estructura: bloquejar, comprovar,
escriure, commit".

**15-35 s — Per què.** Ensenyar `answerSubmitHandler.js:25-35` i dir la frase: "la memòria és
una foto; el `FOR UPDATE` fa que comprovar i escriure siguin atòmics".

**35-60 s — Demo 1 (unió).**

```sql
UPDATE partida SET estat = 'en_curs' WHERE codi = 'sala_xxxxx';
```

Tercer client → *"La partida ja no accepta més jugadors"*. Restaurar a `esperant`.

**60-90 s — Demo 2 (resposta).**

```sql
UPDATE ronda SET estat = 'tancada' WHERE id = <RONDA>;
```

Respondre → *"La ronda ja està tancada."* Restaurar a `oberta`.

**90-110 s — L'observer.** Dir: "si entres en una partida en curs, ets espectador: mires,
no jugues, i no es desa a `participant`. El rebuig de BD hi és i és el que acabem de veure".

**110-120 s — Tancar.** "Resposta i tancament bloquegen la mateixa fila de `ronda`: per això
no es pot respondre a una ronda tancada ni tancar una ronda amb respostes a mig escriure."
