CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id           SERIAL PRIMARY KEY,
  user_id      INT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name    VARCHAR(150) NOT NULL,
  headline     VARCHAR(200),
  bio          TEXT,
  phone        VARCHAR(30),
  city         VARCHAR(100),
  linkedin_url TEXT,
  github_url   TEXT,
  website_url  TEXT,
  photo_url    TEXT
);

CREATE TABLE IF NOT EXISTS experiences (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position    VARCHAR(150) NOT NULL,
  company     VARCHAR(150) NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS education (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  degree      VARCHAR(150) NOT NULL,
  school      VARCHAR(150) NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS skills (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  category   VARCHAR(50),
  level      SMALLINT CHECK (level BETWEEN 1 AND 5),
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projects (
  id           SERIAL PRIMARY KEY,
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        VARCHAR(150) NOT NULL,
  description  TEXT,
  technologies TEXT[],
  repo_url     TEXT,
  demo_url     TEXT,
  image_url    TEXT,
  sort_order   INT NOT NULL DEFAULT 0
);

-- Données de démonstration (mot de passe factice : à remplacer par un vrai hachage bcrypt/argon2)
INSERT INTO users (email, password_hash, slug, is_public)
VALUES ('demo@example.com', 'hash_a_remplacer', 'demo-etudiant', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO profiles (user_id, full_name, headline, bio)
SELECT id, 'Étudiant Démo', 'Développeur Full-Stack junior', 'Portfolio de démonstration.'
FROM users WHERE slug = 'demo-etudiant'
ON CONFLICT DO NOTHING;
