// Les données qui servent à fabriquer le CV

export type CvExperience = {
  id: number;
  position: string;
  company: string;
  start_date: string; // "2026-05"
  end_date: string | null;
  description: string | null;
};

export type CvEducation = {
  id: number;
  degree: string;
  school: string;
  start_date: string;
  end_date: string | null;
  description: string | null;
};

export type CvSkill = { id: number; name: string; category: string | null; level: number | null };

export type CvProject = { id: number; title: string; description: string | null; technologies: string[] | null };

export type CvData = {
  full_name: string;
  headline: string | null;
  bio: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  website_url: string | null;
  experiences: CvExperience[];
  education: CvEducation[];
  skills: CvSkill[];
  projects: CvProject[];
};

export const TEMPLATES = ["classic", "modern"] as const;
export type Template = (typeof TEMPLATES)[number];
