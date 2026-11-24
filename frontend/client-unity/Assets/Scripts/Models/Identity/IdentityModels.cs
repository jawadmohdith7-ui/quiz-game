//ARXIU QUE CONTÉ ELS MODELS D'IDENTITAT DEL CONVIDAT

//=====================
//IMPORTEM
//=====================
using System;
using Newtonsoft.Json;

//=====================
//NAMESPACE: MODELS
//=====================
namespace Models
{
    //=====================
    //MODEL: IDENTITAT QUE ES DECLARA EN CONNECTAR
    //"NEW" LA PRIMERA VEGADA, "RESTORE" SI JA TENIM ID I NICK GUARDATS
    //=====================
    [Serializable]
    public class IdentityPayload
    {
        public string type = "new";
        public string id;
        public string nickname;
    }

    //=====================
    //MODEL: MISSATGE PER DECLARAR LA IDENTITAT
    //=====================
    [Serializable]
    public class DeclareIdentityMessage
    {
        public string type = "identity:declare";
        public IdentityPayload identity = new IdentityPayload();
    }

    //=====================
    //MODEL: MISSATGE PER CANVIAR EL NICK
    //=====================
    [Serializable]
    public class UpdateNicknameMessage
    {
        public string type = "nickname:update";
        public string nickname;
    }

    //=====================
    //MODEL: ACTUALITZACIÓ DE L'INVITAT (NO S'UTILITZA)
    //=====================
    [Serializable]
    public class UpdateGuestMessage
    {
        public string type = "guest:update";
        public string guestId;
        public string newNickname;
    }

    //=====================
    //MODEL: IDENTITAT CONFIRMADA (IDENTITY:CONFIRMED)
    //S'ACCEPTEN DIVERSOS NOMS DE CAMP PERQUÈ LA DOCUMENTACIÓ DEL SERVIDOR NO ÉS EXACTA
    //=====================
    public class ServerIdentity
    {
        public string id;
        public string guestId;
        public string type;
        public string nickname;
        public string nickanme;

        //=====================
        //PROPIETAT: ID DE L'INVITAT, VINGUI COM VINGUI
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

                return guestId;
            }
        }

        //=====================
        //PROPIETAT: NICK DE L'INVITAT, VINGUI COM VINGUI
        //=====================
        [JsonIgnore]
        public string Nick
        {
            get
            {
                if (nickname != null)
                {
                    return nickname;
                }

                return nickanme;
            }
        }
    }
}
