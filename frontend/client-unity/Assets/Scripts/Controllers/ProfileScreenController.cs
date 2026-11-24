//ARXIU QUE CONTROLA LA PANTALLA DE PERFIL D'USUARI

//=====================
//IMPORTEM
//=====================
using System;
using Models;
using UnityEngine.UIElements;

//=====================
//CLASSE: PROFILESCREENCONTROLLER
//NOMÉS PINTA DADES I AVISA QUAN L'USUARI VOL TORNAR
//=====================
public class ProfileScreenController
{
    public event Action OnBack;

    //=====================
    //ESTAT INTERN: REFERÈNCIES ALS ELEMENTS DE LA PANTALLA
    //=====================
    TextField nicknameField;
    Label gamesPlayed;
    Label winsCount;
    Label accuracyRate;
    Label podiumCount;
    ScrollView historyList;

    //=====================
    //MÈTODE: CONSTRUCTOR
    //BUSCA ELS ELEMENTS DEL UXML I PREPARA EL BOTÓ DE SORTIR
    //=====================
    public ProfileScreenController(VisualElement root)
    {
        nicknameField = root.Q<TextField>("nickname-field");
        gamesPlayed = root.Q<Label>("games-played");
        winsCount = root.Q<Label>("wins-count");
        accuracyRate = root.Q<Label>("accuracy-rate");
        podiumCount = root.Q<Label>("podium-count");
        historyList = root.Q<ScrollView>("history-list");

        Button leaveButton = root.Q<Button>("leave-button");

        if (leaveButton != null)
        {
            leaveButton.clicked += OnBackClicked;
        }
    }

    //=====================
    //MÈTODE: PINTA EL PERFIL SENCER
    //=====================
    public void Show(UserProfile profile)
    {
        if (profile == null)
        {
            return;
        }

        SetNickname(profile.nickname);

        if (gamesPlayed != null)
        {
            gamesPlayed.text = profile.gamesPlayed.ToString();
        }

        if (winsCount != null)
        {
            winsCount.text = profile.wins.ToString();
        }

        if (accuracyRate != null)
        {
            int percent = (int)(profile.accuracyRate * 100f);
            accuracyRate.text = percent + "%";
        }

        if (podiumCount != null)
        {
            podiumCount.text = profile.podiumCount.ToString();
        }

        RebuildHistory(profile);
    }

    //=====================
    //MÈTODE: PINTA EL NICKNAME AL CAMP
    //=====================
    public void SetNickname(string nickname)
    {
        if (nicknameField == null)
        {
            return;
        }

        if (string.IsNullOrEmpty(nickname))
        {
            nicknameField.SetValueWithoutNotify("");
            return;
        }

        nicknameField.SetValueWithoutNotify(nickname);
    }

    //=====================
    //MÈTODE: TORNA A PINTAR L'HISTORIAL DE PARTIDES
    //=====================
    void RebuildHistory(UserProfile profile)
    {
        if (historyList == null)
        {
            return;
        }

        historyList.Clear();

        if (profile.history == null)
        {
            return;
        }

        //SI NO HI HA PARTIDES MOSTREM UN MISSATGE BUIT
        if (profile.history.Count == 0)
        {
            Label empty = new Label("Encara no has jugat cap partida.");
            empty.AddToClassList("empty");
            historyList.Add(empty);
            return;
        }

        //UNA FILA PER A CADA PARTIDA
        foreach (GameHistoryEntry entry in profile.history)
        {
            string text = entry.category + " · posició " + entry.position;
            Label row = new Label(text);
            historyList.Add(row);
        }
    }

    //=====================
    //EVENT: CLIC AL BOTÓ DE TORNAR
    //=====================
    void OnBackClicked()
    {
        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnBack == null)
        {
            return;
        }

        OnBack.Invoke();
    }
}
