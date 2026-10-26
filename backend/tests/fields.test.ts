import { describe, expect, it } from "vitest";
import { app, newUser, request } from "./helpers.js";

// Les champs ajoutés pour le nouveau portfolio (accroche, qualités, "ce que j'ai fait"...)
describe("Champs du nouveau portfolio", () => {
  it("enregistre le profil enrichi et l'affiche sur le portfolio public", async () => {
    const { agent, user } = await newUser();
    await agent
      .put("/api/profile")
      .send({
        full_name: "Eddy Test",
        tagline: "Je transforme des idées en applications qui fonctionnent.",
        looking_for: "Un stage en développement logiciel",
        interests: ["Foot", "Musique"],
        qualities: [{ title: "Curieux", text: "J'apprends vite." }],
      })
      .expect(200);

    const mine = await agent.get("/api/profile").expect(200);
    expect(mine.body.qualities).toEqual([{ title: "Curieux", text: "J'apprends vite." }]);
    expect(mine.body.interests).toEqual(["Foot", "Musique"]);

    const exp = await agent
      .post("/api/experiences")
      .send({ position: "Ambassadeur", company: "Collège", kind: "benevolat", start_date: "2025-08" })
      .expect(201);
    expect(exp.body.kind).toBe("benevolat");

    await agent
      .post("/api/projects")
      .send({ title: "Portfolio", context: "Projet de session", highlights: ["Connexion sécurisée", "CV en PDF"] })
      .expect(201);
    await agent
      .post("/api/education")
      .send({ degree: "AEC", school: "Collège", start_date: "2025-01", topics: ["java", "sql"] })
      .expect(201);

    await agent.patch("/api/profile/visibility").send({ is_public: true }).expect(200);
    const pub = await request(app).get(`/api/public/${user.slug}`).expect(200);
    expect(pub.body.tagline).toMatch(/idées/);
    expect(pub.body.qualities[0].title).toBe("Curieux");
    expect(pub.body.experiences[0].kind).toBe("benevolat");
    expect(pub.body.projects[0].highlights).toEqual(["Connexion sécurisée", "CV en PDF"]);
    expect(pub.body.education[0].topics).toEqual(["java", "sql"]);
    expect(pub.body.phone).toBeUndefined(); // le téléphone reste privé
  });

  it("met « emploi » par défaut et refuse un type inconnu", async () => {
    const { agent } = await newUser();
    const exp = await agent
      .post("/api/experiences")
      .send({ position: "Préposé", company: "SAQ", start_date: "2026-05" })
      .expect(201);
    expect(exp.body.kind).toBe("emploi");

    const bad = await agent
      .post("/api/experiences")
      .send({ position: "X", company: "Y", kind: "vacances", start_date: "2026-05" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/Type d'expérience/);
  });
});
