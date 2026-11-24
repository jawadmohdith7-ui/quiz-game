//ARXIU QUE FA LES PETICIONS INTERNES DEL PANELL D'ADMINISTRACIO

//=====================
//CONFIGURACIO
//=====================
const CATALOG_URL = process.env.CATALOG_URL || "http://localhost:3001";
const AUTH_URL = process.env.AUTH_URL || "http://localhost:3011";
const STATS_URL = process.env.STATS_URL || "http://localhost:3012";

//=====================
//PETICIO INTERNA
//=====================
export async function cridaInterna(baseUrl, ruta, metode, cos, token) {
  const headers = {
    //EL SERVEI DE DESTI COMPROVA QUE LA PETICIO VE DE DINS
    "x-internal-secret": process.env.INTERNAL_SECRET || "",
    //EL TOKEN DE L'ADMIN VIATJA TAL QUAL
    Authorization: "Bearer " + token,
  };

  let body = null;

  if (cos) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(cos);
  }

  const resposta = await fetch(baseUrl + ruta, {
    method: metode,
    headers: headers,
    body: body,
  });

  const dades = await resposta.json();
  return dades;
}

//=====================
//ACCESSOS CURTS
//=====================
export function cridaCatalog(ruta, metode, cos, token) {
  return cridaInterna(CATALOG_URL, ruta, metode, cos, token);
}

export function cridaAuth(ruta, metode, cos, token) {
  return cridaInterna(AUTH_URL, ruta, metode, cos, token);
}

export function cridaStats(ruta, metode, cos, token) {
  return cridaInterna(STATS_URL, ruta, metode, cos, token);
}
