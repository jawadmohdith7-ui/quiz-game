# T13 · Exportació CSV d'una partida acabada (RA1 · 5%)

## Nota

**8 / 10 — Bé (Bé alt)**

El contingut és complet: participants, respostes, punts per ronda, punts totals i classificació
final (`posicio`), generat amb `csv-stringify` de veritat (no `join(',')`), amb columnes i cometes
ben resoltes i amb `escape_formulas` com a extra. La guarda d'estat existeix i funciona.

El que el deixa a **Bé** i no a **Excel·lent** és exactament el que demana la rúbrica en aquest
nivell: **no hi ha BOM** (els accents es veuran malament en obrir el fitxer fent doble clic a Excel
Windows) i **els decimals surten amb punt i amb 6 zeros** (`42.000000`), que en un Excel en català
s'interpreten malament. Són dos defectes de representació, no de contingut.

## Per què (evidència)

**1. Usa `csv-stringify`, no concatenació** — `backend/game-service/src/game/files/exportGameCsv.js:6`

```js
import { stringify } from "csv-stringify/sync";
```

La sortida es construeix en una sola crida a `stringify(...)` a `exportGameCsv.js:93-97`, amb
`header: true`, la llista explícita de `columns` i `escape_formulas: true`. No hi ha cap
`records.map(r => r.join(","))` enlloc del fitxer.

**2. Columnes exactes del CSV** — `exportGameCsv.js:79-87` i `:95`

| Columna | Origen | Què és |
|---|---|---|
| `posicio` | JS, `index + 1` | Classificació final (1 = guanyador) |
| `nickname` | `participant.nickname` | Participant |
| `punts_totals` | JS, suma de `resposta.punts` | Punts totals de la partida |
| `ronda` | `ronda.numero` | Número de ronda |
| `pregunta` | `pregunta.text` | Enunciat |
| `resposta` | `resposta.valor` | Resposta donada |
| `punts_ronda` | `resposta.punts` | Punts d'aquella ronda |

Ordre: `ORDER BY COALESCE(totals.score, 0) DESC, p.nickname ASC, p.id ASC, r.numero`
(`exportGameCsv.js:50`). Com que el `Map` de JS conserva l'ordre d'inserció (`:55-72`), el primer
participant que apareix és el que té més punts i rep `posicio = 1`. La classificació final, per
tant, **hi és** i és coherent amb els punts.

**3. La guarda d'estat: es comprova en JS, després de llegir la BD** — `exportGameCsv.js:23-32`

```js
const [games] = await connection.execute("SELECT id, estat FROM partida WHERE codi = ?", [roomId]);
if (games.length === 0) throw new Error("La partida no existeix.");
if (games[0].estat !== "acabada") throw new Error("Només es poden exportar partides acabades.");
```

No és una condició dins del `SELECT` (no és `WHERE ... AND estat = 'acabada'`), és un `if` a Node.
El resultat pràctic és el mateix: la consulta grossa de respostes (`:35-52`) no s'arriba a executar.
L'estat ve de l'enum `partida.estat ENUM('esperant','en_curs','acabada')` (`backend/database/sql/schema.sql:51`).
Abans hi ha la validació d'entrada buida (`:15-21`): `"Cal indicar el codi de la partida."`.

El CLI tradueix l'error i surt amb codi 1 — `backend/game-service/src/cli/exportGameCsv.js:4-11`:

```js
console.error(`Error d'exportació: ${error.message}`);
process.exitCode = 1;
```

**4. El paquet hi és i s'usa** — `backend/game-service/package.json:16` (`"csv-stringify": "^6.9.0"`),
instal·lat a `node_modules/csv-stringify` (versió 6.9.0). Script d'entrada a `package.json:13`:
`"export:csv": "node src/cli/exportGameCsv.js"`. El CLI, però, **no** carrega `.env`
(`node src/cli/...` sense `--env-file-if-exists`), així que cal passar les `DB_*` pel shell o acceptar
els valors per defecte de `src/db/pool.js:10-40`.

**5. Comprovació real executada** (stub de connexió, sense tocar la BD):

```
posicio,nickname,punts_totals,ronda,pregunta,resposta,punts_ronda
1,Pere Çatalà,100,1,"Què val això, amb coma?",42.000000,100
2,Anna,40,1,"Què val això, amb coma?",7.500000,40
```

- BOM al començament: **`false`** (els tres primers bytes no són `EF BB BF`).
- Delimitador: **coma** (el valor per defecte de `csv-stringify`).
- Coma dins del text: **entre cometes** correctament.
- Decimals: **punt** i **6 decimals** (`42.000000`), no coma.
- Guarda: `Només es poden exportar partides acabades.`; codi buit: `Cal indicar el codi de la partida.`

**6. Per què els 6 decimals** — `resposta.valor` és `DECIMAL(20, 6)` (`schema.sql:116`) i el pool
no té `decimalNumbers` (`src/db/pool.js:42-52`), així que `mysql2` el retorna com a **string**
`"42.000000"`. El codi el passa al CSV tal qual (`exportGameCsv.js:85`), sense `Number()` ni
format. `punts` i `punts_totals` són enters i surten bé.

**7. Coses que sí que estan bé i val la pena dir-les**

- `esquerda de fórmules`: `escape_formulas: true` (`:96`) evita que un nickname que comenci per `=`
  s'executi com a fórmula en obrir-lo.
- Sense injecció SQL: els dos paràmetres del `SELECT` van per `?` (`:51`).
- `LEFT JOIN` a `resposta` (`:45`) fa que un participant sense cap resposta **surti igualment** amb
  les columnes de ronda/pregunta/resposta buides. (El `doc/entregarbbdd/simulacio-entrega.md:376`
  diu el contrari; el codi diu això.)
- Connexió injectable (`connection = pool`, `:13`) pensada per a tests — tot i que **no hi ha cap
  test** de l'export al repo (només `sendRound.test.js`, `catalogOptions.test.js`, etc.).

## Què falta per ser Excel·lent

1. **BOM UTF-8** — afegir `bom: true` a les opcions de `stringify` (`exportGameCsv.js:93-97`). És
   una línia i és el que fa que Excel Windows obri `Pere Çatalà` bé en lloc de `Pere Ã‡atalÃ`.
   Sense BOM, l'Excel que obre el fitxer per doble clic no dedueix UTF-8.
2. **Decimals humans** — `Number(row.resposta)` (o `CAST(a.valor AS DOUBLE)` a l'SQL) i, si es vol
   Excel en català, `delimiter: ";"` + decimal amb coma. Com a mínim, treure els 6 zeros: avui
   `42` surt com `42.000000`. Triar **una** convenció i aplicar-la: `;` + `,` decimal (Excel ES/CA)
   o `,` + `.` decimal (CSV estàndard). Ara mateix és la pitjor combinació: coma de camp + punt
   decimal, que en Excel català converteix el número en text.
3. **Test de l'export** — un `exportGameCsv.test.js` amb connexió falsa que comprovi: (a) la capçalera
   exacta, (b) que `en_curs` llança, (c) que una coma dins d'un camp queda entre cometes. La connexió
   injectable ja hi és; només falta el test.
4. **Detall menor**: en cas d'empat, `posicio` és 1, 2, 3... sense compartir posició. Si el professor
   pregunta per la classificació "esportiva", cal dir que el desempat és per `nickname`, no per punts.

No és un problema per a la rúbrica, però convé saber-ho: només hi ha export per CLI, no per REST ni
per la UI, i la finestra per exportar és curta perquè `resetAbandonedGameRecord` esborra
`ronda`/`participant` quan la partida torna a `esperant` (`doc/game-service.md:984`).

## Fitxers clau

| Fitxer | Per què |
|---|---|
| `backend/game-service/src/game/files/exportGameCsv.js` | Implementació real: validació, guarda d'estat, SQL, agrupació i `stringify` |
| `backend/game-service/src/cli/exportGameCsv.js` | Wrapper CLI: `argv[2]` → stdout, error → stderr + `exitCode = 1` |
| `backend/game-service/package.json` | Dep `csv-stringify ^6.9.0` i script `export:csv` |
| `backend/game-service/src/db/pool.js` | Pool `mysql2` (utf8mb4, sense `decimalNumbers`) |
| `backend/database/sql/schema.sql` | `partida.estat` (línia 51), `resposta.valor DECIMAL(20,6)` (116), `resposta.punts` (118) |

## Explicació dels fitxers

**`exportGameCsv.js`** (98 línies, una sola funció `exportGameCsv(roomId, connection = pool)`):

1. `:15-21` — `roomId` ha de ser string no buit, si no peta amb missatge en català.
2. `:23-32` — busca la partida pel `codi`; si no existeix o `estat !== 'acabada'`, peta. **Aquesta és
   la guarda** que impedeix exportar una partida oberta.
3. `:35-52` — un sol `SELECT` amb `LEFT JOIN` de `participant` → `resposta` → `ronda` → `pregunta`,
   més una subconsulta `totals` que suma els punts per participant. Ordena per punts descendents.
4. `:55-72` — agrupa les files en un `Map` per `participant_id` i acumula `score`. Els `NULL` es
   tracten com a 0 (`:63-69`).
5. `:75-91` — converteix el `Map` en registres plans; `index + 1` és la posició final, que s'assigna
   un cop per participant.
6. `:93-97` — `stringify` amb capçalera, columnes explícites i `escape_formulas`. Retorna un string;
   no escriu cap fitxer (l'escriptura la fa el shell amb `>`).

**`cli/exportGameCsv.js`** (11 línies): importa la funció, escriu el resultat a `stdout`, captura
l'error i el mostra a `stderr` amb `Error d'exportació: ...`, marca `exitCode = 1` i sempre tanca el
pool al `finally`. Per això `npm run export:csv -- CODI > partida.csv` funciona i un codi dolent
retorna codi de sortida ≠ 0.

## Preguntes probables

**1. Per què `csv-stringify` i no `join(",")`?**
Perquè `join` no escapa res: un nickname o una pregunta amb comes, cometes o salts de línia trenca
les columnes. `csv-stringify` decideix quan cal cometes, duplica les cometes internes i, de pas, amb
`escape_formulas` neutralitza valors que comencen per `=`, `+`, `-` o `@`.

**2. Què passa si un camp conté una coma?**
Es tanca entre cometes dobles. Ho hem vist: `"Què val això, amb coma?"` surt en un sol camp. Si el
camp contingués cometes, es duplicarien (`""`), que és l'estàndard RFC 4180.

**3. Per què cal BOM per Excel?**
Perquè Excel, en obrir un `.csv` amb doble clic, no llegeix la codificació del contingut: si no troba
el BOM (`EF BB BF`) assumeix la codificació ANSI del sistema i els accents es trenquen. El BOM és
l'única pista que té. Aquí **no hi és**, i és la meva principal objecció.

**4. Llavors els accents estan malament?**
El fitxer és UTF-8 vàlid i a VS Code, LibreOffice o `Importar dades` d'Excel es veu perfecte. El
problema és només el doble clic a Excel Windows. Per això la rúbrica ho castiga com a "Bé" i no com
a "Insuficient".

**5. I els decimals?**
`resposta.valor` és `DECIMAL(20,6)`; `mysql2` el retorna com a text i arriba al CSV com
`42.000000`. Numèricament és correcte, però és lleig i, amb coma de separador de camps i punt
decimal, un Excel en català ho pot llegir com a text o com a `42000000`. Hauria de sortir `42` o
`42,5` segons la convenció triada.

**6. Per què no exportar una partida oberta?**
Perquè les dades encara no són definitives: hi haurà rondes noves, respostes que canvien i la
classificació no està tancada. Exportar-la donaria un CSV que sembla oficial i no ho és. La guarda
és `estat !== 'acabada'` → `"Només es poden exportar partides acabades."`.

**7. On es comprova, a l'SQL o al JS?**
Al JS, a `exportGameCsv.js:30-32`, després d'un `SELECT id, estat FROM partida WHERE codi = ?`.
No és `AND estat = 'acabada'` a l'SQL; el resultat és equivalent perquè la segona consulta no
s'executa. Si es volgués, es podria fer a l'SQL, però llavors no es podria distingir "no existeix"
de "no està acabada", i els missatges són diferents a posta.

**8. El CSV té la classificació final?**
Sí, la columna `posicio`. Es calcula a JS (`index + 1`) sobre l'ordre de l'SQL, que ordena per punts
totals descendents. Cada participant té la mateixa `posicio` a totes les seves files.

**9. Què passa si un participant no ha respost res?**
Surten les seves dades amb `ronda`, `pregunta`, `resposta` i `punts_ronda` buits i `punts_totals = 0`.
El `LEFT JOIN` el conserva. (Alguna documentació del repo diu el contrari; el codi mana.)

**10. Com ho executes i ho demostres?**
`npm run export:csv -- CODI > partida.csv` dins `backend/game-service`, amb les `DB_*` a l'entorn.
Si el codi és d'una partida en curs, surt `Error d'exportació: Només es poden exportar partides
acabades.` i el procés acaba amb codi 1 (no genera fitxer útil).

## Guió de demostració (90 s)

1. **0-15 s — Ensenya el codi.** `exportGameCsv.js:6` (`import { stringify }`) i `:93-97`
   (opcions). Digues: "no concatenem strings, deleguem l'escapament a la llibreria".
2. **15-30 s — Columnes.** Llegeix la llista de `:95`: `posicio, nickname, punts_totals, ronda,
   pregunta, resposta, punts_ronda`. Remarca que `posicio` és la classificació final i que
   l'`ORDER BY` de `:50` és el que la fa possible.
3. **30-45 s — Guarda.** `:30-32`. Executa `npm run export:csv -- <codi_en_curs>` i ensenya
   `Error d'exportació: Només es poden exportar partides acabades.` amb codi de sortida 1.
4. **45-65 s — Export bo.** Acaba la partida (o usa'n una d'acabada) i
   `npm run export:csv -- <codi> > partida.csv`. Obre'l al full de càlcul: columnes separades,
   una fila per resposta, la mateixa `posicio` per jugador.
5. **65-80 s — Sigues honest.** Ensenya el fitxer en un editor hex o `Format-Hex` i digues: "no hi
   ha BOM i els decimals surten amb 6 zeros; per això és Bé i no Excel·lent. La correcció és
   `bom: true` i formatar `resposta`".
6. **80-90 s — Tancament.** "Contingut complet, llibreria correcta, guarda correcta; falta
   representació per a Excel i un test."
