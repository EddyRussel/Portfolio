import { Router } from "express";
import { pool } from "../db.js";
import { redis } from "../redis.js";

export const publicRouter = Router();

const CACHE_TTL_SECONDS = 60 * 5;

// Portfolio public complet : profil + expériences + formations + compétences + projets.
// Pattern "cache-aside" : on regarde d'abord dans Redis, sinon on lit PostgreSQL
// puis on garde le résultat dans Redis pendant 5 minutes.
publicRouter.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `portfolio:${slug}`;

  // 1. Le portfolio est-il déjà dans le cache Redis ?
  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({ source: "cache", ...JSON.parse(cached) });
  }

  // 2. Sinon, on cherche l'utilisateur et son profil dans PostgreSQL
  const userResult = await pool.query(
      `SELECT u.id, u.slug, p.full_name, p.headline, p.bio, p.city,
            p.linkedin_url, p.github_url, p.website_url, p.photo_url
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.slug = $1 AND u.is_public = TRUE`,
      [slug]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: "Portfolio introuvable" });
  }

  // On sépare l'id (usage interne) du reste du profil (affiché publiquement)
  const { id: userId, ...profile } = userResult.rows[0];

  // 3. On récupère les 4 sections en parallèle (Promise.all = en même temps)
  const [experiences, education, skills, projects] = await Promise.all([
    pool.query(
        `SELECT id, position, company,
              to_char(start_date, 'YYYY-MM') AS start_date,
              to_char(end_date, 'YYYY-MM') AS end_date,
              description
         FROM experiences WHERE user_id = $1 ORDER BY sort_order`,
        [userId]
    ),
    pool.query(
        `SELECT id, degree, school,
              to_char(start_date, 'YYYY-MM') AS start_date,
              to_char(end_date, 'YYYY-MM') AS end_date,
              description
         FROM education WHERE user_id = $1 ORDER BY sort_order`,
        [userId]
    ),
    pool.query(
        `SELECT id, name, category, level
         FROM skills WHERE user_id = $1 ORDER BY sort_order`,
        [userId]
    ),
    pool.query(
        `SELECT id, title, description, technologies, repo_url, demo_url, image_url
         FROM projects WHERE user_id = $1 ORDER BY sort_order`,
        [userId]
    ),
  ]);

  const portfolio = {
    ...profile,
    experiences: experiences.rows,
    education: education.rows,
    skills: skills.rows,
    projects: projects.rows,
  };

  // 4. On garde le résultat dans Redis pour les prochaines visites
  await redis.set(cacheKey, JSON.stringify(portfolio), { EX: CACHE_TTL_SECONDS });
  res.json({ source: "db", ...portfolio });
});