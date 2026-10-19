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

-- =====================================================================
-- Données de départ : le portfolio d'Eddy Russel Ngoue (tirées de mon CV)
-- (mot de passe factice : à remplacer par un vrai hachage bcrypt/argon2)
-- =====================================================================
INSERT INTO users (email, password_hash, slug, is_public)
VALUES ('ngouerussel@gmail.com', 'hash_a_remplacer', 'eddy-russel-ngoue', TRUE)
    ON CONFLICT DO NOTHING;

INSERT INTO profiles (user_id, full_name, headline, bio, city, linkedin_url, github_url)
SELECT id,
       'Eddy Russel Ngoue',
       'Étudiant en programmation et analyse de données',
       'Étudiant en programmation et analyse de données au Collège LaSalle, je m''intéresse au développement logiciel et à la création de solutions concrètes. Curieux et autonome, j''aime résoudre des problèmes, apprendre rapidement de nouvelles technologies et transformer des idées en applications fonctionnelles. Je recherche actuellement un stage académique pour mettre mes compétences en pratique et contribuer à des projets au sein d''une équipe dynamique.',
       'Montréal, QC',
       'https://www.linkedin.com/in/eddy-russel-ngoue',
       'https://github.com/EddyRussel'
FROM users WHERE slug = 'eddy-russel-ngoue'
    ON CONFLICT DO NOTHING;

-- Expériences professionnelles et bénévolat
INSERT INTO experiences (user_id, position, company, start_date, end_date, description, sort_order) VALUES
                                                                                                        ((SELECT id FROM users WHERE slug = 'eddy-russel-ngoue'), 'Membre du comité exécutif – Chargé des communications (bénévolat)', 'AGEL – Association générale des étudiants du Collège LaSalle', '2026-09-01', NULL, 'Participer à la stratégie de communication de l''association et assurer la diffusion des activités, événements et initiatives auprès de la communauté étudiante.', 1),
                                                                                                        ((SELECT id FROM users WHERE slug = 'eddy-russel-ngoue'), 'Préposé à l''entrepôt (temps plein, saisonnier)', 'SAQ – Centre d''opérations spécialisé de Montréal', '2026-05-01', '2026-08-31', 'Préparation, déplacement et organisation des marchandises en environnement logistique à haut volume, avec utilisation sécuritaire d''équipements de manutention et collaboration d''équipe pour assurer l''efficacité des opérations.', 2),
                                                                                                        ((SELECT id FROM users WHERE slug = 'eddy-russel-ngoue'), 'Ambassadeur (bénévolat)', 'Collège LaSalle, Montréal', '2025-08-01', NULL, 'Représenter le Collège lors d''activités et d''événements, accueillir les étudiants et visiteurs et contribuer à la promotion de la vie étudiante.', 3),
                                                                                                        ((SELECT id FROM users WHERE slug = 'eddy-russel-ngoue'), 'Instructeur d''équipier (temps partiel)', 'McDonald''s, Montréal', '2025-06-01', '2026-08-31', 'Service à la clientèle et gestion simultanée de plusieurs tâches dans un environnement rapide, en assurant le respect des normes de qualité, d''hygiène et de sécurité alimentaire ainsi que la satisfaction des clients.', 4);

-- Formations et certifications
INSERT INTO education (user_id, degree, school, start_date, end_date, description, sort_order) VALUES
                                                                                                   ((SELECT id FROM users WHERE slug = 'eddy-russel-ngoue'), 'AEC – Programmeur analyste en techniques de l''information', 'Collège LaSalle, Montréal', '2025-01-01', NULL, 'Obtention prévue en décembre 2026. Formation axée sur le développement logiciel, l''analyse des systèmes d''information et la conception d''applications : Java, C#, Python, SQL, UML et applications multicouches.', 1),
                                                                                                   ((SELECT id FROM users WHERE slug = 'eddy-russel-ngoue'), 'Certificat professionnel en support informatique de Google', 'Coursera', '2026-01-01', NULL, 'Dépannage informatique, systèmes d''exploitation, réseaux, sécurité et support aux utilisateurs.', 2);

-- Compétences (catégories reprises de mon CV)
INSERT INTO skills (user_id, name, category, sort_order)
SELECT u.id, s.name, s.category, s.sort_order
FROM users u,
     (VALUES
          ('Java', 'langage', 1), ('Python', 'langage', 2), ('C#', 'langage', 3), ('Kotlin', 'langage', 4),
          ('SQL', 'langage', 5), ('HTML5', 'langage', 6), ('CSS', 'langage', 7),
          ('React', 'technologie', 10), ('.NET / .NET Framework', 'technologie', 11), ('ASP.NET Core', 'technologie', 12),
          ('ASP.NET MVC', 'technologie', 13), ('Windows Forms', 'technologie', 14), ('Entity Framework Core', 'technologie', 15),
          ('ADO.NET', 'technologie', 16), ('Spring Boot', 'technologie', 17), ('API REST', 'technologie', 18),
          ('Architecture MVC', 'technologie', 19), ('Docker', 'technologie', 20), ('Git', 'technologie', 21),
          ('Microsoft SQL Server', 'technologie', 22), ('MySQL', 'technologie', 23),
          ('GitHub', 'outil', 30), ('IntelliJ IDEA', 'outil', 31), ('Visual Studio', 'outil', 32), ('WebStorm', 'outil', 33),
          ('Android Studio', 'outil', 34), ('Docker Desktop', 'outil', 35), ('Microsoft 365', 'outil', 36)
     ) AS s(name, category, sort_order)
WHERE u.slug = 'eddy-russel-ngoue';

-- Langues (niveau sur 5)
INSERT INTO skills (user_id, name, category, level, sort_order) VALUES
                                                                    ((SELECT id FROM users WHERE slug = 'eddy-russel-ngoue'), 'Français (langue maternelle)', 'langue', 5, 40),
                                                                    ((SELECT id FROM users WHERE slug = 'eddy-russel-ngoue'), 'Anglais (intermédiaire)', 'langue', 3, 41);

-- Projets académiques
INSERT INTO projects (user_id, title, description, technologies, sort_order) VALUES
                                                                                 ((SELECT id FROM users WHERE slug = 'eddy-russel-ngoue'), 'Application web de gestion budgétaire intelligente', 'Application de gestion financière personnelle permettant aux étudiants de suivre leurs revenus et dépenses, d''analyser leur budget et de prévoir leurs habitudes financières, en appliquant les principes de programmation orientée objet.', ARRAY['Java', 'Spring Boot', 'HTML5', 'CSS', 'Architecture MVC'], 1),
                                                                                 ((SELECT id FROM users WHERE slug = 'eddy-russel-ngoue'), 'Simulation d''un système d''administration immobilière REMAX', 'Application client-serveur de gestion immobilière avec opérations CRUD et architecture multicouche basée sur ADO.NET.', ARRAY['C#', 'Windows Forms', 'SQL Server', 'ADO.NET', 'Architecture MVC'], 2);
 