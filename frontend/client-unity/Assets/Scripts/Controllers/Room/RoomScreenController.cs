//ARXIU QUE CONTROLA LA PANTALLA DE SALA: CAPÇALERA, JUGADORS I INVITACIÓ

//=====================
//IMPORTEM
//=====================
using System;
using System.Collections.Generic;
using Models;
using UnityEngine.UIElements;

//=====================
//ENUM: ESTAT DE LA PANTALLA DE SALA
//CADA VALOR CORRESPON A UNA SECCIÓ DEL MATEIX UXML
//=====================
public enum RoomScreenState
{
    Setup,
    Waiting,
    Round,
    Result,
    Ranking,
    Finished,
    Spectator
}

//=====================
//CLASSE: ROOMSCREENCONTROLLER
//NO FA PETICIONS DE XARXA: PINTA DADES I LLANÇA EVENTS
//=====================
public partial class RoomScreenController
{
    //=====================
    //ESTAT INTERN: EVENTS QUE LLANÇA LA PANTALLA
    //=====================
    public event Action OnLeave;
    public event Action<string> OnCopyCode;
    public event Action<bool> OnReady;
    public event Action OnStartGame;
    public event Action<RoomConfigurationData> OnSaveConfiguration;
    public event Action<int, int> OnSendAnswer;
    public event Action OnNextRound;
    public event Action<string> OnSendChat;

    //=====================
    //ESTAT INTERN: ELEMENTS DE LA PANTALLA
    //=====================
    Label roomTitle;
    Label roomCategory;
    Label roomError;
    Label inviteCode;
    Button copyButton;
    ScrollView playersList;
    Label playersCount;

    VisualElement setupSection;
    VisualElement waitingSection;
    VisualElement roundSection;
    VisualElement resultSection;
    VisualElement rankingSection;
    VisualElement finishedSection;
    VisualElement spectatorSection;

    string currentInviteCode = "";
    bool isReady;

    //=====================
    //MÈTODE: CONSTRUCTOR
    //BUSCA ELS ELEMENTS DEL UXML I CONNECTA ELS CLICS
    //=====================
    public RoomScreenController(VisualElement root)
    {
        QueryHeader(root);
        QuerySections(root);
        QueryGameElements(root);
        QueryRankingElements(root);
        QueryChatElements(root);
    }

    //=====================
    //MÈTODE: BUSCA I CONNECTA LA CAPÇALERA I ELS JUGADORS
    //=====================
    void QueryHeader(VisualElement root)
    {
        roomTitle = root.Q<Label>("room-title");
        roomCategory = root.Q<Label>("room-category");
        roomError = root.Q<Label>("room-error");
        inviteCode = root.Q<Label>("invite-code");
        copyButton = root.Q<Button>("copy-button");
        playersList = root.Q<ScrollView>("players-list");
        playersCount = root.Q<Label>("players-count");

        Button leaveButton = root.Q<Button>("leave-button");

        if (leaveButton != null)
        {
            leaveButton.clicked += OnLeaveClicked;
        }

        if (copyButton != null)
        {
            copyButton.clicked += OnCopyClicked;
        }

        Show(roomError, false);
    }

    //BUSCA EL CONTENIDOR DE CADA SECCIÓ
    void QuerySections(VisualElement root)
    {
        setupSection = root.Q<VisualElement>("setup-section");
        waitingSection = root.Q<VisualElement>("waiting-section");
        roundSection = root.Q<VisualElement>("round-section");
        resultSection = root.Q<VisualElement>("result-section");
        rankingSection = root.Q<VisualElement>("ranking-section");
        finishedSection = root.Q<VisualElement>("finished-section");
        spectatorSection = root.Q<VisualElement>("spectator-section");
    }

    //MOSTRA UNA SECCIÓ I AMAGA LA RESTA
    public void Show(RoomScreenState state)
    {
        Show(setupSection, state == RoomScreenState.Setup);
        Show(waitingSection, state == RoomScreenState.Waiting);
        Show(roundSection, state == RoomScreenState.Round);
        Show(resultSection, state == RoomScreenState.Result);
        Show(rankingSection, state == RoomScreenState.Ranking);
        Show(finishedSection, state == RoomScreenState.Finished);
        Show(spectatorSection, state == RoomScreenState.Spectator);
    }

    //PINTA EL NOM I LA CATEGORIA DE LA SALA
    public void SetRoom(string name, string category)
    {
        if (roomTitle != null)
        {
            roomTitle.text = name;
        }

        if (roomCategory == null)
        {
            return;
        }

        //SI NO HI HA CATEGORIA NO MOSTREM L'ETIQUETA
        if (string.IsNullOrEmpty(category))
        {
            roomCategory.text = "";
        }
        else
        {
            roomCategory.text = "Categoria: " + category;
        }
    }

    //SUBSTITUEIX LA LLISTA SENCERA DE JUGADORS
    public void SetPlayers(List<LobbyPlayer> players, string localPlayerId)
    {
        if (playersList == null)
        {
            return;
        }

        playersList.Clear();

        int total = 0;
        if (players != null)
        {
            total = players.Count;
        }

        if (playersCount != null)
        {
            playersCount.text = "Jugadors connectats (" + total + ")";
        }

        //SI NO HI HA NINGÚ MOSTREM UN MISSATGE BUIT
        if (total == 0)
        {
            Label empty = new Label("Encara no hi ha ningú.");
            empty.AddToClassList("empty");
            playersList.Add(empty);
            return;
        }

        //UNA FITXA PER A CADA JUGADOR
        foreach (LobbyPlayer player in players)
        {
            VisualElement chip = CreatePlayerChip(player, localPlayerId);
            playersList.Add(chip);
        }
    }

    //CREA LA FITXA D'UN JUGADOR I MARCA EL LOCAL I L'AMFITRIÓ
    VisualElement CreatePlayerChip(LobbyPlayer player, string localPlayerId)
    {
        VisualElement chip = new VisualElement();
        chip.AddToClassList("player-chip");

        if (player.id == localPlayerId)
        {
            chip.AddToClassList("player-chip-me");
        }

        if (player.role == "host")
        {
            chip.AddToClassList("player-chip-host");
        }

        string text = player.nickname;
        if (player.ready == true)
        {
            text = text + " · a punt";
        }

        Label name = new Label(text);
        chip.Add(name);

        return chip;
    }

    //PINTA EL CODI D'INVITACIÓ: UN CODI BUID L'AMAGA AMB EL BOTÓ
    public void SetInviteCode(string code)
    {
        bool hasCode = string.IsNullOrEmpty(code) == false;
        currentInviteCode = code;

        if (hasCode == false)
        {
            currentInviteCode = "";
        }

        if (inviteCode != null)
        {
            inviteCode.text = currentInviteCode;
            Show(inviteCode, hasCode);
        }

        Show(copyButton, hasCode);
    }

    //MOSTRA UN ERROR DE LA SALA: UN MISSATGE BUID L'AMAGA
    public void ShowError(string message)
    {
        if (roomError == null)
        {
            return;
        }

        if (string.IsNullOrEmpty(message))
        {
            roomError.text = "";
            Show(roomError, false);
            return;
        }

        roomError.text = message;
        Show(roomError, true);
    }

    //MOSTRAR O AMAGAR UN ELEMENT
    static void Show(VisualElement element, bool visible)
    {
        if (element == null)
        {
            return;
        }

        if (visible == true)
        {
            element.style.display = DisplayStyle.Flex;
        }
        else
        {
            element.style.display = DisplayStyle.None;
        }
    }

    //=====================
    //EVENTS
    //=====================

    //CLIC AL BOTÓ DE SORTIR
    void OnLeaveClicked()
    {
        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnLeave == null)
        {
            return;
        }

        OnLeave.Invoke();
    }

    //CLIC AL BOTÓ DE COPIAR EL CODI
    void OnCopyClicked()
    {
        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnCopyCode == null)
        {
            return;
        }

        OnCopyCode.Invoke(currentInviteCode);
    }
}
