//ARXIU QUE DECLARA ELS EVENTS DEL CLIENT I ELS LLANÇA ALS SUBSCRITS

//=====================
//IMPORTEM
//=====================
using System;
using System.Collections.Generic;
using Models;
using Newtonsoft.Json.Linq;

//=====================
//CLASSE: GAMECLIENT (PART D'EVENTS)
//CADA INVOKE... COMPROVA QUE HI HAGI ALGÚ ESCOLTANT ABANS DE LLANÇAR
//=====================
public partial class GameClient
{
    //=====================
    //EVENTS QUE ES LLANCEN QUAN ARRIBA CADA RESPOSTA
    //=====================
    public event Action<ServerIdentity> OnIdentity;
    public event Action<string> OnDisconnected;
    public event Action<List<RoomListItem>> OnRoomsList;
    public event Action<CatalogOptions> OnCatalogOptions;
    public event Action<RoomListItem> OnRoomAdded;
    public event Action<string> OnRoomRemoved;
    public event Action<RoomCreatedData> OnRoomCreated;
    public event Action<RoomPlayersData> OnRoomJoined;
    public event Action<RoomPlayersData> OnRoomPlayers;
    public event Action<string> OnRoomLeft;
    public event Action<RoomStateData> OnRoomState;
    public event Action<string> OnNicknameUpdated;
    public event Action<string> OnReadyError;
    public event Action<RoomConfigurationData> OnConfigurationUpdated;
    public event Action<string> OnConfigurationError;
    public event Action<RoundStartedData> OnRoundStarted;
    public event Action<SpectatorRoundData> OnSpectatorRound;
    public event Action<RoundResultsData> OnRoundResults;
    public event Action<RoundRankingData> OnRoundRanking;
    public event Action<GameFinishedData> OnGameFinished;
    public event Action<int> OnAnswerAck;
    public event Action<string> OnRoundNextError;
    public event Action<string, string> OnServerError;
    public event Action<ChatMessageData> OnChatMessage;
    public event Action<string, JToken> OnOther;

    //=====================
    //EVENT: IDENTITAT CONFIRMADA
    //=====================
    void InvokeIdentity(ServerIdentity identity)
    {
        if (OnIdentity == null)
        {
            return;
        }

        OnIdentity.Invoke(identity);
    }

    //=====================
    //EVENT: LLISTA DE SALES
    //=====================
    void InvokeRoomsList(List<RoomListItem> rooms)
    {
        if (OnRoomsList == null)
        {
            return;
        }

        OnRoomsList.Invoke(rooms);
    }

    //=====================
    //EVENT: CATEGORIES I DIFICULTATS DEL CATÀLEG
    //=====================
    void InvokeCatalogOptions(CatalogOptions options)
    {
        if (OnCatalogOptions == null)
        {
            return;
        }

        OnCatalogOptions.Invoke(options);
    }

    //=====================
    //EVENT: SALA NOVA A LA LLISTA
    //=====================
    void InvokeRoomAdded(RoomListItem room)
    {
        if (OnRoomAdded == null)
        {
            return;
        }

        OnRoomAdded.Invoke(room);
    }

    //=====================
    //EVENT: SALA ELIMINADA DE LA LLISTA
    //=====================
    void InvokeRoomRemoved(string roomId)
    {
        if (OnRoomRemoved == null)
        {
            return;
        }

        OnRoomRemoved.Invoke(roomId);
    }

    //=====================
    //EVENT: SALA CREADA
    //=====================
    void InvokeRoomCreated(RoomCreatedData room)
    {
        if (OnRoomCreated == null)
        {
            return;
        }

        OnRoomCreated.Invoke(room);
    }

    //=====================
    //EVENT: HEM ENTRAT A UNA SALA
    //=====================
    void InvokeRoomJoined(RoomPlayersData room)
    {
        if (OnRoomJoined == null)
        {
            return;
        }

        OnRoomJoined.Invoke(room);
    }

    //=====================
    //EVENT: HAN CANVIAT ELS JUGADORS D'UNA SALA
    //=====================
    void InvokeRoomPlayers(RoomPlayersData room)
    {
        if (OnRoomPlayers == null)
        {
            return;
        }

        OnRoomPlayers.Invoke(room);
    }

    //=====================
    //EVENT: HEM SORTIT DE LA SALA
    //=====================
    void InvokeRoomLeft(string roomId)
    {
        if (OnRoomLeft == null)
        {
            return;
        }

        OnRoomLeft.Invoke(roomId);
    }

    //=====================
    //EVENT: HA CANVIAT L'ESTAT DE LA SALA
    //=====================
    void InvokeRoomState(RoomStateData roomState)
    {
        if (OnRoomState == null)
        {
            return;
        }

        OnRoomState.Invoke(roomState);
    }

    //=====================
    //EVENT: HA CANVIAT EL NICK DEL JUGADOR
    //=====================
    void InvokeNicknameUpdated(string nickname)
    {
        if (OnNicknameUpdated == null)
        {
            return;
        }

        OnNicknameUpdated.Invoke(nickname);
    }

    //=====================
    //EVENT: ERROR EN MARCAR-SE A PUNT
    //=====================
    void InvokeReadyError(string text)
    {
        if (OnReadyError == null)
        {
            return;
        }

        OnReadyError.Invoke(text);
    }

    //=====================
    //EVENT: CONFIGURACIÓ DE LA SALA CONFIRMADA
    //=====================
    void InvokeConfigurationUpdated(RoomConfigurationData configuration)
    {
        if (OnConfigurationUpdated == null)
        {
            return;
        }

        OnConfigurationUpdated.Invoke(configuration);
    }

    //=====================
    //EVENT: ERROR EN CANVIAR LA CONFIGURACIÓ
    //=====================
    void InvokeConfigurationError(string text)
    {
        if (OnConfigurationError == null)
        {
            return;
        }

        OnConfigurationError.Invoke(text);
    }

    //=====================
    //EVENT: HA COMENÇAT UNA RONDA
    //=====================
    void InvokeRoundStarted(RoundStartedData round)
    {
        if (OnRoundStarted == null)
        {
            return;
        }

        OnRoundStarted.Invoke(round);
    }

    //=====================
    //EVENT: RONDA VISTA PER UN OBSERVADOR
    //=====================
    void InvokeSpectatorRound(SpectatorRoundData round)
    {
        if (OnSpectatorRound == null)
        {
            return;
        }

        OnSpectatorRound.Invoke(round);
    }

    //=====================
    //EVENT: RESULTAT DE LA RONDA
    //=====================
    void InvokeRoundResults(RoundResultsData results)
    {
        if (OnRoundResults == null)
        {
            return;
        }

        OnRoundResults.Invoke(results);
    }

    //=====================
    //EVENT: RÀNQUING DE LA RONDA
    //=====================
    void InvokeRoundRanking(RoundRankingData ranking)
    {
        if (OnRoundRanking == null)
        {
            return;
        }

        OnRoundRanking.Invoke(ranking);
    }

    //=====================
    //EVENT: S'HA ACABAT LA PARTIDA
    //=====================
    void InvokeGameFinished(GameFinishedData finished)
    {
        if (OnGameFinished == null)
        {
            return;
        }

        OnGameFinished.Invoke(finished);
    }

    //=====================
    //EVENT: HA ARRIBAT UN MISSATGE DE XAT
    //=====================
    void InvokeChatMessage(ChatMessageData message)
    {
        if (OnChatMessage == null)
        {
            return;
        }

        OnChatMessage.Invoke(message);
    }

    //=====================
    //EVENT: RESPOSTA ACCEPTADA PEL SERVIDOR
    //=====================
    void InvokeAnswerAck(int questionId)
    {
        if (OnAnswerAck == null)
        {
            return;
        }

        OnAnswerAck.Invoke(questionId);
    }

    //=====================
    //EVENT: ERROR EN PASSAR A LA SEGÜENT RONDA
    //=====================
    void InvokeRoundNextError(string text)
    {
        if (OnRoundNextError == null)
        {
            return;
        }

        OnRoundNextError.Invoke(text);
    }

    //=====================
    //EVENT: ERROR DEL SERVIDOR
    //=====================
    void InvokeServerError(string type, string text)
    {
        if (OnServerError == null)
        {
            return;
        }

        OnServerError.Invoke(type, text);
    }

    //=====================
    //EVENT: MISSATGE QUE ENCARA NO ES TRACTA
    //=====================
    void InvokeOther(string type, JToken data)
    {
        if (OnOther == null)
        {
            return;
        }

        OnOther.Invoke(type, data);
    }
}
