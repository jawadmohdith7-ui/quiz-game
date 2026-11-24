//ARXIU QUE AGRUPA TOTES LES PETICIONS DEL PANELL D'ADMINISTRACIO

//=====================
//IMPORTEM
//=====================
import { sendAdminRequest } from "./websocket.js";

//=====================
//AUTENTICACIO
//=====================
export function adminAuth() {
  return sendAdminRequest("admin:auth", {
    token: localStorage.getItem("authToken") || "",
  });
}

//=====================
//DIRECTE
//=====================
export function adminLiveGet() {
  return sendAdminRequest("admin:live:get", {});
}

//=====================
//PREGUNTES
//=====================
export function adminPreguntesList() {
  return sendAdminRequest("admin:preguntes:list", {});
}

export function adminPreguntesCreate(dades) {
  return sendAdminRequest("admin:preguntes:create", { dades: dades });
}

export function adminPreguntesUpdate(id, dades) {
  return sendAdminRequest("admin:preguntes:update", { id: id, dades: dades });
}

export function adminPreguntesDelete(id) {
  return sendAdminRequest("admin:preguntes:delete", { id: id });
}

//=====================
//CATEGORIES
//=====================
export function adminCategoriesList() {
  return sendAdminRequest("admin:categories:list", {});
}

export function adminCategoriesCreate(dades) {
  return sendAdminRequest("admin:categories:create", { dades: dades });
}

export function adminCategoriesUpdate(id, dades) {
  return sendAdminRequest("admin:categories:update", { id: id, dades: dades });
}

export function adminCategoriesDelete(id) {
  return sendAdminRequest("admin:categories:delete", { id: id });
}

//=====================
//USUARIS
//=====================
export function adminUsuarisList() {
  return sendAdminRequest("admin:usuaris:list", {});
}

export function adminUsuarisCreate(dades) {
  return sendAdminRequest("admin:usuaris:create", { dades: dades });
}

export function adminUsuarisUpdate(id, dades) {
  return sendAdminRequest("admin:usuaris:update", { id: id, dades: dades });
}

export function adminUsuarisDelete(id) {
  return sendAdminRequest("admin:usuaris:delete", { id: id });
}

//=====================
//ESTADISTIQUES
//=====================
export function adminEstadistiquesGet(sala) {
  return sendAdminRequest("admin:estadistiques:get", { sala: sala });
}

export function adminRegistreGet(periode) {
  return sendAdminRequest("admin:registre:get", { periode: periode });
}

export function adminUsageGet(periode) {
  return sendAdminRequest("admin:usage:get", { periode: periode });
}
