//ARXIU QUE CONTROLA LES SECCIONS DE RÀNQUING, FINAL I ESPECTADOR

//=====================
//IMPORTEM
//=====================
using Models;
using UnityEngine.UIElements;

//=====================
//CLASSE: ROOMSCREENCONTROLLER (PART DE RÀNQUING)
//=====================
public partial class RoomScreenController
{
    //=====================
    //ESTAT INTERN: REFERÈNCIES AL RÀNQUING I AL FINAL
    //=====================
    ScrollView rankingList;
    Button nextRoundButton;
    Label rankingWaiting;
    ScrollView finalRankingList;

    //=====================
    //ESTAT INTERN: REFERÈNCIES A L'ESPECTADOR
    //=====================
    Label spectatorText;
    Label spectatorCountdown;

    //=====================
    //MÈTODE: BUSCA I CONNECTA ELS ELEMENTS DE RÀNQUING
    //=====================
    void QueryRankingElements(VisualElement root)
    {
        rankingList = root.Q<ScrollView>("ranking-list");
        nextRoundButton = root.Q<Button>("next-round-button");
        rankingWaiting = root.Q<Label>("ranking-waiting");
        finalRankingList = root.Q<ScrollView>("final-ranking-list");
        spectatorText = root.Q<Label>("spectator-text");
        spectatorCountdown = root.Q<Label>("spectator-countdown");

        if (nextRoundButton != null)
        {
            nextRoundButton.clicked += OnNextRoundClicked;
        }

        if (rankingWaiting != null)
        {
            rankingWaiting.text = "Esperant que el host passi de ronda...";
        }
    }

    //=====================
    //MÈTODE: PINTA EL RÀNQUING DE LA RONDA
    //EL BOTÓ DE SEGÜENT RONDA EL GESTIONA SETNEXTROUNDVISIBLE
    //=====================
    public void SetRanking(RoundRankingData data)
    {
        if (data == null)
        {
            return;
        }

        if (rankingList == null)
        {
            return;
        }

        rankingList.Clear();

        if (data.ranking == null)
        {
            return;
        }

        foreach (RankingEntry entry in data.ranking)
        {
            rankingList.Add(MakeRankingRow(entry));
        }
    }

    //=====================
    //MÈTODE: MOSTRA EL BOTÓ DE SEGÜENT RONDA NOMÉS AL HOST
    //LA RESTA DE JUGADORS VEURAN EL MISSATGE D'ESPERA
    //=====================
    public void SetNextRoundVisible(bool visible)
    {
        Show(nextRoundButton, visible);
        Show(rankingWaiting, visible == false);
    }

    //=====================
    //MÈTODE: PINTA EL RÀNQUING FINAL
    //SI TENIM BLOC "YOU" AFEGIM LA NOSTRA POSICIÓ AL CAPDAMUNT
    //=====================
    public void SetFinished(GameFinishedData data)
    {
        if (data == null)
        {
            return;
        }

        if (finalRankingList == null)
        {
            return;
        }

        finalRankingList.Clear();

        if (data.you != null)
        {
            Label mine = new Label("Has quedat " + data.you.position + " amb " + data.you.score + " punts");
            mine.AddToClassList("player-chip");
            mine.AddToClassList("player-chip-me");
            finalRankingList.Add(mine);
        }

        if (data.ranking == null)
        {
            return;
        }

        foreach (RankingEntry entry in data.ranking)
        {
            finalRankingList.Add(MakeRankingRow(entry));
        }
    }

    //=====================
    //MÈTODE: PINTA L'ESTAT DE LA RONDA PER A L'ESPECTADOR
    //=====================
    public void SetSpectator(SpectatorRoundData data)
    {
        if (data == null)
        {
            return;
        }

        if (spectatorText != null)
        {
            string text = "Ronda " + data.round + "/" + data.totalRounds;
            text = text + " · fase: " + data.phase;
            spectatorText.text = text;
        }

        SetSpectatorCountdown(MillisecondsToSeconds(data.remainingMs));
    }

    //=====================
    //MÈTODE: PINTA EL COMPTADOR DE L'ESPECTADOR
    //=====================
    public void SetSpectatorCountdown(int? seconds)
    {
        if (spectatorCountdown == null)
        {
            return;
        }

        spectatorCountdown.text = FormatCountdown(seconds);
    }

    //=====================
    //EVENT: CLIC AL BOTÓ DE SEGÜENT RONDA
    //=====================
    void OnNextRoundClicked()
    {
        //SI NINGÚ ESCOLTA L'ESDEVENIMENT NO HI HA RES MÉS A FER
        if (OnNextRound == null)
        {
            return;
        }

        OnNextRound.Invoke();
    }

    //=====================
    //MÈTODE: CREA UNA FILA DEL RÀNQUING
    //POSICIÓ, NICKNAME I PUNTS
    //=====================
    static Label MakeRankingRow(RankingEntry entry)
    {
        string text = entry.position + ". " + entry.nickname + " · " + entry.score + " pts";
        Label row = new Label(text);
        row.AddToClassList("player-chip");
        return row;
    }
}
