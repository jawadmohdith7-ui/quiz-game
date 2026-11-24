//ARXIU QUE CONTÉ ELS MODELS DE PERFIL I ESTADÍSTIQUES

//=====================
//IMPORTEM
//=====================
using System;
using System.Collections.Generic;

//=====================
//NAMESPACE: MODELS
//=====================
namespace Models
{
    //=====================
    //MODEL: UNA PARTIDA PASSADA DE L'HISTORIAL
    //=====================
    [Serializable]
    public class GameHistoryEntry
    {
        public string gameId;
        public string category;
        public int position;
    }

    //=====================
    //MODEL: PERFIL COMPLET DE L'USUARI
    //=====================
    [Serializable]
    public class UserProfile
    {
        public string id;
        public string nickname;
        public int gamesPlayed;
        public int wins;
        public float accuracyRate;
        public int podiumCount;
        public List<GameHistoryEntry> history = new List<GameHistoryEntry>();
    }
}
