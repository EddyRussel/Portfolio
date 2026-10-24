import type { NextFunction, Request, Response } from "express";
import { getSessionUserId, SESSION_COOKIE } from "../session.js";

// "Middleware" = une fonction qui s'exécute AVANT la route.
// Celle-ci laisse passer seulement les utilisateurs connectés.
// Usage : router.get("/route-privee", requireAuth, (req, res) => { ... })
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.[SESSION_COOKIE];
  const userId = token ? await getSessionUserId(token) : null;

  if (!userId) {
    return res.status(401).json({ error: "Vous devez être connecté." });
  }

  // On garde l'id pour la suite (res.locals = espace de stockage de la requête)
  res.locals.userId = userId;
  next();
}
