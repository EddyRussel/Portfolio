import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
// Avec Express 4, une erreur dans une route "async" n'est pas rattrapée et fait planter
// tout le serveur. Cette ligne corrige ça : l'erreur est envoyée au gestionnaire d'erreurs plus bas.
import "express-async-errors";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { healthRouter } from "./routes/health.js";
import { publicRouter } from "./routes/public.js";
import { cvRouter } from "./routes/cv.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { accountRouter } from "./routes/account.js";
import { cvFileRouter } from "./routes/cvFile.js";
import { statsRouter } from "./routes/stats.js";
import {
  experiencesRouter,
  educationRouter,
  skillsRouter,
  projectsRouter,
} from "./routes/content.js";

// ---------------------------------------------------------------------------
// L'application Express (routes, sécurité...), SANS la démarrer.
// index.ts la démarre pour de vrai ; les tests l'utilisent directement avec Supertest.
// ---------------------------------------------------------------------------
export const app = express();

app.use(helmet());
// credentials: true = le navigateur a le droit d'envoyer le cookie de session à l'API
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser()); // lit les cookies et les range dans req.cookies

app.use("/api/health", healthRouter);
app.use("/api/public", publicRouter);
app.use("/api/cv", cvRouter);
app.use("/api/auth", authRouter);

// Espace privé : gestion du contenu (toutes ces routes exigent d'être connecté)
app.use("/api/profile", profileRouter);
app.use("/api/account", accountRouter);
app.use("/api/cv-file", cvFileRouter);
app.use("/api/stats", statsRouter);
app.use("/api/experiences", experiencesRouter);
app.use("/api/education", educationRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/projects", projectsRouter);

// Gestionnaire d'erreurs (toujours en dernier) : une erreur imprévue dans une route
// renvoie une réponse 500 propre au lieu d'arrêter l'API.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});
