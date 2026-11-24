//ARXIU QUE CONFIGURA LA CONNEXIÓ A LA BASE DE DADES MYSQL
//=====================
//IMPORTEM
//=====================
import mysql from "mysql2/promise";

//=====================
//CONFIGURACIÓ DE LA CONNEXIÓ
//=====================
let host = process.env.DB_HOST;
if (host === undefined) {
  host = "localhost";
}

let port = Number(process.env.DB_PORT);
let portInvalid = false;
if (port === 0) {
  portInvalid = true;
}
if (Number.isNaN(port)) {
  portInvalid = true;
}
if (portInvalid === true) {
  port = 3306;
}

let user = process.env.DB_USER;
if (user === undefined) {
  user = "root";
}

let password = process.env.DB_PASSWORD;
if (password === undefined) {
  password = "root";
}

let database = process.env.DB_NAME;
if (database === undefined) {
  database = "howmuch";
}

export const pool = mysql.createPool({
  host: host,
  port: port,
  user: user,
  password: password,
  database: database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});
