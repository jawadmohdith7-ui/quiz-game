//ARXIU QUE CONSTRUEIX L'ESTAT SENCER QUE VEURA EL PANELL D'ADMINISTRACIO

//=====================
//IMPORTEM
//=====================
import { playersCount } from "../connections/broadcast.js";
import { roomStorage } from "../storage/roomStorage.js";

//=====================
//ESTAT
//=====================
export function estatDirecte() {
  const sales = [];
  let partidesEnCurs = 0;

  for (const [id, sala] of roomStorage.members) {
    let jugadors = 0;

    if (sala.players) {
      jugadors = sala.players.size;
    }

    let nom = "";
    if (sala.nameRoom) {
      nom = sala.nameRoom;
    }

    let estat = "lobby";
    if (sala.state) {
      estat = sala.state;
    }

    sales.push({
      id: id,
      nom: nom,
      jugadors: jugadors,
      estat: estat,
      categoria: sala.category,
    });

    //UNA SALA AMB LA PARTIDA COMENÇADA ES UNA PARTIDA EN CURS
    if (sala.state === "playing") {
      partidesEnCurs = partidesEnCurs + 1;
    }
  }

  return {
    jugadors: playersCount(),
    sales: sales,
    partidesEnCurs: partidesEnCurs,
  };
}
