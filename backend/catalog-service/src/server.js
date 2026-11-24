//ARXIU QUE CREA EL SERVIDOR HTTP DEL CATALOG-SERVICE

//=====================
//IMPORTEM
//=====================
import { app } from "./app.js";
import { ensureInitialCatalog } from "./questions/preguntas.repository.js";

//=====================
//CONFIGUREM EL PORT I INICIEM EL SERVIDOR
//=====================
const PORT = 3001;

async function startServer() {
  const seedResult = await ensureInitialCatalog();
  if (seedResult) {
    console.log(
      `Catàleg inicial carregat: ${seedResult.imported} preguntes importades.`
    );
  }
  app.listen(PORT, () => {
    console.log(`Catalog-service escoltant al port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("No s'ha pogut inicialitzar el catalog-service:", error);
  process.exit(1);
});