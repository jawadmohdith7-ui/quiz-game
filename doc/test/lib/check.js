// Motor mínim de checks: sense dependències, sense framework.
// Cada test crida suite({...}, fn) i dins fa servir check() / conegut().
const fs = require("fs");
const path = require("path");

// doc/test/lib -> arrel del repo
const ROOT = path.resolve(__dirname, "..", "..", "..");
const IGNORATS = new Set(["node_modules", ".git", "dist", "build", "Library", "Temp", "obj", "bin", "Logs", ".vite"]);
const EXT = /\.(js|mjs|sql|md|vue|json|yml)$/;

let oks = 0;
let avisos = 0;
let fallades = 0;

function llistar(rel = ".") {
  const out = [];
  const ple = path.join(ROOT, rel);
  if (fs.statSync(ple).isFile()) return [rel.replace(/\\/g, "/")];
  (function walk(p) {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      if (IGNORATS.has(e.name)) continue;
      const f = path.join(p, e.name);
      if (e.isDirectory()) walk(f);
      else if (EXT.test(e.name)) out.push(path.relative(ROOT, f).replace(/\\/g, "/"));
    }
  })(ple);
  return out;
}

function llegir(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function existeix(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// Cerca un patró línia a línia dins d'una carpeta o fitxer.
function on(patro, rel = "backend", opts = {}) {
  const re = typeof patro === "string" ? new RegExp(patro) : patro;
  const trobat = [];
  for (const f of llistar(rel)) {
    if (opts.include && !opts.include.test(f)) continue;
    if (opts.exclude && opts.exclude.test(f)) continue;
    llegir(f).split(/\r?\n/).forEach((text, i) => {
      if (re.test(text)) trobat.push({ fitxer: f, linia: i + 1 });
    });
  }
  return trobat;
}

function onText(patro, rel) {
  const txt = rel ? llegir(rel) : "";
  return typeof patro === "string" ? txt.includes(patro) : patro.test(txt);
}

function lista(matches, max = 4) {
  const t = matches.slice(0, max).map((m) => `${m.fitxer}:${m.linia}`).join(", ");
  return matches.length > max ? `${t} (+${matches.length - max} més)` : t;
}

function check(nom, cond, detall = "") {
  if (cond) {
    oks++;
    console.log(`  ✅ ${nom}`);
  } else {
    fallades++;
    console.log(`  ❌ ${nom}${detall ? ` — ${detall}` : ""}`);
  }
}

// Forat conegut: si falla no compta com a error, però queda clar que hi és.
function conegut(nom, cond, detall = "") {
  if (cond) {
    oks++;
    console.log(`  ✅ ${nom}`);
  } else {
    avisos++;
    console.log(`  ⚠️  ${nom}${detall ? ` — ${detall}` : ""}  (buit conegut: puja nota si s'arregla)`);
  }
}

function suite(meta, fn) {
  console.log(`\n${"=".repeat(78)}`);
  console.log(`BLOC ${meta.bloc} · ${meta.id} · ${meta.titol}`);
  console.log("=".repeat(78));
  console.log(`  QUÈ DEMANA LA RÚBRICA: ${meta.demana}`);
  console.log(`  QUÈ MOSTREM NOSALTRES: ${meta.fem}`);
  console.log("-".repeat(78));
  const t = { check, conegut, existeix, llegir, on, onText, lista, ROOT };
  try {
    fn(t);
  } catch (e) {
    fallades++;
    console.log(`  ❌ el test ha petat: ${e.message}`);
  }
}

function resum() {
  console.log(`\n${"=".repeat(78)}`);
  console.log(`RESUM: ${oks} ✔   ${avisos} ⚠️ (buits coneguts)   ${fallades} ✘`);
  console.log("=".repeat(78));
  return fallades;
}

module.exports = { suite, resum, ROOT };
