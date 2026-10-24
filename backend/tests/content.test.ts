import { describe, expect, it } from "vitest";
import { app, newUser, request } from "./helpers.js";

const experience = {
  position: "Développeur",
  company: "Entreprise",
  start_date: "2026-01",
  end_date: "",
};

describe("Gestion du contenu (CRUD)", () => {
  it("ajoute, modifie et supprime une expérience", async () => {
    const { agent } = await newUser();

    const created = await agent
      .post("/api/experiences")
      .send(experience)
      .expect(201);
    expect(created.body).toMatchObject({
      position: "Développeur",
      start_date: "2026-01",
      end_date: null,
    });

    const updated = await agent
      .put(`/api/experiences/${created.body.id}`)
      .send({
        ...experience,
        position: "Développeur full-stack",
        end_date: "2026-06",
      })
      .expect(200);
    expect(updated.body.position).toBe("Développeur full-stack");
    expect(updated.body.end_date).toBe("2026-06");

    await agent.delete(`/api/experiences/${created.body.id}`).expect(204);
    const list = await agent.get("/api/experiences").expect(200);
    expect(list.body).toHaveLength(0);
  });

  it("valide les données (Zod)", async () => {
    const { agent } = await newUser();
    const res = await agent
      .post("/api/experiences")
      .send({ ...experience, start_date: "2026-13" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Date invalide/);

    const badUrl = await agent
      .post("/api/projects")
      .send({ title: "Projet", repo_url: "github.com/x" });
    expect(badUrl.status).toBe(400);
  });

  it("change l'ordre d'affichage", async () => {
    const { agent } = await newUser();
    const a = await agent
      .post("/api/skills")
      .send({ name: "A", category: "langage", level: "" });
    const b = await agent
      .post("/api/skills")
      .send({ name: "B", category: "langage", level: 3 });

    await agent
      .put("/api/skills/reorder")
      .send({ ids: [b.body.id, a.body.id] })
      .expect(200);
    const list = await agent.get("/api/skills");
    expect(list.body.map((s: { name: string }) => s.name)).toEqual(["B", "A"]);
  });

  it("empêche de toucher aux données d'un autre utilisateur", async () => {
    const alice = await newUser("Alice Test");
    const bob = await newUser("Bob Test");
    const item = await alice.agent.post("/api/experiences").send(experience);

    await bob.agent
      .put(`/api/experiences/${item.body.id}`)
      .send(experience)
      .expect(404);
    await bob.agent.delete(`/api/experiences/${item.body.id}`).expect(404);
    const bobList = await bob.agent.get("/api/experiences");
    expect(bobList.body).toHaveLength(0);
  });

  it("rejette les routes privées sans session", async () => {
    await request(app).get("/api/experiences").expect(401);
    await request(app).post("/api/projects").send({ title: "X" }).expect(401);
  });
});

describe("Portfolio public et cache Redis", () => {
  it("n'affiche pas un portfolio privé (RF-11)", async () => {
    const { user } = await newUser();
    await request(app).get(`/api/public/${user.slug}`).expect(404); // privé par défaut
  });

  it("sert le portfolio depuis le cache puis l'invalide après une modification (RF-13)", async () => {
    const { agent, user } = await newUser();
    await agent
      .patch("/api/profile/visibility")
      .send({ is_public: true })
      .expect(200);

    const first = await request(app)
      .get(`/api/public/${user.slug}`)
      .expect(200);
    const second = await request(app)
      .get(`/api/public/${user.slug}`)
      .expect(200);
    expect(first.body.source).toBe("db");
    expect(second.body.source).toBe("cache");

    await agent
      .post("/api/projects")
      .send({ title: "Nouveau projet", technologies: ["React"] })
      .expect(201);
    const third = await request(app)
      .get(`/api/public/${user.slug}`)
      .expect(200);
    expect(third.body.source).toBe("db"); // le cache a été vidé
    expect(third.body.projects[0].title).toBe("Nouveau projet");
  });

  it("ne montre jamais le téléphone sur la page publique", async () => {
    const { agent, user } = await newUser("Test Telephone");
    await agent
      .put("/api/profile")
      .send({ full_name: "Test Telephone", phone: "514-555-0000" })
      .expect(200);
    await agent.patch("/api/profile/visibility").send({ is_public: true });
    const res = await request(app).get(`/api/public/${user.slug}`);
    expect(JSON.stringify(res.body)).not.toContain("514-555-0000");
  });
});
