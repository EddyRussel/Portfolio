import { randomBytes } from "node:crypto";
import { redis } from "./redis.js";

// Une session dure 7 jours
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

// Nom du cookie qui contient le jeton de session dans le navigateur
export const SESSION_COOKIE = "session";

const key = (token: string) => `session:${token}`;
// Liste (un "set" Redis) de toutes les sessions d'un utilisateur :
// permet de toutes les fermer d'un coup (changement de mot de passe, suppression du compte)
const userKey = (userId: number) => `user-sessions:${userId}`;

// Crée une session : un jeton aléatoire impossible à deviner, rangé dans Redis
// avec l'id de l'utilisateur. Redis supprime la clé tout seul après 7 jours (EX).
export async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await redis
    .multi() // plusieurs commandes exécutées d'un bloc
    .set(key(token), String(userId), { EX: SESSION_TTL_SECONDS })
    .sAdd(userKey(userId), token)
    .expire(userKey(userId), SESSION_TTL_SECONDS)
    .exec();
  return token;
}

// Retrouve l'utilisateur à partir du jeton (ou null si la session n'existe plus)
export async function getSessionUserId(token: string): Promise<number | null> {
  const value = await redis.get(key(token));
  return value ? Number(value) : null;
}

// Déconnexion : on supprime la session de Redis
export async function destroySession(token: string): Promise<void> {
  const userId = await getSessionUserId(token);
  await redis.del(key(token));
  if (userId) await redis.sRem(userKey(userId), token);
}

// Ferme toutes les sessions d'un utilisateur, sauf éventuellement celle à garder
export async function destroyUserSessions(
  userId: number,
  keepToken?: string,
): Promise<void> {
  const tokens = await redis.sMembers(userKey(userId));
  for (const token of tokens) {
    if (token === keepToken) continue;
    await redis.del(key(token));
    await redis.sRem(userKey(userId), token);
  }
}
