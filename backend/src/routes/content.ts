import { z } from "zod";
import { createCrudRouter } from "./crud.js";
import { month, optionalMonth, optionalText, optionalUrl, textList } from "../validation.js";

// Les 4 types de contenu du portfolio, chacun avec ses règles de validation.

export const experiencesRouter = createCrudRouter({
  table: "experiences",
  dateColumns: ["start_date", "end_date"],
  schema: z.object({
    position: z.string().trim().min(1, "Le poste est obligatoire.").max(150),
    company: z.string().trim().min(1, "L'entreprise est obligatoire.").max(150),
    // emploi et stage d'un côté, bénévolat de l'autre (deux "voies" sur le portfolio)
    kind: z
      .enum(["emploi", "stage", "benevolat"], { errorMap: () => ({ message: "Type d'expérience invalide." }) })
      .default("emploi"),
    employment_type: optionalText(80), // ex. "temps plein · saisonnier"
    start_date: month,
    end_date: optionalMonth,
    description: optionalText(3000),
  }),
});

export const educationRouter = createCrudRouter({
  table: "education",
  dateColumns: ["start_date", "end_date"],
  schema: z.object({
    degree: z.string().trim().min(1, "Le diplôme est obligatoire.").max(150),
    school: z.string().trim().min(1, "L'établissement est obligatoire.").max(150),
    start_date: month,
    end_date: optionalMonth,
    description: optionalText(3000),
    topics: textList(15, 40), // matières, affichées comme import { java, sql } from "college"
  }),
});

export const skillsRouter = createCrudRouter({
  table: "skills",
  schema: z.object({
    name: z.string().trim().min(1, "Le nom de la compétence est obligatoire.").max(100),
    category: z.enum(["langage", "technologie", "outil", "langue", "soft skill"], {
      errorMap: () => ({ message: "Catégorie invalide." }),
    }),
    level: z.preprocess(
      (v) => (v === "" || v === undefined ? null : Number(v)),
      z.number().int().min(1, "Niveau entre 1 et 5.").max(5, "Niveau entre 1 et 5.").nullable()
    ),
  }),
});

export const projectsRouter = createCrudRouter({
  table: "projects",
  schema: z.object({
    title: z.string().trim().min(1, "Le titre est obligatoire.").max(150),
    context: optionalText(150), // ex. "Projet académique · Collège LaSalle"
    description: optionalText(3000),
    highlights: textList(10, 200), // la liste "Ce que j'ai fait"
    technologies: textList(20, 50),
    repo_url: optionalUrl,
    demo_url: optionalUrl,
    image_url: optionalUrl,
  }),
});
