import { createHash } from "node:crypto";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { pool } from "../db.js";
import { redis } from "../redis.js";
import Classic from "./templates/Classic.js";
import Modern from "./templates/Modern.js";
import type { CvData, Template } from "./types.js";

const CV_CACHE_TTL_SECONDS = 60 * 60 * 24; // un PDF reste 24 h dans le cache

// Pas de coupure des mots avec un tiret en fin de ligne
// (React-PDF utilise par défaut des règles de césure anglaises, mauvaises pour le français)
Font.registerHyphenationCallback((word) => [word]);

// ---------- 1. Lire toutes les données du CV dans PostgreSQL ----------
export async function loadCvData(userId: number): Promise<CvData | null> {
  const { rows } = await pool.query(
    `SELECT u.email, p.full_name, p.headline, p.bio, p.phone, p.city,
            p.linkedin_url, p.github_url, p.website_url
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.id = $1`,
    [userId],
  );
  if (rows.length === 0) return null;

  const month = (column: string) =>
    `to_char(${column}, 'YYYY-MM') AS ${column}`;
  const [experiences, education, skills, projects] = await Promise.all([
    pool.query(
      `SELECT id, position, company, ${month("start_date")}, ${month("end_date")}, description
         FROM experiences WHERE user_id = $1 ORDER BY sort_order, id`,
      [userId],
    ),
    pool.query(
      `SELECT id, degree, school, ${month("start_date")}, ${month("end_date")}, description
         FROM education WHERE user_id = $1 ORDER BY sort_order, id`,
      [userId],
    ),
    pool.query(
      "SELECT id, name, category, level FROM skills WHERE user_id = $1 ORDER BY sort_order, id",
      [userId],
    ),
    pool.query(
      "SELECT id, title, description, technologies FROM projects WHERE user_id = $1 ORDER BY sort_order, id",
      [userId],
    ),
  ]);

  return {
    ...rows[0],
    experiences: experiences.rows,
    education: education.rows,
    skills: skills.rows,
    projects: projects.rows,
  };
}

// ---------- 2. Garder seulement ce que l'étudiant a choisi (RF-22) ----------
export type Selection = {
  sections: {
    bio: boolean;
    experiences: boolean;
    education: boolean;
    skills: boolean;
    projects: boolean;
  };
  exclude: {
    experiences: number[];
    education: number[];
    skills: number[];
    projects: number[];
  };
};

export function applySelection(
  data: CvData,
  { sections, exclude }: Selection,
): CvData {
  const keep = <T extends { id: number }>(
    list: T[],
    show: boolean,
    excluded: number[],
  ) => (show ? list.filter((item) => !excluded.includes(item.id)) : []);

  return {
    ...data,
    bio: sections.bio ? data.bio : null,
    experiences: keep(
      data.experiences,
      sections.experiences,
      exclude.experiences,
    ),
    education: keep(data.education, sections.education, exclude.education),
    skills: keep(data.skills, sections.skills, exclude.skills),
    projects: keep(data.projects, sections.projects, exclude.projects),
  };
}

// ---------- 3. Fabriquer le PDF, avec cache Redis (RF-26) ----------
//
// La clé du cache contient une "empreinte" (hash) des données du CV :
//   cv:<id utilisateur>:<gabarit>:<empreinte>
// Si une seule lettre change dans les données, l'empreinte change, donc la clé aussi :
// l'ancien PDF n'est plus utilisé (il disparaîtra tout seul après 24 h).
export async function generateCv(
  userId: number,
  data: CvData,
  template: Template,
): Promise<{ pdf: Buffer; cached: boolean }> {
  const version = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")
    .slice(0, 16);
  const cacheKey = `cv:${userId}:${template}:${version}`;

  const cached = await redis.get(cacheKey);
  if (cached) return { pdf: Buffer.from(cached, "base64"), cached: true };

  const Component = template === "modern" ? Modern : Classic;
  // Le gabarit renvoie un <Document> React-PDF, que renderToBuffer transforme en fichier PDF
  const pdf = await renderToBuffer(Component({ data }));

  // Redis stocke du texte : on encode le PDF (binaire) en base64
  await redis.set(cacheKey, pdf.toString("base64"), {
    EX: CV_CACHE_TTL_SECONDS,
  });
  return { pdf, cached: false };
}

// "Eddy Russel Ngoue" -> "CV_Eddy_Russel_Ngoue.pdf" (RF-25)
export function cvFileName(fullName: string): string {
  const clean = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 -]/g, "")
    .trim()
    .split(/\s+/)
    .join("_");
  return `CV_${clean || "Portfolio"}.pdf`;
}
