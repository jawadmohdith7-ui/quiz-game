//ARXIU QUE CONTROLA EL DIÀLEG DE CREAR SALA

//=====================
//IMPORTEM
//=====================
using System;
using Models;
using UnityEngine.UIElements;

//=====================
//CLASSE: CREATEROOMDIALOGCONTROLLER
//VALIDA EL FORMULARI I LLANÇA ESDEVENIMENTS, NO TOCA LA XARXA
//=====================
public class CreateRoomDialogController
{
    public event Action<CreateRoomMessage> OnCreate;
    public event Action OnCancel;

    const int MinPlayers = 2;
    const int MaxPlayers = 20;

    //=====================
    //ESTAT INTERN: ELEMENTS I DADES LOCALS
    //=====================
    VisualElement dialogRoot;
    TextField nameField;
    Label nameError;
    IntegerField playersField;
    Label playersError;
    Button publicButton;
    Button privateButton;
    Label privateHint;
    Label serverError;
    Button cancelButton;
    Button createButton;

    bool isPrivate;

    //=====================
    //MÈTODE: CONSTRUCTOR
    //BUSCA ELS ELEMENTS DEL UXML I PREPARA ELS ESDEVENIMENTS
    //=====================
    public CreateRoomDialogController(VisualElement root)
    {
        dialogRoot = root.Q<VisualElement>("dialog-root");
        nameField = root.Q<TextField>("room-name-input");
        nameError = root.Q<Label>("name-error");
        playersField = root.Q<IntegerField>("max-players-input");
        playersError = root.Q<Label>("players-error");
        publicButton = root.Q<Button>("public-button");
        privateButton = root.Q<Button>("private-button");
        privateHint = root.Q<Label>("private-hint");
        serverError = root.Q<Label>("dialog-server-error");
        cancelButton = root.Q<Button>("dialog-cancel-button");
        createButton = root.Q<Button>("dialog-create-button");

        if (publicButton != null)
        {
            publicButton.clicked += OnPublicClicked;
        }

        if (privateButton != null)
        {
            privateButton.clicked += OnPrivateClicked;
        }

        if (cancelButton != null)
        {
            cancelButton.clicked += OnCancelClicked;
        }

        if (createButton != null)
        {
            createButton.clicked += Submit;
        }

        Reset();
    }

    //=====================
    //MÈTODE: VISIBILITAT, ESTAT I ERRORS
    //=====================

    //MOSTRA EL DIÀLEG
    public void Show()
    {
        ShowElement(dialogRoot, true);
    }

    //AMAGA EL DIÀLEG
    public void Hide()
    {
        ShowElement(dialogRoot, false);
    }

    //DEIXA EL FORMULARI NET: S'USA CADA VEGADA QUE S'OBRE
    //EL NOM ARRIBA PREOMPLERT AMB EL NICKNAME, PERÒ ES POT EDITAR
    public void Reset(string defaultName = "")
    {
        if (nameField != null)
        {
            nameField.SetValueWithoutNotify(defaultName);
        }

        if (playersField != null)
        {
            playersField.SetValueWithoutNotify(8);
        }

        SetPrivate(false);

        SetError(nameError, null);
        SetError(playersError, null);
        SetError(serverError, null);

        SetBusy(false);
    }

    //BLOQUEJA EL BOTÓ MENTRE S'ENVIA LA PETICIÓ
    public void SetBusy(bool busy)
    {
        if (createButton == null)
        {
            return;
        }

        createButton.SetEnabled(busy == false);

        if (busy == true)
        {
            createButton.text = "Creant...";
        }
        else
        {
            createButton.text = "Crear sala";
        }
    }

    //MOSTRA L'ERROR QUE HA RETORNAT EL SERVIDOR
    public void ShowServerError(string message)
    {
        SetError(serverError, message);
    }

    //=====================
    //EVENTS
    //=====================

    //CLIC AL BOTÓ DE SALA PÚBLICA
    void OnPublicClicked()
    {
        SetPrivate(false);
    }

    //CLIC AL BOTÓ DE SALA PRIVADA
    void OnPrivateClicked()
    {
        SetPrivate(true);
    }

    //CLIC AL BOTÓ DE CANCEL·LAR
    void OnCancelClicked()
    {
        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnCancel == null)
        {
            return;
        }

        OnCancel.Invoke();
    }

    //CANVIA L'ESTAT PÚBLIC O PRIVAT I L'AVÍS DEL CODI
    void SetPrivate(bool value)
    {
        isPrivate = value;

        if (publicButton != null)
        {
            publicButton.EnableInClassList("toggle-on", value == false);
        }

        if (privateButton != null)
        {
            privateButton.EnableInClassList("toggle-on", value);
        }

        //L'AVÍS DE CODI D'INVITACIÓ NOMÉS ES VEU A LES SALES PRIVADES
        ShowElement(privateHint, value);
    }

    //=====================
    //VALIDACIÓ I ENVIAMENT
    //=====================

    //VALIDA EL FORMULARI I LLANÇA L'ESDEVENIMENT DE CREAR
    void Submit()
    {
        if (nameField == null)
        {
            return;
        }

        string name = nameField.value.Trim();

        int players = 0;
        if (playersField != null)
        {
            players = playersField.value;
        }

        //COMPROVEM EL NOM
        bool nameBad = string.IsNullOrEmpty(name);

        //COMPROVEM EL NOMBRE DE JUGADORS
        bool playersBad = false;
        if (players < MinPlayers)
        {
            playersBad = true;
        }

        if (players > MaxPlayers)
        {
            playersBad = true;
        }

        SetError(nameError, BuildNameError(nameBad));
        SetError(playersError, BuildPlayersError(playersBad));
        SetError(serverError, null);

        //SI HI HA QUALQUE ERROR NO ENVIEM RES
        if (nameBad == true)
        {
            return;
        }

        if (playersBad == true)
        {
            return;
        }

        //PREPAREM LES DADES QUE REBRÀ QUI ESCOLTA L'ESDEVENIMENT
        CreateRoomMessage data = new CreateRoomMessage();
        data.nameRoom = name;
        data.maxPlayers = players;
        data.isPrivate = isPrivate;

        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnCreate == null)
        {
            return;
        }

        OnCreate.Invoke(data);
    }

    //TEXTE D'ERROR DEL NOM
    static string BuildNameError(bool nameBad)
    {
        if (nameBad == false)
        {
            return null;
        }

        return "Escriu un nom per a la sala.";
    }

    //TEXTE D'ERROR DEL NOMBRE DE JUGADORS
    static string BuildPlayersError(bool playersBad)
    {
        if (playersBad == false)
        {
            return null;
        }

        return "Entre " + MinPlayers + " i " + MaxPlayers + " jugadors.";
    }

    //=====================
    //AJUDANTS
    //=====================

    //PINTA O AMAGA UN MISSATGE D'ERROR
    static void SetError(Label label, string message)
    {
        if (label == null)
        {
            return;
        }

        //SI NO HI HA MISSATGE, BUIDEM EL TEXT I AMAGUEM L'ETIQUETA
        if (string.IsNullOrEmpty(message))
        {
            label.text = "";
            label.style.display = DisplayStyle.None;
            return;
        }

        label.text = message;
        label.style.display = DisplayStyle.Flex;
    }

    //MOSTRAR O AMAGAR UN ELEMENT
    static void ShowElement(VisualElement element, bool visible)
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
}
