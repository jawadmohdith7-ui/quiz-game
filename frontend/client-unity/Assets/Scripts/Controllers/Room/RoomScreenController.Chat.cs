//ARXIU QUE CONTROLA EL PANELL DE XAT DE LA SALA

//=====================
//IMPORTEM
//=====================
using System;
using System.Globalization;
using Models;
using UnityEngine;
using UnityEngine.UIElements;

//=====================
//CLASSE: ROOMSCREENCONTROLLER (PART DE XAT)
//PINTA MISSATGES LOCALS I LLANÇA L'ESDEVENIMENT D'ENVIAMENT
//=====================
public partial class RoomScreenController
{
    //=====================
    //ESTAT INTERN: REFERÈNCIES I COMPTADOR DEL XAT
    //=====================
    VisualElement chatBox;
    Label chatEmpty;
    Label chatCount;
    ScrollView chatList;
    TextField chatInput;
    Button chatSendButton;
    int chatMessageCount;

    //=====================
    //QUERIES
    //BUSCA ELS ELEMENTS DEL XAT I CONNECTA ELS ESDEVENIMENTS
    //=====================

    //=====================
    //MÈTODE: BUSCA I CONNECTA ELS ELEMENTS DEL XAT
    //=====================
    void QueryChatElements(VisualElement root)
    {
        chatBox = root.Q<VisualElement>(className: "chat-box");
        chatEmpty = root.Q<Label>("chat-empty");
        chatCount = root.Q<Label>("chat-count");
        chatList = root.Q<ScrollView>("chat-list");
        chatInput = root.Q<TextField>("chat-input");
        chatSendButton = root.Q<Button>("chat-send-button");

        if (chatSendButton != null)
        {
            chatSendButton.clicked += OnChatSendClicked;
        }

        if (chatInput != null)
        {
            chatInput.RegisterCallback<KeyDownEvent>(OnChatKeyDown);
        }

        Show(chatEmpty, true);
    }

    //=====================
    //PINTAT
    //ESTAT BUIT, MISSATGES, COMPTADOR I TOPALL DE LA LLISTA
    //=====================

    //=====================
    //MÈTODE: PINTA UN MISSATGE REBUT
    //VALIDA, NORMALITZA I AFEGEIX LA FILA AL FINAL DE LA LLISTA
    //=====================
    public void AddChatMessage(ChatMessageData message)
    {
        if (message == null)
        {
            return;
        }

        if (chatList == null)
        {
            return;
        }

        string text = NormalizeChatMessage(message, chatMessageCount);

        //UN TEXT BUID O NOMÉS D'ESPAIS NO PINTA RES
        if (text == null)
        {
            return;
        }

        VisualElement row = CreateChatRow(message);
        chatList.Add(row);

        chatMessageCount = chatMessageCount + 1;
        TrimChatList();

        if (chatCount != null)
        {
            chatCount.text = chatMessageCount.ToString();
        }

        Show(chatEmpty, false);
        chatList.ScrollTo(row);
    }

    //COMPLETA ELS CAMPS BUITS I ASSIGNA LA CLAU LOCAL DEL MISSATGE
    static string NormalizeChatMessage(ChatMessageData message, int messageCount)
    {
        if (message.text == null)
        {
            return null;
        }

        string text = message.text.Trim();

        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        if (string.IsNullOrEmpty(message.senderName))
        {
            message.senderName = "Anònim";
        }

        //SENSE HORA DEL SERVIDOR FEM SERVIR LA LOCAL
        if (message.timestamp <= 0)
        {
            message.timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }

        //L'ID ÉS LOCAL I IGNORA EL DEL SERVIDOR, COM FA EL CLIENT VUE
        string senderKey = message.senderId;

        if (string.IsNullOrEmpty(senderKey))
        {
            senderKey = "anon";
        }

        message.id = senderKey + "-" + message.timestamp + "-" + messageCount;
        message.text = text;

        return text;
    }

    //TOPALL DE 200 MISSATGES: FORA EL MÉS ANTIC
    void TrimChatList()
    {
        while (chatList.contentContainer.childCount > 200)
        {
            chatList.contentContainer.RemoveAt(0);
            chatMessageCount = 200;
        }
    }

    //CREA LA FILA D'UN MISSATGE: REMITENT, HORA I TEXT PLÀ
    static VisualElement CreateChatRow(ChatMessageData message)
    {
        VisualElement row = new VisualElement();
        row.AddToClassList("chat-row");

        VisualElement header = new VisualElement();
        header.AddToClassList("chat-header");

        Label author = new Label(message.senderName);
        author.AddToClassList("chat-author");

        DateTimeOffset time = DateTimeOffset.FromUnixTimeMilliseconds(message.timestamp);
        string hour = time.ToLocalTime().ToString("HH:mm", CultureInfo.InvariantCulture);

        Label timeLabel = new Label(hour);
        timeLabel.AddToClassList("chat-time");

        header.Add(author);
        header.Add(timeLabel);
        row.Add(header);

        Label text = new Label(message.text);
        //EL TEXT ÉS PLÀ: NO INTERPRETEM ETIQUETES COM A RICH TEXT
        text.enableRichText = false;
        text.AddToClassList("chat-text");
        row.Add(text);

        return row;
    }

    //BUIDA EL XAT I TORNA A MOSTRAR L'ESTAT BUIT
    public void ClearChat()
    {
        if (chatList != null)
        {
            chatList.Clear();
        }

        chatMessageCount = 0;

        if (chatCount != null)
        {
            chatCount.text = "0";
        }

        Show(chatEmpty, true);
    }

    //=====================
    //EVENTS
    //=====================

    //ENVIA EL TEXT ESCRIT I BUIDA EL CAMP
    void OnChatSendClicked()
    {
        if (chatInput == null)
        {
            return;
        }

        string rawText = chatInput.value;

        if (rawText == null)
        {
            return;
        }

        string text = rawText.Trim();

        //UN TEXT DE NOMÉS ESPAIS NO S'ENVIA
        if (string.IsNullOrEmpty(text))
        {
            return;
        }

        chatInput.SetValueWithoutNotify("");

        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnSendChat == null)
        {
            return;
        }

        OnSendChat.Invoke(text);
    }

    //EVENT: INTRO AL CAMP DE XAT ENVIA EL MISSATGE
    void OnChatKeyDown(KeyDownEvent evt)
    {
        //NOMÉS ENVIEM QUAN ES PREM INTRO O INTRO DEL TECLAT NUMÈRIC
        bool isReturn = evt.keyCode == KeyCode.Return;
        bool isKeypadEnter = evt.keyCode == KeyCode.KeypadEnter;

        if (isReturn == false)
        {
            if (isKeypadEnter == false)
            {
                return;
            }
        }

        OnChatSendClicked();
    }
}
