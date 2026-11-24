//ARXIU QUE CONFIGURA L'APLICACIÓ EXPRESS DEL CATALOG-SERVICE

//=====================
//IMPORTEM
//=====================
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { preguntasRoutes } from "./questions/preguntas.routes.js";
import { requireInternalService } from "./middleware/requireInternalService.js";
import { adminRoutes } from "./admin/admin.routes.js";
import { registre } from "./middleware/registre.js";

//=====================
//CREEM LA INSTÀNCIA EXPRESS I MIDDLEWARE BASE
//=====================
export const app = express();

app.use((req, res, next) => {
	const origin = req.headers.origin;
	const allowedOrigins = new Set([
		"http://localhost:5173",
		"http://localhost:5174",
	]);

	if (allowedOrigins.has(origin)) {
		res.header("Access-Control-Allow-Origin", origin);
	}

	res.header("Vary", "Origin");
	res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
	res.header("Access-Control-Allow-Headers", "Content-Type");

	if (req.method === "OPTIONS") {
		res.status(204).end();
		return;
	}

	next();
});

app.use(express.json());

//ANOTEM TOTES LES RESPOSTES AL REGISTRE (NO BLOQUEJA MAI LA PETICIO)
app.use(registre("catalog"));

//=====================
//MUNTEM LES RUTES (TOTES LES /internal EXIGEIXEN EL SECRET DE SERVEI)
//=====================
//LES RUTES D'ADMIN VAN PRIMER: /internal TAMBE ENCAIXA AMB /internal/admin
app.use("/internal/admin", adminRoutes);
app.use("/internal", requireInternalService, preguntasRoutes);

//=====================
//MIDDLEWARE DE GESTIÓ D'ERRORS GLOBAL
//=====================
app.use(errorHandler);
