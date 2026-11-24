//ARXIU QUE CONTÉ ELS MISSATGES DE XARXA DE PARTIDA DE UNITY CAP AL SERVIDOR

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
    //MODEL: MISSATGE PER ENVIAR LA RESPOSTA DEL JUGADOR
    //=====================
    [Serializable]
    public class SubmitAnswerMessage
    {
        public string type = "answer:submit";
        public int questionId;
        public int answer;
    }

    //=====================
    //MODEL: MISSATGE PER PASSAR A LA SEGÜENT RONDA (NOMÉS EL HOST)
    //=====================
    [Serializable]
    public class NextRoundMessage
    {
        public string type = "round:next";
    }

    //=====================
    //MODEL: MISSATGE PER ENVIAR UNA LÍNIA DE XAT
    //=====================
    [Serializable]
    public class ChatMessage
    {
        public string type = "chat:message";
        public string text;
    }
}
