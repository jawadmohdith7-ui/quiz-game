//ARXIU QUE TRADUEIX ELS MISSATGES REBUTS DEL SERVIDOR EN EVENTS DEL CLIENT

//=====================
//IMPORTEM
//=====================
using System;
using System.Collections.Generic;
using Models;
using Newtonsoft.Json.Linq;
using UnityEngine;

//=====================
//CLASSE: GAMECLIENT (PART DE RECEPCIÓ)
//DECIDEIX QUIN MÈTODE HANDLE... TRACTA EL MISSATGE I CADA MÈTODE TRADUEIX
//EL JSON AL MODEL QUE TOCA ABANS DE LLANÇAR L'EVENT
//=====================
public partial class GameClient
{
    //=====================
    //MÈTODE: LLEGEIX EL MISSATGE I LLANÇA L'EVENT QUE TOQUI
    //=====================
    void Handle(string json)
    {
        JObject obj;

        //SI EL JSON NO ÉS VÀLID HO AVISEM I SORTIM
        try
        {
            obj = JObject.Parse(json);
        }
        catch (Exception)
        {
            Debug.LogWarning("[GameClient] JSON no válido: " + json);
            return;
        }

        string type = (string)obj["type"];

        //EL MISSATGE POT PORTAR LES DADES A "PAYLOAD" O DIRECTAMENT A L'ARREL
        JToken payload = obj["payload"];
        JToken data = payload;
        if (data == null)
        {
            data = obj;
        }

        try
        {
            DispatchMessage(type, data, json);
        }
        catch (Exception e)
        {
            Debug.LogWarning("[GameClient] No se pudo leer '" + type + "': " + e.Message + "\n" + json);
        }
    }

    //=====================
    //MÈTODE: DECIDEIX QUÈ FER SEGONS EL TIPUS DE MISSATGE
    //=====================
    void DispatchMessage(string type, JToken data, string json)
    {
        //EL SERVIDOR HA OBERT LA CONNEXIÓ: DECLAREM LA IDENTITAT
        if (type == "connection:stablished")
        {
            DeclareIdentity(false);
            return;
        }

        //EL SERVIDOR HA CONFIRMAT O REBUTJAT LA IDENTITAT
        if (type == "identity:confirmed")
        {
            HandleIdentityConfirmed(type, data);
            return;
        }

        //CATEGORIES I DIFICULTATS DEL CATÀLEG
        if (type == "catalog:options")
        {
            HandleCatalogOptions(data);
            return;
        }

        //LLISTA DE SALES
        if (type == "rooms:list")
        {
            HandleRoomsList(data);
            return;
        }

        //SALA NOVA PUBLICADA PER UN ALTRE JUGADOR
        if (type == "room:new")
        {
            HandleRoomNew(data);
            return;
        }

        //SALA ELIMINADA DE LA LLISTA
        if (type == "room:removed")
        {
            string roomId = (string)data["roomId"];
            InvokeRoomRemoved(roomId);
            return;
        }

        //SALA CREADA
        if (type == "room:created")
        {
            HandleRoomCreated(data);
            return;
        }

        //HEM ENTRAT A UNA SALA
        if (type == "room:joined")
        {
            HandleRoomJoined(data);
            return;
        }

        //HA CANVIAT LA LLISTA DE JUGADORS
        if (type == "room:players")
        {
            HandleRoomPlayers(data);
            return;
        }

        //HEM SORTIT DE LA SALA
        if (type == "room:left")
        {
            string roomId = (string)data["roomId"];
            InvokeRoomLeft(roomId);
            return;
        }

        //HA COMENÇAT UNA RONDA: ARRIBA LA PREGUNTA
        if (type == "round:started")
        {
            HandleRoundStarted(data);
            return;
        }

        //RONDA VISTA PER UN OBSERVADOR
        if (type == "round:spectator")
        {
            HandleSpectatorRound(data);
            return;
        }

        //RESULTAT DE LA RONDA PER AL JUGADOR
        if (type == "round:results")
        {
            HandleRoundResults(data);
            return;
        }

        //RÀNQUING DESPRÉS DE LA RONDA
        if (type == "round:ranking")
        {
            HandleRoundRanking(data);
            return;
        }

        //HA CANVIAT L'ESTAT DE LA SALA
        if (type == "room:state")
        {
            HandleRoomState(data);
            return;
        }

        //S'HA ACABAT LA PARTIDA
        if (type == "game:finished")
        {
            HandleGameFinished(data);
            return;
        }

        //EL SERVIDOR HA ACCEPTAT LA RESPOSTA
        if (type == "answer:ack")
        {
            HandleAnswerAck(data);
            return;
        }

        //ERRORS NOUS DE LA PARTIDA I DE LA SALA
        if (type == "round:next:error")
        {
            HandleRoundNextError(data);
            return;
        }

        if (type == "room:ready:error")
        {
            HandleReadyError(data);
            return;
        }

        //CONFIGURACIÓ DE LA SALA CONFIRMADA O REBUTJADA
        if (type == "room:configuration:updated")
        {
            HandleConfigurationUpdated(data);
            return;
        }

        if (type == "room:configuration:error")
        {
            HandleConfigurationError(data);
            return;
        }

        //HA CANVIAT EL NICK DEL JUGADOR
        if (type == "nickname:updated")
        {
            HandleNicknameUpdated(data);
            return;
        }

        //HA ARRIBAT UN MISSATGE DE XAT
        if (type == "chat:message")
        {
            HandleChatMessage(data);
            return;
        }

        //MISSATGES D'ERROR
        if (IsErrorType(type))
        {
            HandleError(type, data);
            return;
        }

        //MISSATGES QUE ENCARA NO ES TRACTEN
        InvokeOther(type, data);
    }

    //=====================
    //MÈTODE: DIU SI EL TIPUS ÉS UN MISSATGE D'ERROR
    //=====================
    static bool IsErrorType(string type)
    {
        if (type == "room:create:error")
        {
            return true;
        }

        if (type == "room:join:error")
        {
            return true;
        }

        if (type == "room:leave:error")
        {
            return true;
        }

        if (type == "nickname:error")
        {
            return true;
        }

        if (type == "round:error")
        {
            return true;
        }

        if (type == "answer:error")
        {
            return true;
        }

        if (type == "chat:error")
        {
            return true;
        }

        if (type == "error")
        {
            return true;
        }

        return false;
    }

    //=====================
    //MÈTODE: LLEGEIX EL TEXT D'UN MISSATGE D'ERROR
    //EL SERVIDOR POT ENVIAR EL TEXT A "REASON" O A "MESSAGE"
    //=====================
    static string ReadErrorText(JToken data)
    {
        string reason = (string)data["reason"];
        if (reason != null)
        {
            return reason;
        }

        string message = (string)data["message"];
        if (message != null)
        {
            return message;
        }

        return "Error del servidor";
    }

    //=====================
    //MÈTODE: TRACTA LA RESPOSTA DE IDENTITY:CONFIRMED
    //SI EL SERVIDOR REBUTJA LA IDENTITAT GUARDADA, EN DEMANEM UNA DE NOVA
    //=====================
    void HandleIdentityConfirmed(string type, JToken data)
    {
        string error = (string)data["error"];

        //IDENTITAT REBUTJADA
        if (string.IsNullOrEmpty(error) == false)
        {
            Debug.LogWarning("[GameClient] identidad rechazada: " + error);

            //SI ENCARA NO HO HAVÍEM PROVAT, ESBORREM L'ID GUARDAT I DEMANEM UN DE NOU
            if (triedNewIdentity == false)
            {
                SessionStore.GuestId = "";
                DeclareIdentity(true);
                return;
            }

            //SI JA HAVÍEM DEMANAT UNA IDENTITAT NOVA, HO CONSIDEREM UN ERROR
            InvokeServerError(type, error);
            return;
        }

        Debug.Log("[GameClient] identidad confirmada: " + data["identity"]);

        JToken identityToken = data["identity"];
        Identity = identityToken.ToObject<ServerIdentity>();

        //SI NO HA ARRIBAT CAP IDENTITAT NO TENIM RES MÉS A FER
        if (Identity == null)
        {
            return;
        }

        //GUARDEM L'ID PER PODER RESTAURAR-LO MIENTRAS VISQUI LA SESSIÓ
        if (string.IsNullOrEmpty(Identity.Id) == false)
        {
            SessionStore.GuestId = Identity.Id;
        }

        InvokeIdentity(Identity);
    }

    //=====================
    //MÈTODE: TRACTA LES CATEGORIES I DIFICULTATS DEL CATÀLEG
    //SI EL SERVIDOR NO LES POT CARREGAR, MANTENIM L'ÚLTIMA LLISTA
    //=====================
    void HandleCatalogOptions(JToken data)
    {
        bool ok = true;
        JToken okToken = data["ok"];

        if (okToken != null)
        {
            ok = (bool)okToken;
        }

        if (ok == false)
        {
            string reason = ReadErrorText(data);
            Debug.LogWarning("[GameClient] catálogo no disponible: " + reason);
            return;
        }

        CatalogOptions options = data.ToObject<CatalogOptions>();

        if (options == null)
        {
            return;
        }

        if (options.categories == null || options.difficulties == null)
        {
            return;
        }

        InvokeCatalogOptions(options);
    }

    //=====================
    //MÈTODE: TRACTA LA LLISTA DE SALES
    //=====================
    void HandleRoomsList(JToken data)
    {
        JToken roomsToken = data["rooms"];

        List<RoomListItem> rooms = null;
        if (roomsToken != null)
        {
            rooms = roomsToken.ToObject<List<RoomListItem>>();
        }

        //SI NO HA ARRIBAT CAP LLISTA, ENVIEM UNA DE BUIDA
        if (rooms == null)
        {
            rooms = new List<RoomListItem>();
        }

        InvokeRoomsList(rooms);
    }

    //=====================
    //MÈTODE: TRACTA UNA SALA NOVA DE LA LLISTA
    //=====================
    void HandleRoomNew(JToken data)
    {
        RoomListItem room = data.ToObject<RoomListItem>();

        //SI NO S'HA POGUT LLEGIR LA SALA NO FEM RES
        if (room == null)
        {
            return;
        }

        InvokeRoomAdded(room);
    }

    //=====================
    //MÈTODE: TRACTA LA SALA QUE ACABEM DE CREAR
    //=====================
    void HandleRoomCreated(JToken data)
    {
        RoomCreatedData room = data.ToObject<RoomCreatedData>();

        //SI NO S'HA POGUT LLEGIR LA SALA NO FEM RES
        if (room == null)
        {
            return;
        }

        InvokeRoomCreated(room);
    }

    //=====================
    //MÈTODE: TRACTA L'ENTRADA A UNA SALA
    //=====================
    void HandleRoomJoined(JToken data)
    {
        RoomPlayersData room = data.ToObject<RoomPlayersData>();

        //SI NO S'HA POGUT LLEGIR LA SALA NO FEM RES
        if (room == null)
        {
            return;
        }

        InvokeRoomJoined(room);
    }

    //=====================
    //MÈTODE: TRACTA EL CANVI DE JUGADORS D'UNA SALA
    //=====================
    void HandleRoomPlayers(JToken data)
    {
        RoomPlayersData room = data.ToObject<RoomPlayersData>();

        //SI NO S'HA POGUT LLEGIR LA SALA NO FEM RES
        if (room == null)
        {
            return;
        }

        InvokeRoomPlayers(room);
    }

    //=====================
    //MÈTODE: TRACTA L'INICI D'UNA RONDA AMB LA PREGUNTA
    //=====================
    void HandleRoundStarted(JToken data)
    {
        RoundStartedData round = data.ToObject<RoundStartedData>();

        //SI NO S'HA POGUT LLEGIR LA RONDA NO FEM RES
        if (round == null)
        {
            return;
        }

        InvokeRoundStarted(round);
    }

    //=====================
    //MÈTODE: TRACTA LA RONDA VISTA PER UN OBSERVADOR
    //=====================
    void HandleSpectatorRound(JToken data)
    {
        SpectatorRoundData round = data.ToObject<SpectatorRoundData>();

        //SI NO S'HA POGUT LLEGIR LA RONDA NO FEM RES
        if (round == null)
        {
            return;
        }

        InvokeSpectatorRound(round);
    }

    //=====================
    //MÈTODE: TRACTA EL RESULTAT DE LA RONDA
    //=====================
    void HandleRoundResults(JToken data)
    {
        RoundResultsData results = data.ToObject<RoundResultsData>();

        //SI NO S'HA POGUT LLEGIR EL RESULTAT NO FEM RES
        if (results == null)
        {
            return;
        }

        InvokeRoundResults(results);
    }

    //=====================
    //MÈTODE: TRACTA EL RÀNQUING DE LA RONDA
    //=====================
    void HandleRoundRanking(JToken data)
    {
        RoundRankingData ranking = data.ToObject<RoundRankingData>();

        //SI NO S'HA POGUT LLEGIR EL RÀNQUING NO FEM RES
        if (ranking == null)
        {
            return;
        }

        InvokeRoundRanking(ranking);
    }

    //=====================
    //MÈTODE: TRACTA EL CANVI D'ESTAT DE LA SALA
    //=====================
    void HandleRoomState(JToken data)
    {
        RoomStateData roomState = data.ToObject<RoomStateData>();

        //SI NO S'HA POGUT LLEGIR L'ESTAT NO FEM RES
        if (roomState == null)
        {
            return;
        }

        InvokeRoomState(roomState);
    }

    //=====================
    //MÈTODE: TRACTA EL FINAL DE LA PARTIDA
    //=====================
    void HandleGameFinished(JToken data)
    {
        GameFinishedData finished = data.ToObject<GameFinishedData>();

        //SI NO S'HA POGUT LLEGIR EL FINAL NO FEM RES
        if (finished == null)
        {
            return;
        }

        InvokeGameFinished(finished);
    }

    //=====================
    //MÈTODE: TRACTA L'ACUSAMENT DE REBUDA D'UNA RESPOSTA
    //=====================
    void HandleAnswerAck(JToken data)
    {
        JToken questionIdToken = data["questionId"];

        //SI NO ARRIBA EL QUESTIONID NO PODEM DIR QUINA RESPOSTA S'HA ACCEPTAT
        if (questionIdToken == null)
        {
            return;
        }

        int questionId = (int)questionIdToken;
        InvokeAnswerAck(questionId);
    }

    //=====================
    //MÈTODE: TRACTA L'ERROR DE ROUND:NEXT
    //TAMBÉ PASSA PEL CANAL GENERAL D'ERRORS
    //=====================
    void HandleRoundNextError(JToken data)
    {
        string text = ReadErrorText(data);
        InvokeRoundNextError(text);
        InvokeServerError("round:next:error", text);
    }

    //=====================
    //MÈTODE: TRACTA L'ERROR DE ROOM:READY
    //TAMBÉ PASSA PEL CANAL GENERAL D'ERRORS
    //=====================
    void HandleReadyError(JToken data)
    {
        string text = ReadErrorText(data);
        InvokeReadyError(text);
        InvokeServerError("room:ready:error", text);
    }

    //=====================
    //MÈTODE: TRACTA LA CONFIGURACIÓ ACCEPTADA PEL SERVIDOR
    //EL SERVIDOR ÉS LA FONT DE VERITAT: NOMÉS ENS QUEDEM EL BLOC CONFIGURATION
    //=====================
    void HandleConfigurationUpdated(JToken data)
    {
        JToken configurationToken = data["configuration"];

        //SI NO ARRIBA LA CONFIGURACIÓ NO FEM RES
        if (configurationToken == null)
        {
            return;
        }

        RoomConfigurationData configuration = configurationToken.ToObject<RoomConfigurationData>();

        //SI NO S'HA POGUT LLEGIR LA CONFIGURACIÓ NO FEM RES
        if (configuration == null)
        {
            return;
        }

        InvokeConfigurationUpdated(configuration);
    }

    //=====================
    //MÈTODE: TRACTA L'ERROR DE ROOM:CONFIGURATION
    //TAMBÉ PASSA PEL CANAL GENERAL D'ERRORS
    //=====================
    void HandleConfigurationError(JToken data)
    {
        string text = ReadErrorText(data);
        InvokeConfigurationError(text);
        InvokeServerError("room:configuration:error", text);
    }

    //=====================
    //MÈTODE: TRACTA EL CANVI DE NICK CONFIRMAT PEL SERVIDOR
    //=====================
    void HandleNicknameUpdated(JToken data)
    {
        string nickname = (string)data["nickname"];

        //SI NO ARRIBA EL NICK NO FEM RES
        if (nickname == null)
        {
            return;
        }

        Debug.Log("[GameClient] nickname:updated " + nickname);
        InvokeNicknameUpdated(nickname);
    }

    //=====================
    //MÈTODE: TRACTA UN MISSATGE DE XAT REBUT
    //=====================
    void HandleChatMessage(JToken data)
    {
        ChatMessageData chatMessage = data.ToObject<ChatMessageData>();

        //SI NO S'HA POGUT LLEGIR EL MISSATGE NO FEM RES
        if (chatMessage == null)
        {
            return;
        }

        InvokeChatMessage(chatMessage);
    }

    //=====================
    //MÈTODE: TRACTA UN MISSATGE D'ERROR
    //=====================
    void HandleError(string type, JToken data)
    {
        string text = ReadErrorText(data);
        InvokeServerError(type, text);
    }
}
