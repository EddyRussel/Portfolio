import { describe, expect, it } from "vitest";
import { app, newUser, request } from "./helpers.js";

type Agent = Awaited<ReturnType<typeof newUser>>["agent"];

// Le comptage des visites se fait en arrière-plan (après la réponse au visiteur).
// Plutôt que d'attendre une durée fixe, on redemande les statistiques
// toutes les 200 ms jusqu'à obtenir le résultat attendu (5 secondes maximum).
async function waitForStats(agent: Agent, expectedViews: number) {
  let stats;
  for (let attempt = 0; attempt < 25; attempt++) {
    stats = (await agent.get("/api/stats").expect(200)).body;
    if (stats.totals.views >= expectedViews) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return stats;
}

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

    const stats = await waitForStats(agent, 2);
    expect(stats.days).toHaveLength(30);
    // A (le rechargement compte pour la même visite) + B ; le propriétaire n'est pas compté
    expect(stats.totals.views).toBe(2);
    expect(stats.totals.unique_visitors).toBe(2);
  });
});
