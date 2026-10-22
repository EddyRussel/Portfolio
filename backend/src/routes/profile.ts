import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { invalidatePortfolio } from "../cache.js";
import { optionalText, optionalUrl } from "../validation.js";

export const profileRouter = Router();
profileRouter.use(requireAuth); // toutes les routes de ce fichier sont protégées

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(150),
  headline: optionalText(200),
  bio: optionalText(3000),
  phone: optionalText(30),
  city: optionalText(100),
  linkedin_url: optionalUrl,
  github_url: optionalUrl,
  website_url: optionalUrl,
  photo_url: optionalUrl,
});

// GET /api/profile : mon profil complet (y compris le téléphone, qui n'est pas public)
profileRouter.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.email, u.slug, u.is_public,
            p.full_name, p.headline, p.bio, p.phone, p.city,
            p.linkedin_url, p.github_url, p.website_url, p.photo_url
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
    [res.locals.userId]
  );
  res.json(rows[0]);
});

// PUT /api/profile : modifier mon profil
profileRouter.put("/", async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const p = parsed.data;

  // INSERT ... ON CONFLICT : crée le profil s'il n'existe pas encore, sinon le met à jour
  await pool.query(
    `INSERT INTO profiles (user_id, full_name, headline, bio, phone, city, linkedin_url, github_url, website_url, photo_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (user_id) DO UPDATE SET
       full_name = EXCLUDED.full_name, headline = EXCLUDED.headline, bio = EXCLUDED.bio,
       phone = EXCLUDED.phone, city = EXCLUDED.city, linkedin_url = EXCLUDED.linkedin_url,
       github_url = EXCLUDED.github_url, website_url = EXCLUDED.website_url, photo_url = EXCLUDED.photo_url`,
    [
      res.locals.userId, p.full_name, p.headline ?? null, p.bio ?? null, p.phone ?? null, p.city ?? null,
      p.linkedin_url ?? null, p.github_url ?? null, p.website_url ?? null, p.photo_url ?? null,
    ]
  );
  await invalidatePortfolio(res.locals.userId);
  res.json({ ok: true });
});

// PATCH /api/profile/visibility : rendre mon portfolio public ou privé (RF-11)
profileRouter.patch("/visibility", async (req, res) => {
  const parsed = z.object({ is_public: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valeur invalide." });

  await pool.query("UPDATE users SET is_public = $1 WHERE id = $2", [parsed.data.is_public, res.locals.userId]);
  await invalidatePortfolio(res.locals.userId);
  res.json({ is_public: parsed.data.is_public });
});
