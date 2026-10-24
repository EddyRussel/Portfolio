// Petit utilitaire pour appeler l'API depuis n'importe quelle page.
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    // "include" = envoyer le cookie de session avec la requête (sinon l'API ne sait pas qui on est)
    credentials: "include",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    // On renvoie le message d'erreur écrit par l'API (ex. "Courriel ou mot de passe incorrect.")
    throw new Error(data.error ?? "Une erreur est survenue. Réessayez.");
  }
  return data as T;
}
