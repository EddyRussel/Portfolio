import { Router } from "express";

export const cvRouter = Router();

// TODO (étudiants) : générer le CV en PDF à partir des données de PostgreSQL.
//  - Choisir une bibliothèque (pdfkit, puppeteer, @react-pdf/renderer...)
//  - Gérer au moins 2 gabarits (?template=classic | modern)
//  - Mettre le PDF en cache dans Redis
//  - Répondre avec :
//      res.setHeader("Content-Type", "application/pdf");
//      res.setHeader("Content-Disposition", 'attachment; filename="CV_Prenom_Nom.pdf"');
cvRouter.get("/download", (_req, res) => {
  res.status(501).json({ error: "Génération du CV à implémenter" });
});

cvRouter.get("/preview", (_req, res) => {
  res.status(501).json({ error: "Aperçu du CV à implémenter" });
});
