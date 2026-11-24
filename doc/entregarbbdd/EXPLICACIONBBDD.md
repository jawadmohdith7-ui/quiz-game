# Persistència de How Much?! LIVE

Aquest document explica els canvis relacionats amb la base de dades i el
backend perquè l'equip els pugui entendre. El resum es basa en els commits
de `a25jawmohbou` i `a25jawmohbou-code` presents a l'historial i en l'estat
actual del projecte; alguns fitxers també han rebut canvis d'altres persones i
poden haver evolucionat després.

## 1. Base de dades i Docker

- S'ha configurat MariaDB a [`docker-compose.yml`](../../docker-compose.yml),
  amb un volum per conservar les dades, i phpMyAdmin per consultar-les.
- [`sql/schema.sql`](../../backend/database/sql/schema.sql) crea la base de dades `howmuch` i les
  seves taules, claus primàries i foranes, `UNIQUE`, `NOT NULL` i `CHECK`.
- [`sql/dades-inicials.sql`](../../backend/database/sql/dades-inicials.sql) insereix categories i
  preguntes d'exemple.
- El model de dades (diagrama ER i model relacional) es recull a
  [model-de-dades.md](../model-de-dades.md).

Els scripts s'executen automàticament quan MariaDB inicialitza **un volum
nou**. No es tornen a executar en reiniciar un volum existent.
`dades-inicials.sql` és re-executable: usa `ON DUPLICATE KEY UPDATE id = id`,
així que repetir-lo no duplica dades ni dona error. No cal esborrar el volum
per fer una prova normal. `schema.sql` usa `CREATE TABLE IF NOT EXISTS` i ja no
esborra la taula `usuaris`.

### Taules i relacions

| Taula | Dades principals | Per a què es guarden |
| --- | --- | --- |
| `categoria` | Nom de la categoria | Organitzar i filtrar les preguntes. |
| `pregunta` | Categoria, enunciat, resposta correcta, unitat, dificultat i explicació | Conservar el banc de preguntes i seleccionar-les per jugar. |
| `partida` | Codi intern, tipus, estat, límit de jugadors i dates | Identificar la partida, controlar el seu estat i conservar l'historial. |
| `participant` | Partida i nickname | Identificar cada jugador i calcular els seus punts. |
| `ronda` | Partida, número, pregunta i estat | Saber quina pregunta s'ha fet servir i si la ronda està oberta o tancada. |
| `resposta` | Ronda, participant, valor, posició i punts | Evitar respostes duplicades i calcular la classificació. |

Una categoria té moltes preguntes; una partida té participants i rondes; cada
ronda utilitza una pregunta i pot tenir diverses respostes. `UNIQUE` impedeix,
entre altres coses, repetir un nickname a la mateixa partida, una pregunta a la
mateixa partida o una resposta del mateix participant a la mateixa ronda. Les
claus foranes compostes de `resposta` també garanteixen que la ronda i el
participant siguin de la mateixa partida que la resposta. El model complet i
el diagrama ER estan a [model-de-dades.md](../model-de-dades.md).

La classificació no es guarda en una taula: es calcula sumant els punts de les
respostes. Les connexions i l'estat visual i en directe romanen a memòria; un
reinici del servidor no recupera les sales actives.

## 2. Connexions i accés a dades

- S'usa `mysql2/promise` amb un pool a cada servei:
  [`game-service`](../../backend/game-service/src/db/pool.js) i
  [`catalog-service`](../../backend/catalog-service/src/db/pool.js). Són processos
  diferents; el servei de catàleg també fa servir el pool propi de Sequelize
  per als seus models.
- Les consultes del joc usen `execute()` i paràmetres `?` per passar els valors
  sense concatenar-los al SQL.
- Les dades de connexió es llegeixen de les variables d'entorn configurades a
  Docker Compose. Les funcions de persistència estan separades dels
  gestors WebSocket.

## 3. Sales i partides amb mysql2

A [`roomRepository.js`](../../backend/game-service/src/repositories/roomRepository.js)
es guarda la partida i el seu amfitrió en crear una sala. En entrar un jugador,
una transacció bloqueja la partida amb `SELECT ... FOR UPDATE`, comprova que
està esperant i que hi ha places, i insereix el participant. Si falla alguna
operació es fa `rollback`.

A [`gameRepository.js`](../../backend/game-service/src/game/persistence/gameRepository.js)
es guarden l'inici de la partida, les rondes, les respostes i el final:

1. En iniciar, la partida passa d'`esperant` a `en_curs` i s'obre la primera
   ronda. Les rondes següents es guarden amb la seva pregunta i número.
2. En respondre, una transacció bloqueja la ronda, comprova que continuï oberta
   i guarda la resposta. La restricció de la base de dades evita duplicats.
3. En tancar la ronda, una altra transacció bloqueja la ronda, calcula i guarda
   les posicions i els punts de les respostes i la marca com a `tancada`.
4. La classificació acumulada i final es consulta amb `JOIN`, `SUM` i
   `GROUP BY`; en acabar, la partida passa a `acabada`.

A més, la [cua de sala](../../backend/game-service/src/rooms/roomQueue.js) serialitza les
operacions del joc per a una mateixa sala dins del servidor. El bloqueig a
MariaDB continua sent important per protegir les escriptures a la base de
dades.

## 4. Banc de preguntes amb Sequelize

A [`sequelize.js`](../../backend/catalog-service/src/db/sequelize.js) hi ha els models
`Categoria` i `Pregunta`, les seves validacions i la relació d'una categoria amb
moltes preguntes. Fan servir les taules existents sense cridar `sync()`. Una
categoria amb preguntes no es pot esborrar; la clau forana també protegeix
aquesta relació.

El [repositori de preguntes](../../backend/catalog-service/src/questions/preguntas.repository.js)
conté operacions CRUD i consultes amb `include`. De moment aquestes funcions
no estan exposades com a CRUD d'administració a l'aplicació; la ruta existent
del catàleg s'utilitza per obtenir preguntes per al joc.

## 5. Importar JSON i exportar CSV

La [importació](../../backend/catalog-service/src/questions/importQuestions.js) llegeix el
JSON amb `fs.promises`, captura els errors de lectura i parseig, valida cada
pregunta amb `validarPregunta()` i guarda les vàlides amb Sequelize. Retorna
quantes se n'han importat, quines s'han omès perquè ja existeixen i quines s'han
rebutjat amb els seus motius.

Amb els contenidors en marxa, des de l'arrel es pot importar el fitxer inclòs
al contenidor. **Això modifica el catàleg de la base de dades**:

```bash
docker compose exec -T catalog-service npm run import:questions
```

L'[exportació](../../backend/game-service/src/game/files/exportGameCsv.js) genera amb
`csv-stringify` un CSV d'una partida acabada: posició final, nickname,
punts totals, ronda, pregunta, resposta i punts de la ronda. Des de l'arrel:

```bash
docker compose exec -T game-service npm run --silent export:csv -- CODIGO_INTERNO > partida.csv
```

`CODIGO_INTERNO` és el valor de `partida.codi` a MariaDB, no la contrasenya
de sis dígits d'una sala privada. L'exportació no esborra les dades.

## 6. Sala privada

S'ha corregit l'entrada per codi: el client envia la contrasenya i el
[servidor busca l'identificador intern](../../backend/game-service/src/rooms/joinRoom.js)
de la sala abans de tramitar la unió. El nom visible de la sala és el
nickname del creador; l'identificador intern continua sent diferent.

## 7. Com comprovar-ho

Des de l'arrel del projecte:

```bash
docker compose up -d
docker compose ps
```

L'aplicació és a `http://localhost:5173` i phpMyAdmin a
`http://localhost:8081`. A phpMyAdmin, seleccioneu `howmuch` per consultar
les taules. Per executar les proves del joc des del repositori:

```bash
npm test --prefix backend/game-service
```

S'han provat al navegador una partida pública de quatre jugadors i una
privada de tres, amb les seves respostes i classificació. També es va
comprovar a MariaDB que les respostes i els punts d'aquestes partides es van
guardar, i es va exportar a CSV la partida privada.

## 8. Pendent de revisar

- Exposar el CRUD de categories i preguntes per a administració i completar
  la traducció dels errors esperables de Sequelize per al client.
- Ampliar les proves de concurrència, rollback i importació; hi ha una prova
  de puntuació que espera 110 punts mentre el codi actual retorna 530.
- Revisar la configuració visual: en crear una sala amb un màxim diferent
  de 4, el formulari de configuració mostra inicialment 4.
