import { sequelize } from "../db/sequelize.js";
import { importQuestions } from "../questions/importQuestions.js";

try {
  const result = await importQuestions(process.argv[2]);

  console.log(
    `Importades: ${result.imported} | Actualitzades: ${result.updated} | Saltades: ${result.skipped} | Rebutjades: ${result.rejected.length}`
  );

  for (const rebuig of result.rejected) {
    console.log("");
    console.log(`[${rebuig.categoria}] ${rebuig.pregunta}`);
    for (const missatge of rebuig.errors) {
      console.log("  - " + missatge);
    }
  }
} catch (error) {
  console.error(`Error d'importació: ${error.message}`);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
