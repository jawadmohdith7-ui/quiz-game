//ARXIU QUE PROVA QUE EL FILTRE DE SALA S'APLIQUI A LES DUES CONSULTES

//=====================
//IMPORTEM
//=====================
import test from "node:test";
import assert from "node:assert/strict";
import { construirFiltreSala } from "../src/filtreSala.js";

//=====================
//CASOS
//=====================
test("sense sala no filtra", () => {
  const filtre = construirFiltreSala(null);
  assert.equal(filtre.condicioSala, "");
  assert.equal(filtre.valorsSala.length, 0);
});

test("amb sala filtra i passa el valor", () => {
  const filtre = construirFiltreSala("sala_a");
  assert.equal(filtre.condicioSala, " WHERE p.nom_sala = ?");
  assert.equal(filtre.valorsSala.length, 1);
  assert.equal(filtre.valorsSala[0], "sala_a");
});

test("una sala buida no filtra", () => {
  const filtre = construirFiltreSala("");
  assert.equal(filtre.condicioSala, "");
});
