import { describe, expect, it } from "vitest";
import { app, newUser, request } from "./helpers.js";
import { cvFileName } from "../src/cv/service.js";
import { period } from "../src/cv/format.js";

// Supertest : lire la réponse comme un fichier binaire (Buffer)
const asBuffer = (res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
};

describe("Fonctions utilitaires du CV (tests unitaires)", () => {
  it("nomme le fichier CV_Prenom_Nom.pdf sans accents (RF-25)", () => {
    expect(cvFileName("Éloïse Tremblay")).toBe("CV_Eloise_Tremblay.pdf");
    expect(cvFileName("Eddy Russel Ngoue")).toBe("CV_Eddy_Russel_Ngoue.pdf");
  });

  it("formate les périodes en français", () => {
    expect(period("2025-06", "2026-08")).toBe("juin 2025 – août 2026");
    expect(period("2026-09", null)).toBe("sept. 2026 – aujourd'hui");
  });
});

describe("Génération du CV en PDF", () => {
  it("génère un vrai PDF pour les deux modèles (RF-20, RF-21)", async () => {
    const { agent } = await newUser("Test Cv");
    await agent.post("/api/experiences").send({ position: "Stagiaire", company: "Entreprise", start_date: "2026-01" });

    for (const template of ["classic", "modern"]) {
      const res = await agent.post("/api/cv/download").send({ template }).buffer(true).parse(asBuffer);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/pdf");
      expect(res.headers["content-disposition"]).toContain('filename="CV_Test_Cv.pdf"');
      expect((res.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
    }
  });

  it("met le PDF en cache dans Redis (RF-26)", async () => {
    const { agent } = await newUser();
    const first = await agent.post("/api/cv/preview").send({ template: "modern" });
    const second = await agent.post("/api/cv/preview").send({ template: "modern" });
    expect(first.headers["x-cv-cache"]).toBe("MISS");
    expect(second.headers["x-cv-cache"]).toBe("HIT");

    // une modification des données change la version : le cache n'est plus utilisé
    await agent.post("/api/skills").send({ name: "TypeScript", category: "langage", level: "" });
    const third = await agent.post("/api/cv/preview").send({ template: "modern" });
    expect(third.headers["x-cv-cache"]).toBe("MISS");
  });

  it("refuse un modèle inconnu et l'accès sans session", async () => {
    const { agent } = await newUser();
    await agent.post("/api/cv/preview").send({ template: "inexistant" }).expect(400);
    await request(app).post("/api/cv/preview").send({}).expect(401);
  });
});

describe("CV téléchargeable par les visiteurs", () => {
  it("refuse un fichier qui n'est pas un PDF", async () => {
    const { agent } = await newUser();
    const res = await agent
      .put("/api/cv-file")
      .set("Content-Type", "application/pdf")
      .send(Buffer.from("pas un pdf"));
    expect(res.status).toBe(400);
  });

  it("permet à un visiteur de télécharger le CV seulement s'il est autorisé", async () => {
    const { agent, user } = await newUser();
    await agent.patch("/api/profile/visibility").send({ is_public: true });
    const pdf = Buffer.from("%PDF-1.4\n% test\n");
    await agent.put("/api/cv-file").set("Content-Type", "application/pdf").set("X-File-Name", "mon-cv.pdf").send(pdf).expect(200);

    const download = await request(app).get(`/api/public/${user.slug}/cv`).buffer(true).parse(asBuffer);
    expect(download.status).toBe(200);
    expect((download.body as Buffer).equals(pdf)).toBe(true); // fichier identique

    await agent.patch("/api/cv-file").send({ is_public: false }).expect(200);
    await request(app).get(`/api/public/${user.slug}/cv`).expect(404);
  });
});
