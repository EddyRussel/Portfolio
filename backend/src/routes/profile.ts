import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { invalidatePortfolio } from "../cache.js";
import { optionalText, optionalUrl, textList } from "../validation.js";

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
  tagline: optionalText(200), // l'accroche sous le nom
  looking_for: optionalText(200), // "Je cherche"
  interests: textList(10, 40), // "En dehors du code" : Foot, Musique...
  // Mes qualités : [{ title: "Curieux", text: "J'apprends vite..." }]
  qualities: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Chaque qualité a besoin d'un titre.").max(60),
        text: z.string().trim().max(300).default(""),
      })
    )
    .max(6, "6 qualités au maximum.")
    .default([]),
});

// GET /api/profile : mon profil complet (y compris le téléphone, qui n'est pas public)
profileRouter.get("/", async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.email, u.slug, u.is_public,
            p.full_name, p.headline, p.bio, p.phone, p.city,
            p.linkedin_url, p.github_url, p.website_url, p.photo_url,
            p.tagline, p.looking_for, p.interests, p.qualities
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
    `INSERT INTO profiles (user_id, full_name, headline, bio, phone, city, linkedin_url, github_url, website_url, photo_url,
                           tagline, looking_for, interests, qualities)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET
       full_name = EXCLUDED.full_name, headline = EXCLUDED.headline, bio = EXCLUDED.bio,
       phone = EXCLUDED.phone, city = EXCLUDED.city, linkedin_url = EXCLUDED.linkedin_url,
       github_url = EXCLUDED.github_url, website_url = EXCLUDED.website_url, photo_url = EXCLUDED.photo_url,
       tagline = EXCLUDED.tagline, looking_for = EXCLUDED.looking_for,
       interests = EXCLUDED.interests, qualities = EXCLUDED.qualities`,
    [
      res.locals.userId,
      p.full_name,
      p.headline ?? null,
      p.bio ?? null,
      p.phone ?? null,
      p.city ?? null,
      p.linkedin_url ?? null,
      p.github_url ?? null,
      p.website_url ?? null,
      p.photo_url ?? null,
      p.tagline ?? null,
      p.looking_for ?? null,
      p.interests,
      JSON.stringify(p.qualities), // JSONB : on envoie le texte JSON
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
