import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  applySelection,
  cvFileName,
  generateCv,
  loadCvData,
} from "../cv/service.js";
import { TEMPLATES } from "../cv/types.js";

export const cvRouter = Router();
cvRouter.use(requireAuth);

// Ce que le tableau de bord envoie : le gabarit + les sections et éléments choisis
const ids = z.array(z.number().int()).default([]);
const optionsSchema = z.object({
  template: z.enum(TEMPLATES).default("classic"),
  sections: z
    .object({
      bio: z.boolean().default(true),
      experiences: z.boolean().default(true),
      education: z.boolean().default(true),
      skills: z.boolean().default(true),
      projects: z.boolean().default(true),
    })
    .default({}),
  exclude: z
    .object({ experiences: ids, education: ids, skills: ids, projects: ids })
    .default({}),
});

// GET /api/cv/data : toutes mes données, pour construire l'écran de sélection
cvRouter.get("/data", async (_req, res) => {
  const data = await loadCvData(res.locals.userId);
  if (!data) return res.status(404).json({ error: "Profil introuvable." });
  res.json(data);
});

// POST /api/cv/preview et /api/cv/download : le PDF
// - preview  : "inline"     -> le navigateur l'affiche (aperçu, RF-23)
// - download : "attachment" -> le navigateur le télécharge (RF-20)
for (const mode of ["preview", "download"] as const) {
  cvRouter.post(`/${mode}`, async (req, res) => {
    const parsed = optionsSchema.safeParse(req.body ?? {});
    if (!parsed.success)
      return res.status(400).json({ error: "Options du CV invalides." });

    const data = await loadCvData(res.locals.userId);
    if (!data) return res.status(404).json({ error: "Profil introuvable." });

    try {
      const selected = applySelection(data, parsed.data);
      const { pdf, cached } = await generateCv(
        res.locals.userId,
        selected,
        parsed.data.template,
      );
      const fileName = cvFileName(data.full_name ?? "");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${mode === "download" ? "attachment" : "inline"}; filename="${fileName}"`,
      );
      res.setHeader("X-CV-Cache", cached ? "HIT" : "MISS"); // pour voir le cache Redis en action
      res.setHeader(
        "Access-Control-Expose-Headers",
        "Content-Disposition, X-CV-Cache",
      );
      res.send(pdf);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "La génération du CV a échoué." });
    }
  });
}
