# How Much?! LIVE — Arquitectura

## 1. VISIÓ GENERAL

Quatre serveis backend i dos clients. Una sola base de dades: MariaDB `howmuch`, creada amb
`backend/database/sql/schema.sql` i `dades-inicials.sql`.

| Peça | Tecnologia | Paper |
|---|---|---|
| `game-service` | Node.js + `ws` | Servidor WebSocket del joc i del panell d'administració |
| `catalog-service` | Node.js + Express + Sequelize | Categories i preguntes |
| `auth-service` | Node.js + Express + `mysql2` | Comptes, rols, sessió JWT, verificació per correu i avatar |
| `stats-service` | Node.js + Express + Sequelize | Resum de partides, perfil i rànquing |
| `client-vue` | Vue 3 + Vite + Pinia + Vuetify | Client de joc i panell d'administració |
| `client-unity` | Unity | Client de joc alternatiu |

El client Vue parla amb `game-service` per WebSocket (`ws://localhost:3000`), amb `auth-service`
per HTTP (`http://localhost:3011`) i amb `stats-service` per HTTP (`http://localhost:3012`).
Mai no crida `catalog-service`: el joc hi arriba des de `game-service`.

## 2. SERVEIS I PORTS

| Servei | Port | Protocol | Responsabilitat |
|---|---|---|---|
| `game-service` | 3000 | WebSocket | Partides, rondes, respostes, puntuació i pasarel·la del panell |
| `catalog-service` | 3001 | REST intern | Categories i preguntes |
| `auth-service` | 3011 | REST | Usuaris, rols, login, JWT, verificació i avatar |
| `stats-service` | 3012 | REST | Estadístiques, registre i rànquing |
| `client-vue` | 5173 | HTTP | Client de joc i panell d'administració |
| `mariadb` | 3306 | MySQL | Base de dades única `howmuch` |
| `phpmyadmin` | 8081 | HTTP | Administració visual de la base de dades |

Els ports surten de `docker-compose.yml`. `game-service` escolta el que digui `PORT`
(`src/config/websocketConfig.js`); la resta de serveis tenen el port fix al codi o a `PORT`.

## 3. DOMINI DE CADA SERVEI

Regla: cap servei escriu taules d'un altre. Les lectures creuades són només les de la taula.

| Servei | Escriu | Llegeix |
|---|---|---|
| `game-service` | `partida`, `participant`, `ronda`, `resposta` | `usuaris` (`avatar_color`) |
| `catalog-service` | `categoria`, `pregunta`, `registre` | `categoria`, `pregunta` |
| `auth-service` | `usuaris`, `rol`, `registre` | `usuaris`, `rol` |
| `stats-service` | `partides`, `registre` | `partides`, `usuaris`, `registre` |

Els intercanvis entre serveis són HTTP, no SQL:

| Origen | Destí | Què demana |
|---|---|---|
| `game-service` | `catalog-service` | `GET /internal/catalog/options`, `POST /internal/preguntas/get` |
| `game-service` | `stats-service` | `POST /stats/partides` |
| `game-service` (panell) | els tres serveis | Rutes `/internal/admin/*` amb el token de l'admin |
| `client-vue` | `auth-service`, `stats-service` | Login, perfil, avatar, estadístiques i rànquing |

## 4. MODEL DE DADES

Deu taules, totes a `backend/database/sql/schema.sql`.

| Taula | Per a què serveix | Servei propietari |
|---|---|---|
| `categoria` | Nom de cada categoria de preguntes | `catalog-service` |
| `pregunta` | Text, resposta correcta, rang del control lliscant, unitat, dificultat i explicació | `catalog-service` |
| `partida` | Partida viva: tipus, codi, estat, màxim de jugadors i dates | `game-service` |
| `participant` | Nickname de cada jugador dins d'una partida | `game-service` |
| `ronda` | Pregunta assignada a cada número de ronda d'una partida | `game-service` |
| `resposta` | Valor enviat per un participant, posició i punts de la ronda | `game-service` |
| `rol` | Rols de compte (`admin`, jugador) | `auth-service` |
| `usuaris` | Compte: nom, correu, contrasenya, avatar, rol i verificació | `auth-service` |
| `partides` | Resum d'una partida acabada per participant: sala, categoria, posició, encerts i rondes | `stats-service` |
| `registre` | Una fila per petició HTTP atesa, amb servei, mètode, ruta, estat i data | `auth-service`, `catalog-service`, `stats-service` |

`partides.participant_id` apunta a `participant(id)` amb `ON DELETE SET NULL`, i
`partides.rondes` guarda el nombre de rondes perquè les files de `ronda` s'esborren en acabar.

## 5. FLUX DEL JOC

1. **Crear sala.** El client envia `room:create`. `game-service` valida el nickname i la
   configuració, escriu `partida` i `participant` i respon `room:created`.
2. **Unir-se.** `room:join` escriu una fila de `participant`; si l'usuari té compte, llegeix
   `usuaris.avatar_color`. Respon `room:joined` i difon `room:players`.
3. **Configurar.** `room:configuration` actualitza `partida.max_jugadors`. Les categories i
   dificultats surten de `catalog-service` (`catalog:options`).
4. **Començar.** `room:ready` marca els jugadors i `game:start` comprova el mínim de preparats.
   `game-service` demana les preguntes a `catalog-service`, posa `partida.estat = 'en_curs'` i
   envia `round:started`.
5. **Ronda.** `game-service` escriu una fila de `ronda` per pregunta i l'envia sense la resposta
   correcta.
6. **Resposta.** `answer:submit` escriu `resposta`, calcula els punts per proximitat i respon
   `answer:ack`.
7. **Resultats.** En tancar la ronda, `game-service` desa posició i punts a `resposta`, tanca la
   `ronda` i envia `round:results` i, cinc segons després, `round:ranking`.
8. **Tancar.** `game-service` calcula el rànquing, posa `partida.estat = 'acabada'`, envia
   `game:finished` i publica el resum a `stats-service` (`POST /stats/partides`, taula
   `partides`). Quinze segons després esborra `ronda`, `resposta` i `participant` de la partida.
9. **Exportar.** `npm run export:csv <partidaId>` dins `game-service` llegeix `partida`,
   `participant`, `ronda` i `resposta` i escriu el CSV per stdout. No hi ha cap servei
   d'exportació.

## 6. PROTOCOL WEBSOCKET

Tots els missatges són JSON amb `type` obligatori; les dades van al mateix objecte.

### Client → servidor (`messageRouter.js`)

| Tipus | Qui l'envia | Qui el rep i què fa |
|---|---|---|
| `catalog:options` | Client | `game-service`: retorna categories i dificultats |
| `room:create` | Client | `game-service`: crea la sala i el participant |
| `rooms:list` | Client | `game-service`: retorna les sales públiques |
| `room:join` | Client | `game-service`: uneix el jugador (per `roomId` o per contrasenya) |
| `room:leave` | Jugador | `game-service`: treu el jugador de la sala |
| `room:configuration` | Amfitrió | `game-service`: canvia màxim de jugadors, categoria i dificultat |
| `room:ready` | Jugador | `game-service`: marca o desmarca el jugador com a preparat |
| `game:start` | Amfitrió | `game-service`: comprova el lobby i obre la primera ronda |
| `answer:submit` | Jugador | `game-service`: valida, puntua i desa la resposta |
| `chat:message` | Jugador o observador | `game-service`: afegeix el text al xat de la sala i el difon |
| `room:kick` | Amfitrió | `game-service`: expulsa un jugador |
| `round:next` | Amfitrió | `game-service`: tanca la ronda i obre la següent |
| `identity:declare` | Client | `game-service`: crea o restaura la identitat del convidat |
| `nickname:update` | Client | `game-service`: canvia el nickname |
| `observer:select` | Observador | `game-service`: tria quin jugador segueix |
| `gameplay:update` | Jugador | `game-service`: envia el que escriu als observadors que el segueixen |

Els missatges `admin:*` tenen router propi (`src/admin/adminRouter.js`) i no toquen el joc:
`admin:auth`, `admin:live:get`, `admin:preguntes:list|create|update|delete`,
`admin:categories:list|create|update|delete`, `admin:usuaris:list|create|update|delete`,
`admin:estadistiques:get`, `admin:registre:get` i `admin:usage:get`.

### Servidor → client

| Tipus | Destinatari | Quan |
|---|---|---|
| `connection:stablished` | El socket que connecta | En obrir la connexió |
| `identity:confirmed`, `identity:error` | El socket | Resposta a `identity:declare` |
| `nickname:updated`, `nickname:error` | El socket | Resposta a `nickname:update` |
| `catalog:options` | El socket | Resposta a `catalog:options` |
| `room:created`, `room:create:error` | El creador | Resposta a `room:create` |
| `room:new` | Tota la resta de clients | Sala nova |
| `room:joined`, `room:join:error` | El jugador que entra | Resposta a `room:join` |
| `room:players` | Tota la sala | Canvi de jugadors o d'amfitrió |
| `room:left`, `room:leave:error` | El jugador que surt | Resposta a `room:leave` |
| `room:removed` | Tots els clients | Sala esborrada perquè és buida |
| `room:state` | Tota la sala | Canvi d'estat de la partida |
| `room:configuration:updated`, `room:configuration:error` | Tota la sala | Resposta a `room:configuration` |
| `room:ready:error` | El jugador | Error en marcar-se preparat |
| `room:kicked` | El jugador expulsat | Resposta a `room:kick` |
| `chat:message`, `chat:error` | Tota la sala / el socket | Xat |
| `round:started` | Tota la sala | Comença una ronda |
| `round:spectator` | Observadors | Ronda en mode espectador |
| `round:results` | Un per socket | Resultat propi de la ronda |
| `round:ranking` | Un per socket | Rànquing cinc segons després dels resultats |
| `game:finished` | Un per socket | Fi de la partida amb `you` i `ranking` |
| `round:error`, `round:next:error` | El socket o la sala | Error de ronda |
| `answer:ack`, `answer:error` | El jugador | Resposta a `answer:submit` |
| `observer:selected`, `observer:select:error` | L'observador | Resposta a `observer:select` |
| `gameplay:update` | Observadors que segueixen el jugador | Text en directe |
| `admin:live` | Sockets d'administració | Canvi de jugadors o sales |
| `admin:*` (resposta) | El socket admin | Resposta a cada missatge `admin:*`, amb `requestId` |
| `error` | El socket | JSON no vàlid o `type` desconegut |

## 7. SEGURETAT

- **JWT d'usuari.** `auth-service` signa un token de set dies amb `sub`, `username` i `rol`.
  `game-service`, `catalog-service` i `stats-service` el validen amb `jwt.verify` i
  `AUTH_SECRET`; el rol viatja dins el token.
- **Secret intern.** Les rutes `/internal/*` de `catalog-service` i `stats-service` exigeixen
  la capçalera `x-internal-secret` igual a `INTERNAL_SECRET`. El mateix secret protegeix
  `POST /stats/partides`.
- **`requireAdmin` als tres serveis.** `auth-service`, `catalog-service` i `stats-service`
  comproven el rol `admin` abans d'executar qualsevol ruta de `/internal/admin/*`.
  `game-service` fa de pasarel·la i reenvia el token de l'admin.
- **Token per convidat.** `createGuest()` genera un `guestSecret` que viatja dins
  `identity:confirmed`. `identity:declare` amb `type: "restore"` només recupera el convidat si
  l'`id` i el secret coincideixen; si no, en crea un de nou.
- **Avatar.** `PATCH /avatar` accepta només un enllaç `https://` o un `data:image/` de tipus
  png, jpeg, webp o gif. `GET /avatar/:id` respon amb `X-Content-Type-Options: nosniff`.
- **Límits del WebSocket.** `maxPayload` és de 64 KB i el text del xat es retalla a 200
  caràcters.

## 8. QUÈ NO ES DESA

| Dada | On viu | Per què |
|---|---|---|
| Xat de sala | Memòria (`room.chat`), màxim 50 missatges | És xat efímer; qui entra nou no veu res anterior |
| Estat «preparat» i configuració de sala | Memòria (`roomStorage.members`) | Només val mentre la sala existeix |
| Identitat i `guestSecret` dels convidats | Memòria (`guestStorage.guests`) | Un convidat no té compte; es netegen els que fa una hora que no es mouen |
| Puntuació de la partida en curs | Memòria (sales i `scoring.js`) | El resultat definitiu es publica en acabar |
| `ronda`, `resposta` i `participant` d'una partida acabada | Base de dades, només 15 segons | El resum queda a `partides`; la resta s'esborra per no créixer sense sostre |
| Token JWT i `guestSecret` al navegador | `localStorage` del client | No hi ha sessió al servidor; el token es valida a cada petició |

## 9. POSADA EN MARXA

```powershell
docker compose up -d
```

Això aixeca `mariadb` (3306), `phpmyadmin` (8081), `game-service` (3000), `catalog-service`
(3001), `auth-service` (3011), `stats-service` (3012) i `client-vue` (5173). La base de dades es
crea de zero la primera vegada amb `schema.sql` i `dades-inicials.sql`; per tornar-hi:

```powershell
docker compose down -v
docker compose up -d
```

`phpMyAdmin` és a <http://localhost:8081> i hi entra l'usuari `root` amb la contrasenya de
`MARIADB_ROOT_PASSWORD` del `docker-compose.yml`. El client Vue és a <http://localhost:5173>.
