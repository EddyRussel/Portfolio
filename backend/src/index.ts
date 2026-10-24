import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { connectRedis } from "./redis.js";
import { healthRouter } from "./routes/health.js";
import { publicRouter } from "./routes/public.js";
import { cvRouter } from "./routes/cv.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { accountRouter } from "./routes/account.js";
import { experiencesRouter, educationRouter, skillsRouter, projectsRouter } from "./routes/content.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(helmet());
// credentials: true = le navigateur a le droit d'envoyer le cookie de session à l'API
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser()); // lit les cookies et les range dans req.cookies

app.use("/api/health", healthRouter);
app.use("/api/public", publicRouter);
app.use("/api/cv", cvRouter);
app.use("/api/auth", authRouter);

// Espace privé : gestion du contenu (toutes ces routes exigent d'être connecté)
app.use("/api/profile", profileRouter);
app.use("/api/account", accountRouter);
app.use("/api/experiences", experiencesRouter);
app.use("/api/education", educationRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/projects", projectsRouter);

async function start() {
  await connectRedis();
  app.listen(port, () => console.log(`API démarrée sur le port ${port}`));
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
