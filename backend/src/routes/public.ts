import { Router } from "express";
import { pool } from "../db.js";
import { redis } from "../redis.js";

export const publicRouter = Router();

const CACHE_TTL_SECONDS = 60 * 5;

// Exemple d'utilisation de Redis comme cache (pattern "cache-aside").
// Les étudiants doivent invalider la clé lorsque les données changent.
publicRouter.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `portfolio:${slug}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return res.json({ source: "cache", ...JSON.parse(cached) });
  }

  const { rows } = await pool.query(
    `SELECT u.slug, p.full_name, p.headline, p.bio
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.slug = $1 AND u.is_public = TRUE`,
    [slug]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "Portfolio introuvable" });
  }

  await redis.set(cacheKey, JSON.stringify(rows[0]), { EX: CACHE_TTL_SECONDS });
  res.json({ source: "db", ...rows[0] });
});
