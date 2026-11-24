// Executa TOTS els tests de la rúbrica en ordre T1..T15.
//   node doc/test/run-all.js
const fs = require("fs");
const path = require("path");
const { resum } = require("./lib/check");

const fitxers = fs
  .readdirSync(__dirname)
  .filter((f) => f.endsWith(".test.js"))
  .sort((a, b) => Number(a.match(/t(\d+)/)[1]) - Number(b.match(/t(\d+)/)[1]));

for (const f of fitxers) require(path.join(__dirname, f));

process.exitCode = resum() > 0 ? 1 : 0;
