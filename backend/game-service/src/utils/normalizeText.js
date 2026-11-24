//ARXIU QUE NORMALITZA TEXT PER COMPARAR NOMS

//=====================
//FUNCIÓ PRINCIPAL: TRET ACCENTS, MAJÚSCULES I ESPAIS SOBRANTS
//=====================
export function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
