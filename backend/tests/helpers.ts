import request from "supertest";
import { randomUUID } from "node:crypto";
import { app } from "../src/app.js";

// Crée un compte de test unique et renvoie un "agent" : un client HTTP
// qui garde le cookie de session entre les requêtes (comme un navigateur).
export async function newUser(fullName = "Utilisateur Test") {
  const agent = request.agent(app);
  const email = `test-${randomUUID().slice(0, 8)}@test.local`;
  const password = "motdepasse-test";
  const res = await agent.post("/api/auth/register").send({ full_name: fullName, email, password });
  if (res.status !== 201) throw new Error(`Inscription impossible : ${JSON.stringify(res.body)}`);
  return { agent, email, password, user: res.body.user as { id: number; slug: string } };
}

export { app, request };
