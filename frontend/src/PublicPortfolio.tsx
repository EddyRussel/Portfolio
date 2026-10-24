import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import "./portfolio.css";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

// Phrase affichée dans le badge du haut (à modifier quand tu auras trouvé ton stage !)
const STATUS = "Disponible pour un stage";

// ---------- Types : la forme des données renvoyées par l'API ----------
type Experience = {
  id: number;
  position: string;
  company: string;
  start_date: string; // "2026-05"
  end_date: string | null; // null = en cours
  description: string | null;
};

type Education = {
  id: number;
  degree: string;
  school: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
};

type Skill = {
  id: number;
  name: string;
  category: string | null;
  level: number | null;
};

type Project = {
  id: number;
  title: string;
  description: string | null;
  technologies: string[] | null;
  repo_url: string | null;
  demo_url: string | null;
};

type Portfolio = {
  full_name: string;
  email: string | null;
  headline: string | null;
  bio: string | null;
  city: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  website_url: string | null;
  cv_available: boolean; // l'étudiant autorise le téléchargement de son CV
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
};

// ---------- Petites fonctions utilitaires ----------

// "2026-05" -> "mai 2026"
function formatMonth(value: string): string {
  const date = new Date(`${value}-01T12:00:00`);
  return date.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
}

function formatPeriod(start: string, end: string | null): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : "aujourd'hui"}`;
}

// Regroupe les compétences par catégorie : { langage: [...], outil: [...] }
function groupByCategory(skills: Skill[]): Record<string, Skill[]> {
  const groups: Record<string, Skill[]> = {};
  for (const skill of skills) {
    const key = skill.category ?? "autre";
    (groups[key] ??= []).push(skill);
  }
  return groups;
}

const CATEGORY_LABELS: Record<string, string> = {
  langage: "Langages",
  technologie: "Technologies",
  outil: "Outils",
  langue: "Langues",
  autre: "Autres",
};

const SECTIONS = [
  { id: "apropos", label: "À propos" },
  { id: "parcours", label: "Parcours" },
  { id: "projets", label: "Projets" },
  { id: "competences", label: "Compétences" },
  { id: "contact", label: "Contact" },
];

// L'utilisateur a-t-il demandé à réduire les animations (réglage d'accessibilité) ?
const reduceMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- L'éditeur de code animé du haut de page ----------

// Un "token" = un morceau de code avec sa couleur (mot-clé, texte, propriété...)
type Token = {
  kind: "kw" | "var" | "key" | "str" | "bool" | "punct";
  text: string;
};

function buildCode(p: Portfolio): Token[] {
  const langages = p.skills
    .filter((s) => s.category === "langage")
    .slice(0, 3)
    .map((s) => s.name);
  const school = p.education[0]?.school.split(",")[0];

  const line = (key: string, value: Token[]): Token[] => [
    { kind: "punct", text: "  " },
    { kind: "key", text: key },
    { kind: "punct", text: ": " },
    ...value,
    { kind: "punct", text: ",\n" },
  ];
  const str = (text: string): Token[] => [{ kind: "str", text: `"${text}"` }];

  return [
    { kind: "kw", text: "const " },
    { kind: "var", text: "moi" },
    { kind: "punct", text: " = {\n" },
    ...line("nom", str(p.full_name)),
    ...(p.city ? line("ville", str(p.city)) : []),
    ...(school ? line("ecole", str(school)) : []),
    ...line("langages", [
      { kind: "punct", text: "[" },
      ...langages.flatMap((l, i) => [
        { kind: "str" as const, text: `"${l}"` },
        ...(i < langages.length - 1
          ? [{ kind: "punct" as const, text: ", " }]
          : []),
      ]),
      { kind: "punct", text: "]" },
    ]),
    ...line("recherche", str("stage")),
    ...line("disponible", [{ kind: "bool", text: "true" }]),
    { kind: "punct", text: "};" },
  ];
}

function CodeWindow({ tokens }: { tokens: Token[] }) {
  const total = tokens.reduce((sum, t) => sum + t.text.length, 0);
  const [typed, setTyped] = useState(reduceMotion ? total : 0);

  // On "tape" un caractère toutes les 28 ms
  useEffect(() => {
    if (typed >= total) return;
    const timer = setTimeout(() => setTyped((n) => n + 1), 28);
    return () => clearTimeout(timer);
  }, [typed, total]);

  // On n'affiche que les "typed" premiers caractères
  let remaining = typed;
  const visible = tokens.map((token, i) => {
    const part = token.text.slice(0, Math.max(0, remaining));
    remaining -= token.text.length;
    return part ? (
      <span key={i} className={`tk-${token.kind}`}>
        {part}
      </span>
    ) : null;
  });

  return (
    <div className="editor" aria-label="Mon profil présenté sous forme de code">
      <div className="editor-bar">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
        <span className="editor-file">moi.ts</span>
      </div>
      <pre className="editor-code">
        <code>
          {visible}
          <span
            className={`caret ${typed >= total ? "caret-done" : ""}`}
            aria-hidden="true"
          />
        </code>
      </pre>
    </div>
  );
}

// ---------- Le composant de la page ----------
export default function PublicPortfolio() {
  const { slug } = useParams();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // 1. Au chargement : on appelle l'API
  useEffect(() => {
    // credentials "include" : si c'est toi (connecté) qui regardes ton portfolio,
    // l'API le sait et ne compte pas ta visite dans les statistiques
    fetch(`${API_URL}/api/public/${slug}`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 404)
          throw new Error("Ce portfolio n'existe pas ou est privé.");
        if (!response.ok)
          throw new Error(
            "Le portfolio n'a pas pu être chargé. Vérifie que l'API est démarrée.",
          );
        return response.json();
      })
      .then(setPortfolio)
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  // 2. Une fois les données là : animations au défilement + section active dans le menu
  useEffect(() => {
    if (!portfolio) return;

    // Les éléments ".reveal" apparaissent quand ils entrent à l'écran
    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    document
      .querySelectorAll(".reveal")
      .forEach((el) => revealObserver.observe(el));

    // La section au milieu de l'écran est surlignée dans le menu
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    });

    return () => {
      revealObserver.disconnect();
      sectionObserver.disconnect();
    };
  }, [portfolio]);

  // useMemo : on ne recalcule le code de l'éditeur que si les données changent
  const codeTokens = useMemo(
    () => (portfolio ? buildCode(portfolio) : []),
    [portfolio],
  );

  if (error) return <main className="pf-status">{error}</main>;
  if (!portfolio)
    return <main className="pf-status">Chargement du portfolio…</main>;

  const skillGroups = groupByCategory(portfolio.skills);
  const languages = skillGroups["langue"] ?? [];
  delete skillGroups["langue"]; // les langues ont leur propre affichage

  const technicalCount = portfolio.skills.filter(
    (s) => s.category !== "langue",
  ).length;
  const stats = [
    { value: portfolio.projects.length, label: "projets académiques" },
    { value: technicalCount, label: "langages, technologies et outils" },
    {
      value: portfolio.experiences.length,
      label: "expériences et engagements",
    },
    { value: languages.length, label: "langues parlées" },
  ];

  const firstName = portfolio.full_name.split(" ")[0];
  // Lien direct vers le PDF : l'API répond "attachment", donc le navigateur le télécharge
  const cvUrl = `${API_URL}/api/public/${slug}/cv`;

  return (
    <div className="pf">
      <a className="skip-link" href="#apropos">
        Aller au contenu
      </a>

      {/* ---------- Menu fixe ---------- */}
      <header className="nav">
        <div className="nav-inner">
          <a className="nav-logo" href="#top">
            {slug}
          </a>
          <button
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="nav-links"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Fermer" : "Menu"}
          </button>
          <nav
            id="nav-links"
            className={`nav-links ${menuOpen ? "is-open" : ""}`}
            aria-label="Sections"
          >
            {SECTIONS.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className={activeSection === id ? "is-active" : ""}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {/* ---------- Haut de page ---------- */}
      <section id="top" className="hero">
        <div className="hero-text">
          <p className="status">
            <span className="status-dot" aria-hidden="true" />
            {STATUS}
          </p>
          <h1>{portfolio.full_name}</h1>
          {portfolio.headline && (
            <p className="hero-headline">{portfolio.headline}</p>
          )}
          <div className="hero-actions">
            {portfolio.cv_available ? (
              <a className="btn btn-primary" href={cvUrl}>
                Télécharger mon CV
              </a>
            ) : (
              <a className="btn btn-primary" href="#projets">
                Voir mes projets
              </a>
            )}
            <a className="btn btn-ghost" href="#contact">
              Me contacter
            </a>
          </div>
        </div>
        <CodeWindow tokens={codeTokens} />
      </section>

      {/* ---------- Chiffres clés ---------- */}
      <section className="stats" aria-label="Chiffres clés">
        {stats.map((stat) => (
          <div key={stat.label} className="stat">
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </div>
        ))}
      </section>

      <main>
        {/* ---------- À propos ---------- */}
        {portfolio.bio && (
          <section id="apropos" className="block reveal">
            <h2>À propos</h2>
            <p className="lead">{portfolio.bio}</p>
          </section>
        )}

        {/* ---------- Parcours : expériences en ligne du temps + formations ---------- */}
        <section id="parcours" className="block reveal">
          <h2>Parcours</h2>
          <div className="parcours">
            <div>
              <h3 className="sub">Expériences</h3>
              <ol className="timeline">
                {portfolio.experiences.map((exp) => (
                  <li
                    key={exp.id}
                    className={!exp.end_date ? "is-current" : ""}
                  >
                    <p className="when">
                      {formatPeriod(exp.start_date, exp.end_date)}
                    </p>
                    <h4>{exp.position}</h4>
                    <p className="where">{exp.company}</p>
                    {exp.description && (
                      <p className="desc">{exp.description}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="sub">Formations</h3>
              <ol className="timeline">
                {portfolio.education.map((edu) => (
                  <li
                    key={edu.id}
                    className={!edu.end_date ? "is-current" : ""}
                  >
                    <p className="when">
                      {formatPeriod(edu.start_date, edu.end_date)}
                    </p>
                    <h4>{edu.degree}</h4>
                    <p className="where">{edu.school}</p>
                    {edu.description && (
                      <p className="desc">{edu.description}</p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ---------- Projets ---------- */}
        {portfolio.projects.length > 0 && (
          <section id="projets" className="block reveal">
            <h2>Projets</h2>
            <div className="projects">
              {portfolio.projects.map((project) => (
                <article key={project.id} className="project">
                  <h3>{project.title}</h3>
                  <div>
                    {project.description && <p>{project.description}</p>}
                    {project.technologies && (
                      <ul className="chips" aria-label="Technologies utilisées">
                        {project.technologies.map((tech) => (
                          <li key={tech}>{tech}</li>
                        ))}
                      </ul>
                    )}
                    {(project.repo_url || project.demo_url) && (
                      <p className="project-links">
                        {project.repo_url && (
                          <a
                            href={project.repo_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Voir le code
                          </a>
                        )}
                        {project.demo_url && (
                          <a
                            href={project.demo_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Voir la démo
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ---------- Compétences ---------- */}
        <section id="competences" className="block reveal">
          <h2>Compétences</h2>
          <div className="skills">
            {Object.entries(skillGroups).map(([category, skills]) => (
              <div key={category} className="skill-group">
                <h3 className="sub">{CATEGORY_LABELS[category] ?? category}</h3>
                <ul className="chips">
                  {skills.map((skill) => (
                    <li key={skill.id}>{skill.name}</li>
                  ))}
                </ul>
              </div>
            ))}
            {languages.length > 0 && (
              <div className="skill-group">
                <h3 className="sub">Langues</h3>
                <ul className="languages">
                  {languages.map((lang) => (
                    <li key={lang.id}>
                      <span>{lang.name}</span>
                      {lang.level && (
                        <span
                          className="meter"
                          role="img"
                          aria-label={`Niveau ${lang.level} sur 5`}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              className={n <= (lang.level ?? 0) ? "on" : ""}
                            />
                          ))}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* ---------- Contact ---------- */}
        <section id="contact" className="contact reveal">
          <h2>Vous cherchez un stagiaire ?</h2>
          <p>Le plus simple pour me joindre, c'est par courriel.</p>
          {portfolio.email && (
            <a className="contact-mail" href={`mailto:${portfolio.email}`}>
              {portfolio.email}
            </a>
          )}
          <p className="contact-links">
            {portfolio.cv_available && <a href={cvUrl}>Mon CV (PDF)</a>}
            {portfolio.linkedin_url && (
              <a href={portfolio.linkedin_url} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            )}
            {portfolio.github_url && (
              <a href={portfolio.github_url} target="_blank" rel="noreferrer">
                GitHub
              </a>
            )}
            {portfolio.website_url && (
              <a href={portfolio.website_url} target="_blank" rel="noreferrer">
                Site web
              </a>
            )}
          </p>
        </section>
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} {portfolio.full_name}. Fait avec React,
        Express et PostgreSQL par {firstName}.
      </footer>
    </div>
  );
}
