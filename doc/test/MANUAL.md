# Testing manual · guió d'execució en viu

> `doc/test/*.test.js` comprova **codi** (estàtic, no toca la BD).
> Això comprova **el que funciona**. Si no s'executa a la sessió, com a màxim és Insuficient.

## Qui prova què

| | Qui | Què demostra | Temps |
|---|---|---|---|
| Automàtic (`node doc/test/run-all.js`) | tu | Que el codi compleix la rúbrica (160 comprovacions) | 5 s |
| Manual (aquest document) | tu, davant el profe | Que **funciona de veritat** | 25 min |

**El profe no executarà els tests.** La sessió és: ell demana, tu executes i expliques. Els tests són
suport (els pots ensenyar al final, 20 segons), no substitueixen res.

---

## Posada a punt (abans del torn)

```bash
docker compose down -v          # només si la BD en viu és antiga
docker compose up -d
```
- phpMyAdmin obert (URL, usuari i contrasenya a «Entrar a phpMyAdmin», més avall).
- Admin (Vue/Electron) obert + **2 clients de joc**.
- Editor obert a `doc/`, `schema.sql`, `dades-inicials.sql`, JSON de preguntes.
- Un `preguntes-broken.json` preparat (falta una clau, una coma o una clau de tancament).

### Entrar a phpMyAdmin

`docker compose` aixeca un phpMyAdmin propi al port **8081** (no cal instal·lar res):

1. Obre **http://localhost:8081**
2. **Usuari:** `root` · **Contrasenya:** `root`
3. **Servidor:** `mariadb` (no `localhost`: és el nom del contenidor dins la xarxa de Docker)
4. A l'esquerra, tria la base de dades **`howmuch`**

Si el camp «Servidor» no et surt, ja ve preconfigurat (`PMA_HOST=mariadb`): només cal usuari i contrasenya.

| On | Host | Usuari | Contrasenya |
|---|---|---|---|
| phpMyAdmin (navegador) | `mariadb` | `root` | `root` |
| HeidiSQL / DBeaver / `mariadb` CLI des del PC | `127.0.0.1:3306` | `root` | `root` |

> Si el navegador diu «No es pot connectar»: `docker compose up -d mariadb phpmyadmin` i espera 10 s.
> Si `howmuch` no surt a l'esquerra, és que `schema.sql` no s'ha executat: `docker compose down -v && docker compose up -d`.

---

## BLOC 1 · Model de dades (4 min)

| # | Acció | Comanda / SQL | Sortida esperada | Tasca |
|---|---|---|---|---|
| 1 | Esborrar i recrear | `DROP DATABASE howmuch;` + executar `schema.sql` | 10 taules, cap error | T2 |
| 2 | Ensenyar FK + ON DELETE | phpMyAdmin → `pregunta` → Relacions | `fk_pregunta_categoria … ON DELETE RESTRICT` | T2 |
| 3 | Ensenar UNIQUE compost | `SHOW CREATE TABLE participant;` | `uq_participant_partida_nickname (partida_id, nickname)` | T2 |
| 4 | Violar el CHECK | `INSERT INTO pregunta (categoria_id, text, resposta_correcta, min_value, max_value, step_value, dificultat, explicacio) VALUES (1,'prova',500,0,100,1,'facil','prova');` | **ERROR 3819** `chk_pregunta_slider` | T2 |
| 5 | Seed 2 cops | executar `dades-inicials.sql` dues vegades | 2a: cap error | T3 |
| 6 | Comparar ids | `SELECT id, nom FROM categoria ORDER BY id;` (abans/després) | **mateixos ids** | T3 |
| 7 | Diagrama ER | obrir `doc/model-de-dades.md` | 10 taules + §1.1 multiplicitats | T1 |

**Frase T3:** "ids explícits + `ON DUPLICATE KEY UPDATE id = id`: la segona passada no toca res."

---

## BLOC 2 · Banc de preguntes (5 min)

| # | Acció | Comanda / SQL | Sortida esperada | Tasca |
|---|---|---|---|---|
| 8 | Crear categoria | Admin → Categories → Nova | Apareix a `SELECT * FROM categoria` | T5 |
| 9 | Crear/modificar/esborrar pregunta | Admin → Preguntes | Canvis visibles a phpMyAdmin | T5 |
| 10 | Nom buit | desar categoria amb nom buit | error **al camp nom** | T5 |
| 11 | Nom repetit | desar "Geografia" una altra vegada | "Ja existeix un registre amb aquestes dades" | T5 |
| 12 | Resposta fora de rang | `resposta_correcta` > `max_value` | error al camp, no es desa | T5 |
| 13 | Esborrar categoria AMB preguntes | Admin → esborrar "Geografia" | "té N preguntes" i **no** s'esborra | T6 |
| 14 | Esborrar categoria SENSE preguntes | crear buida i esborrar | s'esborra | T6 |
| 15 | Prova que no és només UI | phpMyAdmin: `DELETE FROM categoria WHERE id=1;` | **ERROR 1451** | T6 |
| 16 | Include | Admin → llistat de preguntes | surt el **nom de la categoria** | T6 |

**Frase T5:** "Les validacions són al model (`validate`/`allowNull`), la UI només pinta els errors per camp."

---

## BLOC 3 · Joc (5 min) — **comença la partida única**

| # | Acció | Comanda / SQL | Sortida esperada | Tasca |
|---|---|---|---|---|
| 17 | Crear partida | Admin → Nova partida (2 jugadors) | **codi** a la pissarra | T7 |
| 18 | Unir 2 clients | client A i B + codi | tots dos a la sala | T7 |
| 19 | Nickname repetit | tercer client amb el mateix nom | rebuig amb missatge clar | T7 |
| 20 | Cerca de pools | cercar `createPool` al projecte | **3**, un per servei | T7 |
| 21 | Ronda 1 | jugar | — | T8 |
| 22 | Ronda 2 | jugar | **pregunta diferent** | T8 |
| 23 | Prova SQL de l'exclusió | ensenyar `preguntas.repository.js` (`NOT IN (SELECT … FROM ronda …)`) | la pregunta no es repeteix per SQL | T8 |
| 24 | Doble resposta | `INSERT INTO resposta (ronda_id, partida_id, participant_id, valor, punts) VALUES (<ronda>,<partida>,<jugador>,1,0);` | **ERROR 1062** | T8 |
| 25 | Classificació | pantalla de rànquing | ordenada, tothom hi surt | T9 |
| 26 | Comprovació a mà | `SELECT SUM(punts) FROM resposta WHERE participant_id = <id>;` | coincideix amb la pantalla | T9 |

**Frase T8:** "La no-repetició és SQL, no memòria. I encara hi ha `uq_ronda_partida_pregunta` de xarxa."

---

## BLOC 4 · Transaccions (4 min)

| # | Acció | Comanda / SQL | Sortida esperada | Tasca |
|---|---|---|---|---|
| 27 | Tancar ronda 2 | botó de tancar | ronda `tancada` | T10 |
| 28 | Veure posicions i punts | `SELECT id, participant_id, valor, posicio, punts FROM resposta;` | posicions 1..N, punts desats | T10 |
| 29 | Ensenyar el codi | `gameRepository.js` → `closeRoundRecord` | `getConnection`→`beginTransaction`→`FOR UPDATE`→`commit`/`rollback`/`finally release` | T10 |
| 30 | Demo de rollback (si la tens preparada) | trigger temporal: `CREATE TRIGGER tr_falla BEFORE UPDATE ON resposta FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='falla';` → tancar ronda → `DROP TRIGGER tr_falla;` | ronda segueix **oberta**, 0 punts nous → res a mitges | T10 |
| 31 | Respondre a ronda tancada | client → respondre | rebuig amb missatge clar | T11 |
| 32 | Entrar a partida començada | tercer client amb el codi | entra com a **observador** (no juga) | T11 |
| 33 | Ensenyar els FOR UPDATE | `gameRepository.js:171` i `roomRepository.js` | `SELECT … FOR UPDATE` a tots dos | T11 |

**Frase T10:** "Una sola connexió del pool: si féssim `pool.query()` cada consulta aniria a una connexió diferent i no seria una transacció."
**Frase T11:** "Sense `FOR UPDATE` dos clients llegeixen 'oberta' alhora; amb el lock el segon espera i veu 'tancada'."

---

## BLOC 5 · Fitxers (4 min) — **mateixa partida**

| # | Acció | Comanda / SQL | Sortida esperada | Tasca |
|---|---|---|---|---|
| 34 | Trencar el JSON | afegir els errors que digui el profe (sense `text`, fora de rang, categoria inexistent) | — | T12a |
| 35 | Importar | Admin → Importar | informe: **cada descartada amb el motiu**, tots els errors de cada pregunta | T12a |
| 36 | JSON trencat | importar `preguntes-broken.json` | missatge clar, **el servidor segueix viu** | T12a |
| 37 | Vàlides a la BD | `SELECT id, text, categoria_id FROM pregunta ORDER BY id DESC LIMIT 5;` | només les vàlides, amb la seva categoria | T12b |
| 38 | Acabar la partida | Admin → Finalitzar | `estat = 'acabada'` | T13 |
| 39 | Exportar | botó CSV | fitxer descarregat | T13 |
| 40 | Obrir a Excel | doble clic | columnes separades, **accents bé**, decimals nets, classificació final | T13 |
| 41 | Exportar no acabada | crear una altra partida → exportar | **no es permet** | T13 |

**Frase T12a:** "`validarPregunta()` acumula tots els errors en un array, no surt al primer."
**Frase T13:** "`csv-stringify` amb `bom: true` perquè Excel llegeixi UTF-8 i no trenqui els accents."

---

## BLOC 6 · Capa de dades (3 min, sobre codi)

| # | Acció | On | Sortida esperada | Tasca |
|---|---|---|---|---|
| 42 | Cerca de SQL | cercar `query(` i `execute(` | només a repositoris | T14a |
| 43 | Funció sense req/res/socket | obrir `roomRepository.js` | no rep `req`, `res` ni `socket` | T14a |
| 44 | Traducció per `error.code` | cercar `ER_DUP_ENTRY` | un lloc que ho tradueix | T14a |
| 45 | Cerca de models | cercar `findAll(`, `create(`, `destroy(` a `backend/` | només a `preguntas.repository.js` | T14b |
| 46 | Ordre dels errors | obrir `sequelizeErrors.js` | `UniqueConstraintError` **abans** de `ValidationError` | T14b |
| 47 | Taula de dades | `doc/defensa.md` §T15 | R1 durabilitat · R2 càlcul SQL · R3 bloqueig · R4 auditoria | T15 |

**Frase T14b:** "`UniqueConstraintError` **hereta** de `ValidationError`: si poses el pare primer, mai arribes a la filla."

---

## Evidències (per si et demana "ho pots provar?")

- `resultat.txt` — sortida de `node doc/test/run-all.js` (160 ✔).
- 4 captures: CHECK violat (3819), doble resposta (1062), rollback (ronda oberta), CSV a Excel.
- `doc/defensa.md` — guió de respostes i preguntes trampa.

## Ordre si vas just de temps

T2 (4') → T5 (4') → T7 (3') → T8 (3') → T10 (3') → T13 (3') → T14b (2').
La resta s'expliquen sobre el codi en 30 segons cadascuna.
