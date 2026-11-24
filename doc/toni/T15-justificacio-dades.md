# T15 · Justificació de quines dades es desen i quines no (RA2 · 3%)

## Nota

**Suficient alt — 6,5 / 10.**

No existeix el document que demana la rúbrica: no hi ha cap `doc/justificacio-dades.md`
ni cap secció que mapegi **columna → requisit** (durabilitat / càlcul SQL / bloqueig
transaccional / auditoria). El que hi ha és una taula de **6 files i nivell de taula**
a `doc/entregarbbdd/EXPLICACIONBBDD.md:29-36` («Per a què es guarden») i un inventari
de columnes, sense justificació, a `doc/bbdd.md:375-510`.

És més que un «no fet»: el contingut és **coherent amb l'esquema** i el codi, i les
dades que **no** es desen estan explicades (disperses). Per això no és Insuficient.
Però la taula és parcial (falten `rol`, `usuaris`, `partides`, `registre` i totes les
columnes) i les justificacions són genèriques, sense lligar-se a cap requisit. Això és
literalment el supòsit de «Suficient» a la rúbrica. Amb una taula de ~30 files pujaria a
Excel·lent sense tocar codi.

## Per què (evidència)

### Què hi ha (i és correcte)

- **Taula de justificació existent, però parcial i genèrica** —
  `doc/entregarbbdd/EXPLICACIONBBDD.md:29-36`: columnes `Taula | Dades principals |
  Per a què es guarden`, només per `categoria`, `pregunta`, `partida`, `participant`,
  `ronda`, `resposta`. Exemples: «Identificar la partida, controlar el seu estat i
  conservar l'historial» (`:33`), «Evitar respostes duplicades i calcular la
  classificació» (`:36`). Són motius de taula, no de columna, i no citen cap requisit.
- **Inventari columna a columna (sense justificar)** — `doc/bbdd.md:375-510`: les 10
  taules amb tipus, NULL, claus i un paràgraf «Per a què serveix». És documentació de
  disseny, no una justificació de persistència. Excepcions bones: `:417` diu que
  `partida` «No guarda host, contrasenya ni categoria»; `:427` que `participant` no té
  `usuari_id` i que els observadors no s'hi desen; `:440` que `ronda` no guarda
  temps d'inici/fi; `:454` que `posicio` és el rànquing de ronda i la final es calcula
  sumant `punts`.
- **La millor justificació del projecte és al SQL, no a `/docs`** —
  `backend/database/sql/schema.sql:108-110`: «`partida_id` es redundante a propósito:
  las FK compuestas obligan a que la ronda y el participante pertenezcan a la misma
  partida». Reforçat a `doc/bbdd.md:42-44`. Aquest és el nivell que demana l'Excel·lent:
  dada → mecanisme que la justifica (integritat/bloqueig), amb evidència.
- **Coherència real amb l'esquema** (verificat al codi):
  - `partida` només rep `tipus, codi, estat, max_jugadors` en crear-se
    (`backend/game-service/src/repositories/roomRepository.js:24-27`); no hi ha host ni
    password. `max_jugadors` es comprova dins la transacció de join (`:74-83`) i
    s'actualitza amb `FOR UPDATE` (`:147-150`).
  - `resposta` s'insereix amb `valor` (`backend/game-service/src/game/persistence/gameRepository.js:142-143`)
    i `posicio`/`punts` s'omplen en tancar la ronda, dins la mateixa transacció
    (`:187-206`). La classificació es llegeix amb `SUM(punts)` (`:41-47`).
  - El xat viu només a `sala.chat`, limitat a 50 missatges
    (`backend/game-service/src/rooms/createRoom.js:307-308`,
    `backend/game-service/src/routers/messageRouter.js:236-239`). No hi ha cap `INSERT`
    de xat a `backend/`.
  - La contrasenya de sala es genera i viu a l'objecte sala
    (`createRoom.js:262-270, 298`); `doc/bbdd.md:151` ho diu explícitament («no la
    contrasenya de 6 dígits, que no es desa mai»).
- **«Què no es desa» està dit, però escampat**: contrasenya (`doc/bbdd.md:151`),
  observadors i `usuari_id` (`:427`), classificació (`EXPLICACIONBBDD.md:46-48`), estat
  viu a memòria (`doc/bbdd.md:586`), identitat de convidat
  (`doc/game-service.md:368`), xat (`doc/frontend-vue.md:707`).

### Incoherències i punts febles

1. **`partida.dificultat` es desa i no es justifica (i no és verdadera).** La columna
   existeix (`schema.sql:53`) però l'`INSERT` no l'envia
   (`roomRepository.js:24-27`) i la configuració només actualitza `max_jugadors`
   (`:147-150`). Totes les files queden a `'media'`. El propi doc ho reconeix com a
   defecte (`doc/bbdd.md:878-880`), no com a decisió. Mateix cas amb la categoria, les
   rondes i la durada, que no es desen a `partida` (`doc/game-service.md:1023`).
2. **«Conservar l'historial» és fals tal com està escrit.** `EXPLICACIONBBDD.md:33`
   diu que `partida` serveix per conservar l'historial, però `returnToLobby` esborra
   `ronda` i `participant` (i per CASCADE les `resposta`) 15 s després del final
   (`gameRepository.js:289-300`; `doc/bbdd.md:177-181`), i la fila `partida` s'esborra
   si la sala queda buida al lobby (`roomRepository.js:196-206`). El que sobreviu és
   l'agregat `partides`.
3. **Falten 4 taules a l'única taula de justificació**: `rol`, `usuaris`, `partides` i
   `registre`. Són precisament les que necessiten més justificació: `partides` duplica
   estadístiques desnormalitzades (`doc/bbdd.md:484-497`), `registre` és auditoria HTTP
   sense retenció (`:499-510`) i `usuaris.avatar_image` és un `LONGTEXT` de fins a
   ~2,2 MB (`schema.sql:150`; `doc/auth-service.md:525`).
4. **No hi ha criteris, només finalitats.** Enlloc s'etiqueta una dada com
   «durabilitat», «SQL la calcula» o «la bloqueja una transacció». `doc/bbdd.md:279`
   esmenta els bloquejos pessimistes com a convenció de consulta, no com a motiu de
   cada columna.
5. **Documentació desactualitzada en un punt que el professor pot preguntar.**
   `doc/bbdd.md:842` afirma que `game-service` no envia `categoria` i que sempre queda
   `'General'`; el codi actual sí que l'envia (`reportStats.js:13-20`,
   `roundEvents.js:456-463`), així que s'emmagatzema `mix` o la categoria triada.
6. **Ubicació**: la rúbrica diu «taula a /docs»; el projecte té `doc/` i no `docs/`.
   Ja ho detecta la vostra auditoria (`doc/auditoria-requisits.md:42`).

## Què falta per ser Excel·lent

Crear `doc/justificacio-dades.md` (i enllaçar-lo des de `doc/README.md`) amb:

1. **Taula `dada | es desa? | requisit | per què | si no es desés | evidència`** d'unes
   30 files, una per columna rellevant. Ha de cobrir les 10 taules, no 6. Exemple de
   fila ben feta:

   | Dada | Requisit | Justificació | Evidència |
   |---|---|---|---|
   | `resposta.valor` | càlcul + durabilitat | la puntuació és per proximitat (`ABS(valor−correcta)`), no binària; sense el número no es pot recalcular ni exportar | `scoring.js:65`, `gameRepository.js:187-199`, `exportGameCsv.js:35-37` |
   | `resposta.partida_id` | bloqueig/integritat | és redundant a posta perquè les FK compostes impedeixin creuar ronda i participant de partides distintes | `schema.sql:108-131` |
   | `partida.estat` | bloqueig | és l'àncora del `FOR UPDATE` que accepta/rebutja joins i inici/fi | `roomRepository.js:53-72`, `gameRepository.js:58-67` |

2. **Secció «Què NO es desa i per què»** amb: contrasenya de sala, configuració
   (categoria/dificultat/rondes/durada/ready/host), xat, convidats (`guestStorage`),
   observadors, estat viu de la ronda i classificació calculada. Una línia per dada amb
   el cost de persistir-la (PII, retenció, feina sense feature).
3. **Secció «Dades que es desen i no haurien»** o «deute acceptat»: `partida.dificultat`
   (mai escrita), `partida` sense categoria/rondes/durada, `partides` sense clau
   d'idempotència. Reconèixer-ho val més que amagar-ho.
4. **Corregir** `doc/bbdd.md:842` (categoria sí que s'envia) i la frase «conservar
   l'historial» de `EXPLICACIONBBDD.md:33`, o matisar-la («l'agregat sobreviu; el
   detall s'esborra al lobby»).
5. Si el professor exigeix la ruta literal, un `docs/` amb un enllaç/índex, o
   justificar per escrit que `doc/` és la carpeta equivalent.

## Fitxers clau

- `doc/entregarbbdd/EXPLICACIONBBDD.md` — única taula «per a què es guarden» (línies 29-36).
- `doc/bbdd.md` — inventari de les 10 taules (375-510), fluxos (140-218), riscos (816-921).
- `backend/database/sql/schema.sql` — 10 taules; comentari de la redundància a 108-110.
- `backend/game-service/src/repositories/roomRepository.js` — `partida`/`participant`.
- `backend/game-service/src/game/persistence/gameRepository.js` — `ronda`/`resposta`, rànquing, reset destructiu.
- `backend/game-service/src/rooms/createRoom.js` — estat de sala que no es persisteix.
- `backend/game-service/src/routers/messageRouter.js` — xat en memòria.
- `backend/stats-service/src/stats.routes.js` — `partides` i `registre`.

## Explicació dels fitxers

**`EXPLICACIONBBDD.md`** — És l'únic lloc amb format de taula justificativa. Serveix per
ensenyar-la, però només cobreix el nucli del joc i amb motius d'una línia. No es pot
defensar com a Excel·lent perquè no arriba a columna ni a requisit.

**`bbdd.md`** — La documentació tècnica real. La seva força és que descriu **què fa**
cada taula i columna i ho lliga al codi; la feblesa, que no respon **per què** aquella
dada ha de ser a la BD i no a memòria. Els apartats 9.x reconeixen defectes (dificultat,
historial esborrat, `partides` sense idempotència), cosa que juga a favor de la coherència.

**`schema.sql`** — L'esquema és la font de veritat. Té una justificació de disseny
excel·lent (FK compostes + `partida_id` redundant) i columnes que el codi no omple
(`partida.dificultat`). Comparar-lo amb el codi és el que permet detectar les
incoherències.

**`roomRepository.js` / `gameRepository.js`** — Demostren què s'escriu de veritat:
`partida` sense host/password/categoria, `participant` sense `usuari_id`, `resposta`
amb `valor` a l'INSERT i `posicio`/`punts` al tancament, i l'esborrat de l'historial al
retorn al lobby. Són l'evidència que la doc no contradiu l'esquema (llevat de la
dificultat).

**`createRoom.js` / `messageRouter.js`** — Prova que configuració, contrasenya i xat
viuen només a la memòria. És la part «què no es desa» que falta consolidar a `/docs`.

## Preguntes probables

1. **Per què deseu `resposta.valor` i no només si és correcta?**
   Perquè la puntuació no és binària: és per proximitat relativa,
   `|valor − correcta| / |correcta|`, amb corba 0–530 (`scoring.js:57-86`). Sense el
   número no es pot puntuar, desempatar (`gameRepository.js:191`) ni exportar la
   resposta donada (`exportGameCsv.js:35-37`). Un booleà destruiria informació que no
   es pot reconstruir.

2. **Per què `resposta.punts` a la BD si el podríeu recalcular?**
   Perquè el rànquing és `SUM(punts)` i es llegeix després de cada ronda
   (`gameRepository.js:41-47, 207`). Guardar-lo fa que el SQL sumi sense recórrer a JS
   i, sobretot, **congela el resultat**: si l'admin edita `pregunta.resposta_correcta` o
   canvia la corba, la puntuació històrica no canvia. Matís honest: el càlcul el fa JS
   (`calculatePoints`, línia 199); SQL només suma.

3. **Per què `resposta.posicio` si es pot derivar ordenant per `valor`?**
   Perquè fixa l'ordre exacte que es va mostrar, amb els desempats (`valor DESC, id ASC`,
   `gameRepository.js:191`), i perquè la resposta correcta és editable al catàleg: tornar
   a derivar-la més tard podria donar un altre resultat. És la justificació més feble de
   les tres (valor/punts/posicio) i cal dir-ho així.

4. **Per què `partida.estat` a la BD si també el teniu a memòria?**
   La memòria és la font de veritat de la sala (`bbdd.md:586`), però `estat` és el punt
   de coordinació entre peticions: el `SELECT … FOR UPDATE` sobre `partida` comprova
   `esperant` per acceptar un join (`roomRepository.js:53-72`) i `en_curs` per iniciar o
   acabar (`gameRepository.js:58-67, 218-227`). Sense la fila no hi ha res a bloquejar.
   Debilitat: un reinici deixa files `en_curs` òrfenes, perquè no hi ha reconciliació
   (`game-service.md:965`).

5. **Per què deseu el codi de sala i no la contrasenya de 6 dígits?**
   El `codi` és el `roomId` intern, únic (`schema.sql:50,58`) i la clau de totes les
   consultes. La contrasenya només valida l'entrada mentre la sala viu
   (`createRoom.js:262-270, 298`); persistir-la seria un risc de seguretat sense cap
   funcionalitat que ho demani. Ho diu `bbdd.md:151`.

6. **Per què no deseu el xat?**
   Perquè no hi ha cap feature d'historial: el xat viu a `sala.chat`, es limita a 50
   missatges i mor amb la sala (`createRoom.js:307-308`, `messageRouter.js:236-239`).
   Persistir-lo obligaria a definir retenció, moderació i accés a contingut d'usuaris.
   Si demanessin «replay» o denúncies, caldria una taula `missatge` amb FK a `partida` i
   `participant`.

7. **Per què `participant.nickname` i no `usuari_id`?**
   Perquè els convidats són ciutadans de primera: es pot jugar sense compte i l'únic
   identificador estable dins la sala és el nickname, únic per partida
   (`schema.sql:67-72`; `bbdd.md:427`). Els registrats es relacionen només pel text del
   nickname, cosa que és un deute conegut (`bbdd.md:831-839`). Si es volgués estadística
   fiable per usuari, caldria afegir `participant.usuari_id` nullable.

8. **Per què no deseu la configuració de sala (categoria, dificultat, rondes, durada, host, ready)?**
   Perquè és estat de coordinació d'una sola instància: `game-service` no escala
   horitzontalment i un reinici perd la sala sencera (`game-service.md:11, 965`). Només
   es desa el que ha de sobreviure, ser consultable per SQL o s'ha de bloquejar. Però
   compte: `partida.dificultat` existeix i no s'escriu (`bbdd.md:878-880`); això no és
   una decisió, és un defecte, i és millor dir-ho.

9. **Per què `partides` (plural) duplica dades si ja teniu `partida`/`resposta`?**
   Perquè el detall normalitzat s'esborra al tornar al lobby (`gameRepository.js:289-300`).
   L'agregat és l'únic que sobreviu per a perfil i rànquing (`stats.routes.js:74-88`) i
   evita fer `JOIN` sobre tot l'historial. Contrapartida: no té `UNIQUE` ni clau
   d'idempotència, així que un reintent pot duplicar la partida (`bbdd.md:497, 909-911`).

10. **Per què `resposta.partida_id` si ja es pot arribar per `ronda_id`?**
    Per permetre les FK compostes `(ronda_id, partida_id)` i `(participant_id, partida_id)`
    (`schema.sql:124-131`). Així la BD garanteix que ronda i participant són de la mateixa
    partida; la comprovació en JS (`gameRepository.js:196`) quedaria oberta a curses i a
    escriptures externes. És la justificació més sòlida de tot l'esquema.

11. **Per què `data_inici`/`data_fi` i `max_jugadors` sí, i en canvi `hostId` no?**
    `max_jugadors` es necessita dins la transacció de join per decidir si hi ha plaça
    (`roomRepository.js:74-83`). Les dates són durabilitat pura: duren per a les sèries
    d'ús i la durada de partida, i tenen `CHECK` de coherència (`schema.sql:61-63`).
    `hostId` només serveix per pintar permisos en directe i no té consulta ni bloqueig
    associat (`game-service.md:987`).

12. **Per què `registre` i `usuaris.avatar_image` no surten a la taula?**
    Són les dues llacunes més visibles. `registre` justifica's per l'auditoria HTTP del
    panell (`bbdd.md:499-510`), sense retenció; `avatar_image` perquè no hi ha servidor
    de fitxers i s'accepta un data URI de fins a 2,2 MB (`auth-service.md:525`), a canvi
    d'engreixar la fila. Totes dues haurien de ser files de la taula de `/docs`.

## Guió de demostració (45 s)

1. **10 s** — Obrir `doc/entregarbbdd/EXPLICACIONBBDD.md:29-36` i dir: «aquí tenim la
   taula de què es desa i per a què; cobreix el nucli del joc, i a `bbdd.md` tenim el
   detall de cada columna». No vendre'l com a més del que és.
2. **10 s** — `SHOW CREATE TABLE resposta\G` i assenyalar `valor`, `posicio`, `punts`,
   `partida_id` redundant i les FK compostes (`schema.sql:111-132`). Frase: «`valor` és
   imprescindible perquè la puntuació és per proximitat; `posicio` i `punts` congelen el
   resultat; `partida_id` és redundant perquè la FK composta impedeix creuar partides».
3. **10 s** — Ensenyar `gameRepository.js:187-206`: «tot això passa en una transacció
   amb `FOR UPDATE`; per això `ronda.estat` i `partida.estat` són a la BD, no només a
   memòria». Ensenyar `roomRepository.js:53-72` per al join.
4. **10 s** — Ensenyar `createRoom.js:298` i `:307-308` + `messageRouter.js:236-239`:
   «contrasenya i xat no es desen perquè només serveixen mentre la sala viu; persistir-los
   seria un risc sense cap feature».
5. **5 s** — Tancar amb el deute: «sabem que `partida.dificultat` no s'escriu i que
   l'historial s'esborra al lobby; està documentat a `bbdd.md:878` i `:177`. Ho
   corregiríem afegint la configuració a `partida` o traient la columna».
