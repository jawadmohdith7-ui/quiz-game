//ARXIU QUE CONTÉ ELS MODELS DE SALES I LOBBY

//=====================
//IMPORTEM
//=====================
using System;
using System.Collections.Generic;
using Newtonsoft.Json;

//=====================
//NAMESPACE: MODELS
//=====================
namespace Models
{
    //=====================
    //MODEL: SALA PÚBLICA DE LA LLISTA
    //=====================
    [Serializable]
    public class RoomInfo
    {
        public string id;
        public string name;
        public int players;
        public int maxPlayers;
        public string category;
        public bool isPrivate;

        //ESTAT DE LA SALA: lobby, playing o finished
        public string state;

        //=====================
        //PROPIETAT: INDICA SI LA SALA JA ESTÀ PLENA
        //SERVEIX PER DESACTIVAR EL BOTÓ D'ENTRAR
        //=====================
        public bool IsFull
        {
            get
            {
                if (players >= maxPlayers)
                {
                    return true;
                }

                return false;
            }
        }
    }

    //=====================
    //MODEL: SALA DE LA LLISTA PÚBLICA
    //ROOMS:LIST FA SERVIR "ID" I ROOM:NEW FA SERVIR "ROOMID", S'ACCEPTEN ELS DOS
    //=====================
    public class RoomListItem
    {
        public string id;
        public string roomId;
        public string name;
        public int maxPlayers;
        public int players;
        public string category;
        public string state;
        public bool isPrivate;

        //=====================
        //PROPIETAT: ID DE LA SALA, VINGUI COM VINGUI
        //=====================
        [JsonIgnore]
        public string Id
        {
            get
            {
                if (id != null)
                {
                    return id;
                }

                return roomId;
            }
        }
    }

    //=====================
    //MODEL: RESPOSTA DE ROOM:CREATED
    //=====================
    public class RoomCreatedData
    {
        public string roomId;
        public string hostId;
        public string nameRoom;
        public string category;
        public string difficulty;
        public int rounds;
        public int maxPlayers;
        public bool isPrivate;
        public string password;
        public List<ServerPlayer> players = new List<ServerPlayer>();
        public string state;
        public int durationSeconds;
        public int readyCount;
        public int readyRequired;
        public bool canStart;
        public string role;
    }

    //=====================
    //MODEL: RESPOSTES DE ROOM:JOINED, ROOM:PLAYERS I ROOM:LEFT
    //ROOM:JOINED TAMBÉ PORTA EL PASSWORD I EL ROL
    //=====================
    public class RoomPlayersData
    {
        public string roomId;
        public string hostId;
        public string nameRoom;
        public string category;
        public string difficulty;
        public int rounds;
        public int maxPlayers;
        public string state;
        public int durationSeconds;
        public int readyCount;
        public int readyRequired;
        public bool canStart;
        public bool isPrivate;
        public string password;
        public string role;
        public List<ServerPlayer> players = new List<ServerPlayer>();
    }

    //=====================
    //MODEL: JUGADOR DINS D'UNA SALA
    //=====================
    public class ServerPlayer
    {
        public string id;
        public string nickname;
        public int score;
        public bool ready;
        public string role;
    }

    //=====================
    //MODEL: JUGADOR QUE APAREIX AL LOBBY
    //=====================
    [Serializable]
    public class LobbyPlayer
    {
        public string id;
        public string nickname;
        public int score;
        public bool ready;
        public string role;
    }

    //=====================
    //MODEL: DADES DE LA SALA QUE MOSTRA EL LOBBY
    //=====================
    [Serializable]
    public class LobbyRoom
    {
        public string name;
        public string category;
        public bool isPrivate;
        public string code;
    }

    //=====================
    //MODEL: DADES QUE S'ENVIEN AL SERVIDOR EN CREAR UNA SALA
    //=====================
    [Serializable]
    public class CreateRoomData
    {
        public string name;
        public bool isPrivate;
        public int maxPlayers;
        public int rounds;
        public string category;
    }

    //=====================
    //MODEL: CANVI D'ESTAT DE LA SALA (ROOM:STATE)
    //=====================
    public class RoomStateData
    {
        public string roomId;
        public string state;
    }

    //=====================
    //MODEL: CONFIGURACIÓ DE LA SALA
    //LA MATEIXA CLASSE SERVEIX PER LLEGIR-LA I PER ENVIAR-LA
    //=====================
    public class RoomConfigurationData
    {
        public string category;
        public string difficulty;
        public int maxPlayers;
        public int rounds;
        public int durationSeconds;
        public string state;
    }
}
