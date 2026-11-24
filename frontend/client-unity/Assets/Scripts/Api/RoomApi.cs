//ARXIU QUE SIMULA LA PETICIÓ DE SALES PÚBLIQUES PER HTTP

//=====================
//IMPORTEM
//=====================
using System;
using System.Collections;
using System.Collections.Generic;
using Models;
using UnityEngine;

//=====================
//CLASSE: RESULTAT DE LA PETICIÓ DE SALES
//=====================
public class RoomApiResult
{
    public bool Ok;
    public List<RoomInfo> Data;
    public string Error;
}

//=====================
//CLASSE: ROOMAPI
//ARA MATEIX RETORNA UNA LLISTA DE SALES D'EXEMPLE, NO CRIDA CAP SERVIDOR
//=====================
public static class RoomApi
{
    //=====================
    //MÈTODE: ESPERA UNS SEGONS I RETORNA LES SALES SIMULADES
    //=====================
    public static IEnumerator GetPublicRooms(Action<RoomApiResult> callback)
    {
        //PETITA ESPERA PER SIMULAR LATÈNCIA DE XARXA
        yield return new WaitForSeconds(0.3f);

        //CONSTRUÏM DUES SALES D'EXEMPLE
        List<RoomInfo> sampleRooms = new List<RoomInfo>();

        RoomInfo firstRoom = new RoomInfo();
        firstRoom.name = "Sala General #1";
        firstRoom.category = "Mixto";
        firstRoom.isPrivate = false;
        sampleRooms.Add(firstRoom);

        RoomInfo secondRoom = new RoomInfo();
        secondRoom.name = "Geografía Express";
        secondRoom.category = "Geografía";
        secondRoom.isPrivate = false;
        sampleRooms.Add(secondRoom);

        //PREPAREM EL RESULTAT QUE REBRÀ QUI ENS HA CRIDAT
        RoomApiResult result = new RoomApiResult();
        result.Ok = true;
        result.Data = sampleRooms;
        result.Error = null;

        //SI NO HI HA CALLBACK NO HI HA RES MÉS A FER
        if (callback == null)
        {
            yield break;
        }

        callback.Invoke(result);
    }
}
