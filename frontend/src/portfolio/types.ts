// La forme des données renvoyées par GET /api/public/:slug

export type Experience = {
  id: number;
  position: string;
  company: string;
  kind: "emploi" | "stage" | "benevolat";
  employment_type: string | null; // ex. "temps plein · saisonnier"
  start_date: string; // "2026-05"
  end_date: string | null; // null = en cours
  description: string | null;
};

export type Education = {
  id: number;
  degree: string;
  school: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
  topics: string[];
};

export type Skill = {
  id: number;
  name: string;
  category: string | null;
  level: number | null;
};

export type Project = {
  id: number;
  title: string;
  context: string | null;
  description: string | null;
  highlights: string[];
  technologies: string[] | null;
  repo_url: string | null;
  demo_url: string | null;
  image_path: string | null; // capture d'écran téléversée
};

export type Portfolio = {
  full_name: string;
  email: string | null;
  headline: string | null;
  tagline: string | null;
  bio: string | null;
  city: string | null;
  looking_for: string | null;
  interests: string[];
  qualities: { title: string; text: string }[];
  linkedin_url: string | null;
  github_url: string | null;
  website_url: string | null;
  photo_path: string | null; // photo téléversée
  cv_available: boolean; // l'étudiant autorise le téléchargement de son CV
  experiences: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
};
