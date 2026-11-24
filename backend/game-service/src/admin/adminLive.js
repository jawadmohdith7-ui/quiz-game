//ARXIU QUE ENVIA L'ESTAT EN DIRECTE A TOTS ELS ADMINS CONNECTATS

//=====================
//IMPORTEM
//=====================
import { llistaAdmins } from "./adminAuth.js";
import { estatDirecte } from "./adminState.js";
import { safeSend } from "../utils/safeSend.js";

//=====================
//ENVIAMENT
//=====================
export function enviaAdminLive() {
  //UN ERROR D'ENVIAMENT NO POT TRENCAR MAI EL JOC
  try {
    const admins = llistaAdmins();

    //SENSE ADMINS CONNECTATS NO CAL FER RES
    if (admins.size === 0) {
      return;
    }

    const estat = estatDirecte();
    const missatge = JSON.stringify({
      type: "admin:live",
      jugadors: estat.jugadors,
      sales: estat.sales,
      partidesEnCurs: estat.partidesEnCurs,
    });

    for (const ws of admins) {
      safeSend(ws, missatge);
    }
  } catch (error) {
    console.error("[ADMIN] No s'ha pogut enviar l'estat en directe: " + error.message);
  }
}

//=====================
//LLISTA DE CATEGORIES EN DIRECTE (PEL DESPLEGABLE DEL FORMULARI)
//=====================
export function enviaCategories(categories) {
  try {
    const admins = llistaAdmins();

    if (admins.size === 0) {
      return;
    }

    const missatge = JSON.stringify({
      type: "admin:categories:live",
      categories: categories,
    });

    for (const ws of admins) {
      safeSend(ws, missatge);
    }
  } catch (error) {
    console.error("[ADMIN] No s'han pogut enviar les categories: " + error.message);
  }
}
