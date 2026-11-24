# Frontend web Vue — `frontend/client-vue`

> Documentació basada en la lectura de **tot** `frontend/client-vue` (excepte `node_modules/` i `dist/`): `src/**`, `electron/main.js`, `package.json`, `package-lock.json` (només deps), `vite.config.js`, `index.html`, `Dockerfile`, `README.md`, `.gitignore` i `public/`. Contrastada amb el codi del `game-service` (WebSocket), els serveis HTTP `auth-service` (3011) i `stats-service` (3012), i el `docker-compose.yml` de l'arrel.
>
> No existeixen `jsconfig`, `.env`, `.env.*`, ni cap config de lint/test/format dins de `client-vue`.

---

## 1. Resum i responsabilitat

`client-vue` és el client web del joc **HowMuch**. És una SPA de Vue 3 que:

- Permet **registrar-se, verificar el correu, iniciar sessió o entrar com a convidat**.
- Manté la **identitat del jugador** (nickname, avatar, token JWT) a `localStorage`/`sessionStorage`.
- Es connecta per **WebSocket** al `game-service` per al lobby, sales, ronda, respostes, rànquing, xat i observació.
- Mostra el **panell d'administració** (dashboard en directe, gràfics, CRUD de preguntes/categories/usuaris, estadístiques), també sobre el mateix WebSocket.
- Consulta el **`stats-service` per HTTP** per al rànquing global i les estadístiques personals.

No conté lògica de joc: el backend és la font de veritat (preguntes, temps, puntuació, rols, estat de sala). El client només pinta l'estat que rep i envia intencions.

---

## 2. Stack i dependències

Versions reals instal·lades a `node_modules` (coincideixen amb `package.json`):

| Paquet | Versió | Ús |
|---|---|---|
| `vue` | 3.5.45 | Framework, `<script setup>`, Composition API |
| `vuetify` | 4.3.2 | Components UI (v-app, v-card, v-data-table, v-dialog, etc.) |
| `pinia` | 4.1.0 | Estat global (`game`, `admin`, `counter`) |
| `vue-router` | 5.4.0 | Rutes SPA amb `createWebHistory` |
| `chart.js` | 4.6.1 | Gràfics de línies del dashboard admin |
| `@mdi/font` | 7.4.47 | Icones Material Design |
| `vite` | 8.3.6 | Dev server i build |
| `@vitejs/plugin-vue` | 6.0.10 | Plugin SFC |

Altres característiques:

- **JavaScript pur**, sense TypeScript.
- **Vuetify en tema `dark`** (`primary: #7c4dff`, `secondary: #b388ff`, `indigo: #7c4dff`), amb alguns estils clars sobreposats a `HomeView` i `RoomView`.
- **Sense tests, lint ni formatador** al `package.json`.
- Existeix `electron/main.js` (finestra nativa que carrega el dev server), però **Electron no és cap dependència ni cap script** de `package.json`: no es pot executar amb el projecte tal com està (vegeu 7.3).
- `chart.js` és l'única dependència afegida específicament per al dashboard admin (gràfic de línies).

Versions comprovades a `node_modules` i `package-lock.json` el novembre de 2026.

---

## 3. Estructura de fitxers

```
frontend/client-vue/
├── index.html                  # Punt d'entrada HTML (lang="ca"), munta /src/main.js, títol "HowMuch"
├── package.json                # Scripts dev/build/preview i dependències (sense electron)
├── package-lock.json           # Lockfile npm (versions fixades)
├── vite.config.js              # Config mínima: només plugin Vue (sense proxy, alias ni server.port)
├── Dockerfile                  # node:22-alpine, npm ci, `npm run dev -- --host 0.0.0.0`, EXPOSE 5173
├── README.md                   # Stub: "En aquest directori hi anirà el client web fet amb Vue."
├── .gitignore                  # node_modules, dist
├── electron/
│   └── main.js                 # Finestra Electron 1200x800 que carrega http://localhost:5173 (no integrat)
├── public/
│   └── howmuch-cover.jpg       # Imatge de portada de HomeView (3:4, /howmuch-cover.jpg)
└── src/
    ├── main.js                 # Crea l'app, Pinia, router i Vuetify (tema dark) i munta a #app
    ├── App.vue                 # Component arrel: <v-app><v-main><router-view/>
    ├── router/
    │   └── index.js            # Rutes i guard global (admin i usuaris autenticats)
    ├── services/
    │   ├── websocket.js        # Connexió WS, enviament/recepció de missatges, cues de peticions i admin
    │   ├── authApi.js          # HTTP auth-service: register, login, verify, resend, avatar, perfil, stats
    │   ├── statsApi.js         # HTTP stats-service: rànquing i estadístiques pròpies
    │   └── adminApi.js         # Envoltoris de les peticions admin:* sobre WebSocket
    ├── stores/
    │   ├── game.js             # Estat global del jugador, lobby, sala, ronda, xat, stats locals
    │   ├── admin.js            # Estat del panell admin i promesa authReady
    │   └── counter.js          # Store d'exemple, no s'importa enlloc (codi mort)
    ├── components/
    │   ├── PlayerAvatar.vue    # Avatar: imatge de /avatar/:id o inicial sobre color
    │   ├── PlayerProfile.vue   # Targeta de perfil, edició d'avatar i tancar sessió
    │   ├── RoomList.vue        # Llistat de sales amb filtre per nom i categoria
    │   ├── CreateRoomDialog.vue# Diàleg de creació de sala pública/privada
    │   ├── RoundSetup.vue      # Configuració de sala (categoria, dificultat, rondes, temps) i inici
    │   ├── RoundTimer.vue      # Compte enrere decoratiu basat en roundEndsAt
    │   ├── RoomRanking.vue     # Rànquing de ronda/final, compartit per jugador i observador
    │   └── admin/
    │       ├── AdminSidebar.vue    # Navegació lateral del panell (rep les seccions per props)
    │       ├── AdminTargeta.vue    # Targeta numèrica amb error opcional
    │       └── AdminUsageChart.vue # Gràfic Chart.js: línia actual sòlida + anterior discontínua
    └── views/
        ├── HomeView.vue        # Login, registre, verificació per codi i accés convidat
        ├── LobbyView.vue       # Llistat/entrada a sales, creació, perfil, nickname
        ├── RoomView.vue        # Marc de la sala: jugadors, xat, error, sortida, rejoin i sortida en desmuntar
        ├── PlayerRoomView.vue  # Vista del jugador: ready, pregunta, resultats, rànquing
        ├── ObserverRoomView.vue# Vista de l'observador: selecció de jugador i gameplay
        ├── StatsView.vue       # Rànquing global i estadístiques/historial personals
        └── admin/
            ├── AdminLayout.vue            # Barra + router-view, auth admin i estat en directe
            ├── AdminDashboardView.vue     # 4 targetes, selector de període i 2 gràfics d'ús
            ├── AdminSalesView.vue         # Taula de sales obertes (només lectura, via admin:live)
            ├── AdminPreguntesView.vue     # CRUD de preguntes
            ├── AdminCategoriesView.vue    # CRUD de categories
            ├── AdminUsuarisView.vue       # CRUD d'usuaris
            └── AdminEstadistiquesView.vue # Mètriques generals i per sala
```

No hi ha cap `.env`, `.env.example`, `jsconfig.json` ni `tsconfig.json`. `public/` només conté `howmuch-cover.jpg`.

---

## 4. Fluxos principals

### 4.1 Arrencada

1. `index.html` carrega `/src/main.js`.
2. `main.js` crea l'app, registra **Pinia**, el **router** i **Vuetify** (tema `dark`, tots els components i directives) i munta a `#app`.
3. `App.vue` només renderitza `<router-view />` dins de `<v-app>`/`<v-main>`.
4. El guard del router decideix la primera ruta:
   - `/admin*`: només si `localStorage.authRol === "admin"`; si no, `home`.
   - `lobby`, `room`, `stats`: només si existeix `localStorage.authUserId`; si no, `home`.
   - `home` amb `authUserId` i sense `?preview=1`: redirigeix a `lobby`.
5. `HomeView` fa `onMounted`: `getAvatarColorOptions()` retorna una **llista local hardcoded** (`#22c55e`, `#0ea5e9`, `#f97316`, `#a855f7`, no fa HTTP) i, si ja hi ha `authUserId` i no hi ha `?preview=1`, va a `/lobby`.

### 4.2 Login, registre i gestió del token

**Login** (`HomeView.handleLogin` → `authApi.loginUser`):

1. `POST http://localhost:3011/login` amb `{ "username": <email>, "password": <password> }`.
2. La resposta porta `userId`, `username`, `rol`, `token`, `user` (`id`, `name`, `email`, `avatarImage`, `avatarColor`).
3. El token es desa a `localStorage.authToken`.
4. `game.setAuthUser(user)` desa `authUserId`, `authUserEmail`, `authToken`, `avatarImage`, `avatarColor` i el nickname; si `rol === "admin"` desa `authRol = "admin"`, si no l'esborra.
5. Redirigeix: admin → `/admin`; resta → `/lobby`.

**Registre** (`handleRegister` → `registerUser`):

1. `POST /register` amb `{ username, email, password, avatarImage, avatarColor }`.
   - `avatarImage` és un **data URL base64** llegit amb `FileReader`; el client limita a 1,5 MB (`file.size > 1_500_000`) i accepta `png/jpeg/webp/gif`.
2. Si la resposta porta `requiresVerification`, es mostra el bloc de codi; `POST /verify` amb `{ email, code }` retorna el mateix format que el login i desa el token. En verificar, `setAuthUser` es crida amb l'avatar triat al formulari (encara que la resposta no el porti).
3. `POST /resend-code` amb `{ email }` per reenviar el codi (usa `pendingVerificationEmail`, que ve de `response.email` o de l'input normalitzat a minúscules).
4. Si el backend **no** exigeix verificació, només es mostra "Compte creat correctament." i l'usuari **no** queda autenticat: ha d'iniciar sessió a mà.

**Convidat** (`handleGuestAccess`):

- No fa cap crida HTTP. Crea localment `id: "guest-<timestamp>-<4 dígits>"`, `name: "Convidat<4 dígits>"`, sense token.
- `setAuthUser` desa `authUserId` (encara que sigui convidat) i **esborra** `authToken`.
- Va a `/lobby`; la identitat real de joc la confirma el `game-service` en el `identity:declare`.

**Tancar sessió** (`PlayerProfile.logout`): tanca el socket, `clearAuthUser()` (esborra `authToken`, `authRol`, nickname, guestId i reinicia les stats en memòria; les claus `howmuchUserStats:*` de `localStorage` **no** s'esborren), `resetGame()` i torna a `/`.

### 4.3 Lobby

1. `LobbyView.onMounted`: si no hi ha `authUserId`, torna a `/`; si n'hi ha, `initSocket()`, `requestRoomsList()` i `requestCatalogOptions()`.
2. El socket s'obre a `ws://localhost:3000`. En rebre `connection:stablished` el client envia `identity:declare`:
   - **restore** si hi ha `sessionStorage.guestId` i nickname (inclou `token` si existeix);
   - **new** en cas contrari.
3. En rebre `identity:confirmed`, `game.setConnection(identity)` desa `guestId` a `sessionStorage` i actualitza el nickname, i llavors es demanen de nou sales i catàleg.
4. Sales: `rooms:list` i `room:new`/`room:removed` mantenen `game.rooms`; `RoomList` filtra per nom i categoria, desactiva l'entrada si la sala és plena i, si la sala no és a `lobby`, el botó passa a "ENTRAR COM A ESPECTADOR" (el backend assigna `role: "observer"`).
5. Nickname: validació local `isNicknameValid()` amb `/^[a-zA-Z0-9_]{3,15}$/`; si hi ha connexió s'envia `nickname:update`, si no es desa localment.

### 4.4 Entrar i crear sala

**Entrar a una sala pública** (`handleJoinRoom`):

1. Comprova connexió i nickname.
2. `joinRoom(room.id, game.nickname)` → `room:join` amb `{ roomId, nickname, password: null }`.
3. Quan arriba `room:joined`, el store actualitza jugadors, host, estat, configuració i `isHost = guestId === hostId`.
4. La promesa es resol i es fa `router.push("/room")`.

**Entrar a una sala privada**:

- Codi de 6 dígits; `joinRoom(null, nickname, codi)` → `{ roomId: null, password: "123456" }`.
- El backend (`findPrivateRoomId`) resol el `roomId` a partir del password. Si no existeix, retorna `room:join:error`.

**Crear sala** (`CreateRoomDialog` → `LobbyView.handleCreateRoom`):

1. Validació local al diàleg: nom de 3–20 caràcters (`\p{L}`, `\p{N}`, espais, `_`), jugadors 2–20 i nickname `/^[a-zA-Z0-9_]{3,15}$/`. En obrir-se, el nom proposat és el nickname.
2. `LobbyView` repeteix la validació de connexió i de nickname abans de cridar `createRoom(nickname, maxPlayers, isPrivate, nameRoom)` → `room:create`.
3. `room:created` ja afegeix el creador a la sala (no cal `room:join`); el store fa `setRoom(...)` i `isHost = true`.
4. Es fa `setCreatedRoom(data)` i tot seguit `clearCreatedRoom()`; després `router.push("/room")`.

### 4.5 Sala de joc

`RoomView` és el marc:

- `onMounted`: si no hi ha `roomId`, torna a `/lobby`; si n'hi ha, `initSocket()` i `rejoinAfterRefresh()`.
- `rejoinAfterRefresh()` té un flag `rejoinTried` i només envia `room:join(game.roomId, game.nickname)` si hi ha `roomId`, cap jugador carregat i `game.connected`. Com que el muntatge pot passar abans de `identity:confirmed`, també s'executa des d'un `watch(game.connected)`. Si falla, `resetRoom()` i `/lobby`.
- Columnes: esquerra jugadors (host marcat com `KING`, rol `OBSERVADOR`, `TÚ`, comptador `readyCount/readyRequired`, i botó amb la contrasenya si la sala és privada), centre `PlayerRoomView` o `ObserverRoomView`, dreta xat amb autoscroll (només si l'usuari és a baix o acaba d'enviar).
- L'error mostrat és `error` local de la vista si n'hi ha, si no `game.errorMessage`.
- En rebre `room:players` s'actualitzen jugadors, host, estat del lobby i `isHost`.
- En rebre `room:state` amb `state: "lobby"` es neteja la partida (pregunta, resultats, rànquing, observació).

**Jugador** (`PlayerRoomView`):

- Sense pregunta i és host → `RoundSetup` (configuració + `INICIAR PARTIDA`).
- Sense pregunta i no és host → espera i botons `MARCAR-SE A PUNT` (`room:ready` amb `!myReady`) i `SORTIR DE LA SALA` (emet `leave`).
- Amb pregunta i `screen === "round"` → text, dificultat, `RoundTimer`, camp numèric i `ENVIAR` (`answer:submit`).
- En rebre `round:results` → encert/error, explicació, resposta correcta, punts de ronda i totals.
- En rebre `round:ranking` → `RoomRanking`; el host pot enviar `round:next` si `round < totalRounds`.
- En rebre `game:finished` → rànquing final.

**Observador** (`ObserverRoomView`):

- No rep mai pregunta ni resultats (el backend només li envia `round:spectator`).
- Pot triar un jugador i enviar `observer:select`; mostra el `gameplay` que arribi per `gameplay:update`.
- **Atenció:** el `game-service` actual no té handler per a `observer:select` ni `gameplay:update` (vegeu riscos).

### 4.6 Sortir de sala i botó enrere

- **Sortir explícit**: `handleLeaveRoom` → `leaveRoom(roomId)` (`room:leave`); en resoldre's (`room:left`) → `resetGame()` i `router.push("/lobby")`. Si falla, l'error es mostra a la vista i no es navega.
- **Botó enrere / navegació fora de la vista**: `onBeforeUnmount(surtEnDesmuntar)` envia `leaveRoom(game.roomId)` **sense esperar** (`.catch` buit) i fa `resetGame()` si encara hi ha `roomId`. Com que `resetGame()` posa `roomId = null`, després d'una sortida explícita el desmuntatge no envia un segon `room:leave`. No hi ha `beforeRouteLeave` ni cap confirmació: el botó enrere del navegador abandona la sala igual que "SORTIR".
- **Refresh**: `sessionStorage.activeRoomId` i `sessionStorage.guestId` permeten reconstruir `roomId` i identitat; en connectar es fa `room:join` automàtic. El backend dona 10 s de gràcia (`GRACE_MS=10000`) abans d'expulsar un socket desconnectat, cosa que fa que el refresh normalment no perdi la plaça.

### 4.7 Panell d'administració

Entrada: login amb `rol === "admin"` → `/admin`, o navegació directa si `localStorage.authRol === "admin"`.

`AdminLayout` (setup, abans que els fills):

1. `initSocket()` (reutilitza el socket si ja està obert).
2. `adminAuth()` → `admin:auth` amb `{ token: localStorage.authToken }`.
3. Si `admin:auth:ok`: `admin.setAutenticat(true)`, `markAuthReady()` i `admin:live:get` per carregar l'estat inicial.
4. Si falla: `setAutenticat(false)`, `setErrorAuth(...)` i `router.push("/")`. **No es resol `authReady`**.

Els fills esperen `authReady` dins de `sendAdminRequest` abans d'enviar res (excepte `admin:auth`). Un cop autenticat, el servidor envia `admin:live` a tots els admins cada cop que canvia l'estat.

- **Dashboard** (`AdminDashboardView`): en muntar fa **dues peticions independents**: `admin:registre:get` amb `periode: "avui"` (un sol cop) i `admin:usage:get` amb el període triat (`dia|setmana|mes`). Les 4 targetes són "Jugadors ara" i "Partides en curs" (de `admin.jugadors`/`admin.partidesEnCurs`, alimentats per l'estat en directe) i "% encerts"/"% errors" (de `admin.registre`). El selector `v-btn-toggle` només refà `admin:usage:get`; els dos `AdminUsageChart` pinten `usage.usuaris` i `usage.partides` amb `etiquetaActual`/`etiquetaAnterior`. Ja no inclou la taula de sales.
- **Sales** (`AdminSalesView`): taula **només lectura** sobre `admin.sales` (`nom`, `categoria`, `jugadors`, `estat`). No fa cap petició pròpia: les dades arriben de l'`admin:live:get` del layout i dels `admin:live` posteriors.
- **Preguntes**: `admin:preguntes:list/create/update/delete`; formulari amb `categoria_id`, `text`, `resposta_correcta`, `unitat`, `dificultat` (`facil|media|dificil`), `explicacio`.
- **Categories**: `admin:categories:*` amb `nom` i `descripcio`.
- **Usuaris**: `admin:usuaris:*` amb `nom`, `email`, `password` (només en crear).
- **Estadístiques**: `admin:estadistiques:get` amb `sala` opcional; targetes `partides`, `jugadors`, `encerts` i taula per sala (`nom_sala`, `partides`, `jugadors`, `encerts`).

---

## 5. Contracte de comunicació

### 5.1 Rutes del router

`createWebHistory`, sense `meta`, sense ruta 404.

| Path | Name | Component | Guard / notes |
|---|---|---|---|
| `/` | `home` | `HomeView` | Si `authUserId` i no `?preview=1` → `/lobby` |
| `/lobby` | `lobby` | `LobbyView` | Requereix `localStorage.authUserId` |
| `/room` | `room` | `RoomView` | Requereix `authUserId`; la vista exigeix `game.roomId` |
| `/stats` | `stats` | `StatsView` | Requereix `authUserId` |
| `/admin` | — | `AdminLayout` | Requereix `authRol === "admin"` |
| `/admin` (fill buit) | — | `AdminDashboardView` | Hereda el guard per path |
| `/admin/sales` | — | `AdminSalesView` | Hereda el guard per path |
| `/admin/preguntes` | — | `AdminPreguntesView` | Hereda el guard per path |
| `/admin/categories` | — | `AdminCategoriesView` | Hereda el guard per path |
| `/admin/usuaris` | — | `AdminUsuarisView` | Hereda el guard per path |
| `/admin/estadistiques` | — | `AdminEstadistiquesView` | Hereda el guard per path |

El guard (`router.beforeEach`) és únic i fa servir el **path**, no `meta`:

```js
if (to.path === "/admin" || to.path.indexOf("/admin/") === 0) {
  if (localStorage.getItem("authRol") !== "admin") return next({ name: "home" });
  return next();
}
```

La resta de rutes (`/lobby`, `/room`, `/stats`) només exigeixen `localStorage.authUserId` no buit; `/` redirigeix a `/lobby` si hi ha `authUserId` i no hi ha `?preview=1`. Els fills d'`/admin` **no tenen `name`** (només `path`), i no hi ha cap ruta 404: un path desconegut deixa la SPA buida.

El guard és **només de client**: l'autorització real d'admin la fa el `game-service` verificant el JWT (`admin:auth`).

### 5.2 Missatges WebSocket que ENVIA el client

Tots són JSON amb un camp `type`. La connexió és única i compartida per joc i admin.

| `type` | Payload d'exemple | Quan s'envia | Resposta esperada |
|---|---|---|---|
| `identity:declare` | `{"type":"identity:declare","identity":{"type":"restore","id":"g-123","nickname":"Ana","token":"eyJ..."}}` (o `{"type":"new","nickname":"Ana"}` sense `guestId`) | En rebre `connection:stablished` | `identity:confirmed` |
| `rooms:list` | `{"type":"rooms:list"}` | En muntar lobby, en confirmar identitat i en tornar del joc | `rooms:list` |
| `catalog:options` | `{"type":"catalog:options"}` | En muntar lobby i `RoundSetup` si no hi ha catàleg | `catalog:options` |
| `room:create` | `{"type":"room:create","nickname":"Ana","maxPlayers":8,"isPrivate":true,"nameRoom":"Sala Ana"}` | Crear sala | `room:created` / `room:create:error` |
| `room:join` | `{"type":"room:join","roomId":"sala-abc123","nickname":"Ana","password":null}` | Entrar a sala o rejoin | `room:joined` / `room:join:error` |
| `room:join` (privada) | `{"type":"room:join","roomId":null,"nickname":"Ana","password":"123456"}` | Entrar amb codi | `room:joined` / `room:join:error` |
| `room:leave` | `{"type":"room:leave","roomId":"sala-abc123"}` | Botó sortir o desmuntar la vista | `room:left` / `room:leave:error` |
| `room:ready` | `{"type":"room:ready","ready":true}` | Botó ready | `room:players` (broadcast) / `room:ready:error`. **La promesa no es resol mai** (vegeu notes) |
| `room:configuration` | `{"type":"room:configuration","configuration":{"category":"Història","difficulty":"media","maxPlayers":8,"rounds":5,"durationSeconds":20}}` | Guardar configuració (host) | `room:configuration:updated` / `room:configuration:error` |
| `game:start` | `{"type":"game:start"}` | Botó iniciar (host) | `room:state` + `round:started` |
| `answer:submit` | `{"type":"answer:submit","questionId":42,"answer":1969}` | Enviar resposta numèrica | `answer:ack` / `answer:error` |
| `round:next` | `{"type":"round:next"}` | Següent ronda (host) | `round:started` / `round:next:error` |
| `chat:message` | `{"type":"chat:message","text":"hola"}` | Enviar xat | `chat:message` (broadcast) / `chat:error` |
| `nickname:update` | `{"type":"nickname:update","nickname":"Ana_99"}` | Canviar nickname | `nickname:updated` / `nickname:error` |
| `observer:select` | `{"type":"observer:select","playerId":"g-456"}` | Observador tria jugador | **Cap handler al backend**; rep `error` genèric |
| `gameplay:update` | `{"type":"gameplay:update","gameplay":"196"}` | Cada canvi del camp de resposta del jugador | **Cap handler al backend**; rep `error` genèric |
| `admin:auth` | `{"type":"admin:auth","requestId":"adm-1-1700000000000","token":"eyJ..."}` | En entrar a `/admin` | `admin:auth:ok` / `admin:auth:error` |
| `admin:live:get` | `{"type":"admin:live:get","requestId":"adm-2-..."}` | Després de `admin:auth` | Resposta amb `jugadors`, `sales`, `partidesEnCurs` |
| `admin:preguntes:list` | `{"type":"admin:preguntes:list","requestId":"adm-..."}` | En muntar la vista | `preguntes` |
| `admin:preguntes:create` | `{"type":"admin:preguntes:create","requestId":"adm-...","dades":{"categoria_id":"1","text":"...","resposta_correcta":"1969","unitat":"any","dificultat":"facil","explicacio":"..."}}` | Desar nova pregunta | `pregunta` / error |
| `admin:preguntes:update` | `{"type":"admin:preguntes:update","requestId":"adm-...","id":42,"dades":{...}}` | Editar pregunta | `pregunta` / error |
| `admin:preguntes:delete` | `{"type":"admin:preguntes:delete","requestId":"adm-...","id":42}` | Esborrar pregunta | `ok` / error |
| `admin:categories:list` | `{"type":"admin:categories:list","requestId":"adm-..."}` | En muntar la vista | `categories` |
| `admin:categories:create` | `{"type":"admin:categories:create","requestId":"adm-...","dades":{"nom":"Història","descripcio":"..."}}` | Nova categoria | `categoria` / error |
| `admin:categories:update` | `{"type":"admin:categories:update","requestId":"adm-...","id":3,"dades":{...}}` | Editar categoria | `categoria` / error |
| `admin:categories:delete` | `{"type":"admin:categories:delete","requestId":"adm-...","id":3}` | Esborrar categoria | `ok` / error |
| `admin:usuaris:list` | `{"type":"admin:usuaris:list","requestId":"adm-..."}` | En muntar la vista | `usuaris` |
| `admin:usuaris:create` | `{"type":"admin:usuaris:create","requestId":"adm-...","dades":{"nom":"Ana","email":"a@b.c","password":"..."}}` | Nou usuari | `usuari` / error |
| `admin:usuaris:update` | `{"type":"admin:usuaris:update","requestId":"adm-...","id":7,"dades":{"nom":"Ana","email":"a@b.c"}}` | Editar usuari | `usuari` / error |
| `admin:usuaris:delete` | `{"type":"admin:usuaris:delete","requestId":"adm-...","id":7}` | Esborrar usuari | `ok` / error |
| `admin:registre:get` | `{"type":"admin:registre:get","requestId":"adm-...","periode":"avui"}` | Dashboard | `total`, `encerts`, `errors`, percentatges |
| `admin:usage:get` | `{"type":"admin:usage:get","requestId":"adm-...","periode":"dia"}` | Dashboard / canvi de període | `usage` |
| `admin:estadistiques:get` | `{"type":"admin:estadistiques:get","requestId":"adm-...","sala":""}` | Vista estadístiques | `general`, `sales` |

Notes:

- Els missatges de joc sense resposta (`game:start`, `round:next`, `chat:message`, `gameplay:update`) s'envien amb `sendMessage`; si el socket no és `OPEN`, es posa error al store.
- Les peticions amb resposta es guarden a `pendingRequests` **per `type`** (no per id), excepte les admin, que fan servir `requestId`.
- `requestId` admin: `"adm-<contador>-<Date.now()>"`, timeout de 10 s. `sendAdminRequest` accepta socket `CONNECTING` i envia quan arriba `open`.
- **`room:ready` no resol la seva promesa**: el handler de `room:ready:error` fa `setError` però no `rejectPending("room:ready")`, i no hi ha cap `resolvePending("room:ready")`. `setReady()` queda penjada i la seva entrada al `Map` s'elimina només en tancar el socket o en sobreescriure-la. A la UI no es nota perquè `PlayerRoomView` no fa `await`.

### 5.2.1 Funcions exportades de `services/websocket.js`

| Funció | Missatge | Claus resoltes a `pendingRequests` | Retorn |
|---|---|---|---|
| `initSocket()` | — | — | `undefined`; idempotent si `OPEN`/`CONNECTING` |
| `requestRoomsList()` | `rooms:list` | — (resposta tractada al switch) | `undefined` |
| `requestCatalogOptions()` | `catalog:options` (posa `catalogLoading=true`) | — | `undefined` |
| `submitAnswer(questionId, answer)` | `answer:submit` amb `Number()` i `answered=true` | `answer:submit` | Promesa; si falla, torna `answered=false` |
| `startRound()` | `game:start` (neteja error) | — | `undefined` |
| `nextRound()` | `round:next` (només si `isHost`) | — | `undefined` |
| `updateNickname(nickname)` | `nickname:update` | `nickname:update` | Promesa |
| `joinRoom(roomId, nickname, password=null)` | `room:join` | `room:join` i `room:join:private` | Promesa |
| `leaveRoom(roomId)` | `room:leave` | `room:leave` | Promesa |
| `setReady(ready)` | `room:ready` | `room:ready` (mai resolta) | Promesa |
| `updateConfiguration(configuration)` | `room:configuration` | `room:configuration` | Promesa |
| `sendChatMessage(text)` | `chat:message` (trim; buit = no envia) | — | `undefined` |
| `selectObservedPlayer(playerId)` | `observer:select` | `observer:select` | Promesa |
| `sendGameplayUpdate(gameplay)` | `gameplay:update` (només string) | — | `undefined` |
| `createRoom(nickname, maxPlayers, isPrivate, nameRoom)` | `room:create` (converteix `maxPlayers` a número) | `room:create` | Promesa |
| `sendAdminRequest(type, payload)` | `<type>` + `requestId` + camps del payload | `pendingAdmin` per `requestId` | Promesa amb timeout de 10 s |
| `disconnectSocket()` | — | — | Tanca el socket, `setDisconnected()` |

### 5.3 Missatges WebSocket que REP el client

| `type` | Payload d'exemple | Efecte al client |
|---|---|---|
| `connection:stablished` | `{"type":"connection:stablished","message":"Connexió establerta"}` | Envia `identity:declare` |
| `identity:confirmed` | `{"type":"identity:confirmed","identity":{"id":"g-123","type":"guest","nickname":"Ana"}}` | `setConnection`; desa `guestId` a `sessionStorage`; demana sales i catàleg |
| `identity:confirmed` (error) | `{"type":"identity:confirmed","error":"Camp identity obligatori"}` | `setError` |
| `catalog:options` | `{"type":"catalog:options","ok":true,"categories":["Història","Ciència"],"difficulties":["facil","media","dificil"]}` | `setCatalogOptions` |
| `catalog:options` (error) | `{"type":"catalog:options","ok":false,"reason":"No s'han pogut carregar les opcions del catàleg"}` | `setCatalogError` |
| `rooms:list` | `{"type":"rooms:list","ok":true,"rooms":[{"id":"sala-abc123","name":"Sala Ana","maxPlayers":8,"players":3,"category":"Història","state":"lobby","isPrivate":false}]}` | `setRooms` (filtra privades) |
| `room:new` | `{"type":"room:new","id":"sala-def456","name":"Nova","maxPlayers":6,"players":1,"category":"Mix","state":"lobby","isPrivate":false}` | `addRoom` si no és privada |
| `room:removed` | `{"type":"room:removed","roomId":"sala-abc123"}` | `removeRoom` |
| `room:created` | `{"type":"room:created","ok":true,"roomId":"sala-abc123","hostId":"g-123","nameRoom":"Sala Ana","category":"Mix","difficulty":"mix","rounds":5,"maxPlayers":8,"isPrivate":true,"password":"123456","players":[...],"state":"lobby","durationSeconds":20,"readyCount":1,"readyRequired":1,"canStart":true}` | `setPlayers`, `setLobbyState`, `setRoom`, `isHost`; resol `room:create` |
| `room:create:error` | `{"type":"room:create:error","ok":false,"reason":"..."}` | `setError`; rebutja `room:create` |
| `room:joined` | `{"type":"room:joined","ok":true,"roomId":"sala-abc123","nameRoom":"Sala Ana","isPrivate":false,"password":null,"category":"Mix","difficulty":"mix","rounds":5,"players":[...],"hostId":"g-123","maxPlayers":8,"role":"player","state":"lobby","durationSeconds":20,"readyCount":1,"readyRequired":1,"canStart":true}` | Actualitza lobby/sala; resol `room:join` |
| `room:join:error` | `{"type":"room:join:error","ok":false,"reason":"La sala és plena"}` | `setError`; rebutja `room:join` |
| `room:players` | `{"type":"room:players","roomId":"sala-abc123","nameRoom":"Sala Ana","maxPlayers":8,"category":"Mix","difficulty":"mix","rounds":5,"players":[...],"hostId":"g-123","state":"lobby","durationSeconds":20,"readyCount":2,"readyRequired":1,"canStart":true}` | Actualitza jugadors, host, lobby i `isHost` |
| `room:left` | `{"type":"room:left","ok":true,"roomId":"sala-abc123","players":[...]}` | Resol `room:leave` |
| `room:leave:error` | `{"type":"room:leave:error","ok":false,"reason":"..."}` | `setError`; rebutja `room:leave` |
| `room:ready:error` | `{"type":"room:ready:error","ok":false,"reason":"..."}` | `setError` |
| `room:configuration:updated` | `{"type":"room:configuration:updated","ok":true,"changed":["rounds"],"configuration":{"category":"Mix","difficulty":"mix","maxPlayers":8,"rounds":7,"durationSeconds":20,"state":"lobby"}}` | `setConfiguration`; resol `room:configuration` |
| `room:configuration:error` | `{"type":"room:configuration:error","ok":false,"reason":"Només el host pot canviar la configuració"}` | `setError`; rebutja |
| `room:state` | `{"type":"room:state","roomId":"sala-abc123","state":"playing"}` | `setRoomState`; si `lobby`, neteja partida |
| `round:started` | `{"type":"round:started","round":1,"totalRounds":5,"durationMs":20000,"question":{"id":42,"text":"En quin any...","min":1900,"max":2020,"step":1,"unit":"any","difficulty":"media"}}` | `startRound`: pregunta, `roundEndsAt`, `screen="round"` |
| `round:spectator` | `{"type":"round:spectator","roomId":"sala-abc123","round":2,"totalRounds":5,"phase":"question","remainingMs":15000,"durationMs":20000}` | `setSpectatorRound` (sense pregunta) |
| `round:results` | `{"type":"round:results","round":1,"totalRounds":5,"correctAnswer":1969,"unit":"any","explanation":"...","you":{"answer":1969,"roundPoints":100,"totalScore":100,"position":1}}` | `setResults`; `screen="result"`; actualitza stats locals |
| `round:ranking` | `{"type":"round:ranking","round":1,"totalRounds":5,"you":{"position":1,"totalScore":100},"ranking":[{"id":"g-123","nickname":"Ana","position":1,"score":100,"userId":7,"avatarColor":"#22c55e"}]}` | `setRanking`; `screen="ranking"` |
| `game:finished` | `{"type":"game:finished","roomId":"sala-abc123","you":{"position":1,"score":500},"ranking":[{"id":"g-123","nickname":"Ana","position":1,"score":500}]}` | `finishGame`; `screen="finished"`; compta partida |
| `answer:ack` | `{"type":"answer:ack","questionId":42}` | `answered=true`; resol `answer:submit` |
| `answer:error` | `{"type":"answer:error","message":"..."}` | `setError`; rebutja `answer:submit` |
| `round:error` | `{"type":"round:error","message":"No s'ha pogut actualitzar la partida."}` | `setError` |
| `round:next:error` | `{"type":"round:next:error","message":"..."}` | `setError` |
| `chat:message` | `{"type":"chat:message","senderId":"g-123","senderName":"Ana","text":"hola","timestamp":1700000000000,"system":false}` | `addChatMessage` (màxim 200) |
| `chat:error` | `{"type":"chat:error","message":"Necessites entrar a una sala..."}` | `setError` |
| `nickname:updated` | `{"type":"nickname:updated","nickname":"Ana_99"}` | `changeNickname`; resol `nickname:update` |
| `nickname:error` | `{"type":"nickname:error","message":"Aquest nom d'usuari ja existeix"}` | `setError`; rebutja |
| `error` | `{"type":"error","message":"Missatge enviat per el client no gestionable!"}` | `setError` |
| `observer:selected` | `{"type":"observer:selected","playerId":"g-456","nickname":"Bru"}` | `setObserverSelection`; resol `observer:select` — **el backend no l'envia** |
| `observer:select:error` | `{"type":"observer:select:error","reason":"..."}` | `setError`; rebutja — **el backend no l'envia** |
| `gameplay:update` | `{"type":"gameplay:update","playerId":"g-456","playerNickname":"Bru","gameplay":"196"}` | `setObservedGameplay` — **el backend no l'envia** |
| `admin:live` | `{"type":"admin:live","jugadors":12,"sales":[{"id":"sala-abc123","nom":"Sala Ana","jugadors":3,"estat":"lobby","categoria":"Mix"}],"partidesEnCurs":2}` | `admin.applyLive` |
| `admin:auth:ok` | `{"type":"admin:auth:ok","requestId":"adm-1-...","ok":true,"usuari":"admin"}` | Resol `admin:auth` |
| `admin:auth:error` | `{"type":"admin:auth:error","requestId":"adm-1-...","ok":false,"reason":"Token invalid o sense permisos"}` | Rebutja; `AdminLayout` torna a `/` |
| `admin:*` (resposta) | `{"type":"admin:preguntes:list","requestId":"adm-2-...","ok":true,"preguntes":[...]}` | Es casa pel `requestId` i resol/rebutja la promesa |

> `observer:selected`, `observer:select:error` i `gameplay:update` estan implementats al client però **no existeixen al backend actual**. El `game-service` respon a `observer:select` i `gameplay:update` amb `{"type":"error"}` perquè `messageRouter.js` no els reconeix.

### 5.4 Crides HTTP directes

No hi ha proxys de Vite ni cap client HTTP genèric; cada servei fa servir `fetch` directe.

**auth-service (base `VITE_AUTH_BASE_URL` o `http://localhost:3011`)**

| Mètode | Path | Body | Resposta usada |
|---|---|---|---|
| POST | `/register` | `{"username":"Ana","email":"a@b.c","password":"...","avatarImage":null,"avatarColor":"#22c55e"}` | `{ ok, requiresVerification, email, message }` |
| POST | `/login` | `{"username":"a@b.c","password":"..."}` | `{ ok, userId, username, rol, token, user:{id,name,email,avatarImage,avatarColor} }` |
| POST | `/verify` | `{"email":"a@b.c","code":"123456"}` | `{ ok, userId, username, token, user }` |
| POST | `/resend-code` | `{"email":"a@b.c"}` | `{ ok, email, message }` |
| PATCH | `/avatar` | `{"userId":7,"avatarImage":"data:image/png;base64,...","avatarColor":"#22c55e"}` + `Authorization: Bearer <token>` | `{ ok, user }` |
| GET | `/profile/:id` | — + `Authorization: Bearer <token>` | `{ ok, user }` (no s'usa a la UI) |
| GET | `/stats/:id` | — | `{ ok, gamesPlayed, gamesWon, answeredQuestions, correctAnswers, accuracyPercentage }` (no s'usa a la UI) |
| GET | `/avatar/:id` | — | Imatge binària o `404 {ok:false,reason}`; s'usa com a `src` a `PlayerAvatar` |

Funcions de `authApi.js`:

| Funció | Crida | Notes |
|---|---|---|
| `registerUser({name,email,password,avatarImage,avatarColor})` | `POST /register` (mapeja `name`→`username`) | Retorna el payload sencer |
| `loginUser({email,password})` | `POST /login` | Desa `payload.token` i **normalitza** a `{id,name,email,avatarImage,avatarColor,token,rol}` |
| `verifyEmailCode({email,code})` | `POST /verify` | Desa el token i normalitza igual que el login |
| `resendVerificationCode({email})` | `POST /resend-code` | Retorna el payload |
| `getAvatarColorOptions()` | **cap HTTP** | Retorna `["#22c55e","#0ea5e9","#f97316","#a855f7"]` hardcoded |
| `updateAvatar({userId,avatarImage,avatarColor})` | `PATCH /avatar` amb Bearer | Retorna `payload.user` |
| `getUserProfile(userId)` | `GET /profile/:id` amb Bearer | Retorna `payload.user`; **no s'usa** |
| `getUserStats(userId)` | `GET /stats/:id` **sense auth** | Normalitza a números; **no s'usa** |

`request()` d'`authApi` sempre envia `Content-Type: application/json` (també als GET), llegeix el JSON i, si `!response.ok`, llança `Error(payload.reason || payload.error.message || "S'ha produït un error inesperat")`. El token es llegeix de `localStorage.authToken` en el moment de la crida.

**stats-service (base `VITE_STATS_BASE_URL` o `http://localhost:3012`)**

| Mètode | Path | Auth | Resposta usada |
|---|---|---|---|
| GET | `/stats/ranking?limit=10` | — | `{ ok, ranking:[{posicioRanking,userId,username,avatarColor,partidesJugades,victories,podis,encertsTotals}] }` |
| GET | `/stats/me` | `Authorization: Bearer <token>` | `{ ok, perfil:{partidesJugades,victories,derrotes,podis,percentatgeVictories,mitjanaEncerts,categoriaMesJugada}, historial:[{nomSala,categoria,posicio,data}] }` |

`statsApi.js` només té dues funcions: `getRanking(limit = 10)` → `/stats/ranking?limit=<limit>` (sense auth) i `getMyStats(token)` → `/stats/me` (afegeix la capçalera només si `token` és truthy). Els errors es llancen amb `payload.error`. `StatsView` només crida `getMyStats` si hi ha `game.authToken`, perquè els convidats no tenen perfil.

**Admin**: no fa HTTP directe. Totes les operacions passen per WebSocket (`adminApi.js` → `sendAdminRequest`); el `game-service` fa les crides internes a catalog/auth/stats amb `x-internal-secret` i el token d'admin.

Funcions de `adminApi.js` (totes retornen la promesa de `sendAdminRequest`):

| Funció | `type` | Payload extra |
|---|---|---|
| `adminAuth()` | `admin:auth` | `token` de `localStorage.authToken` (mai `authReady`) |
| `adminLiveGet()` | `admin:live:get` | — |
| `adminPreguntesList()` | `admin:preguntes:list` | — |
| `adminPreguntesCreate(dades)` | `admin:preguntes:create` | `dades` |
| `adminPreguntesUpdate(id, dades)` | `admin:preguntes:update` | `id`, `dades` |
| `adminPreguntesDelete(id)` | `admin:preguntes:delete` | `id` |
| `adminCategoriesList()` | `admin:categories:list` | — |
| `adminCategoriesCreate(dades)` | `admin:categories:create` | `dades` |
| `adminCategoriesUpdate(id, dades)` | `admin:categories:update` | `id`, `dades` |
| `adminCategoriesDelete(id)` | `admin:categories:delete` | `id` |
| `adminUsuarisList()` | `admin:usuaris:list` | — |
| `adminUsuarisCreate(dades)` | `admin:usuaris:create` | `dades` |
| `adminUsuarisUpdate(id, dades)` | `admin:usuaris:update` | `id`, `dades` |
| `adminUsuarisDelete(id)` | `admin:usuaris:delete` | `id` |
| `adminRegistreGet(periode)` | `admin:registre:get` | `periode` |
| `adminUsageGet(periode)` | `admin:usage:get` | `periode` |
| `adminEstadistiquesGet(sala)` | `admin:estadistiques:get` | `sala` |

### 5.5 Estat global Pinia

#### `useGameStore` (`stores/game.js`)

**Jugador i connexió**

| Camp | Origen |
|---|---|
| `nickname` | `localStorage.nickname`, `identity:confirmed`, `nickname:updated` |
| `authUserId`, `authUserEmail`, `authToken` | `localStorage`, `setAuthUser` |
| `avatarImage`, `avatarColor` | `localStorage`, `setAuthUser`, `setAvatarValue` |
| `guestId` | `sessionStorage.guestId`, `setConnection` |
| `connected`, `connectionInfo` | `setConnection` / `setDisconnected` |

**Lobby i sala**

`rooms` (`rooms:list`, `room:new`, `room:removed`), `roomId` (`sessionStorage.activeRoomId`, `setRoom`, `room:state`), `roomName`, `players`, `hostId`, `roomPassword`, `isPrivateRoom`, `roomState`, `configuration`, `readyCount`, `readyRequired`, `canStart`, `createdRoom` (només l'omple `LobbyView` i l'esborra tot seguit).

**Catàleg**: `categories`, `difficulties`, `catalogError`, `catalogLoading` (inicialment `true`; `requestCatalogOptions` el posa a `true` i la resposta el baixa).

**Partida**: `questions`, `currentQuestionIndex`, `errorMessage`, `currentQuestion`, `roundEndsAt`, `currentRound`, `totalRounds`, `answered`, `results`, `ranking`, `screen` (`round|result|ranking|finished`), `isHost`, `spectatorPhase`, `observedPlayerId`, `observedPlayerNickname`, `observedGameplay`, `chatMessages`, i els interns `hasCountedCurrentGame` i `currentStatsKey`.

**Stats locals**: `userStats` (`gamesPlayed`, `gamesWon`, `answeredQuestions`, `correctAnswers`, `lastUpdatedAt`), `accuracyPercentage`, clau `howmuchUserStats:<userId>` a `localStorage`. S'alimenten de `round:results` (resposta no nul·la) i `game:finished` (una sola vegada per partida gràcies a `hasCountedCurrentGame`).

**Computed**: `myPlayer` (jugador amb `id === guestId`), `isObserver` (`myPlayer.role === "observer"`), `accuracyPercentage` (0 si no ha respost).

**Accions**: `setConnection`, `setDisconnected`, `setAuthUser`, `clearAuthUser`, `changeNickname`, `setAvatarValue`, `setRooms`, `addRoom`, `removeRoom`, `setRoom`, `setPrivateRoom`, `setPlayers`, `setLobbyState`, `setRoomState`, `setConfiguration`, `resetRoom`, `resetGame`, `setCreatedRoom`, `clearCreatedRoom`, `setCatalogOptions`, `setCatalogError`, `setCatalogLoading`, `setQuestions`, `startRound`, `setResults`, `setRanking`, `setSpectatorRound`, `finishGame`, `setObserverSelection`, `setObservedGameplay`, `clearObserverTracking`, `addChatMessage`, `clearChatMessages`, `setError`, `clearError`.

`setRoom` desa `activeRoomId` a `sessionStorage` i buida el xat; `setPlayers` també neteja el seguiment de l'observat si el jugador observat ja no és a la sala o ha deixat de ser `player`; `resetGame` crida `resetRoom`.

#### `useAdminStore` (`stores/admin.js`)

| Camp | Alimentat per |
|---|---|
| `autenticat`, `errorAuth` | `admin:auth:ok` / error |
| `jugadors`, `sales`, `partidesEnCurs`, `errorDirecte` | `admin:live`, `admin:live:get` |
| `preguntes`, `errorPreguntes` | `admin:preguntes:list` |
| `categories`, `errorCategories` | `admin:categories:list` |
| `usuaris`, `errorUsuaris` | `admin:usuaris:list` |
| `general`, `salesStats`, `errorEstadistiques` | `admin:estadistiques:get` |
| `registre`, `errorRegistre` | `admin:registre:get` |
| `usage`, `errorUsage` | `admin:usage:get` |
| `authReady` | Promesa que es resol amb `markAuthReady()` |

`authReady` s'usa per bloquejar les peticions filles fins que el canal ha passat `admin:auth`. Accions: `setAutenticat`, `setErrorAuth`, `applyLive`, `setErrorDirecte`, `setPreguntes`, `setErrorPreguntes`, `setCategories`, `setErrorCategories`, `setUsuaris`, `setErrorUsuaris`, `setEstadistiques`, `setErrorEstadistiques`, `setRegistre`, `setErrorRegistre`, `setUsage`, `setErrorUsage`, `markAuthReady`.

`applyLive` s'executa **dues vegades** en entrar: una amb la resposta d'`admin:live:get` (que `AdminLayout` aplica explícitament) i una altra si el servidor envia `admin:live`; és idempotent.

#### `useCounterStore`

Store d'exemple (`count`, `doubleCount`, `increment`). **No s'importa enlloc**.

### 5.6 Claus de `localStorage` i `sessionStorage`

| Claus | Emmagatzematge | Qui l'escriu | Qui la llegeix / esborra |
|---|---|---|---|
| `nickname` | `localStorage` | `changeNickname`, `setConnection` | Store a l'inici; `clearAuthUser` |
| `authUserId`, `authUserEmail`, `authToken`, `avatarImage`, `avatarColor` | `localStorage` | `setAuthUser`, `setAvatarValue`, `authApi.storeToken` | Store a l'inici, `authApi`, guard, `clearAuthUser` |
| `authRol` | `localStorage` | `setAuthUser` (`"admin"` només si `rol === "admin"`) | Guard del router; `clearAuthUser` |
| `howmuchUserStats:<userId>` | `localStorage` | `persistUserStats` | `loadUserStats`; no s'esborra a `clearAuthUser` |
| `guestId` | `sessionStorage` | `setConnection` | `declareIdentity` (restore); `clearAuthUser` |
| `activeRoomId` | `sessionStorage` | `setRoom` | Store a l'inici (rejoin); `resetRoom`, `resetGame` |
| `avatar` | `localStorage` | **ningú** | `clearAuthUser` el crida `removeItem` (clau llegada) |

### 5.7 Components: props, emits i on s'usen

| Component | Props | Emits | On s'usa |
|---|---|---|---|
| `PlayerAvatar.vue` | `nickname:String="?"`, `userId:Number=null`, `color:String=null`, `size:Number=32` | — | `RoomView` (llista de jugadors), `ObserverRoomView` (selector), `RoomRanking` (cada entrada), `StatsView` (rànquing) |
| `PlayerProfile.vue` | — | `edit-nickname` | `LobbyView` (columna dreta). Fa `PATCH /avatar` i el logout |
| `RoomList.vue` | `rooms:Array` (obligatori), `joiningRoomId:String=null`, `disabled:Boolean=false`, `categories:Array=[]` | `join(room)` | `LobbyView` |
| `CreateRoomDialog.vue` | `dialog:Boolean=false`, `loading:Boolean=false`, `error:String=""`, `isPrivate:Boolean=false` | `create({maxPlayers,isPrivate,nameRoom})`, `close`, `update:dialog` | `LobbyView` amb `v-model:dialog` |
| `RoundSetup.vue` | `canStart:Boolean=false`, `configuration:Object=null` | `save(configuration)`, `start` | `PlayerRoomView` quan ets host i no hi ha pregunta |
| `RoundTimer.vue` | `endsAt:Number=0` | — | `PlayerRoomView` (ronda) i `ObserverRoomView` (si `roundEndsAt > 0`) |
| `RoomRanking.vue` | `ranking:Array=[]`, `you:Object=null`, `title:String="RÀNQUING"`, `spectator:Boolean=false`; slot per defecte | — | `PlayerRoomView` (ronda i final) i `ObserverRoomView` (ronda i final, amb `spectator`) |
| `admin/AdminSidebar.vue` | `seccions:Array` (obligatori) | — | `AdminLayout` (les 6 seccions amb `ruta` i `icona`) |
| `admin/AdminTargeta.vue` | `titol:String` (obligatori), `valor:String\|Number=0`, `error:String=""` | — | `AdminDashboardView` (4 targetes; si hi ha `error`, amaga el valor) |
| `admin/AdminUsageChart.vue` | `titol:String` (obligatori), `etiquetaActual:String=""`, `etiquetaAnterior:String=""`, `actual:Array=[]`, `anterior:Array=[]` | — | `AdminDashboardView` (usuaris i partides) |

`AdminUsageChart` registra a Chart.js només `LineController`, `LineElement`, `PointElement`, `LinearScale`, `CategoryScale`, `Tooltip` i `Legend`; pinta la sèrie actual en blau sòlid (`#1867C0`) i l'anterior en gris discontinu (`#9E9E9E`, `borderDash:[6,4]`), amb llegenda a baix i eix Y començant a zero. Reconstrueix el gràfic amb `watch` sobre `actual`/`anterior` (destrueix el previ) i el destrueix a `onBeforeUnmount`. Les etiquetes X són `1h…24h` si hi ha 24 punts i `D1…Dn` en cas contrari.

---

## 6. Com es comunica amb el backend

### 6.1 URL base

| Canal | URL | Configurable |
|---|---|---|
| WebSocket joc + admin | `ws://localhost:3000` **hardcoded** a `services/websocket.js` | **No** |
| auth-service | `import.meta.env.VITE_AUTH_BASE_URL` o `http://localhost:3011` | Sí |
| stats-service | `import.meta.env.VITE_STATS_BASE_URL` o `http://localhost:3012` | Sí |

No hi ha cap `VITE_WS_URL`, ni fitxer `.env`/`.env.example` dins de `client-vue`. Els únics `VITE_*` que llegeix el codi són `VITE_AUTH_BASE_URL` i `VITE_STATS_BASE_URL`.

El `docker-compose.yml` publica els ports `3000` (game, via `${PORT}` = `PORT=3000` al seu `.env`), `3011` (auth), `3012` (stats) i `5173` (client), de manera que els `localhost` funcionen en desenvolupament local, però **no** en un desplegament remot ni darrere d'un domini.

### 6.2 Cicle de connexió

1. `initSocket()` és idempotent: si ja hi ha un socket `OPEN` o `CONNECTING`, no en crea cap altre.
2. En obrir-se, espera `connection:stablished` i llavors declara identitat.
3. En rebre `identity:confirmed`, demana `rooms:list` i `catalog:options`.
4. `onclose`: `setDisconnected()`, rebutja totes les peticions pendents de joc i admin. **No hi ha reconnexió automàtica, ni backoff, ni heartbeat.**
5. Un nou `initSocket()` només es farà en tornar a muntar `LobbyView`, `RoomView` o `AdminLayout`; si l'usuari es queda a la mateixa vista, la UI queda desconnectada.

### 6.3 Gestió d'errors

- **Joc**: errors del servidor arriben com a `error`, `chat:error`, `round:error`, `room:*:error`, `nickname:error`, `answer:error` i es guarden a `game.errorMessage`; es mostren com a `v-alert` a `RoomView` (via `visibleError`). Al lobby **no** es pinta `game.errorMessage`: només els errors locals i `game.catalogError`.
- **Peticions amb resposta**: els errors rebutgen la promesa sovint amb un **string** (`reason`), no amb un `Error`; les vistes fan `error.value = reason`.
- **Admin**: els errors es rebutgen amb `new Error(reason)` i es guarden al camp d'error corresponent del store; el panell els pinta com a alertes.
- **HTTP auth/stats**: `request()` llegeix el JSON i, si `!response.ok`, llança `Error(payload.reason || payload.error.message || "S'ha produït un error inesperat")`; `statsApi` fa servir `payload.error`.
- **Timeout**: només les peticions admin tenen timeout (10 s). Les de joc no en tenen i poden quedar penjades si el servidor no respon.

---

## 7. Configuració i arrencada

### 7.1 Comandes reals

```bash
cd frontend/client-vue
npm install          # o npm ci
npm run dev          # vite
npm run build        # vite build -> dist/
npm run preview      # vite preview
```

- **Port de desenvolupament**: el de Vite per defecte, `5173` (no hi ha `server.port` a `vite.config.js`).
- **Preview**: `vite preview` serveix `dist/` al port per defecte `4173`.
- **Proxy**: **no n'hi ha**. El navegador crida directament `ws://localhost:3000`, `http://localhost:3011` i `http://localhost:3012`.
- **Build**: `vite build` genera `dist/`; el `Dockerfile` no el fa servir, executa el dev server. Les variables `VITE_*` s'inlinen en el moment del build/dev, no es llegeixen en runtime.

### 7.2 Docker

`Dockerfile`:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

`docker-compose.yml` publica `5173:5173` i declara dependències de `game-service`, `catalog-service` i `stats-service` (no d'`auth-service`), però **el client no configura cap URL per entorn**: el contenidor només executa el dev server. Els ports que el navegador necessita són `3000` (game; al compose surt com `${PORT}:${PORT}` i `backend/game-service/.env` fixa `PORT=3000`), `3011` (auth) i `3012` (stats). El catàleg (3001) no es crida des del navegador.

### 7.3 Electron (`electron/main.js`)

Fitxer únic de 31 línies, **fora de `src/`** i no inclòs al build de Vite:

```js
import { app, BrowserWindow } from 'electron'

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  ventana.loadURL('http://localhost:5173')
}

app.whenReady().then(() => {
  crearVentana()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) crearVentana()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- Obre una finestra de 1200×800 que **carrega el dev server** (`http://localhost:5173`), no fitxers de `dist/`.
- `nodeIntegration: false` i `contextIsolation: true` (configuració segura per defecte); **no hi ha `preload`** ni cap IPC, per tant la pàgina no té accés a Node.
- Gestiona `activate` (macOS) i tanca l'app en tancar l'última finestra excepte a macOS.
- **No està integrat**: `package.json` no té `electron` a `dependencies`/`devDependencies`, ni camp `main`, ni script `electron`. Per fer-lo servir cal instal·lar Electron, afegir `"main": "electron/main.js"` i un script (p. ex. `electron .`), i tenir el `npm run dev` en marxa. El fitxer usa `import` (coherent amb `"type": "module"`), cosa que exigeix una versió d'Electron amb suport ESM al procés principal.
- No hi ha empaquetat (electron-builder/forge), icona ni config de producció.

### 7.4 Variables d'entorn

| Variable | On es llegeix | Valor per defecte |
|---|---|---|
| `VITE_AUTH_BASE_URL` | `services/authApi.js`, `components/PlayerAvatar.vue` | `http://localhost:3011` |
| `VITE_STATS_BASE_URL` | `services/statsApi.js` | `http://localhost:3012` |

No hi ha variables per al WebSocket ni per al catàleg. Com que no existeix cap `.env`, els valors per defecte són els que s'apliquen sempre; per canviar-los cal exportar les variables a la shell (o al `environment:` del servei `client-vue` al compose) **abans** de `npm run dev`/`npm run build`.

---

## 8. Fitxers clau

Inventari complet (tots els fitxers del projecte excepte `node_modules/` i `dist/`):

| Path | Responsabilitat |
|---|---|
| `index.html` | HTML únic (`lang="ca"`, `#app`, mòdul `/src/main.js`, títol "HowMuch") |
| `package.json` | Scripts `dev`/`build`/`preview`, deps (Vue, Vuetify, Pinia, Router, Chart.js, MDI) i devDeps (Vite, plugin Vue) |
| `package-lock.json` | Lockfile npm; fixa les versions instal·lades |
| `vite.config.js` | Només `plugins: [vue()]`; sense proxy, alias, `server.port` ni `base` |
| `Dockerfile` | Imatge de desenvolupament `node:22-alpine`; `npm ci` i dev server a `0.0.0.0:5173` |
| `README.md` | Stub d'una línia (text mal codificat al fitxer) |
| `.gitignore` | Ignora `node_modules` i `dist` |
| `public/howmuch-cover.jpg` | Portada de `HomeView` (`/howmuch-cover.jpg`, proporció 3:4) |
| `electron/main.js` | Finestra Electron 1200×800 sobre `localhost:5173`, sense preload ni empaquetat (7.3) |
| `src/main.js` | Bootstrap: Pinia, router, Vuetify dark (`#7c4dff`) i muntatge a `#app` |
| `src/App.vue` | Layout arrel `<v-app><v-main><router-view/></v-main></v-app>` |
| `src/router/index.js` | 4 rutes públiques + `/admin` amb 6 fills i guard per path |
| `src/services/websocket.js` | Nucli de comunicació: socket, enviament, recepció, cues, admin, identitat |
| `src/services/authApi.js` | Login/registre/verificació/avatar/perfil/stats i desat del token |
| `src/services/statsApi.js` | Rànquing global i estadístiques personals per HTTP |
| `src/services/adminApi.js` | 17 envoltoris de peticions `admin:*` sobre WS |
| `src/stores/game.js` | Estat global del joc, lobby, sala, ronda, xat i stats locals |
| `src/stores/admin.js` | Estat del panell i `authReady` |
| `src/stores/counter.js` | Store d'exemple, sense ús |
| `src/views/HomeView.vue` | Login, registre, verificació per codi i accés convidat |
| `src/views/LobbyView.vue` | Sales, creació pública/privada, entrada, perfil i nickname |
| `src/views/RoomView.vue` | Marc de sala, xat, sortida explícita, rejoin i sortida en desmuntar |
| `src/views/PlayerRoomView.vue` | Flux de joc del jugador: ready, pregunta, resultats, rànquing |
| `src/views/ObserverRoomView.vue` | Flux de l'observador i panell de "gameplay" |
| `src/views/StatsView.vue` | Rànquing global i historial/mètriques personals |
| `src/views/admin/AdminLayout.vue` | Autenticació admin, estat en directe i navegació |
| `src/views/admin/AdminDashboardView.vue` | 4 targetes, selector dia/setmana/mes i 2 gràfics |
| `src/views/admin/AdminSalesView.vue` | Taula de sales obertes (només lectura) |
| `src/views/admin/AdminPreguntesView.vue` | CRUD de preguntes |
| `src/views/admin/AdminCategoriesView.vue` | CRUD de categories |
| `src/views/admin/AdminUsuarisView.vue` | CRUD d'usuaris |
| `src/views/admin/AdminEstadistiquesView.vue` | Mètriques generals i per sala |
| `src/components/PlayerAvatar.vue` | Avatar per imatge HTTP o inicial sobre color |
| `src/components/PlayerProfile.vue` | Targeta de perfil, avatar i logout |
| `src/components/RoomList.vue` | Llistat de sales amb filtres |
| `src/components/CreateRoomDialog.vue` | Diàleg de creació de sala |
| `src/components/RoundSetup.vue` | Formulari de configuració i inici de partida |
| `src/components/RoundTimer.vue` | Compte enrere decoratiu |
| `src/components/RoomRanking.vue` | Rànquing reutilitzable (jugador/observador) |
| `src/components/admin/AdminSidebar.vue` | Navegació lateral del panell |
| `src/components/admin/AdminTargeta.vue` | Targeta numèrica amb error |
| `src/components/admin/AdminUsageChart.vue` | Gràfic Chart.js actual vs anterior |

---

## 9. Riscos i punts febles

Ordenats per impacte:

1. **Observador i `gameplay` no funcionen contra el backend actual.** El client envia `observer:select` i `gameplay:update`, i espera `observer:selected`/`gameplay:update`; el `game-service` no té cap handler per aquests tipus i respon amb `{"type":"error","message":"Missatge enviat per el client no gestionable!"}`. Resultat: l'observador no pot seleccionar ningú i veu un error; a més, cada tecla del jugador genera un error al store (`setError`) que pot tapar missatges reals.
2. **URL del WebSocket hardcoded** (`ws://localhost:3000`). Impedeix desplegaments remots, HTTPS (mixed content) i configuració per entorn; el `Dockerfile` i el compose no ho resolen perquè el WS s'executa al navegador.
3. **Sense reconnexió ni heartbeat.** `onclose` només marca desconnectat; no hi ha reintents ni refresc de la identitat. Si el socket cau, l'usuari ha de refrescar o canviar de vista. A l'admin, `autenticat` i `authReady` queden en estat antic: el socket nou no s'autentica i totes les peticions responen "Cal autenticar-se com a admin".
4. **`pendingRequests` indexat només per `type`.** Dues peticions del mateix tipus (per exemple, dos `room:join` o dos `room:configuration`) sobreescriuen la promesa anterior, que queda penjada; a més, no hi ha timeout per a les peticions de joc.
5. **`authReady` no es resol mai si `admin:auth` falla.** Les peticions filles queden esperant i només acaben pel timeout de 10 s; el timeout comença a comptar abans de l'autenticació, de manera que un `admin:auth` lent fa caducar peticions encara no enviades.
6. **Token JWT a `localStorage`.** Qualsevol XSS pot exfiltrar-lo; no hi ha `HttpOnly` ni cap rotació/refresh. El token també es desa al store i s'envia a `identity:declare`.
7. **El guard de rutes és només de client.** `authRol` a `localStorage` decideix si es pot entrar a `/admin`; un usuari pot manipular-lo i veure la UI (el backend sí que bloqueja les operacions). També es pot veure el panell un instant abans que `admin:auth` falli.
8. **La confirmació de sala creada no es veu mai.** `LobbyView` fa `setCreatedRoom(data)` i tot seguit `clearCreatedRoom()` abans de navegar, i el bloc de `CreateRoomDialog` que mostra ID i contrasenya depèn de `game.createdRoom`; queda com a codi mort. La contrasenya sí que es pot copiar des de `RoomView`.
9. **Codi mort i duplicacions.** `stores/counter.js` no s'usa; `setQuestions`, `setPrivateRoom` i `getUserProfile`/`getUserStats` (auth) no s'usen; el `return` de `game.js` repeteix claus (`currentQuestionIndex`, `answered`, `startRound`, etc.), cosa que dificulta mantenir el store.
10. **Xat no persistent.** Els missatges només viuen al store; un refresh o una reentrada no recupera l'historial. El backend envia un missatge de sistema en entrar/sortir, però no fa replay.
11. **Stats duplicades i inconsistents.** `authApi.getUserStats` (`GET /stats/:id` a 3011) i `statsApi.getMyStats` (`GET /stats/me` a 3012) cobreixen funcions semblants; la UI només usa el segon. A més, `StatsView` etiqueta `derrotes` com a `partides - victòries` (el backend ho calcula així), no com a posicions no guanyadores.
12. **Avatars en base64 a `localStorage` i a la BD.** El límit client és 1,5 MB i el servidor 2,2 MB; un avatar gran pot ocupar bona part de la quota de `localStorage` (~5 MB) i engreixa les respostes de login/perfil.
13. **Resolució de respostes fràgil.** `Number(rawAnswer)` rebutja el separador decimal català (`,`), i el camp és text: un usuari pot escriure `1.969` o `1,969` i obtenir error o un valor inesperat.
14. **Sense ruta 404 ni gestió d'error global de router.** Un path desconegut deixa la SPA buida; un error de càrrega de component no té fallback.
15. **Registre depèn del correu.** Si el SMTP de l'auth-service no està configurat, el registre queda bloquejat en la verificació; el client no ofereix cap camí alternatiu.
16. **Estils i accessibilitat.** Barreja de tema fosc global amb barres blanques a `RoomView`; poc contrast en alguns textos; els botons de color d'avatar no tenen etiqueta textual (només color), i el xat no té regió `aria-live`.
17. **`setReady()` no s'assabenta mai del resultat.** `room:ready:error` no fa `rejectPending("room:ready")` i no hi ha cap `resolvePending` per a aquest tipus: la promesa queda pendent i l'entrada al `Map` només desapareix en tancar el socket o en sobreescriure-la. Avui no es nota perquè la vista no espera la promesa, però qualsevol `await setReady()` es penjaria.
18. **Electron no és executable amb el projecte actual.** `electron/main.js` existeix, però falta la dependència `electron`, el camp `main` i un script; a més carrega el dev server (`localhost:5173`) i no hi ha empaquetat ni `preload`. És codi latent, no una via de distribució.
19. **Els comptadors de jugadors del lobby queden desfasats.** `room:players` només actualitza la sala pròpia; la llista `rooms` només es refresca amb `rooms:list` (en confirmar identitat o en remuntar el lobby), de manera que `players/maxPlayers` de les altres sales pot ser vell i el botó "PLENA" pot enganyar.
