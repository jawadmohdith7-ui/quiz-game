//ARXIU QUE EXPOSA EL CRUD DE PREGUNTES I CATEGORIES PER AL PANELL D'ADMINISTRACIO

//=====================
//IMPORTEM
//=====================
import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireInternalService } from "../middleware/requireInternalService.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  listCategoriesWithQuestions,
  createCategory,
  updateCategory,
  deleteCategory,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "../questions/preguntas.repository.js";

//=====================
//ROUTER
//=====================
export const adminRoutes = express.Router();

//=====================
//TOTES LES RUTES D'ADMIN DEMANEN SECRET INTERN I ROL D'ADMIN
//=====================
adminRoutes.use(requireInternalService);
adminRoutes.use(requireAdmin);

//=====================
//PREGUNTES
//=====================

//LLISTAR
adminRoutes.get("/preguntes", asyncHandler(async function llistar(_req, res) {
  const preguntes = await listQuestions();
  res.json({ ok: true, preguntes: preguntes });
}));

//CREAR
adminRoutes.post("/preguntes", asyncHandler(async function crear(req, res) {
  const pregunta = await createQuestion(req.body);
  res.status(201).json({ ok: true, pregunta: pregunta });
}));

//EDITAR
adminRoutes.patch("/preguntes/:id", asyncHandler(async function editar(req, res) {
  const pregunta = await updateQuestion(req.params.id, req.body);
  res.json({ ok: true, pregunta: pregunta });
}));

//ESBORRAR
adminRoutes.delete("/preguntes/:id", asyncHandler(async function esborrar(req, res) {
  await deleteQuestion(req.params.id);
  res.json({ ok: true });
}));

//=====================
//CATEGORIES
//=====================

//LLISTAR
adminRoutes.get("/categories", asyncHandler(async function llistarCategories(_req, res) {
  const categories = await listCategoriesWithQuestions();
  res.json({ ok: true, categories: categories });
}));

//CREAR
adminRoutes.post("/categories", asyncHandler(async function crearCategoria(req, res) {
  const categoria = await createCategory(req.body.nom);
  res.status(201).json({ ok: true, categoria: categoria });
}));

//EDITAR
adminRoutes.patch("/categories/:id", asyncHandler(async function editarCategoria(req, res) {
  const categoria = await updateCategory(req.params.id, req.body.nom);
  res.json({ ok: true, categoria: categoria });
}));

//ESBORRAR (LA CLAU FORANA RESTRICT IMPEDEIX ESBORRAR UNA CATEGORIA AMB PREGUNTES)
adminRoutes.delete("/categories/:id", asyncHandler(async function esborrarCategoria(req, res) {
  await deleteCategory(req.params.id);
  res.json({ ok: true });
}));
