# Client Unity (`frontend/client-unity`)

> Documentació tècnica del client Unity del projecte **TR1 DAM Equip 6**.
>
> - **Data:** 2026-11-21
> - **Abast:** tot `Assets/` (24 fitxers `.cs`, UXML, USS, escena), `ProjectSettings/`, `Packages/manifest.json`, `README.md` del client i contrast amb `backend/game-service/src/` (`messageRouter.js` i handlers). S'ignoren `Library/`, `Temp/`, `Obj/`, `obj/`, `Logs/`, `Build/`, `Builds/`, `UserSettings/`, `.vs/`, `PackageCache` i la resta de `Packages/`.
> - **Font:** anàlisi estàtica del codi del repositori; **no s'ha executat Unity**. Quan una cosa no es pot deduir del codi, s'indica **no verificat** o **no determinat**.

---

## 1. Resum i responsabilitat del client Unity

El client Unity és una aplicació d'escriptori (Windows/macOS/Linux, editor i build) per jugar a un joc de preguntes per rondes. És un client **prim**: no implementa regles de joc, puntuació ni validació de respostes; tot això ho decideix el `game-service`. La seva feina és:

- Mostrar el **lobby** amb la llista de sales públiques, filtres per nom/categoria i accés a sales privades per codi.
- Crear sales, entrar-ne, configurar-les (només l'amfitrió), marcar-se a punt, començar la partida i sortir.
- Mostrar la pregunta de cada ronda, el comptador, el resultat, el rànquing i el resultat final.
- Mostrar el xat de sala.
- Mantenir la identitat de convidat i el nickname mentre dura l'execució.
- Parlar amb el `game-service` per **WebSocket** i traduir JSON a events de C# i a canvis de UI.

**No** fa: login/registre, autenticació amb token, estadístiques, administració de catàleg, ni cap crida HTTP real. La pantalla de perfil existeix però no s'omple amb dades del servidor (vegeu §9).

Punt d'entrada únic: `AppBootstrap` a l'escena `Assets/Scenes/SampleScene.unity`.

---

## 2. Stack i versió d'Unity

| Element | Valor | Notes |
|---|---|---|
| Versió d'Unity | **6000.6.4f1** (revisió `12bfff696524`) | `ProjectSettings/ProjectVersion.txt` |
| Render pipeline | URP 17.6.0 | `com.unity.render-pipelines.universal` |
| UI | **UI Toolkit** (UXML/USS) | `com.unity.modules.uielements`; la UI del joc és 100 % UI Toolkit. El paquet `com.unity.ugui` 2.6.0 hi és com a dependència de la plantilla, però no es fa servir cap `Canvas`/component uGUI |
| JSON | **Newtonsoft.Json 3.2.2** | `com.unity.nuget.newtonsoft-json` |
| WebSocket | `System.Net.WebSockets.ClientWebSocket` | .NET/BCL; **no** Socket.IO, **no** paquet de tercers |
| Input | Input System 1.20.0 | `activeInputHandler: 2`; el joc no llegeix Input Actions directament |
| Test Framework | 1.8.0 | Instal·lat, però no hi ha tests a `Assets/` |
| IDE | Visual Studio 2.0.26 / Rider 3.0.38 | Paquets d'integració |
| 2D | `com.unity.feature.2d` 2.0.2 + mòduls 2D | Heretat de la plantilla 2D |
| Altres | Multiplayer Play Mode 3.0.0, Visual Scripting 1.9.12, Timeline 6.6.0 | No s'utilitzen al codi del joc |
| Perfil d'API | `apiCompatibilityLevel: 6` (.NET Standard 2.1) | `ProjectSettings/ProjectSettings.asset` |
| Backend de scripting | Mono per defecte; només Android definit a IL2CPP (`scriptingBackend.Android: 1`) | `ProjectSettings.asset`; la resta de plataformes va a Mono |
| Producte / resolució | `ProyectoTR1DAM`, 1920×1080 | `productName`, `defaultScreenWidth/Height` |
| Run in background | `0` (desactivat) | `runInBackground: 0`: en perdre el focus, Unity deixa de cridar `Update()` |
| Assemblea | `Assembly-CSharp` | No hi ha `.asmdef` per al codi del joc; només `Assets/Welcome/Unity.2D.Welcome.asmdef` |

**Paquets absents que són rellevants:** no hi ha `com.unity.transport`, no hi ha cap SDK de Socket.IO, no hi ha `UnityMainThreadDispatcher` i no s'usa TextMeshPro (el paquet `com.unity.ugui` el pot incloure, però tots els textos són `Label` d'UI Toolkit).

`Assets/Settings/` conté els assets de URP i el perfil de volum per defecte; `Assets/UI/New Panel Settings.asset` és el `PanelSettings` que usa l'escena. `Assets/UI Toolkit/PanelSettings.asset` existeix però no l'usa l'escena.

---

## 3. Estructura de fitxers i escenes

### 3.1 Arbre comentat de `Assets/`

```text
Assets/
├── Scenes/
│   └── SampleScene.unity          ÚNICA escena. Conté "MainScreen" (AppBootstrap + UIDocument),
│                                  "Main Camera" i "Global Light 2D". És l'escena inicial i l'única
│                                  habilitada a EditorBuildSettings.
├── Scripts/
│   ├── App/
│   │   └── AppBootstrap.cs        Cervell del client: instancia les pantalles, cableja events,
│   │                              connecta el WebSocket, gestiona estat de sala i navegació.
│   ├── Api/
│   │   └── RoomApi.cs            "API" falsa: retorna 2 sales d'exemple després de 0,3 s.
│   │                              Només s'usa amb AppConfig.UseMock = true. No fa HTTP.
│   ├── Config/
│   │   └── AppConfig.cs          Constants: UseMock, WsUrl (ws://localhost:3000), HttpUrl (sense ús).
│   ├── Controllers/
│   │   ├── MainScreenController.cs        Lobby: llista de sales, filtres, nick, crear/entrar.
│   │   ├── CreateRoomDialogController.cs  Diàleg de crear sala: validació i events.
│   │   ├── ProfileScreenController.cs     Perfil: pinta nickname i estadístiques (no alimentades).
│   │   └── Room/
│   │       ├── RoomScreenController.cs          Sala: capçalera, jugadors, invitació, router de seccions.
│   │       ├── RoomScreenController.Game.cs     Configuració, espera, pregunta, resposta, resultat.
│   │       ├── RoomScreenController.Ranking.cs  Rànquing, final i mode espectador.
│   │       └── RoomScreenController.Chat.cs     Xat de sala (màxim 200 missatges a la UI).
│   ├── Models/
│   │   ├── Common/NetworkModels.cs      Capçalera de missatge i opcions de catàleg.
│   │   ├── Identity/IdentityModels.cs   Identitat de convidat i nick.
│   │   ├── Rooms/RoomMessages.cs        Missatges C→S de sales.
│   │   ├── Rooms/RoomModels.cs          Models S→C de sales, jugadors i configuració.
│   │   ├── Game/GameMessages.cs         Missatges C→S de partida i xat.
│   │   ├── Game/GameModels.cs           Models S→C de ronda, resultats, rànquing i xat.
│   │   └── Profile/ProfileModels.cs     Perfil i historial (no s'usen per xarxa).
│   ├── Router/
│   │   └── ScreenRouter.cs        Mostra/amaga pantalles registrades per nom.
│   └── Services/
│       ├── SessionStore.cs        Estat de sessió en MEMÒRIA: GuestId, sala activa i password.
│       ├── WebSocketService.cs    ClientWebSocket natiu: connectar, enviar, rebre, cua d'events.
│       └── Realtime/
│           ├── GameClient.cs          Connexió, Tick, Send i els 13 enviaments.
│           ├── GameClient.Receive.cs  Parseig i dispatcher de missatges S→C.
│           └── GameClient.Events.cs   Declaració dels 25 events i els Invoke...
├── UI/
│   ├── UXML/
│   │   ├── MainScreen.uxml        Lobby: sales, filtres, nick, perfil, crear/entrar.
│   │   ├── RoomScreen.uxml        Sala: configuració, espera, pregunta, resultat, rànquing,
│   │   │                          final, espectador, jugadors i xat.
│   │   ├── ProfileScreen.uxml     Perfil: nickname, 4 targetes d'estadístiques i historial.
│   │   └── CreateRoomDialog.uxml  Diàleg modal de crear sala.
│   ├── USS/
│   │   └── ScreensUss.uss         Tema fosc (blau marí + accent taronja) de totes les pantalles.
│   └── New Panel Settings.asset   PanelSettings usat per l'UIDocument de l'escena.
├── UI Toolkit/
│   ├── PanelSettings.asset        PanelSettings alternatiu, no referenciat per l'escena.
│   └── UnityThemes/…              Tema per defecte d'UI Toolkit.
├── Settings/                      URP, Renderer2D, volum global i Input Actions (plantilla).
└── Welcome/                       Contingut de benvinguda de la plantilla 2D. No forma part del joc.
    ├── Unity.2D.Welcome.asmdef     Assemblea separada de la plantilla.
    ├── Welcome2DScript.cs         ScriptableObject que obre https://unity.com/features/2d; no s'invoca des del joc.
    └── *.asset                    NewWelcomePage, TutorialProjectSettings i Welcome2DScript.
```

**Prefabs:** no n'hi ha cap a `Assets/`. La UI es construeix instanciant UXML i creant elements per codi.
**ScriptableObjects del joc:** no n'hi ha. Els `.asset` existents són de configuració de Unity/URP, `PanelSettings` i el `Welcome2DScript` de la plantilla.

### 3.2 Classes auxiliars definides dins d'altres fitxers

| Classe / enum | Fitxer | Paper |
|---|---|---|
| `GameClient` (partial) | `GameClient.cs`, `GameClient.Receive.cs`, `GameClient.Events.cs` | Una sola classe repartida en tres fitxers `partial`. |
| `RoomScreenController` (partial) | `RoomScreenController{,.Game,.Chat,.Ranking}.cs` | Una sola classe repartida en quatre fitxers `partial`. |
| `PendingEvent` | `WebSocketService.cs` | Classe de cua amb `Kind` (`connected`/`message`/`closed`) i `Text`. |
| `JoinRoomButton : Button` | `MainScreenController.cs` | Botó `+` que porta adjunta la `RoomInfo` de la fila. |
| `RoomScreenState` (enum) | `RoomScreenController.cs` | `Setup`, `Waiting`, `Round`, `Result`, `Ranking`, `Finished`, `Spectator`. |
| `RoomApiResult` | `RoomApi.cs` | `Ok`, `Data`, `Error` del mock. |

Totes viuen al namespace global excepte els models (`Models`) i el router (`Router`).

### 3.3 Escena i objectes principals

| Escena / objecte | Components | Funció |
|---|---|---|
| `Assets/Scenes/SampleScene.unity` | — | Única escena; habilitada a `ProjectSettings/EditorBuildSettings.asset`. |
| GameObject `MainScreen` | `AppBootstrap`, `UIDocument` | Arrenca el client. `UIDocument` apunta a `MainScreen.uxml` i `New Panel Settings.asset`; `AppBootstrap` neteja el root i instancia els quatre UXML. |
| `Main Camera` | Camera, URP 2D | Càmera de la plantilla; no interactua amb la UI. |
| `Global Light 2D` | Light2D | Il·luminació 2D de la plantilla; irrellevant per a la UI. |

L'escena té un camp serialitzat antic `categories: [Geografia]` al `AppBootstrap` que ja no existeix a la classe. Unity el conserva com a dada òrfena; no afecta l'execució.

El `UIDocument` de `MainScreen` apunta a `Assets/UI/UXML/MainScreen.uxml` (`guid 9a5748…`) i a `Assets/UI/New Panel Settings.asset` (`guid 697b8e…`). El diàleg de crear sala no és cap GameObject: és una capa absoluta afegida al root per codi (`dialogElement`), amb `pickingMode = Ignore` perquè no bloquegi els clics.

---

## 4. Flux principal pas a pas

### 4.1 Arrencada

1. S'obre `SampleScene` i s'activa el GameObject `MainScreen`.
2. `AppBootstrap.OnEnable()`:
   - Comprova que els quatre `VisualTreeAsset` estiguin assignats a l'Inspector.
   - Llegeix el nickname de `PlayerPrefs` (`nickname_editor` a l'editor, `nickname_build` a la build).
   - Fa `root.Clear()` i instancia `MainScreen`, `RoomScreen` i `ProfileScreen`; el diàleg de crear sala s'afegeix com a capa absoluta.
   - Registra les pantalles al `ScreenRouter` i crea els quatre controladors.
   - Mostra la pantalla `main`.
3. Si `AppConfig.UseMock == true`: carrega catàleg i sales falses i **no** obre cap socket.
4. Si `UseMock == false`: crea `GameClient`, li passa el nickname, cableja tots els events, posa `main.ShowLoading()` i crida `client.Connect(AppConfig.WsUrl)`.

`AppBootstrap.Update()` crida `client.Tick()` cada frame (buida la cua d'esdeveniments del socket) i `room.Tick()` (comptador enrere). Si `client == null` (mode mock), surt abans i el comptador no corre.

Estat intern d'`AppBootstrap`: `nickname`, `myId` (inicialment `"me"`, el `MockId`, fins a `identity:confirmed`), `currentRoomId`, `isHost`, `pending` (`None`/`Creating`/`Joining`) i la llista `rooms`.

### 4.2 Connexió WebSocket i "login" (identitat de convidat)

No hi ha login. L'única autenticació és una **identitat de convidat**:

```text
Unity (GameClient)                           game-service
      |                                            |
      |--- WS connect a ws://localhost:3000 ------->|
      |<-- connection:stablished --------------------|
      |--- identity:declare {type:"new"} ---------->|   (o "restore" amb id+nick)
      |<-- identity:confirmed {identity:{...}} -----|
      |--- rooms:list ----------------------------->|
      |--- catalog:options ------------------------>|
      |<-- rooms:list / catalog:options ------------|
```

- En rebre `connection:stablished`, `GameClient.DeclareIdentity(false)` decideix:
  - `restore` si `SessionStore.GuestId` i `Nickname` no són buits.
  - `new` en qualsevol altre cas. **En el flux `new` no s'envia nickname** (el camp queda `null` i el serialitzador l'omet).
- En rebre `identity:confirmed`, `GameClient` desa `identity.id` (o `guestId`) a `SessionStore.GuestId` i llança `OnIdentity`.
- El servidor crea el convidat amb `id = "guest_N"` i `nickname = "guest_N"`, i `identity.type = "guest"`. Si el client no tenia nick local, acaba mostrant `guest_N` (i no el desa a `PlayerPrefs`).
- El backend també accepta `identity.token` per vincular un usuari registrat (`verifyAuthToken`), però el client no l'envia mai: sempre és un convidat i `userId` queda `null`.
- `AppBootstrap.OnClientIdentity`:
  - Desa `myId`.
  - Si el nickname local és buit, adopta el del servidor; si és diferent, envia `nickname:update`; si és igual, només actualitza les etiquetes.
  - Demana `rooms:list` i `catalog:options`.
  - Si `SessionStore.HasActiveRoom()`, intenta reentrar a la sala anterior amb `room:join` (`pending = Joining`).
- Si el servidor rebutja un `restore`, el client esborra `SessionStore.GuestId`, reintenta **una vegada** amb `new`; si torna a fallar, llança `OnServerError` (que la UI només loga, vegeu §9).

**Conseqüència:** el guest id viu només en memòria. En reiniciar l'aplicació sempre es declara `new`; el `restore` només serveix dins de la mateixa execució (per exemple, després de prémer Reintentar).

### 4.3 Lobby (pantalla principal)

- `rooms:list` substitueix la llista local i `MainScreenController.ShowRooms` la pinta. `AppBootstrap.RefreshRooms` descarta les sales `isPrivate: true`, així que el lobby només mostra les públiques.
- `room:new` afegeix una sala pública si no és privada i no hi és ja.
- `room:removed` la treu; si és la sala pròpia, neteja la sessió i torna a `main`.
- `catalog:options` omple:
  - el filtre de categoria del lobby (`Totes` + categories + `Mix`),
  - els desplegables de categoria i dificultat de la sala (`Mix`/`mix` afegits si falten).
- El backend també fa broadcast de `catalog:options` quan canvia el catàleg i revalida les sales del lobby; si una categoria o dificultat ja no existeix, envia `room:configuration:updated` no sol·licitat (vegeu §5.3).
- Filtres del lobby: text del nom (conté, sense distingir majúscules) i categoria exacta.
- El botó `+` d'una sala pública queda desactivat si `players >= maxPlayers`.

### 4.4 Crear o entrar a una sala

**Crear:**

1. `Crear sala` obre `CreateRoomDialog` amb el nickname com a nom per defecte.
2. El diàleg valida: nom no buit i `maxPlayers` entre 2 i 20 (el servidor aplica la mateixa regla i rebutja enters fora de rang).
3. `AppBootstrap.OnDialogCreate` posa `pending = Creating`, bloqueja el botó i envia `room:create` amb `nickname`, `maxPlayers`, `isPrivate`, `nameRoom`.
4. En arribar `room:created`, només s'accepta si `pending == Creating`: desa `roomId` i `password` a `SessionStore`, aplica la configuració rebuda i obre la sala.
5. Si la sala és privada, el codi d'invitació que es mostra i es copia és **només el password** (6 dígits generats pel servidor).
6. Tota sala nova neix amb configuració per defecte: `category = "mix"`, `difficulty = "mix"`, `rounds = 5`, `durationSeconds = 20`; el client la pinta amb aquests valors fins que l'host la canvia.

**Entrar a pública:**

1. El botó `+` envia `room:join` amb `roomId`, `nickname`, `password = null`, `maxPlayers` de la llista i `isPrivate = false`.
2. `pending = Joining`; `room:joined` només s'accepta amb aquest flag.

**Entrar a privada:**

1. L'usuari escriu el codi; el client el passa a majúscules i valida que no sigui buit.
2. S'envia `room:join` amb `roomId = null`, `password = codi`, `isPrivate = true`, `maxPlayers = null`. El servidor resol la sala pel password.
3. La resposta és el mateix `room:joined`.

**Reentrada automàtica:** si hi ha `SessionStore.ActiveRoomId`, `OnClientIdentity` envia `room:join` amb aquest id i el password desat.

### 4.5 Dins de la sala: lobby, partida i xat

- `room:players` actualitza la llista de jugadors i recalcula `isHost` comparant `hostId` amb `myId`.
- `room:state` decideix la secció:
  - `lobby` → `Setup` si ets host, `Waiting` si no.
  - `playing` → `Round`.
  - `finished` → `Finished`.
- **Host:** pot desar la configuració (`room:configuration`) i començar (`game:start`).
- **Convidat:** pot marcar-se a punt (`room:ready`) i veu l'espera.
- **Ronda:** `round:started` pinta pregunta, unitat i comptador (`durationMs`), neteja el camp de resposta i l'habilita.
- **Resposta:** el camp accepta només dígits, un separador decimal i el signe negatiu. En enviar, es converteix a `int` i s'envia `answer:submit`; el camp es desactiva fins a una pregunta nova.
- **Ack:** `answer:ack` mostra "Resposta acceptada" i torna a la secció `Round`.
- **Resultat:** `round:results` mostra resposta correcta, resposta pròpia, punts i posició; `you` és `null` quan el socket no té un jugador a la sala (p. ex. identitat absent). Un observador no rep `round:results`, sinó `round:spectator` (el servidor ho decideix pel `role`).
- **Rànquing:** `round:ranking` pinta la taula; el botó `Següent ronda` només es veu si ets host. La resta veu "Esperant que el host passi de ronda...". El servidor envia el rànquing 5 s després del resultat i **avança sol** a la ronda següent al cap de 10 s (`NEXT_ROUND_DELAY_MS`, sobreescrivible per `.env`); el botó només accelera el canvi.
- **Final:** `game:finished` mostra la posició pròpia i el rànquing final. Al cap de 15 s (`FINAL_RANKING_DELAY_MS`) el servidor torna la sala a `lobby` i reenvia `room:state` + `room:players`, i el client passa a `Setup` (host) o `Waiting`.
- **Espectador:** `round:spectator` mostra `Ronda X/Y · fase` i el temps restant; no hi ha botó de resposta. El servidor n'envia un a l'inici de cada ronda i també en lloc de `round:results`.
- **Xat:** s'envia `chat:message` amb el text retallat; el servidor el retorna com a `chat:message` i el client l'afegeix a la llista (màxim 200 files; les més antigues s'eliminen). El text es pinta com a text pla (`enableRichText = false`). El servidor també injecta missatges de sistema (`senderId: null`, `senderName: "SISTEMA"`, `system: true`) en entrar, sortir i canviar l'estat de "a punt"; el client els pinta igual que els dels jugadors.

### 4.6 Sortir i desconnexió

- **Sortir de la sala:** `OnRoomLeave` envia `room:leave` (si hi ha connexió) i **neteja l'estat local immediatament**: `currentRoomId`, `isHost`, `SessionStore`, xat i torna a `main`. No espera `room:left`.
- `room:left` també neteja i torna a `main` (ignora el `roomId` del missatge).
- **Desconnexió:** `OnDisconnected` neteja `currentRoomId`, `isHost`, `pending`, desbloqueja el diàleg, mostra `main` i pinta l'error. **No** esborra `SessionStore.ActiveRoomId`, de manera que el botó Reintentar pot reentrar a la sala anterior.
- **Reintentar:** si `client.IsConnected` és cert, demana `rooms:list`; si no, crea una connexió nova. No hi ha reintent automàtic, ni backoff, ni heartbeat.
- **Tancament:** `OnDisable` crida `client.Dispose()`, que cancel·la i allibera el socket sense fer el handshake de tancament.

---

### 4.7 Navegació, botons i flux complet

`ScreenRouter` registra `main`, `room` i `profile`; `Show(nom)` amaga l'actual (`display: none`) i mostra la nova (`display: flex`). El diàleg de crear sala és una capa absoluta germana de les pantalles al root, i el modal de nickname viu dins de `MainScreen.uxml`; cap dels dos no és una pantalla del router. No hi ha historial ni navegació enrere del sistema.

| Pantalla | Element | Controlador → esdeveniment | Efecte | Missatge |
|---|---|---|---|---|
| main | `profile-button` | `MainScreenController.OnProfile` | `router.Show("profile")`, refresca el nick | — |
| main | `nickname-btn` | `OpenNicknameDialog` → `SaveNickname` → `OnNicknameChanged` | valida 3–15; si hi ha socket, espera confirmació | `nickname:update` (o local si no hi ha connexió/mock) |
| main | `create-room-button` | `OnCreateRoom` | obre el diàleg amb el nick per defecte | — |
| main | `join-code-button` | `JoinPrivate` → `OnJoinPrivate` | passa el codi a majúscules i valida no buit | `room:join` (`roomId: null`, `password`, `isPrivate: true`) |
| main | `+` d'una fila | `OnJoinPublic` | `pending = Joining` | `room:join` (`roomId`, `nickname`, `maxPlayers`, `isPrivate: false`) |
| main | `retry-button` | `OnRetry` | `ShowLoading`; si connectat demana sales, si no reconnecta | `rooms:list` o `Connect` |
| main | `search-button` / Enter | `ApplyRoomFilter` | filtre local per nom (conté, ignora majúscules) | — |
| main | `category-filter` | `OnCategoryFilterChanged` | filtre local per categoria exacta | — |
| diàleg | `dialog-create-button` | `Submit` → `OnCreate` | valida i bloqueja el botó | `room:create` |
| diàleg | `dialog-cancel-button` | `OnCancel` | amaga el diàleg | — |
| room | `leave-button` | `OnLeave` | neteja estat local i torna a `main` | `room:leave` |
| room | `copy-button` | `OnCopyCode` | copia el codi al porta-retalls (password a les privades; buit a les públiques, on s'amaga) | — |
| room | `ready-button` | `OnReadyClicked` | alterna text local i envia | `room:ready` |
| room | `save-config-button` | `OnSaveConfiguration` | només visible a `Setup` (host) | `room:configuration` |
| room | `start-game-button` | `OnStartGame` | només visible a `Setup` (host) | `game:start` |
| room | `send-answer-button` / Enter | `SubmitAnswer` | valida número, desactiva el camp | `answer:submit` |
| room | `next-round-button` | `OnNextRound` | només visible a `Ranking` i si ets host | `round:next` |
| room | `chat-send-button` / Enter | `OnChatSendClicked` | buida el camp | `chat:message` |
| profile | `leave-button` | `OnBack` | `router.Show("main")` | — |

Flux complet: `main` → crear/entrar → `room` (`Setup` o `Waiting`) → `game:start` → `Round` → `Result` → `Ranking` → … → `Finished` → (auto) `Setup`/`Waiting` → `Sortir` → `main`. `Perfil` és una branca lateral des de `main`.

`RoomScreenController.SetWaiting(string)` existeix però no s'invoca des de cap controlador: el text d'espera és el fix de `RoomScreen.uxml` (`waiting-text`).

### 4.8 SessionStore i persistència

`SessionStore` és una classe `static` en memòria: no toca disc, `PlayerPrefs` ni cap fitxer. `SetActiveRoom` converteix `null` en `""`, i `HasActiveRoom()` només mira `ActiveRoomId`.

| Dada | Ubicació | Camp / clau | S'escriu | S'esborra |
|---|---|---|---|---|
| Guest id | memòria (`SessionStore`) | `GuestId` | `identity:confirmed` | quan el servidor rebutja un `restore`; es perd en tancar |
| Sala activa | memòria (`SessionStore`) | `ActiveRoomId`, `ActiveRoomPassword` | `room:created`, `room:joined` | `room:leave` (botó), `room:left`, `room:removed` de la sala pròpia i `room:join:error` amb `pending == Joining` |
| Nickname | `PlayerPrefs` | `nickname_editor` (editor) / `nickname_build` (build) | `ApplyNickname` (canvi confirmat o sense connexió) | no s'esborra mai |
| Estat de sessió | camps d'`AppBootstrap` | `nickname`, `myId`, `currentRoomId`, `isHost`, `pending`, `rooms` | durant l'execució | es perd en tancar |
| Comptador de ronda | `RoomScreenController` | `roundEndsAt`, `currentQuestionId`, `isReady` | `round:started` / clic | no es reinicia en sortir de la sala |

`GameClient` esborra a l'arrencada les claus antigues `guestId_editor` i `guestId_build`. `PlayerPrefs` no es desa amb `Save()`: un tancament brusc pot perdre l'últim nickname.

---

## 5. Contracte de comunicació

### 5.1 Format dels missatges

**Client → servidor:** JSON pla, un objecte per missatge:

```json
{ "type": "rooms:list" }
```

Els camps amb valor `null` **no s'envien** (`NullValueHandling.Ignore`). Per això `password` d'una sala pública, `maxPlayers` quan no es coneix o `roomId` d'una entrada per codi no apareixen al JSON.

**Servidor → client:** el client accepta dues formes:

```json
{ "type": "rooms:list", "rooms": [ ... ] }
```

```json
{ "type": "rooms:list", "payload": { "rooms": [ ... ] } }
```

`GameClient.Handle` agafa `payload` si existeix; si no, usa l'arrel. El text dels errors es llegeix de `reason` i, si no hi és, de `message`; `identity:confirmed` és l'única excepció i llegeix `error`.

El client no distingeix respostes de notificacions: `rooms:list`, `room:players` i `room:configuration:updated` també poden arribar per broadcast sense cap petició prèvia (canvi de catàleg, canvi d'host, revalidació de la sala).

Cada missatge és un frame de text UTF-8. Els missatges fragmentats es recomponen amb un `MemoryStream` i un buffer de 8192 bytes.

### 5.2 Missatges que ENVIA el client (13 tipus)

| `type` | Payload real | Mètode a `GameClient` | Quan s'envia |
|---|---|---|---|
| `identity:declare` | `{ identity: { type: "new" } }` o `{ identity: { type: "restore", id, nickname } }` | `DeclareIdentity` (privat) | En rebre `connection:stablished` |
| `rooms:list` | `{ type }` | `RequestRooms()` | En confirmar identitat, en Reintentar i en tornar a `main` |
| `catalog:options` | `{ type }` | `RequestCatalog()` | En confirmar identitat |
| `room:create` | `{ nickname, maxPlayers, isPrivate, nameRoom }` | `CreateRoom(...)` | En enviar el diàleg de crear sala |
| `room:join` | `{ roomId?, nickname, password?, maxPlayers?, isPrivate }` | `JoinRoom(...)` | Sala pública, sala privada per codi i reentrada |
| `room:leave` | `{ roomId }` | `LeaveRoom(roomId)` | Botó Sortir |
| `nickname:update` | `{ nickname }` | `UpdateNickname(...)` | Modal de nickname o si el nick local difereix del confirmat |
| `room:ready` | `{ ready }` | `SetReady(ready)` | Botó A punt |
| `room:configuration` | `{ configuration: { category, difficulty, maxPlayers, rounds, durationSeconds? } }` | `UpdateConfiguration(...)` | Botó Desar configuració (host) |
| `game:start` | `{ type }` | `StartGame()` | Botó Començar partida (host) |
| `answer:submit` | `{ questionId, answer }` | `SubmitAnswer(int, int)` | Botó Enviar resposta / Intro |
| `round:next` | `{ type }` | `NextRound()` | Botó Següent ronda (host) |
| `chat:message` | `{ text }` | `SendChatMessage(text)` | Botó ENVIAR / Intro al xat |

Notes:

- `questionId` i `answer` viatgen com a **enters**; el client trunca qualsevol decimal (`(int)value`).
- `durationSeconds` només s'inclou si és `> 0`.
- `maxPlayers` i `isPrivate` de `room:join` els envia el client, però el `joinRoomHandler` només llegeix `roomId`, `nickname` i `password`; la resta s'ignora.
- `room:configuration` no envia `state` encara que `RoomConfigurationData` el tingui: el client només serialitza els cinc camps de `RoomConfigurationSendData`.
- `room:create` el formula el diàleg sense `nickname`; és `AppBootstrap.OnDialogCreate` qui l'omple amb el nick local abans d'enviar.
- El model `UpdateGuestMessage` (`guest:update`) existeix però **no s'usa**.

### 5.3 Missatges que REP el client

#### Missatges amb tractament propi (23 tipus)

| `type` | Payload real | Event C# | Què fa el client / UI |
|---|---|---|---|
| `connection:stablished` | `{ message }` | — | `DeclareIdentity(false)` immediatament; no toca la UI |
| `identity:confirmed` | `{ identity: { id\|guestId, type, nickname } }` o `{ error }` | `OnIdentity` | Desa GuestId; `AppBootstrap` fixa `myId`, sincronitza nick, demana sales+catàleg i pot reentrar a la sala. El servidor envia `type: "guest"` i, si no hi ha nick, `nickname: "guest_N"` |
| `catalog:options` | `{ ok, categories[], difficulties[] }` o `{ ok:false, reason }` | `OnCatalogOptions` | Omple filtre de categoria del lobby i desplegables de la sala; si `ok:false`, manté l'última llista |
| `rooms:list` | `{ ok:true, rooms: [{ id, name, maxPlayers, players, category, state, isPrivate }] }` | `OnRoomsList` | Substitueix la llista i repinta el lobby |
| `room:new` | `{ id\|roomId, name, maxPlayers, players, category, state, isPrivate }` | `OnRoomAdded` | Afegeix la sala si és pública i no duplicada |
| `room:removed` | `{ roomId }` | `OnRoomRemoved` | Treu la sala; si és la pròpia, neteja la sessió i torna a `main` (no neteja el xat) |
| `room:created` | `{ ok:true, roomId, hostId, nameRoom, category, difficulty, rounds, maxPlayers, isPrivate, password, players[], state, durationSeconds, readyCount, readyRequired, canStart }` | `OnRoomCreated` | Només si `pending == Creating`: desa sala/password, aplica configuració i obre `Setup` o `Waiting`. El servidor **no envia `role`** en aquest missatge |
| `room:joined` | `{ ok:true, roomId, hostId, nameRoom, category, difficulty, rounds, maxPlayers, state, durationSeconds, readyCount, readyRequired, canStart, isPrivate, password, role, players[] }` | `OnRoomJoined` | Només si `pending == Joining`: mateix tractament que `room:created` |
| `room:players` | `{ roomId, hostId, nameRoom, category, difficulty, rounds, maxPlayers, players[], state, durationSeconds, readyCount, readyRequired, canStart }` | `OnRoomPlayers` | Si és la sala actual: recalcula `isHost` i repinta les fitxes de jugadors. El servidor no hi envia `isPrivate`, `password` ni `role` (el `role` va dins de cada jugador) |
| `room:left` | `{ ok, roomId, players[] }` | `OnRoomLeft` | Neteja sessió i xat, i torna a `main` (ignora el `roomId`) |
| `room:state` | `{ roomId, state }` | `OnRoomState` | Si és la sala actual: `lobby` → Setup/Waiting; `playing` → Round; `finished` → Finished |
| `nickname:updated` | `{ nickname }` | `OnNicknameUpdated` | `ApplyNickname`: actualitza memòria, `PlayerPrefs` i etiquetes |
| `round:started` | `{ round, totalRounds, durationMs, question: { id, text, min, max, step, unit, difficulty } }` | `OnRoundStarted` | Pinta pregunta i unitat, habilita resposta, arrenca comptador i mostra `Round`. El servidor no envia `correctAnswer` ni `explanation` en aquest missatge |
| `round:spectator` | `{ roomId, round, totalRounds, phase, remainingMs, durationMs }` | `OnSpectatorRound` | Pinta estat d'espectador i comptador; mostra `Spectator` |
| `round:results` | `{ round, totalRounds, correctAnswer, unit, explanation, you: { answer, roundPoints, totalScore, position } \| null }` | `OnRoundResults` | Pinta resposta correcta, resposta pròpia, punts i explicació; mostra `Result`. `you` és `null` si el socket no té jugador; els observadors reben `round:spectator` |
| `round:ranking` | `{ round, totalRounds, you: { position, totalScore } \| null, ranking: [{ position, nickname, score }] }` | `OnRoundRanking` | Pinta rànquing; mostra botó Següent només a l'host; `Ranking` |
| `game:finished` | `{ roomId, you: { position, score } \| null, ranking[] }` | `OnGameFinished` | Pinta posició pròpia i rànquing final; `Finished` |
| `answer:ack` | `{ questionId }` | `OnAnswerAck` | Mostra "Resposta acceptada" i `Round`; **no comprova** que `questionId` sigui l'actual |
| `round:next:error` | `{ reason }` o `{ message }` | `OnRoundNextError` + `OnServerError` | Mostra l'error a la sala; també passa pel canal general (només log) |
| `room:ready:error` | `{ reason }` o `{ message }` | `OnReadyError` + `OnServerError` | Mostra l'error a la sala; no reverteix el botó |
| `room:configuration:updated` | `{ ok, changed[], configuration: { category, difficulty, maxPlayers, rounds, durationSeconds, state } }` | `OnConfigurationUpdated` | Aplica només el bloc `configuration` a la pantalla de sala |
| `room:configuration:error` | `{ reason }` o `{ message }` | `OnConfigurationError` + `OnServerError` | Mostra l'error a la sala |
| `chat:message` | `{ senderId, senderName, text, timestamp }`; els de sistema afegeixen `system: true` i porten `senderId: null`, `senderName: "SISTEMA"` | `OnChatMessage` | Afegeix el missatge al xat (màxim 200). El client **ignora** `id` (el genera localment), `messageType` i `system`: tots els missatges es pinten igual |

#### Camps que el client llegeix i camps que ignora

| `type` | Camps que llegeix | Camps que arriben i ignora |
|---|---|---|
| `room:created` / `room:joined` | `roomId`, `hostId`, `nameRoom`, `category`, `difficulty`, `rounds`, `maxPlayers`, `isPrivate`, `password`, `players[]`, `durationSeconds` | `state`, `readyCount`, `readyRequired`, `canStart`, `role` (i `ok`) |
| `room:players` | `roomId`, `hostId`, `players[]` | `nameRoom`, `category`, `difficulty`, `rounds`, `maxPlayers`, `state`, `durationSeconds`, `readyCount`, `readyRequired`, `canStart` |
| `round:started` | `durationMs`, `question.id`, `question.text`, `question.unit` | `round`, `totalRounds`, `question.difficulty`, `question.min/max/step` |
| `round:results` | `correctAnswer`, `unit`, `explanation`, `you.answer`, `you.roundPoints`, `you.position` | `round`, `totalRounds`, `you.totalScore` |
| `round:ranking` | `ranking[].position/nickname/score` | `round`, `totalRounds`, `you` (sencer) |
| `round:spectator` | `round`, `totalRounds`, `phase`, `remainingMs` | `roomId`, `durationMs` |
| `game:finished` | `you.position`, `you.score`, `ranking[]` | `roomId` |
| `room:configuration:updated` | `configuration.category/difficulty/maxPlayers/rounds/durationSeconds` | `ok`, `changed[]`, `configuration.state` |
| `chat:message` | `senderId`, `senderName`, `text`, `timestamp` | `system`; `id` i `messageType` no existeixen al payload i no s'usen |
| `answer:ack` | `questionId` (el handler el passa, però `AppBootstrap` no el comprova) | — |
| `room:left` | `roomId` (el handler el passa, però `AppBootstrap` l'ignora) | `ok`, `players[]` |

**Tipus no gestionats:** el `game-service` només emet `admin:live` (només als sockets d'administració, que aquest client no obre); qualsevol tipus nou cau a `OnOther(type, data)` i només es loga. `identity.type = "guest"` és un camp, no un missatge.

#### Missatges d'error agregats (8 tipus)

`IsErrorType` els envia tots a `OnServerError(type, text)`. El text es llegeix de `reason` o `message`.

| `type` | Camp habitual | Tractament a `AppBootstrap.OnClientServerError` |
|---|---|---|
| `room:create:error` | `reason` | Si `pending == Creating` → `dialog.ShowServerError`; si `pending == Joining` → `main.ShowError`; si `None` → només log |
| `room:join:error` | `reason` | Si `pending == Joining` → `main.ShowError` + `ClearActiveRoom`; si `pending == Creating` → diàleg; si `None` → només log |
| `room:leave:error` | `reason` | Sense branca pròpia: amb `pending == None` només log; amb `pending` actiu cau a la branca de create/join |
| `nickname:error` | `message` | `main.SetNicknameError` (modal obert); té prioritat sobre `pending` |
| `round:error` | `message` | Si `pending == None` i hi ha sala → `room.ShowError`; amb `pending` actiu cau a la branca de create/join |
| `answer:error` | `message` | Si `pending == None` i hi ha sala → `room.ShowError`; el camp de resposta queda desactivat |
| `chat:error` | `reason`/`message` | Si `pending == None`: si hi ha sala → `room.ShowError`; si no → `main.ShowError` |
| `error` | `message` | Sense branca pròpia: amb `pending == None` només log; amb `pending` actiu cau a la branca de create/join |

Els tipus que no reconeix cap branca arriben a `OnOther(type, data)`, que només fa `Debug.Log`.

### 5.4 Exemples JSON amb camps reals

**Identitat nova:**

```json
{
  "type": "identity:declare",
  "identity": {
    "type": "new"
  }
}
```

**Identitat restaurar:**

```json
{
  "type": "identity:declare",
  "identity": {
    "type": "restore",
    "id": "guest_42",
    "nickname": "Jugador"
  }
}
```

**Crear sala:**

```json
{
  "type": "room:create",
  "nickname": "Jugador",
  "maxPlayers": 8,
  "isPrivate": true,
  "nameRoom": "Sala de prova"
}
```

**Entrar a sala publica:**

```json
{
  "type": "room:join",
  "roomId": "sala_a1b2c3d4e5",
  "nickname": "Jugador",
  "maxPlayers": 8,
  "isPrivate": false
}
```

> `maxPlayers` surt de la fila de la sala i el servidor l'ignora; si no es coneix (reentrada), s'omet.

**Entrar a sala privada per codi:**

```json
{
  "type": "room:join",
  "nickname": "Jugador",
  "password": "123456",
  "isPrivate": true
}
```

**Desar configuració:**

```json
{
  "type": "room:configuration",
  "configuration": {
    "category": "Mix",
    "difficulty": "mix",
    "maxPlayers": 8,
    "rounds": 5,
    "durationSeconds": 30
  }
}
```

**Enviar resposta:**

```json
{
  "type": "answer:submit",
  "questionId": 12,
  "answer": 42
}
```

**Xat:**

```json
{
  "type": "chat:message",
  "text": "hola"
}
```

**Identitat confirmada:**

```json
{
  "type": "identity:confirmed",
  "identity": {
    "id": "guest_42",
    "type": "new",
    "nickname": "Jugador"
  }
}
```

**Catàleg:**

```json
{
  "type": "catalog:options",
  "ok": true,
  "categories": ["Ciencia", "Geografia"],
  "difficulties": ["facil", "media", "dificil"]
}
```

**Llista de sales:**

```json
{
  "type": "rooms:list",
  "ok": true,
  "rooms": [
    {
      "id": "sala_a1b2c3d4e5",
      "name": "Sala de prova",
      "maxPlayers": 8,
      "players": 2,
      "category": "mix",
      "state": "lobby",
      "isPrivate": false
    }
  ]
}
```

**Sala creada:**

```json
{
  "type": "room:created",
  "ok": true,
  "roomId": "sala_a1b2c3d4e5",
  "hostId": "guest_42",
  "nameRoom": "Sala de prova",
  "category": "mix",
  "difficulty": "mix",
  "rounds": 5,
  "maxPlayers": 8,
  "isPrivate": true,
  "password": "123456",
  "players": [
    {
      "id": "guest_42",
      "nickname": "Jugador",
      "score": 0,
      "ready": false,
      "role": "player"
    }
  ],
  "state": "lobby",
  "durationSeconds": 20,
  "readyCount": 0,
  "readyRequired": 1,
  "canStart": false
}
```

> El servidor envia `role: "player"` també per a l'amfitrió dins de `players[]` (i a `room:joined`), i **no** posa cap `role` a l'arrel de `room:created`. El client identifica l'host per `hostId == myId`, no per `role`. `readyRequired` és el 40 % dels jugadors arrodonit cap avall, amb un mínim d'1.

**Ronda iniciada:**

```json
{
  "type": "round:started",
  "round": 1,
  "totalRounds": 5,
  "durationMs": 20000,
  "question": {
    "id": 12,
    "text": "Quants quilòmetres fa la Terra al voltant del Sol?",
    "min": 0,
    "max": 100,
    "step": 1,
    "unit": "milions de km",
    "difficulty": "facil"
  }
}
```

**Resultat de ronda:**

```json
{
  "type": "round:results",
  "round": 1,
  "totalRounds": 5,
  "correctAnswer": 42.5,
  "unit": "milions de km",
  "explanation": "La Terra recorre uns 42,5 milions de km...",
  "you": {
    "answer": 40,
    "roundPoints": 8,
    "totalScore": 8,
    "position": 2
  }
}
```

**Rànquing:**

```json
{
  "type": "round:ranking",
  "round": 1,
  "totalRounds": 5,
  "you": {
    "position": 2,
    "totalScore": 8
  },
  "ranking": [
    { "position": 1, "nickname": "Ana", "score": 10 },
    { "position": 2, "nickname": "Jugador", "score": 8 }
  ]
}
```

**Final de partida:**

```json
{
  "type": "game:finished",
  "roomId": "sala_a1b2c3d4e5",
  "you": {
    "position": 2,
    "score": 30
  },
  "ranking": [
    { "position": 1, "nickname": "Ana", "score": 40 },
    { "position": 2, "nickname": "Jugador", "score": 30 }
  ]
}
```

**Xat rebut:**

```json
{
  "type": "chat:message",
  "id": "guest_7-1760000000000-0",
  "senderId": "guest_7",
  "senderName": "Ana",
  "text": "hola",
  "timestamp": 1760000000000,
  "messageType": "user"
}
```

**Errors:**

```json
{ "type": "room:join:error", "ok": false, "reason": "La sala està plena" }
```

```json
{ "type": "nickname:error", "message": "El nickname ja existeix" }
```

```json
{ "type": "room:ready:error", "ok": false, "reason": "No pots marcar-te a punt ara" }
```

### 5.5 Crides HTTP

**No n'hi ha cap.** El client no fa servir `UnityWebRequest` ni `HttpClient`.

- `AppConfig.HttpUrl = "http://localhost:3000"` existeix, però **no es referencia enlloc**.
- `RoomApi.GetPublicRooms` no crida cap servidor: espera 0,3 s i retorna dues sales d'exemple (`Sala General #1`, `Geografía Express`). Només s'usa amb `UseMock = true`.
- No hi ha login, token, cookies ni cap capçalera HTTP.

### 5.6 Diferències amb el client Vue

Els dos clients comparteixen **el mateix protocol i el mateix `game-service`**. Les diferències són d'arquitectura i d'abast:

| Aspecte | Unity | Vue |
|---|---|---|
| Transport | `ClientWebSocket` natiu (`System.Net.WebSockets`) | `WebSocket` del navegador |
| Enviament | `Send(object)` fire-and-forget; no retorna res | `sendRequest(type, payload)` retorna `Promise` i desa `{resolve, reject}` per tipus |
| Estat | Camps d'`AppBootstrap` + controladors que muten la UI | Store únic de Pinia (`stores/game.js`) |
| Errors | Per pantalla; alguns tipus només es loguen | `errorMessage` central + rebuig de la promise |
| Persistència | Nickname a `PlayerPrefs`; guest id i sala en memòria | Nickname a `localStorage`; guest id i sala a `sessionStorage` |
| Identitat | `identity:declare` `new`/`restore`; `restore` només dins la mateixa execució | Mateix protocol; `restore` entre recàrregues de pestanya gràcies a `sessionStorage` |
| Login/auth | No n'hi ha | Té serveis HTTP d'auth/estadístiques/admin (`authApi.js`, `statsApi.js`, `adminApi.js`) |
| Pantalles | `main`, `room`, `profile` (parcial) i diàleg de crear sala | Home, Lobby, Room, PlayerRoom, ObserverRoom, Stats, Admin… |
| UI | UI Toolkit (UXML/USS) | Vue + CSS |
| Plataforma | Editor i build d'escriptori; **no WebGL** (el `ClientWebSocket` no hi és) | Navegador |
| Reconeixement | Manual (botó Reintentar), sense backoff | Manual (remuntar la vista), sense backoff |
| Crides HTTP del joc | Cap | Cap per al joc; HTTP només per a auth/stats/admin |

El contracte de missatges és equivalent: Vue també envia `catalog:options` i `chat:message`, i també rep els mateixos tipus. La diferència principal és que Unity no té correlació petició/resposta ni un store reactiu.

---

### 5.7 Models C# i deserialització

**Mecànica:** `GameClient.Handle` fa `JObject.Parse`; el `type` sempre es llegeix de l'arrel. Si existeix `payload`, és el que es passa als handlers; si no, l'arrel. Cada handler fa `data.ToObject<T>()` (Json.NET):

- Noms de camp **case-insensitive**; els camps absents queden al valor per defecte (`null`, `0`, `false`) i els desconeguts s'ignoren.
- Les propietats calculades `[JsonIgnore]` (`RoomListItem.Id`, `ServerIdentity.Id`/`Nick`) no es deserialitzen.
- Si `ToObject` llança (tipus incompatible), `Handle` ho captura, fa `Debug.LogWarning` i **descarta** el missatge.
- `NullValueHandling.Ignore` només s'aplica a l'enviament.

| Model | Camps | Origen / notes |
|---|---|---|
| `RoomListItem` | `id`, `roomId`, `name`, `maxPlayers`, `players`, `category`, `state`, `isPrivate` | `rooms:list`/`room:new`; `Id` = `id ?? roomId`. `room:new` del backend envia `id`. |
| `RoomInfo` | `id`, `name`, `players`, `maxPlayers`, `category`, `isPrivate`, `state`; `IsFull` | **No es deserialitza**: el construeix `AppBootstrap.BuildRoomInfo`. `IsFull` = `players >= maxPlayers`. |
| `RoomCreatedData` | `roomId`, `hostId`, `nameRoom`, `category`, `difficulty`, `rounds`, `maxPlayers`, `isPrivate`, `password`, `players[]`, `state`, `durationSeconds`, `readyCount`, `readyRequired`, `canStart`, `role` | `room:created`. `role` no arriba del servidor; `players` s'inicialitza a llista buida. |
| `RoomPlayersData` | `roomId`, `hostId`, `nameRoom`, `category`, `difficulty`, `rounds`, `maxPlayers`, `state`, `durationSeconds`, `readyCount`, `readyRequired`, `canStart`, `isPrivate`, `password`, `role`, `players[]` | `room:joined` i `room:players`. A `room:players` falten `isPrivate`/`password`/`role`. |
| `ServerPlayer` / `LobbyPlayer` | `id`, `nickname`, `score`, `ready`, `role` | `players[]`. `LobbyPlayer` és la còpia que pinta la UI. |
| `RoomStateData` | `roomId`, `state` | `room:state` (`lobby`, `playing`, `finished`). |
| `RoomConfigurationData` | `category`, `difficulty`, `maxPlayers`, `rounds`, `durationSeconds`, `state` | `room:configuration:updated` (bloc `configuration`) i lectura interna. El client no envia mai `state`, però el servidor sí que el retorna dins del bloc |
| `RoundStartedData` | `round`, `totalRounds`, `durationMs`, `question` | `round:started`. |
| `QuestionData` | `id`, `text`, `correctAnswer`, `unit`, `difficulty`, `explanation`, `timeLimitSeconds = 30` | El servidor només envia `id`, `text`, `min`, `max`, `step`, `unit`, `difficulty`; `min`/`max`/`step` no tenen camp i es perden. `correctAnswer`/`explanation`/`timeLimitSeconds` queden al valor per defecte i no s'usen. |
| `SpectatorRoundData` | `roomId`, `round`, `totalRounds`, `phase`, `remainingMs`, `durationMs` | `round:spectator`; `phase` = `waiting`/`question`/`results`. |
| `RoundResultsData` | `round`, `totalRounds`, `correctAnswer` (**double**), `unit`, `explanation`, `you` | `round:results`. |
| `YouRoundResult` | `answer` (**double?**), `roundPoints`, `totalScore`, `position` (int) | `null` si no hi ha jugador; `answer` pot ser `null` si no va respondre. |
| `RoundRankingData` | `round`, `totalRounds`, `you`, `ranking[]` | `round:ranking`; `ranking` s'inicialitza a llista buida. |
| `YouRanking` | `position`, `totalScore` | `null` per als observadors. |
| `GameFinishedData` | `roomId`, `you`, `ranking[]` | `game:finished`. |
| `YouFinal` | `position`, `score` | `null` per als observadors. |
| `RankingEntry` | `position`, `nickname`, `score` | `round:ranking` i `game:finished`. |
| `ChatMessageData` | `id`, `senderId`, `senderName`, `text`, `timestamp` (**long**, ms), `messageType` | `chat:message`. El client sobreescriu `id`; `messageType` no s'usa. |
| `ServerIdentity` | `id`, `guestId`, `type`, `nickname`, `nickanme` | `identity.identity`. `Id` i `Nick` toleren els dos noms. |
| `CatalogOptions` | `categories[]`, `difficulties[]` | `catalog:options`; si manca qualsevol de les dues, el client no llença l'event. |
| `NetworkMessageHeader` | `type` | Capçalera mínima; també s'usa per enviar `catalog:options`. |
| `UserProfile` / `GameHistoryEntry` | `id`, `nickname`, `gamesPlayed`, `wins`, `accuracyRate` (**float**), `podiumCount`, `history[]` / `gameId`, `category`, `position` | Sense origen de dades: `ProfileScreenController.Show` no es crida. |
| `QuestionResultData` | `questionText`, `correctAnswer`, `explanation` | No s'usa. |
| `RoomInfo`, `LobbyRoom`, `CreateRoomData` | vegeu codi | `LobbyRoom` i `CreateRoomData` no s'usen. |
| `UpdateGuestMessage` | `type = "guest:update"`, `guestId`, `newNickname` | No s'usa. |

**Missatges C→S (classes de `RoomMessages`/`GameMessages`/`IdentityModels`):**

| Classe | Camps serialitzats |
|---|---|
| `ListRoomsMessage` | `type = "rooms:list"` |
| `CreateRoomMessage` | `type`, `nickname`, `maxPlayers` (int), `isPrivate`, `nameRoom` |
| `JoinRoomMessage` | `type`, `roomId`, `nickname`, `password`, `maxPlayers` (**int?**), `isPrivate` |
| `LeaveRoomMessage` | `type`, `roomId` |
| `SetReadyMessage` | `type`, `ready` |
| `RoomConfigurationMessage` | `type`, `configuration: RoomConfigurationSendData` |
| `RoomConfigurationSendData` | `category`, `difficulty`, `maxPlayers`, `rounds`, `durationSeconds` (**int?**) |
| `StartGameMessage` / `NextRoundMessage` | `type` |
| `SubmitAnswerMessage` | `type`, `questionId` (int), `answer` (int) |
| `ChatMessage` | `type`, `text` |
| `DeclareIdentityMessage` | `type = "identity:declare"`, `identity: IdentityPayload` |
| `IdentityPayload` | `type`, `id`, `nickname` (els nuls s'ometen) |
| `UpdateNicknameMessage` | `type`, `nickname` |

**Truncaments i conversions numèriques:**

| Punt | Conversió | Conseqüència |
|---|---|---|
| Resposta del jugador | `double value` → `(int)value` a `RoomScreenController.SubmitAnswer` | Trunca cap a zero: `3,9` → `3`, `-3,9` → `-3`. El servidor accepta decimals i els guarda amb 6 decimals, però el client mai no els envia. |
| Percentatge d'encert | `float accuracyRate` → `(int)(rate * 100f)` | Trunca; el perfil no té dades. |
| Resposta correcta i resposta pròpia | `double` → text `"0.##"` (cultura invariant) | Només presentació: no es trunca el valor, s'arrodoneix a 2 decimals. |
| Camps `int` del protocol | `rounds`, `maxPlayers`, `score`, `position`, `roundPoints`, `durationMs`, `remainingMs` | El servidor els envia enters; si n'enviés un de decimal, `ToObject` podria fallar i el missatge es descartaria (**no verificat**). |
| `timestamp` | `long` (ms Unix) | Si és `<= 0`, el client posa l'hora local. |

### 5.8 Contrast amb el backend (`game-service`)

| Aspecte | Backend (codi) | Client Unity |
|---|---|---|
| Port | `PORT=3000` a `.env`; `docker-compose.yml` publica `${PORT}:${PORT}` | `ws://localhost:3000` |
| Identitat | `identity:declare` amb `new`/`restore`; `token` opcional; guest `guest_N` amb `nickname = id` | No envia `token`; `restore` només dins la mateixa execució |
| Nickname | `^[a-zA-Z0-9_]{3,15}$` a `nickname:update`; no es pot canviar dins d'una sala; duplicats comparats sense accents ni majúscules; paraules `admin`/`hack`/`spam` prohibides en crear/entrar | Valida només longitud 3–15; la resta d'errors arriben com a `nickname:error` |
| Rols | L'host és `role: "player"`; qui entra amb la sala en `playing`/`finished` és `observer` (també apareix a `players[]`, però no rep pregunta ni pot respondre) | `isHost` per `hostId == myId`; els observadors es tracten com a tals només per `round:spectator` |
| Ready | Llindar del 40 % arrodonit cap avall, mínim 1; `canStart` ho resumeix | No fa servir `readyCount`/`readyRequired`/`canStart`; el botó Començar sempre és actiu |
| Resposta | Només la pregunta actual, ronda oberta, una resposta per jugador, `abs(x) < 1e14`, guarda 6 decimals | Trunca a int abans d'enviar; desactiva el camp en enviar |
| Temps de ronda | Resultats → 5 s → rànquing → 10 s → ronda següent (auto); final → 15 s → lobby | Comptador de paret; no envia res en arribar a zero; el botó Següent només accelera |
| Configuració | Només l'host; la sala sempre surt de `ws.roomId`; revalida contra el catàleg | Només mostra el botó a `Setup`; `room:configuration:updated` pot arribar per broadcast |
| Xat | Broadcast a tota la sala, inclòs el remitent; missatges de sistema amb `system: true` | Afegeix tots els missatges; el remitent també veu el seu |
| Desconnexió | Gràcia de 10 s (`GRACE_MS`) abans de treure el jugador; `room:join` cancel·la la sortida pendent | No reconnecta sol; Reintentar crea un socket nou |
| Errors | Tipus exactes: `room:create:error`, `room:join:error`, `room:leave:error`, `nickname:error`, `round:error`, `answer:error`, `chat:error`, `room:ready:error`, `room:next:error`, `room:configuration:error`, `error` | Tots passen per `OnServerError`; només alguns tenen tractament visual (vegeu §5.3) |

---

## 6. Com es comunica amb el backend

| Aspecte | Implementació |
|---|---|
| URL | `AppConfig.WsUrl = "ws://localhost:3000"` |
| Path | Cap; es connecta a l'arrel del `game-service` |
| Protocol | WebSocket estàndard, frames de text UTF-8; sense subprotocol |
| Autenticació de transport | Cap: sense capçaleres, token ni cookies |
| Port | **3000**. `backend/game-service/.env` defineix `PORT=3000` i `docker-compose.yml` publica `${PORT}:${PORT}`; si es canvia allà, cal canviar també `AppConfig.WsUrl` |
| Reconnexió | Només manual: botó Reintentar. No hi ha reintent automàtic, backoff, ni límit d'intents |
| Heartbeat | Cap a nivell d'aplicació: el codi no envia pings ni configura `KeepAliveInterval`/`CancelAfter`. Si la implementació de `ClientWebSocket` de la plataforma envia pings de keepalive, no es pot verificar per anàlisi estàtica (**no verificat**) |
| Timeout | Cap: ni de connexió, ni d'enviament, ni de resposta |
| Tancament | `Dispose()` cancel·la el `CancellationTokenSource` i allibera el socket sense `CloseAsync`; `DisconnectAsync()` existeix (fa `CloseAsync` + `cts.Cancel()`) però no s'usa. Ni el `cts` ni el `SemaphoreSlim` es `Dispose`en |
| Buffer | 8192 bytes per lectura; els missatges fragmentats es recomponen |
| Enviament concurrent | `SemaphoreSlim(1,1)` al voltant de `SendAsync` |
| Fil principal | `WebSocketService` encua `Connected`/`Message`/`Closed` en una `ConcurrentQueue<PendingEvent>`. `GameClient.Tick()` crida `DispatchPending()` des d'`AppBootstrap.Update()`, de manera que tots els events C# es llancen al fil principal. **No** s'usa `UnityMainThreadDispatcher`. Com que `Connect` s'invoca al fil principal i no hi ha `ConfigureAwait(false)`, les continuacions d'`async` hereten el `SynchronizationContext` d'Unity; la cua igualment protegeix el cas que arribi res de fons. |
| Missatge descartat | Si el socket no és `Open`, `SendAsync` fa `Debug.LogWarning` i **descarta** el missatge sense avisar la UI |
| Estat de connexió | `IsConnected` és cert quan el socket és `Open`, **abans** d'`identity:confirmed` |

**Cicle de vida:**

```text
AppBootstrap.OnEnable
  → new GameClient()                 esborra guestId_editor/guestId_build de PlayerPrefs
  → client.Nickname = nickname       (PlayerPrefs, una sola vegada)
  → client.Connect(AppConfig.WsUrl)  fire-and-forget: _ = ws.ConnectAsync(url)
      WebSocketService.ConnectAsync
        → closedByUser = false; cts = new CancellationTokenSource(); socket = new ClientWebSocket()
        → await ConnectAsync(uri, token)
             èxit  → EnqueueConnected(); _ = ReceiveLoop(socket, token)
             error → EnqueueClosed("No s'ha pogut connectar: ...")
Update (cada frame)
  → client.Tick() → DispatchPending() → OnConnected / OnMessage / OnClosed
        OnConnected       només log + triedNewIdentity = false (la identitat s'espera a connection:stablished)
        OnMessage(json)   → GameClient.Handle(json)
        OnClosed(motiu)   → OnDisconnected → AppBootstrap torna a main i mostra l'error
  → room.Tick() → comptador enrere de la ronda
ReceiveLoop (asíncrona)
  → buffer 8192 B + MemoryStream; do/while (!EndOfMessage)
  → Close             → CloseOutputAsync + EnqueueClosed si !closedByUser; return
  → Text              → EnqueueMessage(UTF-8)
  → excepció/cancel·lació → EnqueueClosed si !closedByUser (OperationCanceledException = silenci)
OnDisable
  → client.Dispose() → closedByUser = true; cts.Cancel(); socket.Dispose()
```

| Estat del socket | `IsConnected` | Què passa |
|---|---|---|
| `null` (abans de `Connect`) | `false` | `SendAsync` descarta amb warning |
| `Connecting` | `false` | `Tick` encara no té res a la cua |
| `Open` | `true` | Ja s'accepta `Send`, **abans** de `identity:confirmed` |
| `CloseReceived` / `CloseSent` / `Closed` | `false` | El `ReceiveLoop` ja ha encuat `Closed` o ho farà |
| Socket antic després de Reintentar | pot quedar `Open` | `ConnectAsync` sobreescriu `socket` i `cts` sense `Dispose`: el bucle vell pot continuar viu |

No hi ha cap camí que reconecti sol: ni `OnClosed` ni `ConnectAsync` reintenten. El servidor, això sí, dona 10 s de gràcia (`GRACE_MS`) abans de treure un jugador desconnectat, i `room:join` cancel·la la sortida pendent.

---

## 7. Configuració i arrencada

### 7.1 Requisits

- Unity **6000.6.4f1** (o una 6.x compatible; el projecte es va crear amb aquesta).
- El `game-service` engegat i escoltant al port que espera el client (`3000` per defecte).
- Els quatre UXML assignats a l'Inspector del `AppBootstrap` (ja venen assignats a l'escena).

### 7.2 Passos per obrir el projecte

1. Obre Unity Hub → **Add project from disk** → selecciona `frontend/client-unity`.
2. Obre'l amb Unity 6000.6.4f1.
3. Obre l'escena `Assets/Scenes/SampleScene.unity` (és l'única escena i l'única habilitada a Build Settings).
4. Comprova el GameObject `MainScreen`:
   - té `AppBootstrap` i `UIDocument`;
   - `UIDocument` apunta a `Assets/UI/New Panel Settings.asset`;
   - `AppBootstrap` té `mainScreenAsset`, `roomScreenAsset`, `profileScreenAsset` i `createRoomDialogAsset`.
5. Comprova que el `game-service` respon a `ws://localhost:3000`. Si no, edita `Assets/Scripts/Config/AppConfig.cs` i canvia `WsUrl`.
6. Prem **Play**.

### 7.3 Mode simulat

`AppConfig.UseMock` és `false` per defecte. Si es posa a `true`:

- No s'obre cap WebSocket.
- Es carreguen categories/dificultats locals (`Futbol`, `Ciencia`, `Esports` / `facil`, `mitjana`, `dificil`) i dues sales d'exemple via `RoomApi` (`Sala General #1`, `Geografía Express`).
- Es pot **crear** una sala simulada i veure el lobby. En crear-ne una de privada, el codi es genera localment amb 6 caràcters de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no són els 6 dígits del servidor).
- **No es pot entrar a les sales públiques simulades:** `RoomApi` deixa `players = 0` i `maxPlayers = 0`, i `RoomInfo.IsFull` (`players >= maxPlayers`) val `true`, així que el botó `+` queda desactivat. Entrar per codi privat sí que obre una sala (qualsevol codi no buit, no es valida).
- Les accions de joc (A punt, Començar, Enviar resposta, Següent ronda, Xat) **no fan res** perquè `CanSend()` retorna `false` en mode mock.

`UseMock`, `WsUrl` i `HttpUrl` són camps `static` de codi; no es poden canviar des de l'Inspector ni des d'un fitxer de configuració. Per apuntar a un altre servidor cal editar `Assets/Scripts/Config/AppConfig.cs` i recompilar (Unity recompila en desar).

### 7.4 Build

- `EditorBuildSettings.asset` inclou només `Assets/Scenes/SampleScene.unity` (`enabled: 1`).
- No hi ha build WebGL possible amb el codi actual: `System.Net.WebSockets.ClientWebSocket` no està disponible a WebGL.
- No hi ha símbols de compilació ni perfils de build específics.
- Producte `ProyectoTR1DAM`, 1920×1080 per defecte, `runInBackground: 0` (en perdre el focus s'atura `Update()` i, per tant, `Tick()`; vegeu §9).

### 7.5 Requisits del servidor (contrast)

El `game-service` escolta a `3000` segons `backend/game-service/.env`; necessita el `catalog-service` (`CATALOG_URL`, per defecte `http://localhost:3001`) i `INTERNAL_SECRET` per respondre `catalog:options`. Sense catàleg, el client rep `catalog:options { ok:false }` i manté les llistes que tingui. La base de dades (`mariadb`) només cal per crear/entrar a sales i persistir partides.

---

## 8. Fitxers clau

| Path | Responsabilitat | Mida aprox. |
|---|---|---|
| `Assets/Scenes/SampleScene.unity` | Escena única; `MainScreen` amb `AppBootstrap` + `UIDocument` | 13 KB |
| `Assets/Scripts/App/AppBootstrap.cs` | Arrencada, instanciació d'UI, cablejat d'events, estat de sala, navegació, handlers `OnClient*` | 1318 línies |
| `Assets/Scripts/Services/Realtime/GameClient.cs` | Connexió, `Tick`, `Send`, identitat i els 13 enviaments | 359 línies |
| `Assets/Scripts/Services/Realtime/GameClient.Receive.cs` | `Handle`, `DispatchMessage`, `IsErrorType`, `ReadErrorText` i tots els `Handle*` | 683 línies |
| `Assets/Scripts/Services/Realtime/GameClient.Events.cs` | 25 events i els `Invoke*` amb comprovació de `null` | 357 línies |
| `Assets/Scripts/Services/WebSocketService.cs` | `ClientWebSocket`, cua `ConcurrentQueue`, `ReceiveLoop`, `SendAsync`, `Dispose` | 329 línies |
| `Assets/Scripts/Services/SessionStore.cs` | `GuestId`, `ActiveRoomId`, `ActiveRoomPassword` en memòria | 68 línies |
| `Assets/Scripts/Config/AppConfig.cs` | `UseMock`, `WsUrl`, `HttpUrl` | 17 línies |
| `Assets/Scripts/Controllers/MainScreenController.cs` | Lobby: sales, filtres, nick, crear/entrar, errors | 639 línies |
| `Assets/Scripts/Controllers/CreateRoomDialogController.cs` | Validació del formulari i events de crear/cancel·lar | 320 línies |
| `Assets/Scripts/Controllers/ProfileScreenController.cs` | Perfil: nick, 4 estadístiques, historial | 152 línies |
| `Assets/Scripts/Controllers/Room/RoomScreenController.cs` | Capçalera, jugadors, invitació i router de seccions | 305 línies |
| `Assets/Scripts/Controllers/Room/RoomScreenController.Game.cs` | Configuració, espera, pregunta, resposta, resultat, comptador | 656 línies |
| `Assets/Scripts/Controllers/Room/RoomScreenController.Ranking.cs` | Rànquing, final i espectador | 185 línies |
| `Assets/Scripts/Controllers/Room/RoomScreenController.Chat.cs` | Xat: pintat, normalització, topall de 200 | 257 línies |
| `Assets/Scripts/Models/Rooms/RoomModels.cs` | Models de sala, jugadors, configuració i estat | 201 línies |
| `Assets/Scripts/Models/Game/GameModels.cs` | Models de ronda, resultats, rànquing, final i xat | 154 línies |
| `Assets/Scripts/Models/Identity/IdentityModels.cs` | Identitat i nick; tolerància a `id`/`guestId` i `nickname`/`nickanme` | 103 línies |
| `Assets/Scripts/Models/Common/NetworkModels.cs` | Capçalera `type` i `CatalogOptions` | 28 línies |
| `Assets/Scripts/Models/Profile/ProfileModels.cs` | `UserProfile` i `GameHistoryEntry` (sense origen de dades) | 39 línies |
| `Assets/Scripts/Models/Rooms/RoomMessages.cs` | Missatges C→S de sala | 98 línies |
| `Assets/Scripts/Models/Game/GameMessages.cs` | Missatges C→S de partida i xat | 42 línies |
| `Assets/Scripts/Router/ScreenRouter.cs` | Registre i canvi de pantalles | 64 línies |
| `Assets/Scripts/Api/RoomApi.cs` | Sales simulades per al mode mock | 65 línies |
| `Assets/UI/UXML/MainScreen.uxml` | Lobby | 3,3 KB |
| `Assets/UI/UXML/RoomScreen.uxml` | Sala completa (seccions + jugadors + xat) | 7,2 KB |
| `Assets/UI/UXML/ProfileScreen.uxml` | Perfil | 2,2 KB |
| `Assets/UI/UXML/CreateRoomDialog.uxml` | Diàleg de crear sala | 1,7 KB |
| `Assets/UI/USS/ScreensUss.uss` | Tema visual | 10,5 KB |
| `Assets/Welcome/Welcome2DScript.cs` | ScriptableObject de la plantilla que obre la pàgina 2D; no s'usa | 13 línies |
| `Packages/manifest.json` | Dependències d'Unity | 2,6 KB |
| `README.md` (client) | Resum propi del protocol; **desactualitzat** (11 enviaments/28 tipus) | 86 línies |
| `ProjectSettings/ProjectVersion.txt` | Versió de l'editor | — |

---

## 9. Riscos i punts febles

1. **No hi ha reconnexió, heartbeat ni timeout.** Si el socket es queda penjat, el client no ho detecta fins que el servidor el tanca. El botó Reintentar crea un `ClientWebSocket` nou sense `Dispose` de l'anterior (`WebSocketService.ConnectAsync` sobreescriu `socket` i `cts`), de manera que es poden acumular sockets i bucles de recepció si es clica diverses vegades.

2. **`IsConnected` és cert abans de la identitat.** `WebSocketService.IsConnected` només mira `State == Open`. `OnMainRetry` hi confia per enviar `rooms:list`, i `CanSend()` permet `room:ready`, `game:start`, etc. abans d'`identity:confirmed`. El servidor pot respondre `error`, que el client només loga.

3. **El flag global `pending` perd respostes legítimes.** `room:created` i `room:joined` només s'accepten si `pending` és `Creating`/`Joining`. Si el servidor envia un `room:joined` no provocat pel client (per exemple, una reentrada o un canvi d'host), es descarta. A més, `OnClientServerError` decideix per `pending` abans que pel tipus: un `round:error` que arribi mentre es crea una sala es pinta al diàleg de creació.

4. **Sortir de la sala és optimista i l'error és invisible.** `OnRoomLeave` envia `room:leave` i neteja l'estat local immediatament, sense esperar `room:left`. Si el servidor respon `room:leave:error`, no hi ha cap branca que el mostri: només queda un `Debug.LogWarning`. L'usuari creu que ha sortit mentre el servidor encara el pot tenir dins de la sala.

5. **Diversos errors no arriben mai a l'usuari.** `error`, `room:leave:error` i el segon fracàs d'identitat només es loguen. `OnOther` també només loga. En una desconnexió o un missatge mal format, la UI pot quedar-se carregant o amb un estat antic sense explicar res.

6. **Les respostes decimals es trunquen.** El servidor accepta nombres amb decimals, però `SubmitAnswerMessage.answer` és `int` i el controlador fa `(int)value`. Un `3,5` s'envia com a `3`. A més, el camp es desactiva abans de l'`ack` i **no es torna a habilitar** amb `answer:error`; només amb un `round:started` nou. Un `answer:ack` d'una pregunta antiga també mostra "Resposta acceptada" perquè `OnClientAnswerAck` ignora el `questionId`.

7. **El botó A punt menteix i el començament no es valida.** `RoomScreenController.OnReadyClicked` canvia el text abans d'enviar i no el reverteix si arriba `room:ready:error`. `room:players` actualitza les fitxes però no sincronitza el botó local. Els camps `readyCount`, `readyRequired` i `canStart` del payload s'ignoren, així que el botó Començar sempre està actiu per a l'host i el rebuig del servidor arriba tard. A més, el xip de l'amfitrió no es ressalta: `CreatePlayerChip` espera `role == "host"`, però el backend envia `role: "player"` per a tothom; l'host només es dedueix per `hostId` a `AppBootstrap`.

8. **La configuració de `room:players` s'ignora.** Només `room:created`, `room:joined` i `room:configuration:updated` criden `SetConfiguration`. Si un snapshot de `room:players` porta una configuració nova (per exemple, canvi d'host o reentrada), la pantalla no s'actualitza. `maxPlayers` només s'assigna a `SetConfiguration`; si mai no s'ha cridat, val `0`.

9. **`room:state = playing` pot trepitjar el mode espectador.** `OnClientRoomState` mostra `Round` per a tothom, inclòs un observador que acaba de rebre `round:spectator`. L'últim missatge guanya. A més, en tornar a `lobby` no es netegen pregunta, resultat ni rànquing: la UI pot mostrar dades de la partida anterior.

10. **La identitat i la sala no sobreviuen al reinici.** `GuestId` i `ActiveRoomId` viuen només a `SessionStore` (memòria). En reiniciar sempre es declara `new` i es torna al lobby. El nickname sí que es desa a `PlayerPrefs`, però no es crida `PlayerPrefs.Save()`: un tancament brusc pot perdre l'últim canvi. A més, si el nickname inicial és buit, s'adopta el del servidor però no es desa. `GameClient.Nickname` només s'assigna a l'arrencada (`AppBootstrap.cs:159`); els canvis posteriors no s'hi reflecteixen, així que una reconnexió pot no restaurar la identitat encara que `SessionStore.GuestId` existeixi.

11. **No es pot publicar a WebGL.** `System.Net.WebSockets.ClientWebSocket` no existeix a WebGL. El client és només per a editor i builds d'escriptori. Tampoc no hi ha `.asmdef` per al codi del joc, així que tot va a `Assembly-CSharp` i no hi ha aïllament ni tests.

12. **La pantalla de perfil és decorativa.** `ProfileScreenController.Show(UserProfile)` no es crida enlloc; només s'usa `SetNickname`. Les estadístiques queden a `0`/`0%` i l'historial buit. La targeta `profile-card` del lobby està amagada i no s'omple. El model `UserProfile` i `GameHistoryEntry` no tenen cap origen de dades.

13. **El text del servidor es pot interpretar com a rich text.** Només el xat desactiva `enableRichText`; els nicknames, noms de sala, pregunta i explicació es pinten amb el valor per defecte d'UI Toolkit. Un nom amb etiquetes pot alterar la presentació (no executa codi, però pot fer spoofing visual).

14. **La documentació del contracte està desactualitzada.** `README.md` diu "11 enviaments" i "28 tipus"; el codi té **13 enviaments** i **31 tipus** de recepció (23 amb tractament + 8 errors). `GameClient.cs` fins i tot parla de "setze enviaments". Qui es guiï pel README es deixarà `catalog:options`, `chat:message` i `chat:error`.

15. **El codi de sala privada és el password.** `BuildInviteCode` retorna el password i el botó Copiar el posa al porta-retalls. Qui el tingui pot entrar a la sala. És el comportament dissenyat (el servidor genera 6 dígits), però no hi ha cap segon factor ni caducitat visible des del client; les mesures de rate limiting del servidor són **no determinades** des d'aquí.

16. **El filtre de categoria es reinicia amb cada `catalog:options`.** `MainScreenController.SetCategories` torna a posar `categoryFilter.value = "Totes"`. Com que el servidor pot empènyer `catalog:options` després de qualsevol canvi de catàleg, un usuari que estigui filtrant pot perdre la selecció sense fer res.

17. **La validació local del nickname és incompleta.** El modal només comprova longitud (3–15); no comprova el patró `^[a-zA-Z0-9_]+$` que aplica el servidor. Un nom amb espais o accents s'envia i el servidor el rebutja; l'error es mostra, però el flux és més llarg del necessari.

18. **El comptador és de paret, no de joc.** `SetQuestion` calcula `roundEndsAt` amb `DateTimeOffset.UtcNow`; un canvi de rellotge del sistema pot fer saltar el comptador. `Tick` només pinta el text: no desactiva el camp ni envia res en arribar a zero; la validació real la fa el servidor.

19. **El modal de nickname no es tanca en confirmar.** En rebre `nickname:updated`, `OnClientNicknameUpdated` crida `ApplyNickname`, que actualitza les etiquetes i `PlayerPrefs`, però `HideNicknameDialog` és privat i no s'invoca des d'enlloc. El modal queda obert fins que l'usuari prem Cancel·lar, tot i que el canvi ja s'ha aplicat.

20. **El mode mock no deixa entrar a les sales públiques.** `RoomApi` crea les dues sales amb `players = 0` i `maxPlayers = 0`; `RoomInfo.IsFull` (`players >= maxPlayers`) és cert i `MainScreenController` desactiva el botó `+`. En mock només es pot crear una sala o entrar per codi (que no es valida).

21. **Amb la finestra sense focus el client deixa de processar.** `runInBackground: 0`: Unity no crida `Update()`, així que `GameClient.Tick()` no buida la cua i `room.Tick()` no actualitza el comptador. Els missatges s'acumulen a la `ConcurrentQueue` i es processen de cop en tornar; una desconnexió o un `round:started` es veuen amb retard.

22. **`isReady` sobreviu entre sales i partides.** `RoomScreenController` es crea una sola vegada i `isReady` (i el text del botó A punt) no es reinicien a `ShowRoom`, `ClearChat` ni quan el servidor torna la sala a `lobby` després de `game:finished`. El botó pot dir "No estic a punt" mentre el servidor té `ready: false`; el primer clic envia `false` i no passa res visible.

23. **Els avisos del sistema es confonen amb el xat.** El servidor injecta `chat:message` amb `senderId: null`, `senderName: "SISTEMA"` i `system: true` en entrar, sortir i canviar el ready. El client ignora `system` i els pinta igual que els missatges dels jugadors (i compten per al topall de 200).

24. **La categoria per defecte no coincideix amb el filtre.** El backend crea les sales amb `category: "mix"`; el filtre del lobby afegeix `Mix` amb majúscula i compara exacte (`room.category != category`), de manera que filtrar per `Mix` pot amagar les sales acabades de crear. El desplegable de la sala també afegeix `Mix` mentre el valor del servidor és `mix`.

---

### Resum de límits no determinats

- El comportament del servidor davant d'un `guestId` fals, d'un `roomId` aliè o d'un `room:join` amb camps que ignora (el client només llegeix el codi).
- Si el `catalog-service` fa rate limiting o quant triga; el `game-service` hi posa un timeout de 5 s i respon `catalog:options { ok:false }`.
- Si el `ClientWebSocket` d'Unity envia pings de keepalive; el codi no en configura cap.
- L'esquema exacte de tots els payloads del servidor més enllà del que el client llegeix; el client tolera `payload` o arrel, i camps alternatius `id`/`guestId` i `nickname`/`nickanme`.
- L'estat amb usuaris registrats: el backend accepta `identity.token`, però el client no l'envia mai.
- El comportament visual real (resolució, focus, DPI) no s'ha provat: anàlisi estàtica sense executar Unity.
