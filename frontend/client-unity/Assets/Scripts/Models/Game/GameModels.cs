//ARXIU QUE CONTÉ ELS MODELS DE PARTIDA I JOC

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
    //MODEL: PREGUNTA DE LA RONDA (ROUND:STARTED)
    //=====================
    public class RoundStartedData
    {
        public int round;
        public int totalRounds;
        public int durationMs;
        public QuestionData question;
    }

    //=====================
    //MODEL: ESTAT DE LA RONDA PER A UN OBSERVADOR (ROUND:SPECTATOR)
    //=====================
    public class SpectatorRoundData
    {
        public string roomId;
        public int round;
        public int totalRounds;
        public string phase;
        public int remainingMs;
        public int durationMs;
    }

    //=====================
    //MODEL: RESULTAT DE LA RONDA PER A UN JUGADOR (ROUND:RESULTS)
    //=====================
    public class RoundResultsData
    {
        public int round;
        public int totalRounds;
        public double correctAnswer;
        public string unit;
        public string explanation;
        public YouRoundResult you;
    }

    //=====================
    //MODEL: BLOC "YOU" DE ROUND:RESULTS
    //POT SER null PER ALS OBSERVADORS
    //=====================
    public class YouRoundResult
    {
        public double? answer;
        public int roundPoints;
        public int totalScore;
        public int position;
    }

    //=====================
    //MODEL: RÀNQUING DE LA RONDA (ROUND:RANKING)
    //=====================
    public class RoundRankingData
    {
        public int round;
        public int totalRounds;
        public YouRanking you;
        public List<RankingEntry> ranking = new List<RankingEntry>();
    }

    //=====================
    //MODEL: BLOC "YOU" DE ROUND:RANKING
    //POT SER null PER ALS OBSERVADORS
    //=====================
    public class YouRanking
    {
        public int position;
        public int totalScore;
    }

    //=====================
    //MODEL: FI DE PARTIDA (GAME:FINISHED)
    //=====================
    public class GameFinishedData
    {
        public string roomId;
        public YouFinal you;
        public List<RankingEntry> ranking = new List<RankingEntry>();
    }

    //=====================
    //MODEL: BLOC "YOU" DE GAME:FINISHED
    //POT SER null PER ALS OBSERVADORS
    //=====================
    public class YouFinal
    {
        public int position;
        public int score;
    }

    //=====================
    //MODEL: PREGUNTA QUE ENVIA EL SERVIDOR A ROUND:QUESTIONS
    //=====================
    [Serializable]
    public class QuestionData
    {
        public int id;
        public string text;
        public double correctAnswer;
        public string unit;
        public string difficulty;
        public string explanation;
        public int timeLimitSeconds = 30;
    }

    //=====================
    //MODEL: RESPOSTA CORRECTA QUE ES MOSTRA DESPRÉS DE LA PREGUNTA
    //=====================
    [Serializable]
    public class QuestionResultData
    {
        public string questionText;
        public string correctAnswer;
        public string explanation;
    }

    //=====================
    //MODEL: ENTRADA DE LA TAULA DE CLASSIFICACIÓ
    //=====================
    [Serializable]
    public class RankingEntry
    {
        public int position;
        public string nickname;
        public int score;
    }

    //=====================
    //MODEL: MISSATGE DE XAT REBUT (CHAT:MESSAGE)
    //ID I MESSAGETYPE NOMÉS ARRIBEN ALS AVISOS DE SISTEMA
    //=====================
    public class ChatMessageData
    {
        public string id;
        public string senderId;
        public string senderName;
        public string text;
        public long timestamp;
        public string messageType;
    }
}
