import { pool } from "../db/pool.js";
import { exportGameCsv } from "../game/files/exportGameCsv.js";

try {
  process.stdout.write(await exportGameCsv(process.argv[2]));
} catch (error) {
  console.error(`Error d'exportació: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
