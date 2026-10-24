import { pool } from "./db.js";
import { redis } from "./redis.js";

// Invalidation du cache (RF-13) : dès que l'utilisateur modifie son contenu,
// on supprime la copie de son portfolio gardée dans Redis.
// La prochaine visite relira PostgreSQL et remettra une copie à jour dans le cache.
export async function invalidatePortfolio(userId: number): Promise<void> {
  const { rows } = await pool.query("SELECT slug FROM users WHERE id = $1", [
    userId,
  ]);
  if (rows[0]) await redis.del(`portfolio:${rows[0].slug}`);
}
