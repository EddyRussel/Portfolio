import { app } from "./app.js";
import { connectRedis } from "./redis.js";
import { runMigrations } from "./migrate.js";
import { flushStats, startStatsFlusher } from "./visitStats.js";

// Point d'entrée : prépare Redis et la base, puis démarre le serveur HTTP.
const port = Number(process.env.PORT ?? 3000);

async function start() {
  await connectRedis();
  await runMigrations(); // met la base à jour (nouvelles tables) avant d'accepter des requêtes
  startStatsFlusher(); // recopie Redis -> PostgreSQL toutes les minutes
  app.listen(port, () => console.log(`API démarrée sur le port ${port}`));
}

// À l'arrêt (docker compose down / restart) : dernière recopie des statistiques
process.on("SIGTERM", async () => {
  await flushStats().catch(console.error);
  process.exit(0);
});

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
