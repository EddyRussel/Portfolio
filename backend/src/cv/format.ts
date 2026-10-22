import type { CvData, CvSkill } from "./types.js";

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

// "2026-05" -> "mai 2026"
export function formatMonth(value: string): string {
  const [year, month] = value.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

// Période : "mai 2026 – août 2026" ou "août 2025 – aujourd'hui"
export function period(start: string, end: string | null): string {
  return `${formatMonth(start)} – ${end ? formatMonth(end) : "aujourd'hui"}`;
}

// "https://www.linkedin.com/in/eddy" -> "linkedin.com/in/eddy" (plus lisible sur papier)
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

// Ligne de contact : ville | téléphone | courriel | liens
export function contactItems(data: CvData): string[] {
  return [
    data.city,
    data.phone,
    data.email,
    data.linkedin_url && shortUrl(data.linkedin_url),
    data.github_url && shortUrl(data.github_url),
    data.website_url && shortUrl(data.website_url),
  ].filter((item): item is string => Boolean(item));
}

const CATEGORY_LABELS: Record<string, string> = {
  langage: "Langages",
  technologie: "Technologies",
  outil: "Outils",
  "soft skill": "Savoir-être",
  langue: "Langues",
};

// Regroupe les compétences par catégorie, dans un ordre fixe
export function skillGroups(skills: CvSkill[]): { label: string; skills: CvSkill[] }[] {
  const order = ["langage", "technologie", "outil", "soft skill", "langue"];
  const groups = new Map<string, CvSkill[]>();
  for (const skill of skills) {
    const key = skill.category ?? "autre";
    groups.set(key, [...(groups.get(key) ?? []), skill]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99))
    .map(([key, list]) => ({ label: CATEGORY_LABELS[key] ?? "Autres", skills: list }));
}

// Langues : niveau en mots
export function languageLevel(level: number | null): string {
  if (!level) return "";
  return ["", "notions", "débutant", "intermédiaire", "avancé", "courant / langue maternelle"][level] ?? "";
}
