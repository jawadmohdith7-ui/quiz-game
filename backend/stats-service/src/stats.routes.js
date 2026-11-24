import express from "express";
import { verifyToken, verifyInternalService } from "./auth.middleware.js";
import {
  crearPartida,
  obtenirEstadistiquesJugador,
  obtenirRanking,
} from "./repositories/partidaRepository.js";

const router = express.Router();

// 1. Guardar partida terminada (SOLO accesible desde game-service)
router.post("/partides", verifyInternalService, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ ok: false, error: "El cos de la petició ha de ser un objecte JSON." });
    }

    const { userId, nomSala, categoria, posicio, encerts, rondes = 0 } = req.body;

    if (
      typeof userId !== "number" ||
      typeof posicio !== "number" ||
      typeof encerts !== "number" ||
      typeof rondes !== "number"
    ) {
      return res.status(400).json({ ok: false, error: "userId, posicio i encerts han de ser números." });
    }
    const uid = Number(userId);
    const pos = Number(posicio);
    const enc = Number(encerts);

    // Validación estricta de tipos y rangos
    if (!Number.isInteger(uid) || uid < 1) {
      return res.status(400).json({ ok: false, error: "userId invàlid." });
    }
    if (!Number.isInteger(pos) || pos < 1 || pos > 100) {
      return res.status(400).json({ ok: false, error: "La posició ha de ser un enter >= 1." });
    }
    if (!Number.isInteger(enc) || enc < 0 || enc > 100) {
      return res.status(400).json({ ok: false, error: "Els encerts han de ser un enter >= 0." });
    }

    if (!Number.isInteger(rondes) || rondes < 0 || rondes > 100 || encerts > rondes && rondes > 0) {
      return res.status(400).json({ ok: false, error: "rondes invàlid." });
    }

    const salaLimpia = typeof nomSala === "string" && nomSala.trim()
      ? nomSala.trim().slice(0, 100)
      : "Sala Pública";

    const catLimpia = typeof categoria === "string" && categoria.trim()
      ? categoria.trim().slice(0, 100)
      : "General";

    const novaPartida = await crearPartida({
      usuari_id: uid,
      nom_sala: salaLimpia,
      categoria: catLimpia,
      posicio: pos,
      encerts: enc,
      rondes
    });

    res.status(201).json({ ok: true, partidaId: novaPartida.id });
  } catch (err) {
    console.error("Error guardant partida:", err);
    res.status(500).json({ ok: false, error: "Error intern al guardar la partida." });
  }
});

// 2. Estadísticas de perfil del jugador (accesible desde Unity/Vue con su token)
router.get("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const { resum, catTop, historial } = await obtenirEstadistiquesJugador(userId);

    const partidesJugades = Number(resum?.partidesJugades || 0);
    const victories = Number(resum?.victories || 0);

    res.json({
      ok: true,
      perfil: {
        partidesJugades,
        victories,
        derrotes: partidesJugades - victories,
        percentatgeVictories: partidesJugades > 0 ? Math.round((victories / partidesJugades) * 1000) / 10 : 0,
        podis: Number(resum?.podis || 0),
        mitjanaEncerts: Number(resum?.mitjanaEncerts || 0),
        categoriaMesJugada: catTop ? catTop.categoria : null
      },
      historial
    });
  } catch (err) {
    console.error("Error llegint estadístiques:", err);
    res.status(500).json({ ok: false, error: "Error intern al obtenir estadístiques." });
  }
});

router.get("/ranking", async (req, res) => {
  try {
    const requestedLimit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) {
      return res.status(400).json({ ok: false, error: "limit ha de ser un enter entre 1 i 50." });
    }

    const rows = await obtenirRanking(requestedLimit);

    const ranking = rows.map((row, index) => ({
      posicioRanking: index + 1,
      userId: Number(row.userId),
      username: row.username,
      avatarColor: row.avatarColor,
      partidesJugades: Number(row.partidesJugades),
      victories: Number(row.victories),
      podis: Number(row.podis),
      encertsTotals: Number(row.encertsTotals),
    }));

    return res.json({ ok: true, ranking });
  } catch (err) {
    console.error("Error llegint ranking:", err);
    return res.status(500).json({ ok: false, error: "Error intern al obtenir el ranking." });
  }
});

export default router;