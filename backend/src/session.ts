import { randomBytes } from "node:crypto";
import { redis } from "./redis.js";

// Une session dure 7 jours
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

// Nom du cookie qui contient le jeton de session dans le navigateur
export const SESSION_COOKIE = "session";

const key = (token: string) => `session:${token}`;

// Crée une session : un jeton aléatoire impossible à deviner, rangé dans Redis
// avec l'id de l'utilisateur. Redis supprime la clé tout seul après 7 jours (EX).
export async function createSession(userId: number): Promise<string> {
    const token = randomBytes(32).toString("hex");
    await redis.set(key(token), String(userId), { EX: SESSION_TTL_SECONDS });
    return token;
}

// Retrouve l'utilisateur à partir du jeton (ou null si la session n'existe plus)
export async function getSessionUserId(token: string): Promise<number | null> {
    const value = await redis.get(key(token));
    return value ? Number(value) : null;
}

// Déconnexion : on supprime la session de Redis
export async function destroySession(token: string): Promise<void> {
    await redis.del(key(token));
}