import { describe, expect, it } from "vitest";
import { app, newUser, request } from "./helpers.js";

// Une vraie image PNG de 1 × 1 pixel
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

describe("Images (photo et captures d'écran)", () => {
  it("refuse un fichier qui n'est pas une image", async () => {
    const { agent } = await newUser();
    const res = await agent
      .put("/api/images/photo")
      .set("Content-Type", "image/png")
      .send(Buffer.from("pas une image"));
    expect(res.status).toBe(400);
  });

  it("téléverse la photo et l'affiche sur le portfolio public seulement s'il est public", async () => {
    const { agent, user } = await newUser();
    await agent.put("/api/images/photo").set("Content-Type", "image/png").send(PNG).expect(200);

    const summary = await agent.get("/api/images").expect(200);
    expect(summary.body.photo).toBeTypeOf("number");

    await request(app).get(`/api/public/${user.slug}/photo`).expect(404); // portfolio encore privé

    await agent.patch("/api/profile/visibility").send({ is_public: true });
    const portfolio = await request(app).get(`/api/public/${user.slug}`).expect(200);
    expect(portfolio.body.photo_path).toMatch(new RegExp(`^/api/public/${user.slug}/photo\\?v=\\d+$`));

    const photo = await request(app).get(`/api/public/${user.slug}/photo`).expect(200);
    expect(photo.headers["content-type"]).toBe("image/png");
    expect(photo.headers["cross-origin-resource-policy"]).toBe("cross-origin");

    await agent.delete("/api/images/photo").expect(204);
    const after = await request(app).get(`/api/public/${user.slug}`);
    expect(after.body.photo_path).toBeNull(); // le cache du portfolio a bien été vidé
  });

  it("ajoute une capture d'écran à un projet, mais pas au projet d'un autre", async () => {
    const alice = await newUser("Alice Images");
    const bob = await newUser("Bob Images");
    const project = await alice.agent.post("/api/projects").send({ title: "Projet", technologies: [] });

    await bob.agent
      .put(`/api/images/projects/${project.body.id}`)
      .set("Content-Type", "image/png")
      .send(PNG)
      .expect(404);
    await alice.agent
      .put(`/api/images/projects/${project.body.id}`)
      .set("Content-Type", "image/png")
      .send(PNG)
      .expect(200);

    await alice.agent.patch("/api/profile/visibility").send({ is_public: true });
    const portfolio = await request(app).get(`/api/public/${alice.user.slug}`);
    expect(portfolio.body.projects[0].image_path).toContain(`/projects/${project.body.id}/image?v=`);

    // supprimer le projet supprime aussi son image (ON DELETE CASCADE)
    await alice.agent.delete(`/api/projects/${project.body.id}`).expect(204);
    const summary = await alice.agent.get("/api/images");
    expect(summary.body.projects).toEqual({});
  });
});
