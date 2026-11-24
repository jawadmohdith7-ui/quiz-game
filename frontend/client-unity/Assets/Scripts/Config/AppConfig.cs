//ARXIU QUE GUARDA LA CONFIGURACIÓ GLOBAL DEL CLIENT

//=====================
//CLASSE: APPCONFIG
//VALORS QUE ES PODEN CANVIAR ABANS DE COMPILAR O DES DE L'EDITOR
//=====================
public static class AppConfig
{
    //SI ÉS TRUE EL CLIENT TREBALLA AMB DADES SIMULADES SENSE SERVIDOR
    public static bool UseMock = false;

    //ADREÇA DEL WEBSOCKET DEL GAME-SERVICE
    public static string WsUrl = "ws://localhost:3000";

    //ADREÇA HTTP QUE FA SERVIR ROOMAPI; AMB EL SERVIDOR ACTUAL NO S'UTILITZA
    public static string HttpUrl = "http://localhost:3000";
}
