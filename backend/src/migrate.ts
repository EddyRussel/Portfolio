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
  // 003 : images téléversées (photo de profil, captures d'écran des projets)
  `CREATE TABLE IF NOT EXISTS images (
     id          SERIAL PRIMARY KEY,
     user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     project_id  INT REFERENCES projects(id) ON DELETE CASCADE,
     kind        VARCHAR(20) NOT NULL CHECK (kind IN ('photo', 'project')),
     mime        VARCHAR(30) NOT NULL,
     size_bytes  INT NOT NULL,
     data        BYTEA NOT NULL,
     updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  // Une seule photo par utilisateur, une seule capture par projet (index "partiels")
  `CREATE UNIQUE INDEX IF NOT EXISTS images_one_photo ON images (user_id) WHERE kind = 'photo'`,
  `CREATE UNIQUE INDEX IF NOT EXISTS images_one_per_project ON images (project_id) WHERE kind = 'project'`,
];

export async function runMigrations(): Promise<void> {
  for (const sql of MIGRATIONS) await pool.query(sql);
}
