import { Router } from "express";
import { pool } from "../db.js";
import { redis } from "../redis.js";
import { recordCvDownload, recordVisit } from "../visitStats.js";
import { sendImage } from "../imageUtils.js";

export const publicRouter = Router();

const CACHE_TTL_SECONDS = 60 * 5;

// GET /api/public/:slug/cv : un visiteur télécharge le CV de l'étudiant
// (seulement si le portfolio est public ET si l'étudiant a autorisé le téléchargement)
// Déclarée avant "/:slug" pour être lue en premier.
publicRouter.get("/:slug/cv", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT cv.file_name, cv.data
       FROM cv_files cv JOIN users u ON u.id = cv.user_id
      WHERE u.slug = $1 AND u.is_public = TRUE AND cv.is_public = TRUE`,
    [req.params.slug]
  );
  if (rows.length === 0) return res.status(404).json({ error: "CV non disponible." });
  recordCvDownload(req, req.params.slug).catch(console.error); // statistiques (sans faire attendre le visiteur)

  res.setHeader("Content-Type", "application/pdf");
  // encodeURIComponent : les accents du nom de fichier passent sans problème
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(rows[0].file_name)}`);
  res.send(rows[0].data);
});

// GET /api/public/:slug/photo et /api/public/:slug/projects/:id/image : images du portfolio public
// (l'adresse contient ?v=<version>, donc le navigateur peut les garder en cache 1 jour)
publicRouter.get("/:slug/photo", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.mime, i.data FROM images i JOIN users u ON u.id = i.user_id
      WHERE u.slug = $1 AND u.is_public = TRUE AND i.kind = 'photo'`,
    [req.params.slug]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Aucune photo." });
  sendImage(res, rows[0], 86400);
});

publicRouter.get("/:slug/projects/:id/image", async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(400).json({ error: "Identifiant invalide." });
  const { rows } = await pool.query(
    `SELECT i.mime, i.data FROM images i JOIN users u ON u.id = i.user_id
      WHERE u.slug = $1 AND u.is_public = TRUE AND i.kind = 'project' AND i.project_id = $2`,
    [req.params.slug, Number(req.params.id)]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Aucune image." });
  sendImage(res, rows[0], 86400);
});

// Portfolio public complet : profil + expériences + formations + compétences + projets.
// Pattern "cache-aside" : on regarde d'abord dans Redis, sinon on lit PostgreSQL
// puis on garde le résultat dans Redis pendant 5 minutes.
publicRouter.get("/:slug", async (req, res) => {
  const { slug } = req.params;
  const cacheKey = `portfolio:${slug}`;

  // 1. Le portfolio est-il déjà dans le cache Redis ?
  const cached = await redis.get(cacheKey);
  if (cached) {
    recordVisit(req, slug).catch(console.error); // statistiques (sans faire attendre le visiteur)
    return res.json({ source: "cache", ...JSON.parse(cached) });
  }

  // 2. Sinon, on cherche l'utilisateur et son profil dans PostgreSQL
  const userResult = await pool.query(
    `SELECT u.id, u.slug, u.email, p.full_name, p.headline, p.bio, p.city,
            p.linkedin_url, p.github_url, p.website_url, p.photo_url,
            COALESCE(cv.is_public, FALSE) AS cv_available,
            extract(epoch FROM ph.updated_at)::bigint AS photo_version
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN cv_files cv ON cv.user_id = u.id
       LEFT JOIN images ph ON ph.user_id = u.id AND ph.kind = 'photo'
      WHERE u.slug = $1 AND u.is_public = TRUE`,
    [slug]
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: "Portfolio introuvable" });
  }

  // On sépare l'id (usage interne) du reste du profil (affiché publiquement)
  const { id: userId, photo_version, ...profile } = userResult.rows[0];

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
      `SELECT p.id, p.title, p.description, p.technologies, p.repo_url, p.demo_url, p.image_url,
              extract(epoch FROM i.updated_at)::bigint AS image_version
         FROM projects p
         LEFT JOIN images i ON i.project_id = p.id AND i.kind = 'project'
        WHERE p.user_id = $1 ORDER BY p.sort_order`,
      [userId]
    ),
  ]);

  // Adresses des images téléversées (null s'il n'y en a pas). La version (?v=) change
  // à chaque nouvelle image : le navigateur ne réaffiche jamais une ancienne image.
  const photo_path = photo_version ? `/api/public/${slug}/photo?v=${photo_version}` : null;
  const projectRows = projects.rows.map(({ image_version, ...project }) => ({
    ...project,
    image_path: image_version ? `/api/public/${slug}/projects/${project.id}/image?v=${image_version}` : null,
  }));

  const portfolio = {
    ...profile,
    photo_path,
    experiences: experiences.rows,
    education: education.rows,
    skills: skills.rows,
    projects: projectRows,
  };

  // 4. On garde le résultat dans Redis pour les prochaines visites
  await redis.set(cacheKey, JSON.stringify(portfolio), { EX: CACHE_TTL_SECONDS });
  recordVisit(req, slug).catch(console.error);
  res.json({ source: "db", ...portfolio });
});
