import express, { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { invalidatePortfolio } from "../cache.js";

// ---------------------------------------------------------------------------
// CV téléversé par l'étudiant, que les visiteurs peuvent télécharger.
// Le fichier est stocké dans PostgreSQL (colonne BYTEA = données binaires).
// ---------------------------------------------------------------------------
export const cvFileRouter = Router();
cvFileRouter.use(requireAuth);

const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

// GET /api/cv-file : infos sur mon CV téléversé (sans le fichier lui-même)
cvFileRouter.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    "SELECT file_name, size_bytes, is_public, uploaded_at FROM cv_files WHERE user_id = $1",
    [res.locals.userId]
  );
  res.json(rows[0] ?? null);
});

// PUT /api/cv-file : téléverser (ou remplacer) mon CV
// Le navigateur envoie le PDF "brut" dans le corps de la requête (Content-Type: application/pdf)
// et le nom du fichier dans l'en-tête X-File-Name.
cvFileRouter.put(
  "/",
  express.raw({ type: "application/pdf", limit: MAX_SIZE }), // lit le corps comme un Buffer (max 5 Mo)
  async (req, res) => {
    const file = req.body;
    if (!Buffer.isBuffer(file) || file.length === 0) {
      return res.status(400).json({ error: "Envoie un fichier PDF." });
    }
    // Un vrai PDF commence toujours par "%PDF-" : on ne se fie pas seulement à l'extension
    if (file.subarray(0, 5).toString("latin1") !== "%PDF-") {
      return res.status(400).json({ error: "Ce fichier n'est pas un PDF valide." });
    }

    const rawName = decodeURIComponent(String(req.headers["x-file-name"] ?? "CV.pdf"));
    const fileName = rawName.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 150) || "CV.pdf";

    // INSERT ... ON CONFLICT : un seul CV par utilisateur, le nouveau remplace l'ancien
    const { rows } = await pool.query(
      `INSERT INTO cv_files (user_id, file_name, size_bytes, data)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET file_name = EXCLUDED.file_name, size_bytes = EXCLUDED.size_bytes,
             data = EXCLUDED.data, uploaded_at = NOW()
       RETURNING file_name, size_bytes, is_public, uploaded_at`,
      [res.locals.userId, fileName, file.length, file]
    );
    await invalidatePortfolio(res.locals.userId);
    res.json(rows[0]);
  }
);

// PATCH /api/cv-file : autoriser ou non le téléchargement par les visiteurs
cvFileRouter.patch("/", async (req, res) => {
  const parsed = z.object({ is_public: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valeur invalide." });

  const { rows } = await pool.query(
    `UPDATE cv_files SET is_public = $1 WHERE user_id = $2
     RETURNING file_name, size_bytes, is_public, uploaded_at`,
    [parsed.data.is_public, res.locals.userId]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Aucun CV téléversé." });
  await invalidatePortfolio(res.locals.userId);
  res.json(rows[0]);
});

// DELETE /api/cv-file : supprimer mon CV téléversé
cvFileRouter.delete("/", async (_req, res) => {
  await pool.query("DELETE FROM cv_files WHERE user_id = $1", [res.locals.userId]);
  await invalidatePortfolio(res.locals.userId);
  res.status(204).end();
});

// Erreur "fichier trop gros" levée par express.raw
cvFileRouter.use((err: { type?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Fichier trop volumineux (5 Mo maximum)." });
  }
  next(err);
});
