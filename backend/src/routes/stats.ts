import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { flushStats, today } from "../visitStats.js";

export const statsRouter = Router();
statsRouter.use(requireAuth);

// GET /api/stats : mes statistiques des 30 derniers jours (un point par jour, même vide)
statsRouter.get("/", async (_req, res) => {
  await flushStats(); // on recopie d'abord les compteurs Redis : les chiffres sont à jour

  // generate_series fabrique la liste des 30 jours ; LEFT JOIN met 0 les jours sans visite
  const { rows } = await pool.query(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
            COALESCE(s.views, 0) AS views,
            COALESCE(s.unique_visitors, 0) AS unique_visitors,
            COALESCE(s.cv_downloads, 0) AS cv_downloads
       FROM generate_series($2::date - 29, $2::date, interval '1 day') AS d(day)
       LEFT JOIN visit_stats s ON s.day = d.day AND s.user_id = $1
      ORDER BY d.day`,
    [res.locals.userId, today()],
  );

  const sum = (key: "views" | "unique_visitors" | "cv_downloads") =>
    rows.reduce((total, row) => total + Number(row[key]), 0);

  res.json({
    days: rows,
    totals: {
      views: sum("views"),
      unique_visitors: sum("unique_visitors"),
      cv_downloads: sum("cv_downloads"),
    },
  });
});
