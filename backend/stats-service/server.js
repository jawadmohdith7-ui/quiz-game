//ARXIU QUE ARRENCA EL SERVEI D'ESTADÍSTIQUES

//=====================
//IMPORTEM
//=====================
import express from "express";
import cors from "cors";
import { sequelize } from "./src/db.js";
import "./src/models/Partida.js";
import statsRoutes from "./src/stats.routes.js";
import { adminRoutes } from "./src/admin/admin.routes.js";
import { registre } from "./src/middleware/registre.js";

//=====================
//CREEM L'APLICACIÓ EXPRESS
//=====================
const app = express();
const PORT = Number(process.env.PORT) || 3012;
const MAX_DB_RETRIES = 20;
const DB_RETRY_DELAY_MS = 1000;

app.use(cors());
app.use(express.json());

//=====================
//RUTES
//=====================
app.get("/health", function healthHandler(_req, res) {
  res.json({ ok: true, service: "stats-service" });
});

//ANOTEM TOTES LES RESPOSTES AL REGISTRE (NO BLOQUEJA MAI LA PETICIO)
app.use(registre("stats"));

//RUTES INTERNES DEL PANELL D'ADMINISTRACIO
app.use("/internal/admin", adminRoutes);

app.use("/stats", statsRoutes);

//=====================
//ARRENCADA: COMPROVEM LA CONNEXIÓ I ESCOLTEM
//=====================
async function start() {
  for (let attempt = 1; attempt <= MAX_DB_RETRIES; attempt += 1) {
    try {
      //NOMÉS COMPROVEM LA CONNEXIÓ: L'ESQUEMA EL CREA schema.sql
      await sequelize.authenticate();
      console.log("Connectat a MariaDB.");

      app.listen(PORT, function onListen() {
        console.log("stats-service escoltant al port " + PORT);
      });
      return;
    } catch (err) {
      if (attempt === MAX_DB_RETRIES) {
        console.error("Error arrencant stats-service:", err);
        process.exit(1);
      }

      console.warn(
        `MariaDB no disponible (intent ${attempt}/${MAX_DB_RETRIES}); reintentant...`
      );
      await new Promise((resolve) => setTimeout(resolve, DB_RETRY_DELAY_MS));
    }
  }
}

start();
