import { pool } from "./db.js";

// ---------------------------------------------------------------------------
// Petites "migrations" : modifications de la base appliquées au démarrage de l'API.
// init.sql ne s'exécute qu'à la toute première création de la base ;
// ces requêtes, elles, s'exécutent à chaque démarrage. Elles doivent donc pouvoir
// être relancées sans rien casser ("IF NOT EXISTS").
// ---------------------------------------------------------------------------
const MIGRATIONS = [
  // 001 : CV téléversé, téléchargeable par les visiteurs du portfolio
  `CREATE TABLE IF NOT EXISTS cv_files (
     user_id       INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     file_name     VARCHAR(200) NOT NULL,
     size_bytes    INT NOT NULL,
     data          BYTEA NOT NULL,
     is_public     BOOLEAN NOT NULL DEFAULT TRUE,
     uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  // 002 : statistiques de visites, une ligne par portfolio et par jour
  `CREATE TABLE IF NOT EXISTS visit_stats (
     user_id          INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     day              DATE NOT NULL,
     views            INT NOT NULL DEFAULT 0,
     unique_visitors  INT NOT NULL DEFAULT 0,
     cv_downloads     INT NOT NULL DEFAULT 0,
     PRIMARY KEY (user_id, day)
   )`,
];

export async function runMigrations(): Promise<void> {
  for (const sql of MIGRATIONS) await pool.query(sql);
}
