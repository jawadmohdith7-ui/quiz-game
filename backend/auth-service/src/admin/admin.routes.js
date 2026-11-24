//ARXIU QUE EXPOSA EL CRUD D'USUARIS PER AL PANELL D'ADMINISTRACIO

//=====================
//IMPORTEM
//=====================
import express from "express";
import { requireInternalService } from "../middleware/requireInternalService.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  registerUser,
  listUsers,
  updateUserByAdmin,
  deleteUserByAdmin,
} from "../authService.js";

//=====================
//ROUTER
//=====================
export const adminRoutes = express.Router();

//TOTES LES RUTES D'ADMIN VOLEN SECRET INTERN I ROL ADMIN
adminRoutes.use(requireInternalService);
adminRoutes.use(requireAdmin);

//LLISTAR
adminRoutes.get("/usuaris", async function llistar(_req, res) {
  try {
    const usuaris = await listUsers();
    res.json({ ok: true, usuaris: usuaris });
  } catch (error) {
    res.status(500).json({ ok: false, reason: error.message });
  }
});

//CREAR (PASSA PEL MATEIX REGISTRE I PER TANT PEL CORREU DE VERIFICACIO)
adminRoutes.post("/usuaris", async function crear(req, res) {
  try {
    const resultat = await registerUser({
      username: req.body.nom,
      email: req.body.email,
      password: req.body.password,
    });

    res.status(201).json({ ok: true, usuari: { email: resultat.email } });
  } catch (error) {
    res.status(400).json({ ok: false, code: error.code, reason: error.message });
  }
});

//EDITAR
adminRoutes.patch("/usuaris/:id", async function editar(req, res) {
  try {
    const usuari = await updateUserByAdmin(req.params.id, req.body);
    res.json({ ok: true, usuari: usuari });
  } catch (error) {
    res.status(400).json({ ok: false, code: error.code, reason: error.message });
  }
});

//ESBORRAR
adminRoutes.delete("/usuaris/:id", async function esborrar(req, res) {
  try {
    await deleteUserByAdmin(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ ok: false, code: error.code, reason: error.message });
  }
});
