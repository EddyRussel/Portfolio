import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import "./portfolio.css";
import { API_URL } from "./api";
import CommandPalette, { type Command } from "./portfolio/CommandPalette";
import { buildCode, firstPart, logoFrom, period, shortPeriod, slugify, toCommand } from "./portfolio/format";
import type { Portfolio, Skill } from "./portfolio/types";

// Phrase du badge en haut de page (à modifier quand tu auras trouvé ton stage !)
const STATUS = "Disponible pour un stage";

const SECTIONS = [
  { id: "apropos", label: "À propos" },
  { id: "projets", label: "Projets" },
  { id: "experience", label: "Expérience" },
  { id: "formation", label: "Formation" },
  { id: "competences", label: "Compétences" },
  { id: "contact", label: "Contact" },
];

// Compétences : une lettre et une couleur par catégorie (comme l'autocomplétion d'un éditeur)
const SKILL_KINDS: Record<string, { letter: string; label: string }> = {
  langage: { letter: "L", label: "langage" },
  technologie: { letter: "T", label: "technologie" },
  outil: { letter: "O", label: "outil" },
  langue: { letter: "A", label: "langue" },
  "soft skill": { letter: "S", label: "savoir-être" },
};

const LANGUAGE_LEVELS = ["", "débutant", "notions", "intermédiaire", "avancé", "langue maternelle"];

// L'utilisateur a-t-il demandé à réduire les animations (réglage d'accessibilité) ?
const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Compteur : de 0 à la valeur en 1,4 s (accélère puis ralentit) ----------
function useCountUp(enabled: boolean): number {
  const [progress, setProgress] = useState(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!enabled || reduceMotion) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      setProgress(1 - Math.pow(1 - t, 3)); // "easeOutCubic"
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);
  return progress;
}

// ---------- Photo, ou initiales s'il n'y en a pas ----------
function Avatar({ portfolio, className }: { portfolio: Portfolio; className: string }) {
  const initials = portfolio.full_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return portfolio.photo_path ? (
    <img className={className} src={`${API_URL}${portfolio.photo_path}`} alt={`Photo de ${portfolio.full_name}`} />
  ) : (
    <div className={`${className} is-initials`} aria-hidden="true">
      {initials}
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [skillQuery, setSkillQuery] = useState("");
  const paletteButton = useRef<HTMLButtonElement>(null);
  const progress = useCountUp(portfolio !== null);

  // 1. Au chargement : on appelle l'API
  useEffect(() => {
    // credentials "include" : si c'est toi (connecté) qui regardes ton portfolio,
    // l'API le sait et ne compte pas ta visite dans les statistiques
    fetch(`${API_URL}/api/public/${slug}`, { credentials: "include" })
      .then(async (response) => {
        if (response.status === 404) throw new Error("Ce portfolio n'existe pas ou est privé.");
        if (!response.ok) throw new Error("Le portfolio n'a pas pu être chargé. Réessaie dans un instant.");
        return response.json();
      })
      .then((data: Portfolio) => {
        setPortfolio(data);
        document.title = `${data.full_name} · Portfolio`;
      })
      .catch((err: Error) => setError(err.message));
  }, [slug]);

  // 2. Ctrl K (ou Cmd K sur Mac) ouvre la palette de commandes
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 3. Une fois les données là : apparition au défilement + section active dans le menu
  useEffect(() => {
    if (!portfolio) return;

    const revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.08 }
    );
    document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px" }
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

  // useMemo : on ne recalcule le code de l'en-tête que si les données changent
  const code = useMemo(() => (portfolio ? buildCode(portfolio) : []), [portfolio]);

  if (error) return <main className="pf-status">{error}</main>;
  if (!portfolio) return <main className="pf-status">Chargement du portfolio…</main>;

  const p = portfolio;
  const cvUrl = p.cv_available ? `${API_URL}/api/public/${slug}/cv` : null;
  const languages = p.skills.filter((s) => s.category === "langue");
  const langages = p.skills.filter((s) => s.category === "langage").slice(0, 3);
  const school = p.education[0] ? firstPart(p.education[0].school) : null;
  const available = Boolean(p.looking_for);
  const sections = SECTIONS.filter(({ id }) => {
    if (id === "projets") return p.projects.length > 0;
    if (id === "experience") return p.experiences.length > 0 || available;
    if (id === "formation") return p.education.length > 0;
    if (id === "competences") return p.skills.length > 0;
    return true;
  });

  const stats = [
    { value: p.projects.length, label: "projets" },
    {
      value: p.skills.filter((s) => s.category !== "langue" && s.category !== "soft skill").length,
      label: "technologies et outils",
    },
    { value: p.experiences.length, label: "expériences et engagements" },
    { value: languages.length, label: "langues" },
  ].filter((s) => s.value > 0);

  // Les paragraphes de la présentation (séparés par une ligne vide)
  const bio = (p.bio ?? "")
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean);

  // Compétences filtrées par ce que le visiteur tape après « eddy.competences. »
  const query = skillQuery.trim().toLowerCase();
  const shownSkills = p.skills.filter((s) => s.name.toLowerCase().includes(query));
  const skillKinds = Object.entries(SKILL_KINDS).filter(([key]) => p.skills.some((s) => s.category === key));
  const kindOf = (s: Skill) => SKILL_KINDS[s.category ?? ""] ?? { letter: "·", label: s.category ?? "" };

  const commands: Command[] = [
    ...sections.map((s) => ({ label: s.label, hint: "section", run: () => goTo(s.id) })),
    ...(cvUrl
      ? [{ label: "Télécharger mon CV (PDF)", hint: "fichier", run: () => window.location.assign(cvUrl) }]
      : []),
    ...(p.email
      ? [
          { label: "Écrire un courriel", hint: "contact", run: () => window.location.assign(`mailto:${p.email}`) },
          {
            label: "Copier mon adresse courriel",
            hint: "contact",
            run: () => navigator.clipboard?.writeText(p.email ?? ""),
          },
        ]
      : []),
    ...(p.linkedin_url
      ? [{ label: "Ouvrir LinkedIn", hint: "lien", run: () => window.open(p.linkedin_url!, "_blank") }]
      : []),
    ...(p.github_url
      ? [{ label: "Ouvrir GitHub", hint: "lien", run: () => window.open(p.github_url!, "_blank") }]
      : []),
  ];

  function goTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    setMenuOpen(false);
  }

  // Expériences en « graphe Git » : le prochain commit (le stage) est en haut
  const commits = [
    ...(available
      ? [
          {
            key: "head",
            lane: "work",
            open: true,
            tag: "HEAD · prochain commit",
            title: p.looking_for ?? "",
            where: "Votre entreprise ?",
            detail: null,
            when: "à venir",
          },
        ]
      : []),
    ...p.experiences.map((e) => ({
      key: String(e.id),
      lane: e.kind === "benevolat" ? "volunteer" : "work",
      open: false,
      tag: e.employment_type || (e.kind === "stage" ? "stage" : e.kind === "benevolat" ? "bénévolat" : "emploi"),
      title: e.position,
      where: e.company,
      detail: e.description,
      when: shortPeriod(e.start_date, e.end_date),
    })),
  ];
  const hasVolunteer = commits.some((c) => c.lane === "volunteer");

  return (
    <div className="pf">
      <a className="skip-link" href="#apropos">
        Aller au contenu
      </a>

      {/* ---------- Barre de navigation fixe ---------- */}
      <header className="pf-nav">
        <div className="pf-nav-inner">
          <a className="pf-logo" href="#haut">
            {logoFrom(p.full_name)}
          </a>
          <nav id="pf-links" className={`pf-links ${menuOpen ? "is-open" : ""}`} aria-label="Sections">
            {sections.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className={activeSection === id ? "is-active" : ""}
                aria-current={activeSection === id ? "true" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="pf-nav-actions">
            <button
              ref={paletteButton}
              type="button"
              className="pf-kbd-btn"
              aria-label="Rechercher une section (Ctrl K)"
              onClick={() => setPaletteOpen(true)}
            >
              <svg
                aria-hidden="true"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              type="button"
              className="pf-menu-btn"
              aria-expanded={menuOpen}
              aria-controls="pf-links"
              aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
            <a className="pf-btn pf-btn-primary pf-btn-sm" href={cvUrl ?? "#contact"}>
              Mon CV
            </a>
          </div>
        </div>
      </header>

      <main className="pf-main">
        {/* ---------- Accueil ---------- */}
        <section id="haut" className="pf-hero">
          {available && (
            <p className="pf-status-pill">
              <span className="pf-pulse" aria-hidden="true" />
              {STATUS}
              {p.city ? ` · ${firstPart(p.city)}` : ""}
            </p>
          )}
          <h1>{p.full_name}</h1>
          {(p.tagline || p.headline) && <p className="pf-tagline">{p.tagline || p.headline}</p>}

          {/* Le code (source) et ce qu'il affiche (rendu) */}
          <div className="pf-render">
            <div className="pf-source" aria-label="Mon profil écrit sous forme de code">
              <p className="pf-pane-label">source</p>
              <pre>
                {code.map((line, i) => (
                  <span key={i} className="pf-line">
                    <span className="pf-ln" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className={`tk-${line.kind}`}>{line.text}</span>
                  </span>
                ))}
                <span className="pf-line">
                  <span className="pf-ln" aria-hidden="true">
                    {code.length + 1}
                  </span>
                  <span className="tk-kw">render</span>
                  <span className="tk-punct">(moi);</span>
                  <span className="pf-caret" aria-hidden="true" />
                </span>
              </pre>
            </div>
            <div className="pf-output">
              <p className="pf-pane-label">rendu</p>
              <div className="pf-card">
                <div className="pf-card-head">
                  <Avatar portfolio={p} className="pf-card-photo" />
                  <div className="pf-card-id">
                    <p className="pf-card-name">{p.full_name}</p>
                    {p.headline && <p className="pf-card-role">{p.headline}</p>}
                  </div>
                  {available && <span className="pf-card-badge">disponible</span>}
                </div>
                {langages.length > 0 && (
                  <ul className="pf-card-tags" aria-label="Langages principaux">
                    {langages.map((s) => (
                      <li key={s.id}>{s.name}</li>
                    ))}
                  </ul>
                )}
                {(school || p.city) && <p className="pf-card-foot">{[school, p.city].filter(Boolean).join(" · ")}</p>}
              </div>
            </div>
          </div>

          <div className="pf-actions">
            {p.projects.length > 0 && (
              <a className="pf-btn pf-btn-primary" href="#projets">
                Voir mes projets
              </a>
            )}
            <a className="pf-btn pf-btn-ghost" href="#contact">
              Me contacter
            </a>
          </div>
        </section>

        {/* ---------- Chiffres clés (compteur à l'ouverture) ---------- */}
        {stats.length > 0 && (
          <section className="pf-stats" aria-label="Chiffres clés">
            {stats.map((s) => (
              <div key={s.label} className="pf-stat">
                {/* Les lecteurs d'écran lisent directement la valeur finale */}
                <strong aria-hidden="true">{Math.round(s.value * progress)}</strong>
                <span className="visually-hidden">{s.value}</span>
                <span>{s.label}</span>
              </div>
            ))}
          </section>
        )}

        {/* ---------- À propos ---------- */}
        <section id="apropos" className={`pf-section pf-about reveal ${p.photo_path ? "" : "no-photo"}`}>
          {p.photo_path && (
            <div className="pf-about-photo">
              <Avatar portfolio={p} className="pf-portrait" />
            </div>
          )}
          <div className="pf-about-text">
            <h2>À propos</h2>
            {bio.map((paragraph, i) => (
              <p key={i} className={i === 0 ? "pf-lead" : "pf-body"}>
                {paragraph}
              </p>
            ))}
            {p.qualities.length > 0 && (
              <ul className="pf-qualities">
                {p.qualities.map((q) => (
                  <li key={q.title}>
                    <strong>{q.title}</strong>
                    {q.text && <span>{q.text}</span>}
                  </li>
                ))}
              </ul>
            )}
            <dl className="pf-facts">
              {p.looking_for && (
                <>
                  <dt>Je cherche</dt>
                  <dd>{p.looking_for}</dd>
                </>
              )}
              {languages.length > 0 && (
                <>
                  <dt>Langues</dt>
                  <dd>
                    {languages // le niveau n'est ajouté que si le nom ne le dit pas déjà : "Anglais (intermédiaire)"
                      .map((l) =>
                        l.level && !l.name.includes("(") ? `${l.name} (${LANGUAGE_LEVELS[l.level]})` : l.name
                      )
                      .join(" · ")}
                  </dd>
                </>
              )}
              {p.interests.length > 0 && (
                <>
                  <dt>En dehors du code</dt>
                  <dd className="pf-pills">
                    {p.interests.map((interest) => (
                      <span key={interest}>{interest}</span>
                    ))}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </section>

        {/* ---------- Projets ---------- */}
        {p.projects.length > 0 && (
          <section id="projets" className="pf-section reveal">
            <h2>Projets</h2>
            <p className="pf-sub">Chaque projet, lancé.</p>
            <div className="pf-projects">
              {p.projects.map((project) => (
                <article key={project.id} className="pf-project">
                  <div className="pf-project-visual">
                    {project.image_path && (
                      <img
                        src={`${API_URL}${project.image_path}`}
                        alt={`Capture d'écran : ${project.title}`}
                        loading="lazy"
                      />
                    )}
                    <div
                      className="pf-terminal"
                      aria-label={`Technologies : ${(project.technologies ?? []).join(", ")}`}
                    >
                      <div>
                        <span className="tk-str">$</span> run {toCommand(project.title)}
                      </div>
                      {(project.technologies ?? []).map((tech) => (
                        <div key={tech} className="pf-term-line">
                          <span className="tk-str">✓</span> {tech}
                        </div>
                      ))}
                      <div className="pf-term-ready">→ prêt</div>
                    </div>
                  </div>
                  <div className="pf-project-body">
                    {project.context && <p className="pf-context">{project.context}</p>}
                    <h3>{project.title}</h3>
                    {project.description && <p className="pf-body">{project.description}</p>}
                    {project.highlights.length > 0 && (
                      <>
                        <p className="pf-done-title">Ce que j’ai fait</p>
                        <ul className="pf-done">
                          {project.highlights.map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {(project.repo_url || project.demo_url) && (
                      <div className="pf-project-links">
                        {project.repo_url && (
                          <a
                            className="pf-btn pf-btn-ghost pf-btn-sm"
                            href={project.repo_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Voir le code
                          </a>
                        )}
                        {project.demo_url && (
                          <a
                            className="pf-btn pf-btn-ghost pf-btn-sm"
                            href={project.demo_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Voir la démo
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ---------- Expérience : graphe Git ---------- */}
        {commits.length > 0 && (
          <section id="experience" className="pf-section reveal">
            <h2>Expérience</h2>
            <p className="pf-sub">Travail et engagement, version Git.</p>
            <ul className="pf-legend" aria-label="Légende">
              <li className="is-work">travail et stage</li>
              {hasVolunteer && <li className="is-volunteer">bénévolat</li>}
              {available && <li className="is-open">à venir</li>}
            </ul>
            <ol className={`pf-git ${hasVolunteer ? "has-two-lanes" : ""}`}>
              {commits.map((c) => (
                <li key={c.key} className={`pf-commit lane-${c.lane} ${c.open ? "is-open" : ""}`}>
                  <span className="pf-dot" aria-hidden="true" />
                  <div className="pf-commit-body">
                    <p className="pf-commit-head">
                      <span className="pf-commit-tag">{c.tag}</span>
                      <span className="pf-commit-title">{c.title}</span>
                    </p>
                    <p className="pf-commit-where">{c.where}</p>
                    {c.detail && <p className="pf-commit-detail">{c.detail}</p>}
                  </div>
                  <p className="pf-commit-when">{c.when}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ---------- Formation ---------- */}
        {p.education.length > 0 && (
          <section id="formation" className="pf-section reveal">
            <h2>Formation</h2>
            <p className="pf-sub">Ce que j’ai importé, et d’où.</p>
            <div className="pf-education">
              {p.education.map((edu) => (
                <article key={edu.id} className="pf-edu">
                  <p className="pf-import" aria-hidden="true">
                    <span className="tk-kw">import</span>{" "}
                    {edu.topics.length > 0 && (
                      <>
                        <span className="tk-punct">{"{"}</span> <span className="tk-var">{edu.topics.join(", ")}</span>{" "}
                        <span className="tk-punct">{"}"}</span>
                        <br />
                        <span className="tk-kw">{"  from"}</span>{" "}
                      </>
                    )}
                    <span className="tk-str">"{slugify(firstPart(edu.school))}"</span>
                    <span className="tk-punct">;</span>
                  </p>
                  <div className="pf-edu-body">
                    <p className="pf-edu-when">
                      {edu.end_date || edu.start_date ? period(edu.start_date, edu.end_date) : ""}
                    </p>
                    <h3>{edu.degree}</h3>
                    <p className="pf-edu-school">{edu.school}</p>
                    {edu.topics.length > 0 && <p className="visually-hidden">Matières : {edu.topics.join(", ")}</p>}
                    {edu.description && <p className="pf-edu-desc">{edu.description}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* ---------- Compétences : l'autocomplétion de l'éditeur ---------- */}
        {p.skills.length > 0 && (
          <section id="competences" className="pf-section reveal">
            <h2>Compétences</h2>
            <p className="pf-sub" aria-live="polite">
              {shownSkills.length} suggestion{shownSkills.length > 1 ? "s" : ""} disponible
              {shownSkills.length > 1 ? "s" : ""}.
            </p>
            <label className="pf-prompt">
              <span className="tk-var">{logoFrom(p.full_name).split(".")[0]}</span>
              <span className="tk-punct">.</span>
              <span className="tk-key">competences</span>
              <span className="tk-punct">.</span>
              <input
                value={skillQuery}
                onChange={(e) => setSkillQuery(e.target.value)}
                placeholder="tape pour filtrer"
                aria-label="Filtrer les compétences"
                spellCheck={false}
                autoComplete="off"
              />
            </label>
            <ul className="pf-suggest">
              {shownSkills.map((s, i) => {
                const kind = kindOf(s);
                return (
                  <li key={s.id} className={i === 0 && query ? "is-first" : ""}>
                    <span className={`pf-badge badge-${kind.letter}`} aria-hidden="true">
                      {kind.letter}
                    </span>
                    <span className="pf-suggest-name">{s.name}</span>
                    <span className="pf-suggest-kind">{kind.label}</span>
                  </li>
                );
              })}
              {shownSkills.length === 0 && (
                <li className="pf-suggest-empty">Aucune suggestion pour « {skillQuery} ».</li>
              )}
            </ul>
            <p className="pf-skill-legend">{skillKinds.map(([, k]) => `${k.letter} ${k.label}`).join(" · ")}</p>
          </section>
        )}

        {/* ---------- Contact ---------- */}
        <section id="contact" className="pf-section pf-contact-wrap reveal">
          <div className="pf-contact">
            <p className="pf-shell">
              <span className="tk-str">
                {logoFrom(p.full_name).split(".")[0]}@{slugify(firstPart(p.city ?? "web"))}
              </span>
              <span className="tk-punct">:~$</span> contacter --stage
            </p>
            {p.email && (
              <>
                <p className="pf-shell-out">→ meilleure façon de me joindre :</p>
                <a className="pf-mail" href={`mailto:${p.email}`}>
                  {p.email}
                </a>
              </>
            )}
            <div className="pf-actions">
              {cvUrl && (
                <a className="pf-btn pf-btn-primary" href={cvUrl}>
                  Télécharger mon CV (PDF)
                </a>
              )}
              {p.linkedin_url && (
                <a className="pf-btn pf-btn-ghost" href={p.linkedin_url} target="_blank" rel="noreferrer">
                  LinkedIn
                </a>
              )}
              {p.github_url && (
                <a className="pf-btn pf-btn-ghost" href={p.github_url} target="_blank" rel="noreferrer">
                  GitHub
                </a>
              )}
              {p.website_url && (
                <a className="pf-btn pf-btn-ghost" href={p.website_url} target="_blank" rel="noreferrer">
                  Site web
                </a>
              )}
            </div>
            <p className="pf-shell pf-shell-last" aria-hidden="true">
              <span className="tk-str">
                {logoFrom(p.full_name).split(".")[0]}@{slugify(firstPart(p.city ?? "web"))}
              </span>
              <span className="tk-punct">:~$</span> <span className="pf-caret is-light" />
            </p>
          </div>
          <p className="pf-footer">
            © {new Date().getFullYear()} {p.full_name} · fait avec React, Express et PostgreSQL
          </p>
        </section>
      </main>

      {paletteOpen && (
        <CommandPalette
          commands={commands}
          onClose={() => {
            setPaletteOpen(false);
            paletteButton.current?.focus(); // on rend le focus au bouton
          }}
        />
      )}
    </div>
  );
}
