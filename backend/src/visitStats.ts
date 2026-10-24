import { createHash } from "node:crypto";
import type { Request } from "express";
import { pool } from "./db.js";
import { redis } from "./redis.js";
import { getSessionUserId, SESSION_COOKIE } from "./session.js";

// ---------------------------------------------------------------------------
// Statistiques de visites (bonus du cahier des charges) :
// - chaque visite est comptée dans REDIS (très rapide, une commande par visite) ;
// - toutes les minutes, les compteurs sont recopiés dans POSTGRESQL (persistance).
//
// Clés Redis utilisées :
//   stats:pending               hash  "slug|2026-10-23|views" -> nombre (en attente d'écriture)
//   stats:seen:<slug>:<visiteur> chaîne qui expire après 30 min (évite de compter 2 fois un rechargement)
//   stats:uv:<slug>:<jour>      HyperLogLog des visiteurs uniques du jour
// ---------------------------------------------------------------------------

const PENDING = "stats:pending";
const VISIT_WINDOW_SECONDS = 30 * 60; // une même personne qui revient avant 30 min = la même visite

// Les journées sont comptées à l'heure de Montréal (sinon, en UTC, "aujourd'hui" commencerait à 20 h)
const STATS_TIMEZONE = process.env.STATS_TIMEZONE ?? "America/Toronto";

// Date du jour au format "2026-10-23" ("en-CA" donne justement ce format)
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: STATS_TIMEZONE }).format(new Date());

// Identifiant ANONYME du visiteur : empreinte de son IP + navigateur + date.
// On ne stocke jamais l'adresse IP elle-même (respect de la vie privée),
// et l'empreinte change chaque jour : impossible de suivre quelqu'un dans le temps.
function visitorId(req: Request): string {
  return createHash("sha256")
    .update(`${req.ip}|${req.headers["user-agent"] ?? ""}|${today()}`)
    .digest("hex")
    .slice(0, 24);
}

// Le visiteur est-il le propriétaire du portfolio ? (ses propres visites ne comptent pas)
async function isOwner(req: Request, slug: string): Promise<boolean> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return false;
  const userId = await getSessionUserId(token);
  if (!userId) return false;
  const { rows } = await pool.query("SELECT 1 FROM users WHERE id = $1 AND slug = $2", [userId, slug]);
  return rows.length > 0;
}

// Appelée à chaque affichage d'un portfolio public
export async function recordVisit(req: Request, slug: string): Promise<void> {
  if (await isOwner(req, slug)) return;
  const visitor = visitorId(req);
  const day = today();

  // Visiteur unique du jour : un HyperLogLog compte des éléments distincts
  // en n'utilisant que ~12 Ko, même pour des millions de visiteurs
  await redis.pfAdd(`stats:uv:${slug}:${day}`, visitor);
  await redis.expire(`stats:uv:${slug}:${day}`, 60 * 60 * 48);

  // SET ... NX : ne réussit que si la clé n'existe pas encore -> première vue depuis 30 min
  const isNewVisit = await redis.set(`stats:seen:${slug}:${visitor}`, "1", { NX: true, EX: VISIT_WINDOW_SECONDS });
  if (isNewVisit) await redis.hIncrBy(PENDING, `${slug}|${day}|views`, 1);
  else await redis.hIncrBy(PENDING, `${slug}|${day}|touch`, 0); // garde la trace du jour pour les visiteurs uniques
}

// Appelée à chaque téléchargement du CV par un visiteur
export async function recordCvDownload(req: Request, slug: string): Promise<void> {
  if (await isOwner(req, slug)) return;
  await redis.hIncrBy(PENDING, `${slug}|${today()}|downloads`, 1);
}

// Efface les traces Redis des statistiques d'un portfolio (suppression du compte).
// Sans ça, un nouveau compte qui obtiendrait la même adresse (slug) hériterait de ces traces.
export async function purgeStats(slug: string): Promise<void> {
  for (const pattern of [`stats:seen:${slug}:*`, `stats:uv:${slug}:*`]) {
    for await (const key of redis.scanIterator({ MATCH: pattern })) await redis.del(key);
  }
  const pending = await redis.hKeys(PENDING);
  const fields = pending.filter((field) => field.startsWith(`${slug}|`));
  if (fields.length > 0) await redis.hDel(PENDING, fields);
}

// ---------- Recopie Redis -> PostgreSQL ----------
export async function flushStats(): Promise<void> {
  // RENAME est atomique : les visites qui arrivent pendant la recopie
  // vont dans un NOUVEAU "stats:pending" et ne sont donc jamais perdues.
  const batchKey = `stats:flushing:${Date.now()}`;
  try {
    await redis.rename(PENDING, batchKey);
  } catch {
    return; // pas de clé "stats:pending" = aucune visite depuis la dernière recopie
  }

  const entries = await redis.hGetAll(batchKey);
  // Regroupe par (slug, jour) : { "eddy|2026-10-23": { views: 3, downloads: 1 } }
  const groups = new Map<string, { views: number; downloads: number }>();
  for (const [field, value] of Object.entries(entries)) {
    const [slug, day, kind] = field.split("|");
    const group = groups.get(`${slug}|${day}`) ?? { views: 0, downloads: 0 };
    if (kind === "views") group.views += Number(value);
    if (kind === "downloads") group.downloads += Number(value);
    groups.set(`${slug}|${day}`, group);
  }

  for (const [key, { views, downloads }] of groups) {
    const [slug, day] = key.split("|");
    const uniqueVisitors = await redis.pfCount(`stats:uv:${slug}:${day}`);
    await pool.query(
      `INSERT INTO visit_stats (user_id, day, views, unique_visitors, cv_downloads)
       SELECT id, $2, $3, $4, $5 FROM users WHERE slug = $1
       ON CONFLICT (user_id, day) DO UPDATE SET
         views = visit_stats.views + EXCLUDED.views,
         unique_visitors = GREATEST(visit_stats.unique_visitors, EXCLUDED.unique_visitors),
         cv_downloads = visit_stats.cv_downloads + EXCLUDED.cv_downloads`,
      [slug, day, views, uniqueVisitors, downloads]
    );
  }
  await redis.del(batchKey);
}

// Lance la recopie toutes les minutes ("persistance périodique")
export function startStatsFlusher(): void {
  setInterval(() => {
    flushStats().catch((err) => console.error("Recopie des statistiques échouée :", err));
  }, 60 * 1000);
}
