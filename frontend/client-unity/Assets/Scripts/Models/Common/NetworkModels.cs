//ARXIU QUE CONTÉ ELS MODELS COMUNS DE XARXA

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
    //MODEL: CAPÇALERA PER LLEGIR EL TIPUS D'UN MISSATGE ENTRANT
    //=====================
    [Serializable]
    public class NetworkMessageHeader
    {
        public string type;
    }

    [Serializable]
    public class CatalogOptions
    {
        public System.Collections.Generic.List<string> categories;
        public System.Collections.Generic.List<string> difficulties;
    }
}
