//ARXIU QUE DEFINEIX LES RUTES DE L'API DE PREGUNTES

//=====================
//IMPORTEM
//=====================
import express from "express";
import {
  getCatalogOptionsController,
  getPreguntasController,
} from "./preguntas.controller.js";
import { validateGetPreguntas } from "./preguntas.validator.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

//=====================
//CREEM EL ROUTER
//=====================
export const preguntasRoutes = express.Router();

//=====================
//DECLAREM LA RUTA GET /internal/catalog/options
//=====================
//RETORNA LES CATEGORIES I LES DIFICULTATS DISPONIBLES DEL CATALEG
preguntasRoutes.get(
  "/catalog/options",
  asyncHandler(getCatalogOptionsController)
);

//=====================
//DECLAREM LA RUTA POST /internal/preguntas/get
//=====================
// validateGetPreguntas VALIDA EL BODY
// asyncHandler CAPTURA ELS ERRORS I ELS PASSA A ERRORHANDLER
preguntasRoutes.post(
  "/preguntas/get",
  validateGetPreguntas,
  asyncHandler(getPreguntasController)
);
