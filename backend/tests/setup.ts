import { afterAll, beforeAll } from "vitest";
import { pool } from "../src/db.js";
import { redis, connectRedis } from "../src/redis.js";
import { runMigrations } from "../src/migrate.js";

// Avant les tests : connexion à Redis et base à jour
beforeAll(async () => {
  await connectRedis();
  await runMigrations();
});

// Après les tests : on supprime les comptes de test (tous en @test.local)
// puis on ferme proprement les connexions
afterAll(async () => {
  const { rows } = await pool.query("DELETE FROM users WHERE email LIKE '%@test.local' RETURNING slug");
  for (const { slug } of rows) await redis.del(`portfolio:${slug}`);
  await redis.quit();
  await pool.end();
});
