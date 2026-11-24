//ARXIU QUE REPORTA UNA PARTIDA ACABADA AL STATS-SERVICE

//=====================
//IMPORTEM
//=====================
const STATS_URL = process.env.STATS_URL || "http://stats-service:3012";
const INTERNAL_SECRET = process.env.INTERNAL_SECRET;

//=====================
//REPORTEM
//=====================
export async function reportGameStats(dades) {
  const cos = {
    userId: dades.userId,
    nomSala: dades.nomSala,
    categoria: dades.categoria,
    posicio: dades.posicio,
    encerts: dades.encerts,
    rondes: dades.rondes,
  };

  try {
    const resposta = await fetch(`${STATS_URL}/stats/partides`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": INTERNAL_SECRET,
      },
      body: JSON.stringify(cos),
    });

    //ABANS NO ES MIRAVA: UNA COLUMNA INEXISTENT DONAVA 500 I NINGÚ SE N'ENTERAVA
    if (resposta.ok === false) {
      const text = await resposta.text();
      console.error("[stats] error en reportar la partida:", resposta.status, text);
      return false;
    }

    return true;
  } catch (error) {
    console.error("[stats] no s'ha pogut contactar amb el stats-service:", error.message);
    return false;
  }
}
