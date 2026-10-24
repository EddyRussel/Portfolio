import { describe, expect, it } from "vitest";
import { app, newUser, request } from "./helpers.js";

describe("Authentification", () => {
  it("refuse l'accès aux routes privées sans session", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("refuse une inscription invalide avec un message clair", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        full_name: "Test",
        email: "pas-un-courriel",
        password: "motdepasse",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Adresse courriel invalide.");
  });

  it("inscrit un utilisateur, le connecte et génère un slug lisible", async () => {
    const { agent, user } = await newUser("Éloïse Tremblay");
    expect(user.slug).toMatch(/^eloise-tremblay/); // accents retirés (RF-12)

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.full_name).toBe("Éloïse Tremblay");
  });

  it("refuse un deuxième compte avec le même courriel", async () => {
    const { email } = await newUser();
    const res = await request(app)
      .post("/api/auth/register")
      .send({ full_name: "Copie", email, password: "motdepasse" });
    expect(res.status).toBe(409);
  });

  it("refuse un mauvais mot de passe sans dire si le compte existe", async () => {
    const { email } = await newUser();
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "mauvais" });
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "inconnu@test.local", password: "mauvais" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error); // même message dans les deux cas
  });

  it("déconnecte l'utilisateur", async () => {
    const { agent } = await newUser();
    await agent.post("/api/auth/logout").expect(200);
    await agent.get("/api/auth/me").expect(401);
  });

  it("change le mot de passe et ferme les autres sessions (RF-03)", async () => {
    const { agent, email, password } = await newUser();
    const otherDevice = request.agent(app);
    await otherDevice
      .post("/api/auth/login")
      .send({ email, password })
      .expect(200);

    await agent
      .put("/api/account/password")
      .send({ current_password: password, new_password: "nouveau-mdp-123" })
      .expect(200);

    await agent.get("/api/auth/me").expect(200); // la session actuelle reste ouverte
    await otherDevice.get("/api/auth/me").expect(401); // l'autre appareil est déconnecté
    await request(app)
      .post("/api/auth/login")
      .send({ email, password })
      .expect(401);
    await request(app)
      .post("/api/auth/login")
      .send({ email, password: "nouveau-mdp-123" })
      .expect(200);
  });

  it("supprime le compte et toutes ses données (RF-04)", async () => {
    const { agent, password, user } = await newUser();
    await agent
      .post("/api/experiences")
      .send({
        position: "Poste",
        company: "Entreprise",
        start_date: "2026-01",
      });

    await agent
      .delete("/api/account")
      .send({ password: "mauvais" })
      .expect(401);
    await agent.delete("/api/account").send({ password }).expect(204);

    await agent.get("/api/auth/me").expect(401);
    await request(app).get(`/api/public/${user.slug}`).expect(404);
  });
});
