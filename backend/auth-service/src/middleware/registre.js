//ARXIU QUE ANOTA CADA RESPOSTA HTTP A LA TAULA REGISTRE

//=====================
//IMPORTEM
//=====================
import { pool } from "../pool.js";

//=====================
//MIDDLEWARE
//=====================
export function registre(servei) {
  return function registreMiddleware(req, res, next) {
    //S'ANOTA QUAN LA RESPOSTA JA HA SORTIT, MAI ABANS
    res.on("finish", function onFinish() {
      //shortcut: nomes HTTP; els errors de missatges WS del game-service no s'anoten aqui
      const sql = "INSERT INTO registre (servei, metode, ruta, estat) VALUES (?, ?, ?, ?)";

      pool
        .query(sql, [servei, req.method, req.path, res.statusCode])
        .catch(function onError(error) {
          console.error("[REGISTRE] " + error.message);
        });
    });

    next();
  };
}
