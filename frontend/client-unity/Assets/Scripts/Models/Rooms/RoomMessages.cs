//ARXIU QUE CONTÉ ELS MISSATGES DE XARXA DE SALES DE UNITY CAP AL SERVIDOR

//=====================
//IMPORTEM
//=====================
using System;

//=====================
//NAMESPACE: MODELS
//=====================
namespace Models
{
    //=====================
    //MODEL: MISSATGE PER DEMANAR LA LLISTA DE SALES
    //=====================
    [Serializable]
    public class ListRoomsMessage
    {
        public string type = "rooms:list";
    }

    //=====================
    //MODEL: MISSATGE PER CREAR UNA SALA
    //=====================
    [Serializable]
    public class CreateRoomMessage
    {
        public string type = "room:create";
        public string nickname;
        public int maxPlayers;
        public bool isPrivate;
        public string nameRoom;
    }

    //=====================
    //MODEL: MISSATGE PER ENTRAR A UNA SALA
    //=====================
    public class JoinRoomMessage
    {
        public string type = "room:join";
        public string roomId;
        public string nickname;
        public string password;
        public int? maxPlayers;
        public bool isPrivate;
    }

    //=====================
    //MODEL: MISSATGE PER SORTIR DE LA SALA
    //=====================
    [Serializable]
    public class LeaveRoomMessage
    {
        public string type = "room:leave";
        public string roomId;
    }

    //=====================
    //MODEL: MISSATGE PER MARCAR-SE A PUNT O NO
    //=====================
    [Serializable]
    public class SetReadyMessage
    {
        public string type = "room:ready";
        public bool ready;
    }

    //=====================
    //MODEL: CONFIGURACIÓ QUE S'ENVIA AL SERVIDOR
    //DURATIONSECONDS ÉS NULLABLE: EL SERVIDOR NOMÉS L'IGNORA SI NO ARRIBA
    //=====================
    public class RoomConfigurationSendData
    {
        public string category;
        public string difficulty;
        public int maxPlayers;
        public int rounds;
        public int? durationSeconds;
    }

    //=====================
    //MODEL: MISSATGE PER CANVIAR LA CONFIGURACIÓ (NOMÉS EL HOST)
    //=====================
    public class RoomConfigurationMessage
    {
        public string type = "room:configuration";
        public RoomConfigurationSendData configuration = new RoomConfigurationSendData();
    }

    //=====================
    //MODEL: MISSATGE PER INICIAR LA PARTIDA (NOMÉS EL HOST)
    //=====================
    [Serializable]
    public class StartGameMessage
    {
        public string type = "game:start";
    }
}
