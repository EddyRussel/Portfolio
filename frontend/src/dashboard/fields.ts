// Description des champs de formulaire de chaque type de contenu.
// Le composant ResourceEditor lit cette description pour fabriquer le formulaire :
// pour ajouter un champ, il suffit de l'ajouter ici (et dans la validation de l'API).

// tags  : liste séparée par des virgules   -> ["Java", "SQL"]
// lines : un élément par ligne               -> ["Connexion sécurisée", "CV en PDF"]
// pairs : "Titre : texte", un par ligne      -> [{ title: "Curieux", text: "J'apprends vite." }]
export type FieldType = "text" | "textarea" | "month" | "url" | "select" | "tags" | "lines" | "pairs";

export type Field = {
  name: string; // nom de la colonne dans l'API
  label: string; // texte affiché au-dessus du champ
  type: FieldType;
  required?: boolean;
  hint?: string; // petite aide sous le champ
  options?: { value: string; label: string }[]; // pour type "select"
  wide?: boolean; // prend toute la largeur du formulaire
};

// Un élément renvoyé par l'API : { id, sort_order, ...les champs }
export type Item = { id: number; sort_order: number } & Record<string, unknown>;

export type ResourceConfig = {
  path: string; // ex. "/api/experiences"
  images?: boolean; // true = chaque élément peut avoir une capture d'écran (projets)
  singular: string; // ex. "une expérience"
  empty: string; // message quand la liste est vide
  fields: Field[];
  title: (item: Item) => string; // ligne principale dans la liste
  subtitle: (item: Item) => string; // ligne secondaire
};

type Pair = { title: string; text: string };

// Valeur de l'API -> texte affiché dans le champ du formulaire
export function toFieldValue(field: Field, raw: unknown): string {
  if (field.type === "tags") return Array.isArray(raw) ? raw.join(", ") : "";
  if (field.type === "lines") return Array.isArray(raw) ? raw.join("\n") : "";
  if (field.type === "pairs")
    return Array.isArray(raw)
      ? (raw as Pair[]).map((p) => (p.text ? `${p.title} : ${p.text}` : p.title)).join("\n")
      : "";
  return raw === null || raw === undefined ? "" : String(raw);
}

// Texte du champ -> valeur envoyée à l'API
export function fromFieldValue(field: Field, value: string): unknown {
  const parts = (separator: string) =>
    value
      .split(separator)
      .map((t) => t.trim())
      .filter(Boolean);
  if (field.type === "tags") return parts(",");
  if (field.type === "lines") return parts("\n");
  if (field.type === "pairs")
    return parts("\n").map((line) => {
      const colon = line.indexOf(":"); // tout ce qui est avant le premier ":" est le titre
      return colon === -1
        ? { title: line, text: "" }
        : { title: line.slice(0, colon).trim(), text: line.slice(colon + 1).trim() };
    });
  return value;
}

// "2026-05" -> "mai 2026"
function month(value: unknown): string {
  if (typeof value !== "string" || !value) return "aujourd'hui";
  return new Date(`${value}-01T12:00:00`).toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
}

const KIND_LABELS: Record<string, string> = { emploi: "Emploi", stage: "Stage", benevolat: "Bénévolat" };

const dateFields: Field[] = [
  { name: "start_date", label: "Début", type: "month", required: true },
  { name: "end_date", label: "Fin", type: "month", hint: "Laisse vide si c'est en cours." },
];

export const RESOURCES: Record<string, ResourceConfig> = {
  experiences: {
    path: "/api/experiences",
    singular: "une expérience",
    empty: "Aucune expérience pour l'instant. Ajoute ton premier emploi, stage ou bénévolat.",
    fields: [
      { name: "position", label: "Poste", type: "text", required: true },
      { name: "company", label: "Entreprise ou organisme", type: "text", required: true },
      {
        name: "kind",
        label: "Type",
        type: "select",
        required: true,
        hint: "Le bénévolat s'affiche sur une voie à part.",
        options: [
          { value: "emploi", label: "Emploi" },
          { value: "stage", label: "Stage" },
          { value: "benevolat", label: "Bénévolat" },
        ],
      },
      { name: "employment_type", label: "Type de poste", type: "text", hint: "Ex. : temps plein · saisonnier" },
      ...dateFields,
      { name: "description", label: "Description", type: "textarea", wide: true },
    ],
    title: (i) => String(i.position),
    subtitle: (i) =>
      `${KIND_LABELS[String(i.kind)] ?? ""} · ${i.company} — ${month(i.start_date)} à ${month(i.end_date)}`,
  },
  education: {
    path: "/api/education",
    singular: "une formation",
    empty: "Aucune formation pour l'instant. Ajoute ton diplôme ou une certification.",
    fields: [
      { name: "degree", label: "Diplôme ou certification", type: "text", required: true },
      { name: "school", label: "Établissement", type: "text", required: true },
      ...dateFields,
      { name: "description", label: "Description", type: "textarea", wide: true },
      {
        name: "topics",
        label: "Matières principales",
        type: "tags",
        hint: "Sépare-les par des virgules : java, csharp, python, sql, uml",
        wide: true,
      },
    ],
    title: (i) => String(i.degree),
    subtitle: (i) => `${i.school} — ${month(i.start_date)} à ${month(i.end_date)}`,
  },
  skills: {
    path: "/api/skills",
    singular: "une compétence",
    empty: "Aucune compétence pour l'instant.",
    fields: [
      { name: "name", label: "Compétence", type: "text", required: true },
      {
        name: "category",
        label: "Catégorie",
        type: "select",
        required: true,
        options: [
          { value: "langage", label: "Langage" },
          { value: "technologie", label: "Technologie" },
          { value: "outil", label: "Outil" },
          { value: "langue", label: "Langue" },
          { value: "soft skill", label: "Savoir-être" },
        ],
      },
      {
        name: "level",
        label: "Niveau",
        type: "select",
        hint: "Facultatif. Affiché pour les langues.",
        options: [
          { value: "", label: "Non précisé" },
          { value: "1", label: "1 — Débutant" },
          { value: "2", label: "2" },
          { value: "3", label: "3 — Intermédiaire" },
          { value: "4", label: "4" },
          { value: "5", label: "5 — Expert ou langue maternelle" },
        ],
      },
    ],
    title: (i) => String(i.name),
    subtitle: (i) => `${i.category ?? ""}${i.level ? ` — niveau ${i.level}/5` : ""}`,
  },
  projects: {
    path: "/api/projects",
    images: true,
    singular: "un projet",
    empty: "Aucun projet pour l'instant. Ajoute un projet scolaire ou personnel.",
    fields: [
      { name: "title", label: "Titre", type: "text", required: true },
      { name: "context", label: "Contexte", type: "text", hint: "Ex. : Projet académique · Collège LaSalle" },
      { name: "description", label: "Description", type: "textarea", hint: "Une ou deux phrases.", wide: true },
      {
        name: "highlights",
        label: "Ce que j'ai fait",
        type: "lines",
        hint: "Une réalisation par ligne.",
        wide: true,
      },
      {
        name: "technologies",
        label: "Technologies",
        type: "tags",
        hint: "Sépare-les par des virgules : Java, Spring Boot, MySQL",
        wide: true,
      },
      { name: "repo_url", label: "Lien du code (GitHub)", type: "url" },
      { name: "demo_url", label: "Lien de la démo", type: "url" },
    ],
    title: (i) => String(i.title),
    subtitle: (i) => (Array.isArray(i.technologies) ? i.technologies.join(", ") : ""),
  },
};
