//ARXIU QUE CONSTRUEIX LA CONDICIÓ SQL DEL FILTRE DE SALA

//=====================
//FILTRE DE SALA
//=====================
//SENSE SALA NO HI HA CONDICIÓ; AMB SALA, TOTES LES CONSULTES FILTREN IGUAL
export function construirFiltreSala(sala) {
  let condicioSala = "";
  const valorsSala = [];

  if (sala !== undefined && sala !== null && sala !== "") {
    condicioSala = " WHERE p.nom_sala = ?";
    valorsSala.push(sala);
  }

  return { condicioSala: condicioSala, valorsSala: valorsSala };
}
