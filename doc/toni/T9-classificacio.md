# T9 · Classificació acumulada i final (JOIN, SUM, GROUP BY) · RA2 · 10%

## Nota

**Excel·lent · 10/10.**

La classificació (acumulada de cada ronda i final) es calcula **íntegrament en SQL** amb `LEFT JOIN`, `COALESCE(SUM(...))`, `GROUP BY` i `ORDER BY`. Els totals surten de `resposta.punts`, que és exactament el que es pot sumar a mà a phpMyAdmin. Un participant sense respostes apareix amb **0**. La consulta acumulada i la final són **la mateixa consulta** executada en dos moments del joc (en tancar cada ronda i en acabar la partida): no hi ha cap suma feta a JavaScript que pugui divergir.

Única reserva (no penalitza la rúbrica): no hi ha posicions compartides en cas d'empat; es desempata per `nickname ASC`, i no hi ha un test automàtic que validi la consulta. Ho detallo a «Què falta».

## Per què (evidència)

### 1) La consulta real és SQL, i és única per a acumulada i final

`backend/game-service/src/game/persistence/gameRepository.js`, línies 39-51:

```sql
SELECT p.id AS participant_id, p.nickname, COALESCE(SUM(a.punts), 0) AS score
FROM participant p
LEFT JOIN resposta a ON a.participant_id = p.id
  AND EXISTS (SELECT 1 FROM ronda r WHERE r.id = a.ronda_id AND r.partida_id = p.partida_id)
WHERE p.partida_id = ?
GROUP BY p.id, p.nickname
ORDER BY score DESC, p.nickname ASC
```

- **`FROM participant p LEFT JOIN resposta a`** (línies 42-43): surt **cada participant** de la partida encara que no tingui cap fila a `resposta`. Un `INNER JOIN` amagaria els jugadors amb 0.
- **`COALESCE(SUM(a.punts), 0)`** (línia 41): `SUM` sobre zero files retorna `NULL`; `COALESCE` el converteix en `0`. A més `resposta.punts` és `NOT NULL DEFAULT 0` (`backend/database/sql/schema.sql:118`), així que tampoc no hi ha `NULL` dins de files existents.
- **`EXISTS (...)`** (línia 44): defensa extra perquè només se sumin respostes la ronda de les quals pertany a la mateixa partida del participant. No canvia el resultat amb les FK compostes actuals, però tanca el cas d'una inserció manual mal feta.
- **`GROUP BY p.id, p.nickname`** (línia 46): una fila per participant. S'agrupa per `id` (clau) i no només per nickname; el nickname s'inclou perquè és al `SELECT` i per compatibilitat amb `ONLY_FULL_GROUP_BY`.
- **`ORDER BY score DESC, p.nickname ASC`** (línia 47): ordre descendent per punts i desempat alfabètic. `score` és l'àlies del `SELECT`, per tant no cal repetir `COALESCE(SUM(...))`.

La funció que l'executa és `getRanking(connection, gameId)` (línia 39). És **privada del mòdul** i només té dos consumidors:

| Moment | Codi | Què retorna |
|---|---|---|
| Tancar qualsevol ronda | `closeRoundRecord` → `getRanking(...)` a `gameRepository.js:207` | Classificació **acumulada** de totes les rondes tancades fins ara |
| Acabar la partida | `finishGameRecord` → `return getRanking(...)` a `gameRepository.js:243` | Classificació **final** (totes les rondes) |

No hi ha una segona consulta ni un càlcul paral·lel: la paraula «acumulada» i «final» descriuen el mateix agregat en dos instants. Això és correcte perquè el `SUM` inclou sempre totes les respostes existents; en tancar la ronda 1 dona el total de la ronda 1, en tancar la 2 el total de 1+2, i en acabar el total definitiu.

### 2) La classificació que arriba al client és la de SQL, no la de JavaScript

`backend/game-service/src/game/roundEvents.js`, funció `applyRanking` (línies 82-133):

```js
const score = Number(entry.score);          // línia 104: score de la BD
...
player.score = score;                        // línia 120: sobreescriu el valor en memòria
```

I s'aplica just després de cada càlcul SQL:

- `room.currentRanking = applyRanking(room, result.ranking)` a `roundEvents.js:262`, abans d'enviar els resultats de la ronda (línia 265) i, 5 s després, el `round:ranking`.
- `room.finalRanking = applyRanking(room, ranking)` a `roundEvents.js:385`, dins de `finishGame`.

`buildRanking` de `backend/game-service/src/game/ranking.js:18` només ordena en JS un array que normalment ja ve de la BD: si `room.finalRanking` o `room.currentRanking` existeixen, els retorna tal qual (línies 19-37). Per tant, el camí real de la classificació és SQL → `applyRanking` → WebSocket → Vue. El `player.score += points` d'`answerSubmitHandler.js:146` és només l'acumulador provisional mentre la ronda és oberta; queda sobreescrit pel total de SQL en tancar-la.

La vista també és la bona: `frontend/client-vue/src/components/RoomRanking.vue:57-60` pinta `entry.position`, `entry.nickname` i `entry.score` tal com arriben. `PlayerRoomView.vue:354-356` mostra el rànquing de ronda i `:372-374` el final.

### 3) Els punts per ronda es desen a `resposta.punts` i la suma quadra amb l'esquema

- Taula `resposta`: `punts INT UNSIGNED NOT NULL DEFAULT 0` a `schema.sql:118`; `posicio` a la línia 117; `UNIQUE (ronda_id, participant_id)` a la línia 120 (impedeix comptar dues vegades la mateixa resposta).
- En tancar la ronda, `closeRoundRecord` calcula els punts amb `calculatePoints(...)` (`gameRepository.js:199`) i fa `UPDATE resposta SET posicio = ?, punts = ? WHERE id = ?` (`gameRepository.js:200-203`). La corba és a `scoring.js:57-87` (0 a 530 punts).
- Per tant la classificació és literalment `SUM(resposta.punts)` per participant. La comprovació manual és sumar les files de `resposta` d'un jugador i comparar-ho amb la fila del rànquing.

Consulta de comprovació (la que ja és a `doc/entregarbbdd/simulacio-entrega.md:271-293`):

```sql
-- Total per participant (classificació)
SELECT p.nickname, COALESCE(SUM(a.punts), 0) AS punts
FROM participant p
LEFT JOIN resposta a ON a.participant_id = p.id
WHERE p.partida_id = (SELECT id FROM partida WHERE codi = 'K7QX2P')
GROUP BY p.id, p.nickname
ORDER BY punts DESC, p.nickname ASC;

-- Detall que ha de quadrar amb la fila anterior
SELECT r.numero, a.valor, a.punts
FROM resposta a
JOIN ronda r ON r.id = a.ronda_id
JOIN participant pa ON pa.id = a.participant_id
WHERE pa.nickname = 'Ana'
ORDER BY r.numero;
```

> Nota de fidelitat: la consulta de demo de `simulacio-entrega.md` no porta la clàusula `EXISTS` que sí té el codi. No altera el resultat perquè `participant` és per partida i les FK compostes de `resposta` obliguen que ronda i participant siguin de la mateixa partida, però si es vol ensenyar «la consulta exacta del codi», cal afegir-la o dir que és equivalent.

### 4) Un jugador sense respostes surt amb 0

Dos nivells de garantia:

1. **SQL**: `LEFT JOIN` des de `participant` + `COALESCE(..., 0)`. La fila apareix al resultat amb `0`.
2. **Aplicació**: si el participant de la BD ja no és a la sala (per exemple, ha marxat), `applyRanking` no el descarta: li assigna `id` sintètic `participant_<id>` i el manté al rànquing (`roundEvents.js:107-118`). Això és el que descriu `doc/game-service.md:988`.

També hi ha el cas invers: un jugador que ha estat expulsat o ha sortit continua a `participant` i apareix, amb els punts que hagi acumulat o amb 0. És el comportament que demana la rúbrica.

### 5) Ordre i desempat

`ORDER BY score DESC, p.nickname ASC` és determinista: a igualtat de punts, l'ordre alfabètic decideix. No hi ha `DENSE_RANK` ni posicions compartides (`1, 1, 3`); les posicions són sempre `1..n` perquè `applyRanking` assigna `position = index + 1` (`roundEvents.js:105`). La rúbrica no exigeix empat compartit; l'enunciat parla d'empat, i aquesta és la limitació a declarar si algú ho pregunta.

### 6) Què no és T9 (per no confondre-ho a la demo)

`backend/stats-service/src/stats.routes.js:141-147` té un altre `SUM`/`GROUP BY`/`ORDER BY`, però és el **rànquing global de jugadors** (victòries, podis, encerts), no la classificació d'una partida. No serveix com a evidència de T9.

## Què falta per ser Excel·lent

Res que impedeixi l'Excel·lent segons la rúbrica. Per pujar de 10/10 «de rúbrica» a 10/10 «a prova de foc», es pot fer:

1. **Test d'integració de `getRanking`** contra una BD de test: 3 participants, un sense respostes, 2 rondes, i comprovar `[{score: X}, {score: Y}, {score: 0}]` i l'ordre. Avui no hi ha cap test que executi aquesta consulta (els tests de `backend/game-service/tests/` no la toquen).
2. **Posicions compartides** en cas d'empat (`RANK()`/`DENSE_RANK()` o calcular-ho a la capa de presentació) si el professor ho pregunta com a extres. Avui el desempat per nickname és correcte però no és un «empat».
3. **Paràmetre «fins a la ronda N»** si es vol ensenyar la classificació acumulada després de 2 rondes en una partida de 5. La consulta actual suma totes les respostes existents; és correcte mentre el rànquing es mostri en acabar cada ronda (que és el flux real), però no permet una foto històrica arbitrària.
4. **Endpoint REST** `GET /api/rooms/:codi/ranking` que reutilitzi `getRanking`, per ensenyar la mateixa dada per HTTP i no només per WebSocket/CSV. És una millora d'API, no de T9.

## Fitxers clau

| Fitxer | Línies | Paper a T9 |
|---|---|---|
| `backend/game-service/src/game/persistence/gameRepository.js` | 39-51 | **La consulta SQL** de la classificació |
| `backend/game-service/src/game/persistence/gameRepository.js` | 158-211 | `closeRoundRecord`: puntua i retorna l'acumulada (crida a línia 207) |
| `backend/game-service/src/game/persistence/gameRepository.js` | 216-246 | `finishGameRecord`: tanca la partida i retorna la final (línia 243) |
| `backend/game-service/src/game/roundEvents.js` | 82-133 | `applyRanking`: passa el resultat SQL a la sala i sobreescriu `player.score` |
| `backend/game-service/src/game/roundEvents.js` | 262, 385 | Desa `currentRanking` i `finalRanking` |
| `backend/game-service/src/game/sendRound.js` | 168-189, 194-214 | Missatges `round:ranking` i `game:finished` |
| `backend/game-service/src/game/scoring.js` | 57-87 | Corba de punts que acaba a `resposta.punts` |
| `backend/database/sql/schema.sql` | 111-132 | Taula `resposta` (`punts`, `posicio`, `UNIQUE`) |
| `frontend/client-vue/src/components/RoomRanking.vue` | 51-71 | Pinta posició, nickname i punts |
| `frontend/client-vue/src/views/PlayerRoomView.vue` | 354-374 | Pantalles de rànquing de ronda i final |
| `doc/entregarbbdd/simulacio-entrega.md` | 265-296 | Guió T9 i consultes de comprovació manual |

## Explicació dels fitxers

- **`gameRepository.js`**: és el cor. `getRanking` fa `participant LEFT JOIN resposta` per no perdre ningú, suma `punts` per participant i ordena. `closeRoundRecord` primer assigna `posicio` i `punts` a cada resposta dins d'una transacció i després crida `getRanking`; per això l'acumulada sempre reflecteix exactament les files de `resposta`. `finishGameRecord` només canvia l'estat de la partida i reutilitza la mateixa consulta; no duplica lògica.
- **`roundEvents.js`**: `applyRanking` converteix el resultat SQL en el format del WebSocket (`position`, `id`, `nickname`, `score`, `userId`, `avatarColor`) i actualitza `player.score` amb el valor de la BD. Aquí es veu que el JS no suma res: només fa de pont. `finishRound` desa el resultat a `room.currentRanking` i `finishGame` a `room.finalRanking`.
- **`scoring.js`**: defineix quants punts val cada resposta (0-530). No calcula la classificació; només el valor unitari que després se sumarà a SQL.
- **`schema.sql`**: `resposta.punts` és la font de veritat. El `UNIQUE (ronda_id, participant_id)` és el que impedeix que un doble enviament infli el `SUM`, i `participant` és la taula des de la qual surt tothom, tingui respostes o no.
- **`RoomRanking.vue` / `PlayerRoomView.vue`**: demostren que la dada que ve del backend es mostra sense recalcular. El component rep `ranking[]` i pinta `score` directament.
- **`sendRound.js`**: construeix els missatges. El `you.totalScore` surt de `player.score`, que `applyRanking` acaba d'escriure amb el total SQL.

## Preguntes probables

1. **Per què `LEFT JOIN` i no `INNER JOIN`?**
   Perquè volem que surti **tot** participant de la partida, encara que no hagi respost cap ronda. Amb `INNER JOIN` només sortirien els que tenen almenys una fila a `resposta`, i perdríem el jugador amb 0 punts. El `LEFT JOIN` parteix de `participant` (la llista completa) i hi afegeix les respostes quan existeixen.

2. **Què fa `SUM` si un jugador no té respostes? Per què `COALESCE`?**
   `SUM` sobre zero files retorna `NULL`, no `0`. `COALESCE(SUM(a.punts), 0)` converteix aquest `NULL` en `0` perquè el client rebi un número i pugui ordenar i mostrar «0 punts». `COALESCE` no canvia res quan hi ha files: només actua quan la suma és `NULL`.

3. **Per què `GROUP BY p.id, p.nickname`?**
   Perquè volem una fila per participant i estem agregant les seves respostes. `p.id` és la clau única; `p.nickname` s'hi afegeix perquè apareix al `SELECT` i per complir `ONLY_FULL_GROUP_BY`. Agrupar només per nickname funcionaria mentre no es repetissin nicknames, però `id` és la identificació correcta.

4. **Què passa amb un jugador que no ha respost mai?**
   Surt al rànquing amb `score = 0`, gràcies al `LEFT JOIN` + `COALESCE`. Si ja no és a la sala, `applyRanking` li posa un `id` sintètic `participant_<id>` i el manté a la llista (`roundEvents.js:107-118`). No desapareix.

5. **On es desen els punts de cada ronda?**
   A `resposta.punts`, una fila per resposta (participant + ronda). En tancar la ronda, `closeRoundRecord` calcula els punts i fa `UPDATE resposta SET posicio = ?, punts = ?`. No hi ha cap taula «classificació»: la classificació és una consulta, no una dada desada.

6. **Per què calcular-ho en SQL i no en JavaScript?**
   Perquè la font de veritat és la BD i així no hi ha dues sumes que es puguin desincronitzar. Un `SUM` a JS obligaria a carregar totes les respostes, sumar-les i confiar que el backend i el client fan la mateixa operació. Amb SQL, la mateixa consulta serveix per a l'acumulada i la final, i el que veu el professor a phpMyAdmin és exactament el que veu el jugador.

7. **Com es calcula l'acumulada després de dues rondes i la final? Són consultes diferents?**
   Són **la mateixa consulta** en dos moments. En tancar la ronda 2, `getRanking` suma les respostes de les rondes 1 i 2 (acumulada). En acabar la partida, `finishGameRecord` torna a executar la mateixa consulta, ara amb totes les rondes (final). No cal cap filtre `ronda <= 2`: la suma ja inclou tot el que existeix en aquell moment. El que canvia és quan es crida, no el SQL.

8. **Per què `ORDER BY score DESC, p.nickname ASC` i no un altre desempat?**
   `score DESC` posa primer qui més punts té. `p.nickname ASC` garanteix un ordre estable i reproduïble quan hi ha empat, perquè sense desempat MySQL no promet cap ordre. És un desempat alfabètic, no una posició compartida; si el professor volgués `1, 1, 3`, caldria `RANK()` o calcular-ho a la presentació.

9. **Com comproves a mà que la suma quadra?**
   A phpMyAdmin, primer executes la consulta de total per participant; després, la de detall d'un jugador (`SELECT r.numero, a.punts ... WHERE pa.nickname = 'Ana'`) i sumes les files. El total ha de coincidir exactament amb la seva fila del rànquing. Com que el rànquing és `SUM(a.punts)`, la coincidència és per construcció; la comprovació serveix per demostrar que no hi ha cap resposta comptada dues vegades (ho impedeix el `UNIQUE (ronda_id, participant_id)`).

10. **Què passaria si un jugador tingués una resposta d'una altra partida?**
    No hauria de passar: les FK compostes de `resposta` obliguen que `ronda_id` i `participant_id` pertanyin a la mateixa `partida_id`. A més, la consulta porta l'`EXISTS` que comprova que la ronda de la resposta és de la partida del participant (`gameRepository.js:44`). És una defensa per si algú insereix a mà saltant-se el codi.

11. **Per què el `SUM` no compta dues vegades la mateixa resposta?**
    Perquè `resposta` té `UNIQUE (ronda_id, participant_id)` (`schema.sql:120`): un participant només pot tenir una fila per ronda. El segon enviament el rebutja la BD amb `ER_DUP_ENTRY`, que el codi tradueix a `ANSWER_ALREADY_EXISTS` (`gameRepository.js:145-148`). Sense aquest `UNIQUE`, un reintent de xarxa inflaria la classificació.

12. **Si els punts es calculen a `answerSubmitHandler` i també a `closeRoundRecord`, no es poden desincronitzar?**
    Les dues crides usen la mateixa funció `calculatePoints` amb la mateixa resposta i la mateixa solució, així que donen el mateix número. A més, el valor que compta per al rànquing és el de `resposta.punts`, escrit per `closeRoundRecord`; `player.score += points` és només provisional i queda sobreescrit per `applyRanking` amb el total SQL (`roundEvents.js:120`). La font de veritat és una sola.

## Guió de demostració (120 s)

**Objectiu: ensenyar la consulta, l'acumulada de 2 rondes, la final i la comprovació manual d'un jugador.**

1. **(0-20 s) Context.** Obre `gameRepository.js:39-51` i llegeix la consulta en veu alta: «La classificació no es desa; es calcula sumant `resposta.punts` per participant. Parteixo de `participant` amb `LEFT JOIN` perquè tothom surti, i `COALESCE` perquè qui no ha respost valgui 0».
2. **(20-40 s) Acumulada.** Mostra `closeRoundRecord` cridant `getRanking` a la línia 207 i digues: «En tancar cada ronda torno a executar aquesta consulta; per això el rànquing de la ronda 2 ja és la suma de 1+2».
3. **(40-55 s) Final.** Mostra `finishGameRecord` línia 243: «En acabar la partida faig exactament la mateixa consulta; el resultat és la classificació final». Ensenya al client la pantalla de rànquing de la ronda 2 i la de final.
4. **(55-75 s) phpMyAdmin, total.** Executa la consulta de total amb el codi de la partida. Assenyala la fila d'un jugador que no ha respost: `punts = 0`.
5. **(75-100 s) phpMyAdmin, detall.** Executa la consulta de detall d'un jugador amb 2 rondes i suma els `punts` a mà. Compara el resultat amb la seva fila del pas 4: «coincideix perquè el rànquing és literalment aquest `SUM`».
6. **(100-115 s) Ordre.** Torna a la consulta i assenyala `ORDER BY punts DESC, p.nickname ASC`: «primer qui més punts té; a igualtat, ordre alfabètic perquè l'ordre sigui estable».
7. **(115-120 s) Tancament.** «No hi ha cap suma a JavaScript: `applyRanking` només copia el `score` de la BD al jugador. Per això el que veu el client i el que surt a phpMyAdmin és sempre el mateix».

**Frase de seguretat si falla alguna cosa:** «Si el total no quadra, mira `resposta` d'aquell participant: el rànquing no inventa res, és el `SUM` d'aquestes files. Si hi ha una fila de més, el `UNIQUE (ronda_id, participant_id)` hauria d'haver-la bloquejat».
