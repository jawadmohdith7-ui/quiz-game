# T7 · Pool compartit, partides amb codi únic i participants (RA2 · 7%)

## Nota

**Excel·lent — 10 / 10.**

Un sol pool dins del `game-service`, compartit per tots els mòduls de dades. El codi de
partida és únic per `UNIQUE` a la BD i es reintenta si coincideix (3 intents). El nickname
repetit es rebutja amb dues barreres (memòria i BD) i un missatge clar en català.

## Per què (evidència)

### 1. Un sol pool, compartit

`backend/game-service/src/db/pool.js:42-52`:

```js
export const pool = mysql.createPool({
  host, port, user, password, database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});
```

Tots els mòduls de BD l'importen del mateix lloc:

| Mòdul | Import |
|---|---|
| `repositories/roomRepository.js:6` | `import { pool } from "../db/pool.js"` |
| `game/persistence/gameRepository.js:6` | íd. |
| `rooms/joinRoom.js:9` | íd. |

**La trampa de la demo:** `grep createPool` a tot el projecte dona **3 resultats**
(`auth-service/src/pool.js`, `catalog-service/src/db/pool.js`, `game-service/src/db/pool.js`).
No és un error: cada microservei és un procés Node independent amb la seva pròpia memòria i
no poden compartir un objecte de connexió. La rúbrica parla de "compartit per tots els
mòduls", i dins del `game-service` ho és.

La configuració surt de variables d'entorn amb valors per defecte (`pool.js:10-40`), així
que funciona igual en local i dins del contenidor (`DB_HOST=mariadb`).

### 2. Codi únic amb `UNIQUE` i reintent

**A la BD** — `schema.sql:58`:

```sql
CONSTRAINT uq_partida_codi UNIQUE (codi),
```

**Al codi** — `rooms/createRoom.js:227-257`:

```js
let attempt = 0;
while (attempt < 3) {
  if (saved === true) break;
  roomId = `sala_${randomBytes(5).toString("hex")}`;
  try {
    await createRoomRecord({ roomId, isPrivate, maxPlayers, nickname: cleanNickname });
    saved = true;
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") throw error;   // no amaguem errors reals
    if (attempt === 2) throw error;                    // últim intent
  }
  attempt = attempt + 1;
}
```

Per què n'hi ha prou amb 3 intents: `randomBytes(5)` són 40 bits =
**1.099.511.627.776** combinacions. Amb un milió de partides simultànies, la probabilitat
de col·lisió és de l'ordre de 10⁻⁶. Els 3 intents són una xarxa de seguretat, no una
necessitat estadística.

### 3. La creació de la sala és atòmica

`repositories/roomRepository.js:11-42` — `createRoomRecord` obre una transacció i fa els
dos `INSERT` junts:

```sql
INSERT INTO partida (tipus, codi, estat, max_jugadors) VALUES (?, ?, 'esperant', ?)
INSERT INTO participant (partida_id, nickname) VALUES (?, ?)
```

Si el segon falla, el `catch` fa `rollback()` i el `finally` fa `release()`. No queden
partides òrfenes sense amfitrió. Això també és el que fa que el `ER_DUP_ENTRY` del codi
sigui l'únic duplicat possible aquí: la partida és nova, així que el participant no pot
xocar amb res.

### 4. Nickname repetit: dues barreres, un sol missatge

**Barrera 1, memòria** — `rooms/joinRoom.js:178-188`:

```js
for (const player of room.players.values()) {
  if (player.nickname === cleanNickname) nicknameInUse = true;
}
if (nicknameInUse === true) {
  return { ok: false, reason: "Aquest nom d'usuari ja està en ús" };
}
```

**Barrera 2, BD** — `joinRoom.js:244-250`:

```js
try {
  await addRoomParticipant({ roomId: cleanRoomId, nickname: cleanNickname });
} catch (error) {
  if (error.code === "ER_DUP_ENTRY") {
    return { ok: false, reason: "Aquest nom d'usuari ja està en ús" };
  }
  ...
}
```

Protegida per `schema.sql:72`:

```sql
CONSTRAINT uq_participant_partida_nickname UNIQUE (partida_id, nickname),
```

És un `UNIQUE` **compost**: el nickname és únic dins d'una partida, no globalment. Dos
jugadors de sales diferents es poden dir igual, que és el comportament correcte.

El mateix missatge surt per les dues vies, i arriba al client per `room:join:error`
(`websocket.js` → `v-alert` a `LobbyView.vue`).

### 5. Detall que juga a favor: reserva del nom de sala

`rooms/roomNames.js:12-50` manté un `Set` de noms **reservats** mentre la sala s'està
creant a la BD. `createRoom.js:222` reserva abans de l'`await` i `:258-260` allibera al
`finally`:

```js
const reservedRoomName = reserveRoomName(cleanRoomName);
try { ... } finally { releaseRoomName(reservedRoomName); }
```

Això evita que dues creacions simultànies amb el mateix nom passin totes dues pel
`isRoomNameTaken` abans que cap hagi desat. És consciència de cursa a la capa de memòria.

## Què falta per ser Excel·lent

Res. La tasca està completa.

**Què has de vigilar (i com respondre-ho):**

1. **Si s'esgoten els 3 intents de codi**, `createRoom.js:252-254` relança el
   `ER_DUP_ENTRY` cru i `createRoomHandler.js:30-38` respon
   *"No s'ha pogut crear la partida. Torna-ho a provar."* És un missatge genèric per a un
   cas que en la pràctica no passa (40 bits de codi). La rúbrica només demana "un nou
   intent si coincideix", i en fas tres. **Si t'ho pregunten, digues-ho així:** "si el codi
   coincís tres cops, el client rep un missatge de reintent; la probabilitat és d'una
   entre un bilió".
2. **No hi ha test del reintent.** `backend/game-service/tests/` té tests de xat, lobby i
   `safeSend`, però no de `createRoom`. La rúbrica no en demana.
3. **El nom de la sala és únic només a memòria** (`roomNames.js`), no a la BD. Amb una sola
   instància de `game-service` és correcte; amb diverses rèpliques caldria un `UNIQUE` a
   la BD. No és cap requisit de T7 (T7 parla del codi de partida i del nickname).
4. **Commit.** Els canvis de T5 i T6 a `game-service` i `client-vue` estan sense commitejar;
   el codi de T7 és a `b8c8eee` i no cal tocar-lo.

## Fitxers clau

| Fitxer | Què hi ha |
|---|---|
| `backend/game-service/src/db/pool.js` | L'únic pool del servei (`:42-52`) |
| `backend/game-service/src/rooms/createRoom.js` | Generació del codi i bucle de reintent (`:222-260`) |
| `backend/game-service/src/repositories/roomRepository.js` | `createRoomRecord` (transacció) i `addRoomParticipant` (`FOR UPDATE`) |
| `backend/game-service/src/rooms/joinRoom.js` | Comprovació de nickname (memòria) i captura d'`ER_DUP_ENTRY` |
| `backend/game-service/src/rooms/roomNames.js` | Reserva i alliberament del nom de sala |
| `backend/database/sql/schema.sql` | `uq_partida_codi` (`:58`) i `uq_participant_partida_nickname` (`:72`) |

## Explicació dels fitxers

**`pool.js`** — Crea el pool de `mysql2/promise` un cop per procés. `connectionLimit: 10`
vol dir que com a molt hi ha 10 connexions obertes a MariaDB; la resta esperen a la cua
(`queueLimit: 0` = cua il·limitada). `charset: "utf8mb4"` és el que permet desar emojis als
nicknames. Tots els paràmetres surten de l'entorn, així que el mateix codi serveix en local
i dins Docker.

**`createRoom.js`** — Valida el nickname i el nom de sala, reserva el nom, genera el codi i
desa la sala amb reintent. Després crea l'objecte de sala a memòria (`roomStorage.members`)
i la contrasenya si és privada (`:262-275`, amb bucle perquè no es repeteixi).

**`roomRepository.js`** — Tot el SQL de sales. `createRoomRecord` (`:11-42`) és una
transacció amb `getConnection`/`commit`/`rollback`/`release`. `addRoomParticipant`
(`:47+`) bloqueja la fila de `partida` amb `SELECT ... FOR UPDATE` abans de comprovar
estat i capacitat: és el que fa que dos jugadors no entrin alhora en una sala que només té
una plaça lliure (això és T11).

**`joinRoom.js`** — Comprova contrasenya, nickname, longitud, estat de la sala i capacitat.
Si la sala està en joc, entra com a `observer` (`:230-238`) — decisió de disseny, no un
error (vegeu T11).

**`roomNames.js`** — Un `Set` de noms pendents i una llista de sales vives. El `finally` de
`createRoom` garanteix que una reserva no quedi penjada si la creació falla.

## Preguntes probables

1. **Per què un sol pool i no una connexió per consulta?**
   Perquè obrir una connexió TCP + handshake + autenticació costa mil·lisegons. El pool les
   reutilitza: `getConnection()` dona una connexió lliure i `release()` la torna. Amb 10
   connexions i cua, el servei aguanta moltes peticions amb pocs recursos.

2. **Per què hi ha 3 `createPool` al projecte?**
   Un per microservei. Són processos separats: no poden compartir memòria. La rúbrica diu
   "compartit per tots els mòduls", i dins de cada servei ho és.

3. **Per què 3 intents i no 1?**
   `randomBytes(5)` = 40 bits. La col·lisió és pràcticament impossible, però si passa, un
   reintent és més barat que un error a l'usuari. Més de 3 no aporta res.

4. **Què passa si el codi generat ja existeix?**
   L'`INSERT` falla amb `ER_DUP_ENTRY` (per `uq_partida_codi`), el `catch` el reconeix,
   genera un codi nou i torna a provar. Si no és un duplicat, **no** reintenta: propaga
   l'error, per no amagar un problema real.

5. **Per què no comproveu el codi amb un `SELECT` abans de l'`INSERT`?**
   Perquè seria una cursa: entre el `SELECT` i l'`INSERT` un altre podria inserir el mateix
   codi. L'`UNIQUE` és atòmic; el `SELECT` previ només serveix per donar un missatge més
   bonic, i aquí no cal perquè el reintent és silenciós.

6. **Per què `ER_DUP_ENTRY` i no el text del missatge?**
   Perquè el text canvia amb l'idioma i la versió del servidor. `error.code` és estable.

7. **El nickname repetit, el controla el servidor o la BD?**
   Les dues. La memòria dona la resposta ràpida sense anar a la BD; l'`UNIQUE`
   `(partida_id, nickname)` és la garantia. Si la memòria i la BD divergeixen (cursa), guanya
   la BD i el missatge és el mateix.

8. **Per què `UNIQUE (partida_id, nickname)` i no `UNIQUE (nickname)`?**
   Perquè el nickname és la identitat **dins d'una sala**. Globalment impediria que ningú
   reutilitzés mai un nom.

9. **Per què `createRoomRecord` fa una transacció si només són dos `INSERT`?**
   Perquè si el participant falla, la partida no ha de quedar òrfena. Sense transacció
   quedaria una `partida` sense amfitrió, i la sala existiria a la BD però no a memòria.

10. **Què fa `reserveRoomName` si la creació falla?**
    El `finally` (`createRoom.js:258-260`) l'allibera sempre. Sense això, un nom quedaria
    bloquejat per sempre i ningú podria crear una sala amb aquell nom.

11. **Com demostres que el pool és únic?**
    `grep -rn "createPool" backend/game-service/src` → una sola línia, a `db/pool.js:42`.
    I `grep -rn "import { pool }" backend/game-service/src` → tots els mòduls de BD.

12. **Què passa si MariaDB cau?**
    `getConnection()` falla i l'error puja fins al handler, que respon
    *"No s'ha pogut crear la partida. Torna-ho a provar."* El servei no cau: `mysql2`
    reconecta quan el servidor torna.

## Guió de demostració (90 s)

**0-15 s — El pool.** Comparteix pantalla i executa:

```powershell
Select-String -Path (Get-ChildItem backend\game-service\src -Recurse -Include *.js -File).FullName -Pattern 'createPool'
```

Una sola línia: `db/pool.js:42`. Després:

```powershell
Select-String -Path (Get-ChildItem backend\game-service\src -Recurse -Include *.js -File).FullName -Pattern 'import \{ pool \}'
```

Tots els mòduls de BD. Dir: "un pool per procés; dins del servei, un de sol".

**15-40 s — Crear partida i unir dos clients.** Ensenyar el codi generat a la pantalla
(`sala_` + 10 caràcters hex).

**40-60 s — Nickname repetit.** Obrir el segon client i posar el mateix nickname que el
primer. Surt *"Aquest nom d'usuari ja està en ús"*. Dir que hi ha dues barreres i que la
bona és la de la BD.

**60-75 s — El codi del reintent.** Obrir `createRoom.js:227-257` i assenyalar les tres
coses: `while (attempt < 3)`, `error.code === "ER_DUP_ENTRY"`, i el `throw error` quan no
és duplicat ("no amaguem errors reals").

**75-90 s — La BD.** A phpMyAdmin o per consola:

```powershell
docker compose exec -T mariadb mariadb -uroot -proot howmuch -e "SHOW CREATE TABLE partida\G" 
```

Assenyalar `UNIQUE KEY uq_partida_codi (codi)`. Tancar amb: "el codi és únic per la BD, no
perquè el codi ho comprovi".
