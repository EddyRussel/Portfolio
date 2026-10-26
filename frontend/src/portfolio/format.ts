import type { Portfolio } from "./types";

// Petites fonctions de mise en forme du portfolio public

// "Collège LaSalle, Montréal" -> "Collège LaSalle"
export function firstPart(text: string): string {
  return text.split(",")[0].trim();
}

// "Collège LaSalle" -> "college-lasalle" (sans accents ni espaces)
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// "Eddy Russel Ngoue" -> "eddy.ngoue" (le logo de la barre de navigation)
export function logoFrom(fullName: string): string {
  const words = slugify(fullName).split("-").filter(Boolean);
  return words.length > 1 ? `${words[0]}.${words[words.length - 1]}` : (words[0] ?? "portfolio");
}

// "Portfolio et générateur de CV" -> "portfolio-generateur-cv" (la commande du terminal)
const SMALL_WORDS = new Set([
  "et",
  "de",
  "du",
  "des",
  "la",
  "le",
  "les",
  "l",
  "d",
  "un",
  "une",
  "en",
  "a",
  "au",
  "pour",
]);
export function toCommand(title: string): string {
  return slugify(title)
    .split("-")
    .filter((w) => w && !SMALL_WORDS.has(w))
    .slice(0, 3)
    .join("-");
}

// "2026-05" -> "mai 2026" ou "mai" (court)
function monthLabel(value: string, withYear: boolean): string {
  const date = new Date(`${value}-01T12:00:00`);
  return date.toLocaleDateString("fr-CA", withYear ? { month: "short", year: "numeric" } : { month: "short" });
}

// Période courte : "mai – août 2026", "juin 2025 – août 2026", "août 2025 – auj."
export function shortPeriod(start: string, end: string | null): string {
  if (!end) return `${monthLabel(start, true)} – auj.`;
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${monthLabel(start, !sameYear)} – ${monthLabel(end, true)}`;
}

// Période des formations : "janv. 2025 – déc. 2026", ou "depuis janv. 2025"
export function period(start: string, end: string | null): string {
  return end ? `${monthLabel(start, true)} – ${monthLabel(end, true)}` : `depuis ${monthLabel(start, true)}`;
}

// Le code affiché en haut de page : const moi = { ... };
export type CodeLine = { kind: "kw" | "str" | "bool" | "punct"; text: string };

export function buildCode(p: Portfolio): CodeLine[] {
  const field = (key: string, value: string | null | undefined): CodeLine[] =>
    value ? [{ kind: "str", text: `  ${key}: "${value}",` }] : [];
  const langages = p.skills
    .filter((s) => s.category === "langage")
    .slice(0, 3)
    .map((s) => `"${s.name}"`);

  return [
    { kind: "kw", text: "const moi = {" },
    ...field("nom", p.full_name),
    ...field("role", p.headline),
    ...field("ecole", p.education[0] ? firstPart(p.education[0].school) : null),
    ...field("ville", p.city),
    ...(langages.length ? [{ kind: "str" as const, text: `  langages: [${langages.join(", ")}],` }] : []),
    { kind: "bool", text: `  disponible: ${p.looking_for ? "true" : "false"},` },
    { kind: "punct", text: "};" },
    { kind: "punct", text: "" },
  ];
}
