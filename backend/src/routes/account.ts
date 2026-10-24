import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../db.js";
import { redis } from "../redis.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { destroyUserSessions, SESSION_COOKIE } from "../session.js";

export const accountRouter = Router();
accountRouter.use(requireAuth);

// Vérifie le mot de passe actuel de l'utilisateur connecté
async function checkPassword(userId: number, password: string): Promise<boolean> {
  const { rows } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [userId]);
  return rows[0] ? bcrypt.compare(password, rows[0].password_hash) : false;
}

// ---------- PUT /api/account/password : changer de mot de passe (RF-03) ----------
const passwordSchema = z.object({
  current_password: z.string().min(1, "Le mot de passe actuel est obligatoire."),
  new_password: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères.").max(100),
});

accountRouter.put("/password", async (req, res) => {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { current_password, new_password } = parsed.data;
  const userId: number = res.locals.userId;

  // On redemande l'ancien mot de passe : quelqu'un qui trouverait ton ordinateur
  // déjà connecté ne pourrait pas changer ton mot de passe.
  if (!(await checkPassword(userId, current_password))) {
    return res.status(401).json({ error: "Le mot de passe actuel est incorrect." });
  }

  const hash = await bcrypt.hash(new_password, 12);
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, userId]);

  // Sécurité : on déconnecte toutes les AUTRES sessions (autres navigateurs, autres appareils)
  await destroyUserSessions(userId, req.cookies[SESSION_COOKIE]);
  res.json({ ok: true });
});

// ---------- DELETE /api/account : supprimer mon compte et mes données (RF-04) ----------
accountRouter.delete("/", async (req, res) => {
  const parsed = z.object({ password: z.string().min(1, "Le mot de passe est obligatoire.") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const userId: number = res.locals.userId;

  if (!(await checkPassword(userId, parsed.data.password))) {
    return res.status(401).json({ error: "Mot de passe incorrect." });
  }

  // 1. PostgreSQL : grâce à "ON DELETE CASCADE" (voir init.sql), supprimer l'utilisateur
  //    supprime aussi son profil, ses expériences, formations, compétences et projets.
  const { rows } = await pool.query("DELETE FROM users WHERE id = $1 RETURNING slug", [userId]);

  // 2. Redis : on efface aussi tout ce qui le concerne (cache du portfolio, CV, sessions)
  if (rows[0]) await redis.del(`portfolio:${rows[0].slug}`);
  for await (const cvKey of redis.scanIterator({ MATCH: `cv:${userId}:*` })) {
    await redis.del(cvKey);
  }
  await destroyUserSessions(userId);

  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});
