import { describe, expect, it } from "vitest";
import { app, newUser, request } from "./helpers.js";

describe("Statistiques de visites", () => {
  it("compte les visites des visiteurs, pas celles du propriétaire", async () => {
    const { agent, user } = await newUser();
    await agent.patch("/api/profile/visibility").send({ is_public: true });

    // deux visiteurs différents (navigateurs différents), dont un qui recharge la page
    await request(app).get(`/api/public/${user.slug}`).set("User-Agent", "Visiteur-A");
    await request(app).get(`/api/public/${user.slug}`).set("User-Agent", "Visiteur-A");
    await request(app).get(`/api/public/${user.slug}`).set("User-Agent", "Visiteur-B");
    // le propriétaire, connecté, regarde son propre portfolio
    await agent.get(`/api/public/${user.slug}`);

    // le comptage se fait en arrière-plan : on lui laisse un instant
    await new Promise((resolve) => setTimeout(resolve, 300));

    const stats = await agent.get("/api/stats").expect(200);
    expect(stats.body.days).toHaveLength(30);
    expect(stats.body.totals.views).toBe(2); // A (rechargement = même visite) + B
    expect(stats.body.totals.unique_visitors).toBe(2);
  });
});
