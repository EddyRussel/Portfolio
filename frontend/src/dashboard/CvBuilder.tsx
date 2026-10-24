import { useEffect, useRef, useState } from "react";
import { api, API_URL } from "../api";
import { uploadCvFile } from "./CvFileManager";

// ---------------------------------------------------------------------------
// Écran "Mon CV" : choisir le gabarit (RF-21), les sections et les éléments (RF-22),
// voir l'aperçu (RF-23), puis télécharger le PDF (RF-20, RF-25).
// ---------------------------------------------------------------------------

type Entry = { id: number; label: string };
type CvData = {
  full_name: string;
  bio: string | null;
  experiences: { id: number; position: string; company: string }[];
  education: { id: number; degree: string }[];
  skills: { id: number; name: string }[];
  projects: { id: number; title: string }[];
};

type ListKey = "experiences" | "education" | "skills" | "projects";
type Options = {
  template: "classic" | "modern";
  sections: Record<"bio" | ListKey, boolean>;
  exclude: Record<ListKey, number[]>;
};

const TEMPLATES = [
  { id: "classic", label: "Classique", description: "Une colonne, sobre et traditionnel." },
  { id: "modern", label: "Moderne", description: "Deux colonnes, aux couleurs du portfolio." },
] as const;

const SECTIONS: { key: ListKey; label: string }[] = [
  { key: "experiences", label: "Expériences" },
  { key: "projects", label: "Projets" },
  { key: "education", label: "Formations" },
  { key: "skills", label: "Compétences et langues" },
];

// Demande le PDF à l'API avec les options choisies
async function fetchPdf(mode: "preview" | "download", options: Options) {
  const response = await fetch(`${API_URL}/api/cv/${mode}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? "La génération du CV a échoué.");
  }
  // Nom du fichier envoyé par l'API : attachment; filename="CV_Eddy_Russel_Ngoue.pdf"
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const fileName = /filename="(.+)"/.exec(disposition)?.[1] ?? "CV.pdf";
  return { blob: await response.blob(), fileName, cached: response.headers.get("X-CV-Cache") === "HIT" };
}

export default function CvBuilder({ onPublished }: { onPublished: () => void }) {
  const [data, setData] = useState<CvData | null>(null);
  const [options, setOptions] = useState<Options>({
    template: "modern",
    sections: { bio: true, experiences: true, education: true, skills: true, projects: true },
    exclude: { experiences: [], education: [], skills: [], projects: [] },
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousUrl = useRef<string | null>(null);

  // 1. Les données (pour afficher les cases à cocher)
  useEffect(() => {
    api<CvData>("/api/cv/data")
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  // 2. L'aperçu se met à jour tout seul 400 ms après le dernier changement d'option
  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoadingPreview(true);
      setError(null);
      try {
        const { blob, cached } = await fetchPdf("preview", options);
        const url = URL.createObjectURL(blob); // adresse temporaire du PDF dans le navigateur
        if (previousUrl.current) URL.revokeObjectURL(previousUrl.current); // libère l'ancien aperçu
        previousUrl.current = url;
        setPreviewUrl(url);
        setCached(cached);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingPreview(false);
      }
    }, 400);
    return () => clearTimeout(timer); // si on change encore une option avant 400 ms, on annule
  }, [options]);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const { blob, fileName } = await fetchPdf("download", options);
      // On crée un lien invisible vers le fichier et on "clique" dessus
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  // Publie le CV généré comme "CV pour les visiteurs" du portfolio
  async function publish() {
    setPublishing(true);
    setError(null);
    setPublished(false);
    try {
      const { blob, fileName } = await fetchPdf("download", options);
      await uploadCvFile(blob, fileName);
      setPublished(true);
      onPublished();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPublishing(false);
    }
  }

  const toggleSection = (key: "bio" | ListKey) =>
    setOptions((o) => ({ ...o, sections: { ...o.sections, [key]: !o.sections[key] } }));

  const toggleItem = (key: ListKey, id: number) =>
    setOptions((o) => {
      const excluded = o.exclude[key];
      const next = excluded.includes(id) ? excluded.filter((x) => x !== id) : [...excluded, id];
      return { ...o, exclude: { ...o.exclude, [key]: next } };
    });

  if (!data) return error ? <p className="alert alert-error">{error}</p> : <p className="muted">Chargement…</p>;

  const entries: Record<ListKey, Entry[]> = {
    experiences: data.experiences.map((e) => ({ id: e.id, label: e.position })),
    projects: data.projects.map((p) => ({ id: p.id, label: p.title })),
    education: data.education.map((e) => ({ id: e.id, label: e.degree })),
    skills: data.skills.map((s) => ({ id: s.id, label: s.name })),
  };

  return (
    <div className="cv-builder">
      {/* ---------- Colonne des options ---------- */}
      <div className="cv-options">
        <fieldset className="cv-group">
          <legend>Modèle</legend>
          <div className="cv-templates">
            {TEMPLATES.map((t) => (
              <label key={t.id} className={`cv-template ${options.template === t.id ? "is-selected" : ""}`}>
                <input
                  type="radio"
                  name="template"
                  value={t.id}
                  checked={options.template === t.id}
                  onChange={() => setOptions((o) => ({ ...o, template: t.id }))}
                />
                <strong>{t.label}</strong>
                <span>{t.description}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="cv-group">
          <legend>Contenu</legend>
          <label className="check">
            <input type="checkbox" checked={options.sections.bio} onChange={() => toggleSection("bio")} />
            Profil (présentation)
          </label>

          {SECTIONS.map(({ key, label }) => (
            <details key={key} className="cv-section">
              <summary>
                <label className="check" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={options.sections[key]} onChange={() => toggleSection(key)} />
                  {label}
                </label>
                <span className="muted">
                  {entries[key].length - options.exclude[key].length}/{entries[key].length}
                </span>
              </summary>
              <div className="cv-items">
                {entries[key].map((entry) => (
                  <label key={entry.id} className="check check-small">
                    <input
                      type="checkbox"
                      disabled={!options.sections[key]}
                      checked={!options.exclude[key].includes(entry.id)}
                      onChange={() => toggleItem(key, entry.id)}
                    />
                    {entry.label}
                  </label>
                ))}
              </div>
            </details>
          ))}
          <p className="field-hint">Ouvre une section pour choisir les éléments à inclure.</p>
        </fieldset>

        <button className="btn-primary cv-download" onClick={download} disabled={downloading}>
          {downloading ? "Préparation…" : "Télécharger mon CV (PDF)"}
        </button>
        <button className="btn-ghost cv-publish" onClick={publish} disabled={publishing}>
          {publishing ? "Publication…" : "Publier ce CV sur mon portfolio"}
        </button>
        {published && (
          <p className="alert alert-ok" role="status">
            CV publié : les visiteurs peuvent maintenant le télécharger.
          </p>
        )}
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {/* ---------- Aperçu ---------- */}
      <div className="cv-preview">
        <div className="cv-preview-bar">
          <span>Aperçu</span>
          <span className="muted">
            {loadingPreview ? "Mise à jour…" : cached ? "Servi depuis le cache Redis" : "Généré à l'instant"}
          </span>
        </div>
        {previewUrl ? (
          <iframe title="Aperçu du CV" src={previewUrl} />
        ) : (
          <p className="muted cv-preview-empty">Préparation de l'aperçu…</p>
        )}
        {previewUrl && (
          <a className="cv-open" href={previewUrl} target="_blank" rel="noreferrer">
            Ouvrir l'aperçu dans un nouvel onglet
          </a>
        )}
      </div>
    </div>
  );
}
