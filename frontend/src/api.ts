// Petit utilitaire pour appeler l'API depuis n'importe quelle page.
// En développement : l'API tourne sur http://localhost:3000 (VITE_API_URL dans docker-compose.yml).
// En production (Vercel) : adresse vide = même site. Vercel relaie les appels /api/... vers l'API
// (voir vercel.json), ce qui permet au cookie de session de fonctionner.
export const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? "" : "http://localhost:3000");

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      // "include" = envoyer le cookie de session avec la requête (sinon l'API ne sait pas qui on est)
      credentials: "include",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // fetch échoue (sans réponse) quand le serveur est injoignable : API arrêtée, réseau coupé...
    throw new Error("Impossible de joindre le serveur. Vérifie que l'API est démarrée.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // On renvoie le message d'erreur écrit par l'API (ex. "Courriel ou mot de passe incorrect.")
    throw new Error(data.error ?? "Une erreur est survenue. Réessayez.");
  }
  return data as T;
}
