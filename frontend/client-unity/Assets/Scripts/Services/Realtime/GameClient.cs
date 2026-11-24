//ARXIU QUE PARLA AMB EL GAME-SERVICE PER WEBSOCKET: CONNEXIO, TICK I ENVIAMENTS

//=====================
//IMPORTEM
//=====================
using System;
using Models;
using Newtonsoft.Json;
using UnityEngine;

//=====================
//CLASSE: GAMECLIENT
//TRADUEIX ELS MISSATGES DEL SERVIDOR A EVENTS C# I OFEREIX UN MÈTODE
//PER A CADA MISSATGE QUE UNITY POT ENVIAR. NO CONEIX LES PANTALLES.
//
//FLUX DE CONNEXIÓ:
//  1. S'OBRE EL WEBSOCKET I EL SERVIDOR ENVIA CONNECTION:STABLISHED
//  2. UNITY ENVIA IDENTITY:DECLARE (TYPE "NEW" O "RESTORE" AMB ID I NICK)
//  3. EL SERVIDOR RESPON IDENTITY:CONFIRMED I JA ES POT DEMANAR SALES, CREAR, ENTRAR...
//
//TOTS ELS EVENTS ES LLANCEN AL FIL PRINCIPAL, ELS ENTREGA TICK()
//
//LA CLASSE ES REPARTEIX EN TRES FITXERS PARTIALS:
//  GAMECLIENT.CS          CONNEXIÓ, TICK, SEND I ELS SETZE ENVIAMENTS
//  GAMECLIENT.RECEIVE.CS  DISPATCHMESSAGE I ELS MÈTODES HANDLE...
//  GAMECLIENT.EVENTS.CS   DECLARACIÓ DELS EVENTS I ELS INVOKE...
//=====================
public partial class GameClient : IDisposable
{
    //=====================
    //CONSTANTS I ESTAT INTERN
    //=====================
    readonly WebSocketService ws = new WebSocketService();
    bool triedNewIdentity;

    //NICK LOCAL: S'ENVIA AL RESTAURAR LA IDENTITAT. POSAR-LO ABANS DE CONNECT()
    public string Nickname { get; set; } = "";

    //=====================
    //PROPIETAT: DIU SI EL SOCKET ESTÀ OBERT
    //=====================
    public bool IsConnected
    {
        get
        {
            return ws.IsConnected;
        }
    }

    //IDENTITAT CONFIRMADA PEL SERVIDOR
    public ServerIdentity Identity { get; private set; }

    //=====================
    //MÈTODE: CONSTRUCTOR
    //ENGANXA ELS EVENTS DEL WEBSOCKET A MÈTODES D'AQUESTA CLASSE
    //=====================
    public GameClient()
    {
        ws.OnConnected += OnSocketConnected;
        ws.OnMessage += OnSocketMessage;
        ws.OnClosed += OnSocketClosed;

        //ESBORREM LES CLAUS ANTIGUES DEL GUEST ID: ARA VIU A SESSIONSTORE
        PlayerPrefs.DeleteKey("guestId_editor");
        PlayerPrefs.DeleteKey("guestId_build");
    }

    //=====================
    //MÈTODE: OBRE LA CONNEXIÓ AMB EL SERVIDOR
    //=====================
    public void Connect(string url)
    {
        Debug.Log("[GameClient] conectando a " + url);
        _ = ws.ConnectAsync(url);
    }

    //=====================
    //MÈTODE: PASSA AL FIL PRINCIPAL ELS MISSATGES REBUTS
    //S'HA DE CRIDAR A CADA UPDATE
    //=====================
    public void Tick()
    {
        ws.DispatchPending();
    }

    //=====================
    //MÈTODE: ALLIBERA LA CONNEXIÓ
    //=====================
    public void Dispose()
    {
        ws.Dispose();
    }

    //=====================
    //SECCIÓ: CALLBACKS DEL SOCKET
    //=====================

    //=====================
    //EVENT: EL SOCKET S'HA OBERT
    //=====================
    void OnSocketConnected()
    {
        triedNewIdentity = false;
        Debug.Log("[GameClient] conectado, esperando connection:stablished");
    }

    //=====================
    //EVENT: HA ARRIBAT UN MISSATGE DEL SERVIDOR
    //=====================
    void OnSocketMessage(string json)
    {
        Handle(json);
    }

    //=====================
    //EVENT: EL SOCKET S'HA TANCAT
    //=====================
    void OnSocketClosed(string reason)
    {
        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnDisconnected == null)
        {
            return;
        }

        OnDisconnected.Invoke(reason);
    }

    //=====================
    //SECCIÓ: ENVIAMENT
    //=====================

    //=====================
    //MÈTODE: SERIALITZA I ENVIA UN MISSATGE AL SERVIDOR
    //=====================
    public void Send(object message)
    {
        JsonSerializerSettings settings = CreateSendSettings();
        string json = JsonConvert.SerializeObject(message, settings);
        _ = ws.SendAsync(json);
    }

    //=====================
    //MÈTODE: CONFIGURACIÓ DE SERIALITZACIÓ DELS MISSATGES
    //NO S'ENVIEN ELS CAMPS NULLS, PER EXEMPLE EL PASSWORD D'UNA SALA PÚBLICA
    //=====================
    static JsonSerializerSettings CreateSendSettings()
    {
        JsonSerializerSettings settings = new JsonSerializerSettings();
        settings.NullValueHandling = NullValueHandling.Ignore;
        return settings;
    }

    //=====================
    //MÈTODE: DECLARA LA IDENTITAT AL SERVIDOR
    //SI FORCENEW ÉS TRUE DEMANA UNA IDENTITAT NOVA ENCARA QUE N'HAGI GUARDADA
    //=====================
    void DeclareIdentity(bool forceNew)
    {
        string savedId = SessionStore.GuestId;
        IdentityPayload identity = new IdentityPayload();

        //NOMÉS RESTAUREM SI TENIM ID I NICK GUARDATS I NO ENS HAN FORÇAT UN DE NOU
        bool canRestore = forceNew == false;
        if (canRestore)
        {
            if (string.IsNullOrEmpty(savedId))
            {
                canRestore = false;
            }
        }

        if (canRestore)
        {
            if (string.IsNullOrEmpty(Nickname))
            {
                canRestore = false;
            }
        }

        //RESTAUREM LA IDENTITAT GUARDADA
        if (canRestore)
        {
            identity.type = "restore";
            identity.id = savedId;
            identity.nickname = Nickname;
        }
        //DEMANEM UNA IDENTITAT NOVA
        else
        {
            identity.type = "new";
            triedNewIdentity = true;
        }

        Debug.Log("[GameClient] declarando identidad: " + identity.type);

        DeclareIdentityMessage message = new DeclareIdentityMessage();
        message.identity = identity;
        Send(message);
    }

    //=====================
    //MÈTODE: DEMANA LA LLISTA DE SALES PÚBLIQUES
    //=====================
    public void RequestRooms()
    {
        ListRoomsMessage message = new ListRoomsMessage();
        Send(message);
    }

    //=====================
    //MÈTODE: DEMANA LES CATEGORIES I DIFICULTATS DEL CATÀLEG
    //=====================
    public void RequestCatalog()
    {
        NetworkMessageHeader message = new NetworkMessageHeader();
        message.type = "catalog:options";
        Send(message);
    }

    //=====================
    //MÈTODE: DEMANA AL SERVIDOR CREAR UNA SALA
    //=====================
    public void CreateRoom(string nickname, int maxPlayers, bool isPrivate, string nameRoom)
    {
        CreateRoomMessage message = new CreateRoomMessage();
        message.nickname = nickname;
        message.maxPlayers = maxPlayers;
        message.isPrivate = isPrivate;
        message.nameRoom = nameRoom;
        Send(message);
    }

    //=====================
    //MÈTODE: DEMANA ENTRAR A UNA SALA
    //MAXPLAYERS ES DEIXA NULL SI NO ES CONEIX, COM FA EL CLIENT VUE
    //=====================
    public void JoinRoom(string roomId, string nickname, string password, int? maxPlayers, bool isPrivate)
    {
        JoinRoomMessage message = new JoinRoomMessage();
        message.roomId = roomId;
        message.nickname = nickname;
        message.password = password;
        message.maxPlayers = maxPlayers;
        message.isPrivate = isPrivate;
        Send(message);
    }

    //=====================
    //MÈTODE: DEMANA SORTIR DE LA SALA
    //=====================
    public void LeaveRoom(string roomId)
    {
        LeaveRoomMessage message = new LeaveRoomMessage();
        message.roomId = roomId;
        Send(message);
    }

    //=====================
    //MÈTODE: DEMANA CANVIAR EL NICK
    //=====================
    public void UpdateNickname(string nickname)
    {
        Debug.Log("[GameClient] enviando nickname:update " + nickname);

        UpdateNicknameMessage message = new UpdateNicknameMessage();
        message.nickname = nickname;
        Send(message);
    }

    //=====================
    //MÈTODE: MARCA EL JUGADOR A PUNT O EL TREU DE LA LLISTA
    //=====================
    public void SetReady(bool ready)
    {
        SetReadyMessage message = new SetReadyMessage();
        message.ready = ready;
        Send(message);
    }

    //=====================
    //MÈTODE: DEMANA CANVIAR LA CONFIGURACIÓ DE LA SALA
    //NOMÉS EL HOST TÉ PERMÍS DE FER-HO
    //=====================
    public void UpdateConfiguration(RoomConfigurationData configuration)
    {
        RoomConfigurationMessage message = new RoomConfigurationMessage();
        RoomConfigurationSendData sendData = new RoomConfigurationSendData();
        sendData.category = configuration.category;
        sendData.difficulty = configuration.difficulty;
        sendData.maxPlayers = configuration.maxPlayers;
        sendData.rounds = configuration.rounds;

        //LA DURADA NOMÉS S'ENVIA SI ÉS VÀLIDA: EL SERVIDOR NOMÉS L'IGNORA SI NO ARRIBA
        if (configuration.durationSeconds > 0)
        {
            sendData.durationSeconds = configuration.durationSeconds;
        }

        message.configuration = sendData;
        Send(message);
    }

    //=====================
    //MÈTODE: DEMANA COMENÇAR LA PARTIDA
    //NOMÉS EL HOST TÉ PERMÍS DE FER-HO
    //=====================
    public void StartGame()
    {
        StartGameMessage message = new StartGameMessage();
        Send(message);
    }

    //=====================
    //MÈTODE: ENVIA LA RESPOSTA DE LA RONDA
    //QUESTIONID I ANSWER VIATGEN COM A ENTERS, IGUALS QUE AL CLIENT VUE
    //=====================
    public void SubmitAnswer(int questionId, int answer)
    {
        SubmitAnswerMessage message = new SubmitAnswerMessage();
        message.questionId = questionId;
        message.answer = answer;
        Send(message);
    }

    //=====================
    //MÈTODE: DEMANA PASSAR A LA SEGÜENT RONDA
    //NOMÉS EL HOST TÉ PERMÍS DE FER-HO
    //=====================
    public void NextRound()
    {
        NextRoundMessage message = new NextRoundMessage();
        Send(message);
    }

    //=====================
    //MÈTODE: ENVIA UNA LÍNIA DE XAT A LA SALA
    //NOMÉS VIATGEN TYPE I TEXT: EL SERVIDOR RECONSTRUEIX LA RESTA
    //=====================
    public void SendChatMessage(string text)
    {
        if (text == null)
        {
            return;
        }

        string cleaned = text.Trim();

        //UN MISSATGE BUIT NO S'ENVIA
        if (string.IsNullOrEmpty(cleaned))
        {
            return;
        }

        ChatMessage message = new ChatMessage();
        message.text = cleaned;
        Send(message);
    }
}
