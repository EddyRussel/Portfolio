import { Router, type NextFunction, type Request, type Response } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { invalidatePortfolio } from "../cache.js";
import { detectImageType, readImageBody, sendImage } from "../imageUtils.js";

// ---------------------------------------------------------------------------
// Images du tableau de bord : photo de profil et capture d'écran de chaque projet.
// Stockées dans PostgreSQL (colonne BYTEA), comme le CV.
// ---------------------------------------------------------------------------
export const imagesRouter = Router();
imagesRouter.use(requireAuth);

imagesRouter.param("id", (_req, res, next, value) => {
  if (!/^\d+$/.test(value)) return res.status(400).json({ error: "Identifiant invalide." });
  next();
});

// Vérifie le fichier reçu ; renvoie son type, ou répond 400 et renvoie null
function checkImage(req: Request, res: Response): string | null {
  const file = req.body;
  const mime = Buffer.isBuffer(file) ? detectImageType(file) : null;
  if (!mime) {
    res.status(400).json({ error: "Envoie une image JPEG, PNG ou WebP." });
    return null;
  }
  return mime;
}

// GET /api/images : quelles images existent ? (avec leur version, pour l'aperçu)
imagesRouter.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT kind, project_id, extract(epoch FROM updated_at)::bigint AS version
       FROM images WHERE user_id = $1`,
    [res.locals.userId]
  );
  const photo = rows.find((r) => r.kind === "photo");
  const projects: Record<number, number> = {};
  for (const r of rows) if (r.kind === "project") projects[r.project_id] = Number(r.version);
  res.json({ photo: photo ? Number(photo.version) : null, projects });
});

// ---------- Photo de profil ----------
imagesRouter.get("/photo", async (_req, res) => {
  const { rows } = await pool.query("SELECT mime, data FROM images WHERE user_id = $1 AND kind = 'photo'", [
    res.locals.userId,
  ]);
  if (rows.length === 0) return res.status(404).json({ error: "Aucune photo." });
  sendImage(res, rows[0], 0);
});

imagesRouter.put("/photo", readImageBody, async (req, res) => {
  const mime = checkImage(req, res);
  if (!mime) return;
  await pool.query(
    `INSERT INTO images (user_id, kind, mime, size_bytes, data) VALUES ($1, 'photo', $2, $3, $4)
     ON CONFLICT (user_id) WHERE kind = 'photo'
     DO UPDATE SET mime = EXCLUDED.mime, size_bytes = EXCLUDED.size_bytes, data = EXCLUDED.data, updated_at = NOW()`,
    [res.locals.userId, mime, req.body.length, req.body]
  );
  await invalidatePortfolio(res.locals.userId);
  res.json({ ok: true });
});

imagesRouter.delete("/photo", async (_req, res) => {
  await pool.query("DELETE FROM images WHERE user_id = $1 AND kind = 'photo'", [res.locals.userId]);
  await invalidatePortfolio(res.locals.userId);
  res.status(204).end();
});

// ---------- Capture d'écran d'un projet ----------
imagesRouter.get("/projects/:id", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT mime, data FROM images WHERE user_id = $1 AND project_id = $2 AND kind = 'project'",
    [res.locals.userId, Number(req.params.id)]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Aucune image." });
  sendImage(res, rows[0], 0);
});

imagesRouter.put("/projects/:id", readImageBody, async (req, res) => {
  const mime = checkImage(req, res);
  if (!mime) return;
  const projectId = Number(req.params.id);

  // Le projet doit appartenir à l'utilisateur connecté
  const owned = await pool.query("SELECT 1 FROM projects WHERE id = $1 AND user_id = $2", [
    projectId,
    res.locals.userId,
  ]);
  if (!owned.rowCount) return res.status(404).json({ error: "Projet introuvable." });

  await pool.query(
    `INSERT INTO images (user_id, project_id, kind, mime, size_bytes, data) VALUES ($1, $2, 'project', $3, $4, $5)
     ON CONFLICT (project_id) WHERE kind = 'project'
     DO UPDATE SET mime = EXCLUDED.mime, size_bytes = EXCLUDED.size_bytes, data = EXCLUDED.data, updated_at = NOW()`,
    [res.locals.userId, projectId, mime, req.body.length, req.body]
  );
  await invalidatePortfolio(res.locals.userId);
  res.json({ ok: true });
});

imagesRouter.delete("/projects/:id", async (req, res) => {
  await pool.query("DELETE FROM images WHERE user_id = $1 AND project_id = $2 AND kind = 'project'", [
    res.locals.userId,
    Number(req.params.id),
  ]);
  await invalidatePortfolio(res.locals.userId);
  res.status(204).end();
});

// Erreur "fichier trop gros" levée par express.raw
imagesRouter.use((err: { type?: string }, _req: Request, res: Response, next: NextFunction) => {
  if (err?.type === "entity.too.large")
    return res.status(413).json({ error: "Image trop volumineuse (3 Mo maximum)." });
  next(err);
});
