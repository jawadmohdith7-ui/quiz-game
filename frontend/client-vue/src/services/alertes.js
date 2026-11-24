//ARXIU QUE CENTRALITZA ELS MISSATGES EMERGENTS (SWEETALERT2)

//=====================
//IMPORTEM
//=====================
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

//=====================
//CONFIRMACIO: TRUE SI L'USUARI ACCEPTA
//=====================
export function confirmaEsborrar(missatge) {
  return Swal.fire({
    title: "Segur?",
    text: missatge,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Si, esborra",
    cancelButtonText: "Cancel·lar",
    confirmButtonColor: "#b91c1c",
    cancelButtonColor: "#64748b",
    reverseButtons: true,
  }).then(function resol(resultat) {
    return resultat.isConfirmed === true;
  });
}

//=====================
//ERROR
//=====================
export function mostraError(missatge) {
  return Swal.fire({
    title: "No s'ha pogut fer",
    text: missatge,
    icon: "error",
    confirmButtonText: "D'acord",
  });
}
