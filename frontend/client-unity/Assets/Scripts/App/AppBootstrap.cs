//ARXIU QUE ARRANCA EL CLIENT, CREA LES PANTALLES I CONNECTA ELS SEUS ESDEVENIMENTS AMB EL SERVIDOR

//=====================
//IMPORTEM
//=====================
using System.Collections;
using System.Collections.Generic;
using Models;
using Router;
using UnityEngine;
using UnityEngine.UIElements;

//=====================
//CLASSE: AppBootstrap
//SI AppConfig.UseMock ES TRUE FUNCIONA AMB DADES SIMULADES
//SI ÉS FALSE PARLA AMB EL GAME-SERVICE PER WEBSOCKET
//S'HA DE POSAR AL MATEIX GAMEOBJECT QUE EL UIDocument
//LES PANTALLES ARRIBEN PER L'INSPECTOR I ES REGISTREN AL ROUTER
//=====================
[RequireComponent(typeof(UIDocument))]
public class AppBootstrap : MonoBehaviour
{
    //=====================
    //REFERÈNCIES DE L'INSPECTOR
    //=====================
    [Header("Arrastra aquí los cuatro UXML de la interfaz")]
    [SerializeField] VisualTreeAsset mainScreenAsset;
    [SerializeField] VisualTreeAsset roomScreenAsset;
    [SerializeField] VisualTreeAsset profileScreenAsset;
    [SerializeField] VisualTreeAsset createRoomDialogAsset;

    //=====================
    //ESTAT INTERN
    //=====================
    enum Pending { None, Creating, Joining }

    const string MockId = "me";

    MainScreenController main;
    RoomScreenController room;
    CreateRoomDialogController dialog;
    ProfileScreenController profile;

    ScreenRouter router;
    GameClient client;

    string nickname = "Jugador";
    string myId = MockId;
    string currentRoomId;
    bool isHost;
    Pending pending = Pending.None;
    List<RoomListItem> rooms = new List<RoomListItem>();

    //=====================
    //PROPIETAT: CLAU DE PlayerPrefs PER AL NICKNAME
    //SEPAREM EDITOR I BUILD PER NO BARREJAR DADES
    //=====================
    static string NicknameKey
    {
        get
        {
            if (Application.isEditor)
            {
                return "nickname_editor";
            }

            return "nickname_build";
        }
    }

    //=====================
    //MÈTODE: OnEnable
    //PREPARA LES PANTALLES, ELS CONTROLADORS I LA CONNEXIÓ
    //=====================
    void OnEnable()
    {
        UIDocument document = GetComponent<UIDocument>();
        VisualElement root = document.rootVisualElement;

        //COMPROVEM QUE TOTS ELS UXML ESTAN ARROSSEGATS A L'INSPECTOR
        if (mainScreenAsset == null)
        {
            Debug.LogError("AppBootstrap: falta MainScreen.uxml en el Inspector.");
            return;
        }

        if (roomScreenAsset == null)
        {
            Debug.LogError("AppBootstrap: falta RoomScreen.uxml en el Inspector.");
            return;
        }

        if (profileScreenAsset == null)
        {
            Debug.LogError("AppBootstrap: falta ProfileScreen.uxml en el Inspector.");
            return;
        }

        if (createRoomDialogAsset == null)
        {
            Debug.LogError("AppBootstrap: falta CreateRoomDialog.uxml en el Inspector.");
            return;
        }

        //RECUPEREM EL NICKNAME GUARDAT
        nickname = PlayerPrefs.GetString(NicknameKey, "");

        //BUIDEM EL QUE HAGI POSAT EL UIDOCUMENT: TOT VE DELS UXML DE L'INSPECTOR
        root.Clear();

        //INSTANCIEM LES TRES PANTALLES
        VisualElement mainElement = InstantiateScreen(root, mainScreenAsset);
        VisualElement roomElement = InstantiateScreen(root, roomScreenAsset);
        VisualElement profileElement = InstantiateScreen(root, profileScreenAsset);

        //EL DIÀLEG ÉS UNA CAPA SOBREPOSADA, NO UNA PANTALLA DEL ROUTER
        //LI DONEM TOTA LA PANTALLA: SENSE AIXÒ EL CONTENIDOR FA 0 D'ALÇADA I NO ES VEU MAI
        VisualElement dialogElement = createRoomDialogAsset.Instantiate();
        dialogElement.style.position = Position.Absolute;
        dialogElement.style.left = 0;
        dialogElement.style.top = 0;
        dialogElement.style.right = 0;
        dialogElement.style.bottom = 0;
        //SI EL CONTENIDOR TAPA TOTA LA PANTALLA I ÉS "PICKABLE", ES MENJA ELS CLICS DELS BOTONS
        dialogElement.pickingMode = PickingMode.Ignore;
        root.Add(dialogElement);

        //REGISTREM LES TRES PANTALLES AL ROUTER
        router = new ScreenRouter();
        router.Register("main", mainElement);
        router.Register("room", roomElement);
        router.Register("profile", profileElement);

        //CREEM UN CONTROLADOR PER A CADA PANTALLA I PER AL DIÀLEG
        main = new MainScreenController(mainElement);
        room = new RoomScreenController(roomElement);
        dialog = new CreateRoomDialogController(dialogElement);
        profile = new ProfileScreenController(profileElement);

        main.SetNickname(nickname);
        profile.SetNickname(nickname);

        //ENLLAÇEM ELS ESDEVENIMENTS DE LES PANTALLES
        WireScreens();

        //COMENCEM DIRECTAMENT PER LA PANTALLA PRINCIPAL
        router.Show("main");

        //EN MODE SIMULAT CARREGUEM LES SALES D'EXEMPLE
        if (AppConfig.UseMock)
        {
            LoadMockCatalogOptions();
            StartCoroutine(LoadRoomsMock());
            return;
        }

        //EN MODE REAL OBRIM EL WEBSOCKET
        client = new GameClient();
        client.Nickname = nickname;
        WireClient();
        main.ShowLoading();
        client.Connect(AppConfig.WsUrl);
    }

    //=====================
    //MÈTODE: Update
    //PASSA AL FIL PRINCIPAL ELS MISSATGES REBUTS
    //ACTUALITZA EL COMPTE ENRERE DE LA RONDA
    //=====================
    void Update()
    {
        if (client == null)
        {
            return;
        }

        client.Tick();

        //ACTUALITZA EL COMPTE ENRERE DE LA RONDA (COM VUE RoundTimer)
        if (room != null)
        {
            room.Tick();
        }
    }

    //=====================
    //MÈTODE: OnDisable
    //TANCA LA CONNEXIÓ
    //=====================
    void OnDisable()
    {
        if (client == null)
        {
            return;
        }

        client.Dispose();
    }

    //=====================
    //MÈTODE: InstantiateScreen
    //INSTANCIA UN UXML DE PANTALLA I EL PENJA AL ROOT
    //=====================
    static VisualElement InstantiateScreen(VisualElement root, VisualTreeAsset asset)
    {
        VisualElement element = asset.Instantiate();
        element.style.flexGrow = 1;
        root.Add(element);
        return element;
    }

    //=====================
    //MÈTODE: WireScreens
    //ENLLAÇA ELS ESDEVENIMENTS DE LES PANTALLES AMB ELS SEUS MÈTODES
    //=====================
    void WireScreens()
    {
        main.OnRetry += OnMainRetry;
        main.OnProfile += OnMainProfile;
        main.OnNicknameChanged += OnMainNicknameChanged;
        main.OnCreateRoom += OnMainCreateRoom;
        main.OnJoinPublic += OnMainJoinPublic;
        main.OnJoinPrivate += OnMainJoinPrivate;

        dialog.OnCreate += OnDialogCreate;
        dialog.OnCancel += OnDialogCancel;

        room.OnLeave += OnRoomLeave;
        room.OnCopyCode += OnRoomCopyCode;
        room.OnReady += OnRoomReady;
        room.OnStartGame += OnRoomStartGame;
        room.OnSaveConfiguration += OnRoomSaveConfiguration;
        room.OnSendAnswer += OnRoomSendAnswer;
        room.OnNextRound += OnRoomNextRound;
        room.OnSendChat += OnRoomSendChat;

        profile.OnBack += OnProfileBack;
    }

    //=====================
    //EVENT: BOTÓ DE REINTENTAR A LA PANTALLA PRINCIPAL
    //TORNEM A CARREGAR LES SALES
    //=====================
    void OnMainRetry()
    {
        main.ShowLoading();

        if (AppConfig.UseMock)
        {
            StartCoroutine(LoadRoomsMock());
            return;
        }

        if (client.IsConnected)
        {
            client.RequestRooms();
            return;
        }

        client.Connect(AppConfig.WsUrl);
    }

    //=====================
    //EVENT: BOTÓ DE PERFIL A LA PANTALLA PRINCIPAL
    //=====================
    void OnMainProfile()
    {
        profile.SetNickname(nickname);
        router.Show("profile");
    }

    //=====================
    //EVENT: BOTÓ DE TORNAR DE LA PANTALLA DE PERFIL
    //=====================
    void OnProfileBack()
    {
        router.Show("main");
    }

    //=====================
    //EVENT: CANVI DE NICKNAME A LA PANTALLA PRINCIPAL
    //EL GUARDEM I L'ENVIEM AL SERVIDOR
    //=====================
    void OnMainNicknameChanged(string newName)
    {
        //IGUAL QUE VUE: L'ESTAT NO ES TOCA FINS QUE EL SERVIDOR CONFIRMI (nickname:updated)
        //SI EL SERVIDOR EL REBUTJA, EL NICK SEGUEIX SENT L'ANTERIOR
        if (AppConfig.UseMock)
        {
            ApplyNickname(newName);
            return;
        }

        if (client == null || client.IsConnected == false)
        {
            //SENSE CONNEXIÓ NO HI HA SOCKET: HO DESEM EN LOCAL
            Debug.LogWarning("Nickname desat en local: no hi ha connexió amb el servidor.");
            ApplyNickname(newName);
            return;
        }

        client.UpdateNickname(newName);
    }

    void ApplyNickname(string newName)
    {
        nickname = newName;
        PlayerPrefs.SetString(NicknameKey, nickname);
        main.SetNickname(nickname);
        profile.SetNickname(nickname);
    }

    //=====================
    //EVENT: BOTÓ DE CREAR SALA A LA PANTALLA PRINCIPAL
    //OBRIM EL DIÀLEG DE CREACIÓ
    //=====================
    void OnMainCreateRoom(string roomName)
    {
        dialog.Reset(nickname);
        dialog.Show();
    }

    //=====================
    //EVENT: DIÀLEG DE CREACIÓ CANCEL·LAT
    //=====================
    void OnDialogCancel()
    {
        dialog.Hide();
    }

    //=====================
    //EVENT: DIÀLEG DE CREACIÓ ENVIAT
    //DEMANEM AL SERVIDOR QUE CREÏ LA SALA
    //EL NICKNAME EL POSA AQUESTA CLASSE: EL MISSATGE NO EL PORTA
    //=====================
    void OnDialogCreate(CreateRoomMessage message)
    {
        if (AppConfig.UseMock)
        {
            string mockCode = "";
            if (message.isPrivate)
            {
                mockCode = GenerateCode();
            }

            dialog.Hide();
            OpenRoomMock(message.nameRoom, "", mockCode, true);
            return;
        }

        if (client == null)
        {
            dialog.ShowServerError("Sense connexió amb el servidor.");
            return;
        }

        if (client.IsConnected == false)
        {
            dialog.ShowServerError("Sense connexió amb el servidor.");
            return;
        }

        pending = Pending.Creating;

        dialog.SetBusy(true);
        client.CreateRoom(nickname, message.maxPlayers, message.isPrivate, message.nameRoom);
    }

    //=====================
    //EVENT: UNIR-SE A UNA SALA PÚBLICA
    //=====================
    void OnMainJoinPublic(RoomInfo roomInfo)
    {
        if (roomInfo == null)
        {
            return;
        }

        if (AppConfig.UseMock)
        {
            OpenRoomMock(roomInfo.name, roomInfo.category, "", false);
            return;
        }

        StartJoin(roomInfo.id, null, false, roomInfo.maxPlayers);
    }

    //=====================
    //=====================
    //EVENT: UNIR-SE A UNA SALA PRIVADA AMB CODI
    //EL CODI ÉS NOMÉS EL PASSWORD (COM VUE), NO roomId:password
    //=====================
    void OnMainJoinPrivate(string code)
    {
        if (AppConfig.UseMock)
        {
            OpenRoomMock("Sala privada", "", code, false);
            return;
        }

        //VALIDEM QUE EL CODI NO ESTIGUI BUIT
        if (string.IsNullOrEmpty(code))
        {
            main.ShowError("Introdueix el codi de la sala privada.");
            return;
        }

        //ENVIEM roomId = null I EL password (COM VUE)
        //EL BACKEND TROBA LA SALA PER PASSWORD
        StartJoin(null, code, true, null);
    }

    //=====================
    //MÈTODE: StartJoin
    //DEMANA AL SERVIDOR ENTRAR EN UNA SALA
    //=====================
    void StartJoin(string roomId, string password, bool isPrivate, int? maxPlayers)
    {
        if (client.IsConnected == false)
        {
            main.ShowError("Sense connexió amb el servidor.");
            return;
        }

        pending = Pending.Joining;

        client.JoinRoom(roomId, nickname, password, maxPlayers, isPrivate);
    }

    //=====================
    //MÈTODE: CanSend
    //DIU SI ES POT ENVIAR UN MISSATGE AL SERVIDOR
    //=====================
    bool CanSend()
    {
        if (AppConfig.UseMock)
        {
            return false;
        }

        if (client == null)
        {
            return false;
        }

        if (client.IsConnected == false)
        {
            return false;
        }

        return true;
    }

    //=====================
    //EVENT: BOTÓ DE SORTIR DE LA SALA
    //AVISEM EL SERVIDOR I TORNEM A LA PANTALLA PRINCIPAL
    //=====================
    void OnRoomLeave()
    {
        if (AppConfig.UseMock == false)
        {
            if (currentRoomId != null)
            {
                if (client.IsConnected)
                {
                    client.LeaveRoom(currentRoomId);
                }
            }
        }

        currentRoomId = null;
        isHost = false;
        SessionStore.ClearActiveRoom();
        room.ClearChat();
        GoHome();
    }

    //=====================
    //EVENT: BOTÓ DE COPIAR EL CODI D'INVITACIÓ
    //=====================
    void OnRoomCopyCode(string code)
    {
        GUIUtility.systemCopyBuffer = code;
        room.SetInviteCode(code);
    }

    //=====================
    //EVENT: BOTÓ D'A PUNT
    //=====================
    void OnRoomReady(bool ready)
    {
        if (CanSend() == false)
        {
            return;
        }

        client.SetReady(ready);
    }

    //=====================
    //EVENT: BOTÓ DE COMENÇAR LA PARTIDA
    //=====================
    void OnRoomStartGame()
    {
        if (CanSend() == false)
        {
            return;
        }

        client.StartGame();
    }

    //=====================
    //EVENT: BOTÓ DE DESAR LA CONFIGURACIÓ
    //=====================
    void OnRoomSaveConfiguration(RoomConfigurationData configuration)
    {
        if (CanSend() == false)
        {
            return;
        }

        client.UpdateConfiguration(configuration);
    }

    //=====================
    //EVENT: BOTÓ D'ENVIAR LA RESPOSTA
    //=====================
    void OnRoomSendAnswer(int questionId, int answer)
    {
        if (CanSend() == false)
        {
            return;
        }

        client.SubmitAnswer(questionId, answer);
    }

    //=====================
    //EVENT: BOTÓ DE SEGÜENT RONDA
    //=====================
    void OnRoomNextRound()
    {
        if (CanSend() == false)
        {
            return;
        }

        client.NextRound();
    }

    //=====================
    //EVENT: MISSATGE DE XAT ENVIAT PEL JUGADOR
    //NOMÉS L'ENVIA: LA LLISTA L'ACTUALITZA EL MISSATGE QUE TORNA DEL SERVIDOR
    //=====================
    void OnRoomSendChat(string text)
    {
        if (CanSend() == false)
        {
            room.ShowError("Sense connexió amb el servidor.");
            return;
        }

        client.SendChatMessage(text);
    }

    //=====================
    //MÈTODE: WireClient
    //ENLLAÇA ELS ESDEVENIMENTS DEL SERVIDOR AMB ELS SEUS MÈTODES
    //=====================
    void WireClient()
    {
        client.OnIdentity += OnClientIdentity;
        client.OnDisconnected += OnClientDisconnected;
        client.OnRoomsList += OnClientRoomsList;
        client.OnCatalogOptions += OnClientCatalogOptions;
        client.OnRoomAdded += OnClientRoomAdded;
        client.OnRoomRemoved += OnClientRoomRemoved;
        client.OnRoomCreated += OnClientRoomCreated;
        client.OnRoomJoined += OnClientRoomJoined;
        client.OnRoomPlayers += OnClientRoomPlayers;
        client.OnRoomLeft += OnClientRoomLeft;
        client.OnRoomState += OnClientRoomState;
        client.OnNicknameUpdated += OnClientNicknameUpdated;
        client.OnReadyError += OnClientReadyError;
        client.OnConfigurationUpdated += OnClientConfigurationUpdated;
        client.OnConfigurationError += OnClientConfigurationError;
        client.OnRoundStarted += OnClientRoundStarted;
        client.OnSpectatorRound += OnClientSpectatorRound;
        client.OnRoundResults += OnClientRoundResults;
        client.OnRoundRanking += OnClientRoundRanking;
        client.OnGameFinished += OnClientGameFinished;
        client.OnAnswerAck += OnClientAnswerAck;
        client.OnRoundNextError += OnClientRoundNextError;
        client.OnChatMessage += OnClientChatMessage;
        client.OnServerError += OnClientServerError;
        client.OnOther += OnClientOther;
    }

    //=====================
    //EVENT: IDENTITAT CONFIRMADA
    //GUARDEM L'ID I SINCRONITZEM EL NICKNAME
    //=====================
    void OnClientIdentity(ServerIdentity identity)
    {
        myId = identity.Id;
        Debug.Log("[GameClient] identidad: " + identity.Id + " (" + identity.Nick + ")");

        //SI NO TENIM NICKNAME ENS QUEDEM EL QUE ENS DONA EL SERVIDOR
        if (string.IsNullOrEmpty(nickname))
        {
            nickname = identity.Nick;
            main.SetNickname(nickname);
            profile.SetNickname(nickname);
        }

        //SI TENIM UN NICKNAME DIFERENT L'ENVIEM AL SERVIDOR
        else if (identity.Nick != nickname)
        {
            client.UpdateNickname(nickname);
            main.SetNickname(nickname);
        }

        else
        {
            main.SetNickname(identity.Nick);
        }

        //DEMANEM LA LLISTA DE SALES I EL CATÀLEG
        client.RequestRooms();
        client.RequestCatalog();

        //SI TENIM UNA SALA ACTIVA LA REPRENEM
        if (SessionStore.HasActiveRoom())
        {
            pending = Pending.Joining;
            client.JoinRoom(SessionStore.ActiveRoomId, nickname, SessionStore.ActiveRoomPassword, null, false);
        }
    }

    //=====================
    //EVENT: CATÀLEG REBUT
    //ACTUALITZA EL FILTRE DE LA PANTALLA PRINCIPAL I ELS DESPLEGABLES DE SALA
    //=====================
    void OnClientCatalogOptions(CatalogOptions options)
    {
        if (options == null)
        {
            return;
        }

        if (main != null)
        {
            main.SetCategories(options.categories);
        }

        if (room != null)
        {
            room.SetCategories(options.categories);
            room.SetDifficulties(options.difficulties);
        }
    }

    //=====================
    //EVENT: CONNEXIÓ PERDUDA
    //TORNEM A LA PANTALLA PRINCIPAL I MOSTREM L'ERROR
    //=====================
    void OnClientDisconnected(string reason)
    {
        currentRoomId = null;
        isHost = false;
        pending = Pending.None;
        dialog.SetBusy(false);

        router.Show("main");

        main.ShowError("No hi ha connexió amb el servidor (" + reason + ")");
    }

    //=====================
    //EVENT: LLISTA DE SALES REBUDA
    //=====================
    void OnClientRoomsList(List<RoomListItem> list)
    {
        rooms.Clear();

        foreach (RoomListItem item in list)
        {
            rooms.Add(item);
        }

        RefreshRooms();
    }

    //=====================
    //EVENT: SALA NOVA AL SERVIDOR
    //NOMÉS AFEGIM LES PÚBLIQUES QUE NO TINGUEM JA
    //=====================
    void OnClientRoomAdded(RoomListItem item)
    {
        if (item.isPrivate)
        {
            return;
        }

        if (RoomExists(item.Id))
        {
            return;
        }

        rooms.Add(item);
        RefreshRooms();
    }

    //=====================
    //EVENT: SALA ELIMINADA AL SERVIDOR
    //=====================
    void OnClientRoomRemoved(string id)
    {
        RemoveRoom(id);
        RefreshRooms();

        //SI ERA LA NOSTRA SALA LA DEIXEM I TORNEM A LA PANTALLA PRINCIPAL
        if (id == SessionStore.ActiveRoomId)
        {
            SessionStore.ClearActiveRoom();
            currentRoomId = null;
            isHost = false;
            GoHome();
        }
    }

    //=====================
    //EVENT: SALA CREADA
    //NOMÉS ENS INTERESSA SI NOSALTRES L'HEM DEMANADA
    //=====================
    void OnClientRoomCreated(RoomCreatedData created)
    {
        if (pending != Pending.Creating)
        {
            return;
        }

        pending = Pending.None;
        currentRoomId = created.roomId;
        SessionStore.SetActiveRoom(created.roomId, created.password);

        dialog.SetBusy(false);
        dialog.Hide();

        string inviteCode = BuildInviteCode(created.isPrivate, created.roomId, created.password);
        List<LobbyPlayer> players = ToLobbyPlayers(created.players);

        //PINTEN LA CONFIGURACIÓ QUE ENVIA EL BACKEND (COM VUE)
        RoomConfigurationData configuration = new RoomConfigurationData();
        configuration.category = created.category;
        configuration.difficulty = created.difficulty;
        configuration.maxPlayers = created.maxPlayers;
        configuration.rounds = created.rounds;
        configuration.durationSeconds = created.durationSeconds;
        room.SetConfiguration(configuration);

        ShowRoom(created.nameRoom, created.category, inviteCode, players, created.hostId == myId);
    }

    //=====================
    //EVENT: HEM ENTRAT EN UNA SALA
    //NOMÉS ENS INTERESSA SI NOSALTRES L'HEM DEMANADA
    //=====================
    void OnClientRoomJoined(RoomPlayersData joined)
    {
        if (pending != Pending.Joining)
        {
            return;
        }

        pending = Pending.None;
        currentRoomId = joined.roomId;
        SessionStore.SetActiveRoom(joined.roomId, joined.password);

        string inviteCode = BuildInviteCode(joined.isPrivate, joined.roomId, joined.password);
        List<LobbyPlayer> players = ToLobbyPlayers(joined.players);

        //PINTEN LA CONFIGURACIÓ QUE ENVIA EL BACKEND (COM VUE)
        RoomConfigurationData configuration = new RoomConfigurationData();
        configuration.category = joined.category;
        configuration.difficulty = joined.difficulty;
        configuration.maxPlayers = joined.maxPlayers;
        configuration.rounds = joined.rounds;
        configuration.durationSeconds = joined.durationSeconds;
        room.SetConfiguration(configuration);

        ShowRoom(joined.nameRoom, joined.category, inviteCode, players, joined.hostId == myId);
    }

    //=====================
    //EVENT: CANVIEN ELS JUGADORS DE LA SALA
    //NOMÉS ACTUALITZEM SI ÉS LA NOSTRA SALA
    //=====================
    void OnClientRoomPlayers(RoomPlayersData data)
    {
        if (data.roomId != currentRoomId)
        {
            return;
        }

        //EL SERVIDOR POT CANVIAR L'AMFITRIÓ QUAN MARCHEM
        isHost = data.hostId == myId;

        List<LobbyPlayer> players = ToLobbyPlayers(data.players);
        room.SetPlayers(players, myId);
    }

    //=====================
    //EVENT: EL SERVIDOR ENS HA TREGUT DE LA SALA
    //NETEGEM LA SALA ACTIVA I TORNEM A LA PANTALLA PRINCIPAL
    //=====================
    void OnClientRoomLeft(string roomId)
    {
        SessionStore.ClearActiveRoom();
        currentRoomId = null;
        isHost = false;
        room.ClearChat();
        GoHome();
    }

    //=====================
    //EVENT: ERROR DEL SERVIDOR
    //EL MOSTREM A LA PANTALLA QUE CORRESPON A L'OPERACIÓ PENDENT
    //=====================
    void OnClientServerError(string type, string message)
    {
        Debug.LogWarning("[SERVIDOR] " + type + ": " + message);

        //EL SERVIDOR HA REBUTJAT EL NICK: EL MODAL SEGUEIX OBERT I MOSTREM L'ERROR
        if (type == "nickname:error")
        {
            main.SetNicknameError(message);
            return;
        }

        if (pending == Pending.Creating)
        {
            pending = Pending.None;
            dialog.SetBusy(false);
            dialog.ShowServerError(message);
            return;
        }

        if (pending == Pending.Joining)
        {
            pending = Pending.None;
            SessionStore.ClearActiveRoom();
            main.ShowError(message);
            return;
        }

        //AQUESTS TIPUS NO TENEN UN ESDEVENIMENT PROPI
        if (type == "chat:error")
        {
            if (currentRoomId != null)
            {
                ShowRoomError(message);
                return;
            }

            main.ShowError(message);
            return;
        }

        if (type == "round:error")
        {
            ShowRoomError(message);
            return;
        }

        if (type == "answer:error")
        {
            ShowRoomError(message);
            return;
        }
    }

    //=====================
    //EVENT: MISSATGE DE XAT REBUT
    //=====================
    void OnClientChatMessage(ChatMessageData message)
    {
        room.AddChatMessage(message);
    }

    //=====================
    //EVENT: MISSATGE DEL SERVIDOR SENSE TRACTAR
    //=====================
    void OnClientOther(string type, JToken data)
    {
        Debug.Log("[SERVIDOR] mensaje sin tratar: " + type);
    }

    //=====================
    //SECCIÓ: ESDEVENIMENTS DE SALA I PARTIDA
    //CADA UN PINTA LA SECCIÓ QUE LI TOCA A LA PANTALLA DE SALA
    //=====================

    //=====================
    //EVENT: HA CANVIAT L'ESTAT DE LA SALA
    //EL MISSATGE NOMÉS PORTA ESTAT: ELS JUGADORS ARRIBEN A PART
    //=====================
    void OnClientRoomState(RoomStateData roomState)
    {
        if (roomState.roomId != currentRoomId)
        {
            return;
        }

        //AL LOBBY EL HOST TORNA A VEURE LA CONFIGURACIÓ
        if (roomState.state == "lobby")
        {
            if (isHost)
            {
                room.Show(RoomScreenState.Setup);
            }
            else
            {
                room.Show(RoomScreenState.Waiting);
            }

            return;
        }

        if (roomState.state == "playing")
        {
            room.Show(RoomScreenState.Round);
            return;
        }

        if (roomState.state == "finished")
        {
            room.Show(RoomScreenState.Finished);
        }
    }

    //=====================
    //EVENT: EL SERVIDOR HA CONFIRMAT EL NICKNAME
    //EL GUARDEM COM LA RESTA DEL CLIENT
    //=====================
    void OnClientNicknameUpdated(string newName)
    {
        //EL SERVIDOR HA CONFIRMAT: ARA SÍ QUE APLIQUEM EL NICK
        ApplyNickname(newName);
    }

    //=====================
    //EVENT: ERROR EN MARCAR-SE A PUNT
    //=====================
    void OnClientReadyError(string message)
    {
        ShowRoomError(message);
    }

    //=====================
    //EVENT: CONFIGURACIÓ DE LA SALA CONFIRMADA
    //=====================
    void OnClientConfigurationUpdated(RoomConfigurationData configuration)
    {
        room.SetConfiguration(configuration);
    }

    //=====================
    //EVENT: ERROR EN CANVIAR LA CONFIGURACIÓ
    //=====================
    void OnClientConfigurationError(string message)
    {
        ShowRoomError(message);
    }

    //=====================
    //EVENT: HA COMENÇAT UNA RONDA
    //=====================
    void OnClientRoundStarted(RoundStartedData round)
    {
        room.Show(RoomScreenState.Round);
        room.SetQuestion(round);
    }

    //=====================
    //EVENT: RONDA VISTA PER UN OBSERVADOR
    //=====================
    void OnClientSpectatorRound(SpectatorRoundData round)
    {
        room.SetSpectator(round);
        room.Show(RoomScreenState.Spectator);
    }

    //=====================
    //EVENT: RESULTAT DE LA RONDA
    //=====================
    void OnClientRoundResults(RoundResultsData results)
    {
        room.SetResult(results);
        room.Show(RoomScreenState.Result);
    }

    //=====================
    //EVENT: RÀNQUING DE LA RONDA
    //=====================
    void OnClientRoundRanking(RoundRankingData ranking)
    {
        room.SetRanking(ranking);
        room.SetNextRoundVisible(isHost);
        room.Show(RoomScreenState.Ranking);
    }

    //=====================
    //EVENT: S'HA ACABAT LA PARTIDA
    //=====================
    void OnClientGameFinished(GameFinishedData finished)
    {
        room.SetFinished(finished);
        room.Show(RoomScreenState.Finished);
    }

    //=====================
    //EVENT: RESPOSTA ACCEPTADA PEL SERVIDOR
    //=====================
    void OnClientAnswerAck(int questionId)
    {
        room.SetAnswerStatus("Resposta acceptada");
        room.Show(RoomScreenState.Round);
    }

    //=====================
    //EVENT: ERROR EN PASSAR A LA SEGÜENT RONDA
    //=====================
    void OnClientRoundNextError(string message)
    {
        ShowRoomError(message);
    }

    //=====================
    //MÈTODE: ShowRoom
    //OBRE LA PANTALLA DE SALA EN CONFIGURACIÓ O EN ESPERA
    //=====================
    void ShowRoom(string name, string category, string inviteCode, List<LobbyPlayer> players, bool host)
    {
        //SI EL SERVIDOR NO ENS DONA NOM MOSTREM L'ID DE LA SALA
        string roomName = name;
        if (string.IsNullOrEmpty(roomName))
        {
            roomName = currentRoomId;
        }

        isHost = host;

        room.ShowError("");
        room.ClearChat();
        room.SetRoom(roomName, category);
        room.SetInviteCode(inviteCode);
        room.SetPlayers(players, myId);

        if (host)
        {
            room.Show(RoomScreenState.Setup);
        }
        else
        {
            room.Show(RoomScreenState.Waiting);
        }

        router.Show("room");
    }

    //=====================
    //MODE SIMULAT: CARREGA CATEGORIES I DIFICULTATS LOCALS
    //=====================
    void LoadMockCatalogOptions()
    {
        List<string> categories = new List<string>();
        categories.Add("Futbol");
        categories.Add("Ciencia");
        categories.Add("Esports");

        List<string> difficulties = new List<string>();
        difficulties.Add("facil");
        difficulties.Add("mitjana");
        difficulties.Add("dificil");

        if (main != null)
        {
            main.SetCategories(categories);
        }

        if (room != null)
        {
            room.SetCategories(categories);
            room.SetDifficulties(difficulties);
        }
    }

    //=====================
    //MÈTODE: ShowRoomError
    //MOSTRA UN ERROR A LA PANTALLA DE SALA SI SOM DINS D'UNA
    //=====================
    void ShowRoomError(string message)
    {
        if (currentRoomId == null)
        {
            return;
        }

        room.ShowError(message);
    }

    //=====================
    //MÈTODE: BuildInviteCode
    //EL CODI D'INVITACIÓ NOMÉS EXISTEIX A LES SALES PRIVADES
    //MOSTREM NOMÉS EL PASSWORD (COM VUE), NO EL roomId
    //=====================
    static string BuildInviteCode(bool isPrivate, string roomId, string password)
    {
        if (isPrivate == false)
        {
            return "";
        }

        return password;
    }

    //=====================
    //MÈTODE: RefreshRooms
    //PASSA LA LLISTA DE SALES A LA PANTALLA PRINCIPAL
    //=====================
    void RefreshRooms()
    {
        List<RoomInfo> infos = new List<RoomInfo>();

        foreach (RoomListItem roomItem in rooms)
        {
            if (roomItem.isPrivate)
            {
                continue;
            }

            RoomInfo info = BuildRoomInfo(roomItem);
            infos.Add(info);
        }

        main.ShowRooms(infos);
    }

    //=====================
    //MÈTODE: BuildRoomInfo
    //CONVERTEIX UNA SALA DEL SERVIDOR EN UNA FILA DE LA LLISTA
    //=====================
    RoomInfo BuildRoomInfo(RoomListItem roomItem)
    {
        string roomName = roomItem.name;
        if (string.IsNullOrEmpty(roomName))
        {
            roomName = roomItem.Id;
        }

        RoomInfo info = new RoomInfo();
        info.id = roomItem.Id;
        info.name = roomName;
        info.players = roomItem.players;
        info.maxPlayers = roomItem.maxPlayers;
        info.category = roomItem.category;
        info.isPrivate = roomItem.isPrivate;
        info.state = roomItem.state;
        return info;
    }

    //=====================
    //MÈTODE: RoomExists
    //DIU SI JA TENIM AQUESTA SALA A LA LLISTA
    //=====================
    bool RoomExists(string id)
    {
        foreach (RoomListItem roomItem in rooms)
        {
            if (roomItem.Id == id)
            {
                return true;
            }
        }

        return false;
    }

    //=====================
    //MÈTODE: RemoveRoom
    //TREU UNA SALA DE LA LLISTA
    //=====================
    void RemoveRoom(string id)
    {
        for (int i = rooms.Count - 1; i >= 0; i--)
        {
            if (rooms[i].Id == id)
            {
                rooms.RemoveAt(i);
            }
        }
    }

    //=====================
    //MÈTODE: ToLobbyPlayers
    //CONVERTEIX ELS JUGADORS DEL SERVIDOR ALS DE LA PANTALLA
    //=====================
    static List<LobbyPlayer> ToLobbyPlayers(List<ServerPlayer> players)
    {
        List<LobbyPlayer> list = new List<LobbyPlayer>();

        if (players == null)
        {
            return list;
        }

        foreach (ServerPlayer player in players)
        {
            LobbyPlayer lobbyPlayer = new LobbyPlayer();
            lobbyPlayer.id = player.id;
            lobbyPlayer.nickname = player.nickname;
            lobbyPlayer.score = player.score;
            lobbyPlayer.ready = player.ready;
            lobbyPlayer.role = player.role;
            list.Add(lobbyPlayer);
        }

        return list;
    }

    //=====================
    //MÈTODE: GoHome
    //TORNA A LA PANTALLA PRINCIPAL I REFRESCA LES SALES
    //=====================
    void GoHome()
    {
        router.Show("main");

        if (AppConfig.UseMock)
        {
            StartCoroutine(LoadRoomsMock());
            return;
        }

        if (client.IsConnected)
        {
            client.RequestRooms();
        }
    }

    //=====================
    //MÈTODE: LoadRoomsMock
    //CARREGA LES SALES SIMULADES
    //=====================
    IEnumerator LoadRoomsMock()
    {
        main.ShowLoading();
        yield return RoomApi.GetPublicRooms(OnMockRoomsLoaded);
    }

    //=====================
    //MÈTODE: OnMockRoomsLoaded
    //MOSTRA LES SALES SIMULADES O EL SEU ERROR
    //=====================
    void OnMockRoomsLoaded(RoomApiResult result)
    {
        if (result.Ok)
        {
            main.ShowRooms(result.Data);
            return;
        }

        main.ShowError(result.Error);
    }

    //=====================
    //MÈTODE: OpenRoomMock
    //OBRE LA PANTALLA DE SALA AMB DADES SIMULADES
    //=====================
    void OpenRoomMock(string name, string category, string inviteCode, bool host)
    {
        List<LobbyPlayer> players = new List<LobbyPlayer>();

        LobbyPlayer me = new LobbyPlayer();
        me.id = MockId;
        me.nickname = nickname;
        me.ready = false;
        me.role = "player";

        if (host)
        {
            me.role = "host";
        }

        players.Add(me);
        ShowRoom(name, category, inviteCode, players, host);
    }

    //=====================
    //MÈTODE: GenerateCode
    //GENERA UN CODI ALEATORI DE 6 CARÀCTERS
    //=====================
    static string GenerateCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        System.Text.StringBuilder builder = new System.Text.StringBuilder();

        for (int i = 0; i < 6; i++)
        {
            int index = UnityEngine.Random.Range(0, chars.Length);
            builder.Append(chars[index]);
        }

        return builder.ToString();
    }
}
