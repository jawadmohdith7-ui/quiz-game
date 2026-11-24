//ARXIU QUE GESTIONA LA PANTALLA PRINCIPAL: PINTA LES SALES I LLANÇA EVENTS

//=====================
//IMPORTEM
//=====================
using System;
using System.Collections.Generic;
using Models;
using UnityEngine;
using UnityEngine.UIElements;

//=====================
//CLASSE: BOTÓ PER UNIR-SE A UNA SALA
//GUARDA LA SALA PER PODER ENVIAR-LA QUAN ES CLICA
//=====================
public class JoinRoomButton : Button
{
    public RoomInfo Room;
}

//=====================
//CLASSE: MAINSCREENCONTROLLER
//NO FA PETICIONS DE XARXA: NOMÉS PINTA DADES I LLANÇA EVENTS
//=====================
public class MainScreenController
{
    //=====================
    //ESTAT INTERN: EVENTS QUE LLANÇA LA PANTALLA
    //=====================
    public event Action OnProfile;
    public event Action OnRetry;
    public event Action<string> OnCreateRoom;
    public event Action<RoomInfo> OnJoinPublic;
    public event Action<string> OnJoinPrivate;
    public event Action<string> OnNicknameChanged;

    //=====================
    //ESTAT INTERN: REFERÈNCIES ALS ELEMENTS DE LA PANTALLA
    //=====================
    ScrollView roomsList;
    Label statusLabel;
    Button retryButton;
    TextField privateCode;
    Label privateError;
    TextField roomName;
    Button searchRoomButton;
    DropdownField categoryFilter;
    List<string> availableCategories = new List<string> { "Totes" };
    string selectedCategory = "Totes";
    bool categoryFilterChangedRegistered;
    Button nicknameBtn;
    VisualElement nicknameDialog;
    TextField nicknameDialogInput;
    Label nicknameDialogError;

    //=====================
    //ESTAT INTERN: DADES LOCALS
    //=====================
    string currentNickname = "Jugador";
    List<RoomInfo> allRooms = new List<RoomInfo>();

    //=====================
    //MÈTODE: CONSTRUCTOR
    //BUSCA ELS ELEMENTS, CONNECTA ELS CLICS I AMAGA EL QUE NO TOCA
    //=====================
    public MainScreenController(VisualElement root)
    {
        roomsList = root.Q<ScrollView>("rooms-list");
        statusLabel = root.Q<Label>("status-label");
        retryButton = root.Q<Button>("retry-button");
        privateCode = root.Q<TextField>("join-code-input");
        privateError = root.Q<Label>("main-error");
        roomName = root.Q<TextField>("search-input");
        searchRoomButton = root.Q<Button>("search-button");
        categoryFilter = root.Q<DropdownField>("category-filter");
        nicknameBtn = root.Q<Button>("nickname-btn");
        nicknameDialog = root.Q<VisualElement>("nickname-dialog");
        nicknameDialogInput = root.Q<TextField>("nickname-dialog-input");
        nicknameDialogError = root.Q<Label>("nickname-dialog-error");

        //CONNECTEM ELS BOTONS FIXOS DE LA PANTALLA
        Button profileButton = root.Q<Button>("profile-button");
        Button createButton = root.Q<Button>("create-room-button");
        Button joinPrivateButton = root.Q<Button>("join-code-button");

        if (profileButton != null)
        {
            profileButton.clicked += OnProfileClicked;
        }

        if (createButton != null)
        {
            createButton.clicked += OnCreateClicked;
        }

        if (joinPrivateButton != null)
        {
            joinPrivateButton.clicked += OnJoinPrivateClicked;
        }

        if (retryButton != null)
        {
            retryButton.clicked += OnRetryClicked;
        }

        //FILTRE DE SALES PEL NOM
        if (searchRoomButton != null)
        {
            searchRoomButton.clicked += OnSearchClicked;
        }

        if (roomName != null)
        {
            roomName.RegisterCallback<KeyDownEvent>(OnRoomNameKeyDown);
        }

        //CANVI DE NICKNAME: EL BOTÓ OBRE UN MODAL
        if (nicknameBtn != null)
        {
            nicknameBtn.clicked += OnNicknameClicked;
        }

        Button nicknameCancelButton = root.Q<Button>("nickname-cancel-button");
        Button nicknameSaveButton = root.Q<Button>("nickname-save-button");

        if (nicknameCancelButton != null)
        {
            nicknameCancelButton.clicked += HideNicknameDialog;
        }

        if (nicknameSaveButton != null)
        {
            nicknameSaveButton.clicked += SaveNickname;
        }

        if (nicknameDialogInput != null)
        {
            nicknameDialogInput.RegisterCallback<KeyDownEvent>(OnNicknameKeyDown);
        }

        Show(retryButton, false);
        Show(privateError, false);
        Show(nicknameDialogError, false);
    }

    //=====================
    //MÈTODE: SETNICKNAME
    //GUARDA EL NICKNAME I EL PINTA AL BOTÓ I AL CAMP
    //=====================
    public void SetNickname(string nickname)
    {
        if (string.IsNullOrEmpty(nickname))
        {
            return;
        }

        currentNickname = nickname;

        if (nicknameBtn != null)
        {
            nicknameBtn.text = nickname;
        }
    }

    //=====================
    //MÈTODE: OBRIR EL MODAL DEL NICKNAME
    //POSA EL VALOR ACTUAL, BUIDA L'ERROR I DONA EL FOCUS
    //=====================
    void OpenNicknameDialog()
    {
        if (nicknameDialogInput != null)
        {
            nicknameDialogInput.SetValueWithoutNotify(currentNickname);
        }

        SetNicknameError(null);
        Show(nicknameDialog, true);

        if (nicknameDialogInput != null)
        {
            nicknameDialogInput.Focus();
        }
    }

    //=====================
    //MÈTODE: TANCAR EL MODAL SENSE DESAR
    //=====================
    void HideNicknameDialog()
    {
        Show(nicknameDialog, false);
    }

    //=====================
    //MÈTODE: VALIDAR I DESAR EL NICKNAME
    //SI ÉS VÀLID AVISA PER ENVIAR EL SOCKET (EL MODAL ES QUEDA OBERT)
    //=====================
    void SaveNickname()
    {
        string newName = nicknameDialogInput != null ? nicknameDialogInput.value.Trim() : "";

        //EL NICKNAME HA DE TINDRE ENTRE 3 I 15 CARÀCTERS
        if (newName.Length < 3 || newName.Length > 15)
        {
            SetNicknameError("El nom ha de tenir entre 3 i 15 caràcters.");
            return;
        }

        SetNicknameError(null);

        if (newName == currentNickname)
        {
            return;
        }

        //EL MODAL NOMÉS ES TANCA AMB "CANCEL·LAR"
        //EL BOTÓ "JUGADOR" NOMÉS CANVIA QUAN EL SERVIDOR CONFIRMA
        OnNicknameChanged?.Invoke(newName);
    }

    //MOSTRA O AMAGA L'ERROR DEL MODAL DEL NICKNAME
    public void SetNicknameError(string message)
    {
        if (nicknameDialogError == null)
        {
            return;
        }

        nicknameDialogError.text = message ?? "";
        Show(nicknameDialogError, !string.IsNullOrEmpty(message));
    }

    //=====================
    //MÈTODE: MOSTRAR QUE S'ESTAN CARREGANT LES SALES
    //=====================
    public void ShowLoading()
    {
        roomsList.Clear();
        statusLabel.text = "Carregant sales...";
        Show(statusLabel, true);
        Show(retryButton, false);
    }

    //=====================
    //MÈTODE: MOSTRAR UN ERROR I EL BOTÓ DE REINTENTAR
    //=====================
    public void ShowError(string message)
    {
        roomsList.Clear();
        statusLabel.text = message;
        Show(statusLabel, true);
        Show(retryButton, true);
    }

    //=====================
    //MÈTODE: GUARDAR LES SALES I PINTAR-LES
    //SI ARRIBA NULL ES TRACTA COM UNA LLISTA BUIDA
    //=====================
    public void ShowRooms(List<RoomInfo> rooms)
    {
        if (rooms == null)
        {
            allRooms = new List<RoomInfo>();
        }
        else
        {
            allRooms = rooms;
        }

        ApplyRoomFilter();
    }

    //=====================
    //MÈTODE: CARREGAR LES CATEGORIES AL FILTRE
    //=====================
    public void SetCategories(List<string> categories)
    {
        if (categoryFilter == null)
        {
            return;
        }

        if (categories == null)
        {
            return;
        }

        //CREEM LA LLISTA AMB "TOTES" + CATEGORIES DISPONIBLES
        List<string> choices = new List<string>();
        choices.Add("Totes");

        foreach (string category in categories)
        {
            if (string.IsNullOrEmpty(category) == false)
            {
                choices.Add(category);
            }
        }

        if (choices.Contains("Mix") == false)
        {
            choices.Add("Mix");
        }

        categoryFilter.choices = choices;
        categoryFilter.value = "Totes";

        //GUARDEM LES CATEGORIES DISPONIBLES
        availableCategories = choices;

        //CONNECTEM EL CANVI DE CATEGORIA
        if (categoryFilterChangedRegistered == false)
        {
            categoryFilter.RegisterCallback<ChangeEvent<string>>(OnCategoryFilterChanged);
            categoryFilterChangedRegistered = true;
        }
    }

    //=====================
    //EVENT: CANVI DE CATEGORIA AL FILTRE
    //=====================
    void OnCategoryFilterChanged(ChangeEvent<string> evt)
    {
        selectedCategory = evt.newValue;
        ApplyRoomFilter();
    }

    //=====================
    //MÈTODE: APLICAR EL FILTRE DEL CAMP DE CERCA I CATEGORIA
    //=====================
    void ApplyRoomFilter()
    {
        Show(statusLabel, false);
        Show(retryButton, false);
        roomsList.Clear();

        //LLEGIM EL TEXT DEL FILTRE DE NOM
        string query = "";
        if (roomName != null)
        {
            query = roomName.value.Trim();
        }

        //LLEGIM LA CATEGORIA SELECCIONADA
        string category = selectedCategory;

        //FILTREM PER NOM I CATEGORIA (COM VUE)
        List<RoomInfo> filteredRooms = new List<RoomInfo>();

        foreach (RoomInfo room in allRooms)
        {
            //FILTRE PER NOM
            bool matchesName = true;
            if (string.IsNullOrEmpty(query) == false)
            {
                if (string.IsNullOrEmpty(room.name))
                {
                    matchesName = false;
                }
                else
                {
                    int position = room.name.IndexOf(query, StringComparison.OrdinalIgnoreCase);
                    if (position < 0)
                    {
                        matchesName = false;
                    }
                }
            }

            //FILTRE PER CATEGORIA
            bool matchesCategory = true;
            if (category != "Totes")
            {
                if (room.category != category)
                {
                    matchesCategory = false;
                }
            }

            //SI COINCIDEIX ELS DOS FILTRES, L'AFEGIM
            if (matchesName && matchesCategory)
            {
                filteredRooms.Add(room);
            }
        }

        //SI NO QUEDA CAP SALA MOSTREM UN MISSATGE
        if (filteredRooms.Count == 0)
        {
            string message = "";
            if (string.IsNullOrEmpty(query) && category == "Totes")
            {
                message = "No hi ha sales públiques ara mateix.";
            }
            else
            {
                message = "No s'ha trobat cap sala amb aquest nom.";
            }

            Label empty = new Label(message);
            empty.AddToClassList("empty");
            roomsList.Add(empty);
            return;
        }

        //PINTEM UNA FILA PER CADA SALA
        foreach (RoomInfo room in filteredRooms)
        {
            VisualElement row = CreateRow(room);
            roomsList.Add(row);
        }
    }

    //=====================
    //MÈTODE: CREAR LA FILA D'UNA SALA
    //NOM, JUGADORS, CATEGORIA I BOTÓ PER UNIR-SE
    //=====================
    VisualElement CreateRow(RoomInfo room)
    {
        VisualElement row = new VisualElement();
        row.AddToClassList("room-row");

        row.Add(MakeCell(room.name, "col-name"));

        //EL NOMBRE DE JUGADORS NEGATIU VOL DIR QUE NO ES CONEIX
        string playersText = "";
        if (room.players < 0)
        {
            playersText = "-";
        }
        else
        {
            playersText = room.players.ToString();
        }

        playersText = playersText + "/" + room.maxPlayers;
        row.Add(MakeCell(playersText, "col-players"));

        row.Add(MakeCell(room.category, "col-category"));
        row.Add(CreateStateBadge(room));

        //CEL·LA DE L'ACCIÓ AMB EL BOTÓ D'ENTRAR
        VisualElement actionCell = new VisualElement();
        actionCell.AddToClassList("col-action");

        JoinRoomButton joinButton = new JoinRoomButton();
        joinButton.Room = room;
        joinButton.text = "+";
        joinButton.AddToClassList("btn");
        joinButton.AddToClassList("btn-icon");

        if (room.IsFull == true)
        {
            joinButton.tooltip = "Sala plena";
        }
        else
        {
            joinButton.tooltip = "Unir-se a la sala";
        }

        joinButton.SetEnabled(room.IsFull == false);
        joinButton.RegisterCallback<ClickEvent>(OnJoinPublicClicked);

        actionCell.Add(joinButton);
        row.Add(actionCell);

        return row;
    }

    //=====================
    //MÈTODE: CREAR L'ETIQUETA DE L'ESTAT DE LA SALA
    //MATEIXOS TEXTOS QUE VUE: ESPERANT, EN JOC I FINALITZADA
    //=====================
    static Label CreateStateBadge(RoomInfo room)
    {
        string state = room.state;

        if (string.IsNullOrEmpty(state))
        {
            state = "lobby";
        }

        string text = "ESPERANT";

        if (state == "playing")
        {
            text = "EN JOC";
        }
        else if (state == "finished")
        {
            text = "FINALITZADA";
        }

        Label badge = new Label(text);
        badge.AddToClassList("badge");
        badge.AddToClassList("badge-" + state);
        return badge;
    }

    //=====================
    //MÈTODE: CREAR UNA CEL·LA DE TEXT
    //=====================
    static Label MakeCell(string text, string columnClass)
    {
        Label label = new Label(text);
        label.AddToClassList("cell");
        label.AddToClassList(columnClass);
        return label;
    }

    //=====================
    //MÈTODE: UNIR-SE A UNA SALA PRIVADA AMB CODI
    //=====================
    void JoinPrivate()
    {
        string rawCode = privateCode.value.Trim();
        string code = rawCode.ToUpperInvariant();

        if (string.IsNullOrEmpty(code))
        {
            privateError.text = "Introdueix un codi de sala.";
            Show(privateError, true);
            return;
        }

        Show(privateError, false);
        OnJoinPrivate?.Invoke(code);
    }

    //=====================
    //MÈTODE: MOSTRAR O AMAGAR UN ELEMENT
    //=====================
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
    //EVENT: CLIC AL BOTÓ DE PERFIL
    //=====================
    void OnProfileClicked()
    {
        OnProfile?.Invoke();
    }

    //=====================
    //EVENT: CLIC AL BOTÓ DE CREAR SALA
    //S'ENVIA UN NOM BUID: EL POSA LA PANTALLA DE CREAR
    //=====================
    void OnCreateClicked()
    {
        OnCreateRoom?.Invoke("");
    }

    //=====================
    //EVENT: CLIC AL BOTÓ D'UNIR-SE AMB CODI
    //=====================
    void OnJoinPrivateClicked()
    {
        JoinPrivate();
    }

    //=====================
    //EVENT: CLIC AL BOTÓ DE REINTENTAR
    //=====================
    void OnRetryClicked()
    {
        OnRetry?.Invoke();
    }

    //=====================
    //EVENT: CLIC AL BOTÓ DE CERCAR
    //=====================
    void OnSearchClicked()
    {
        ApplyRoomFilter();
    }

    //=====================
    //EVENT: TECLA AL CAMP DE CERCA
    //=====================
    void OnRoomNameKeyDown(KeyDownEvent evt)
    {
        if (evt.keyCode != KeyCode.Return && evt.keyCode != KeyCode.KeypadEnter)
        {
            return;
        }

        ApplyRoomFilter();
        evt.StopPropagation();
    }

    //=====================
    //EVENT: CLIC AL NICKNAME PER OBRIR EL MODAL
    //=====================
    void OnNicknameClicked()
    {
        OpenNicknameDialog();
    }

    //=====================
    //EVENT: TECLA AL CAMP DEL MODAL DE NICKNAME
    //=====================
    void OnNicknameKeyDown(KeyDownEvent evt)
    {
        if (evt.keyCode != KeyCode.Return && evt.keyCode != KeyCode.KeypadEnter)
        {
            return;
        }

        SaveNickname();
        evt.StopPropagation();
    }

    //=====================
    //EVENT: CLIC AL BOTÓ D'ENTRAR EN UNA SALA PÚBLICA
    //=====================
    void OnJoinPublicClicked(ClickEvent evt)
    {
        JoinRoomButton joinButton = evt.currentTarget as JoinRoomButton;
        if (joinButton == null)
        {
            return;
        }

        OnJoinPublic?.Invoke(joinButton.Room);
    }
}
