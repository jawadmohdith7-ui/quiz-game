//ARXIU QUE GUARDA EN MEMORIA LA SESSIO DEL CLIENT: GUEST ID I SALA ACTIVA

//=====================
//CLASSE: SESSIONSTORE
//ESTAT NOMES EN MEMORIA, MAI A DISC NI A CAP EMMAGATZEMATGE PERSISTENT
//=====================
public static class SessionStore
{
    //GUEST ID QUE CONFIRMA EL SERVIDOR A IDENTITY:CONFIRMED
    public static string GuestId { get; set; }

    //SALA ON L'USUARI HA ENTRAT O HA CREAT
    public static string ActiveRoomId { get; private set; }

    //CONTRASENYA DE LA SALA ACTIVA
    public static string ActiveRoomPassword { get; private set; }

    //=====================
    //DESA LA SALA ACTIVA
    //=====================
    public static void SetActiveRoom(string roomId, string password)
    {
        if (roomId == null)
        {
            ActiveRoomId = string.Empty;
        }
        else
        {
            ActiveRoomId = roomId;
        }

        if (password == null)
        {
            ActiveRoomPassword = string.Empty;
        }
        else
        {
            ActiveRoomPassword = password;
        }
    }

    //=====================
    //NETEJA LA SALA ACTIVA
    //=====================
    public static void ClearActiveRoom()
    {
        ActiveRoomId = string.Empty;
        ActiveRoomPassword = string.Empty;
    }

    //=====================
    //DIU SI HI HA UNA SALA ACTIVA
    //=====================
    public static bool HasActiveRoom()
    {
        if (ActiveRoomId == null)
        {
            return false;
        }

        if (ActiveRoomId.Length == 0)
        {
            return false;
        }

        return true;
    }
}
