import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";

export type User = {
  id: number;
  email: string;
  slug: string;
  full_name: string;
  is_public?: boolean;
};

type AuthContextValue = {
  user: User | null; // null = personne n'est connecté
  loading: boolean; // true pendant qu'on vérifie la session au démarrage
  login: (email: string, password: string) => Promise<void>;
  register: (
    full_name: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>; // relit l'utilisateur (après une modification du profil)
};

// Le "contexte" rend l'utilisateur connecté accessible dans TOUTES les pages,
// sans devoir le passer de composant en composant.
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Au démarrage de l'application : est-ce qu'on a déjà une session valide ?
  useEffect(() => {
    api<{ user: User }>("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const data = await api<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setUser(data.user);
  }

  async function register(full_name: string, email: string, password: string) {
    const data = await api<{ user: User }>("/api/auth/register", {
      method: "POST",
      body: { full_name, email, password },
    });
    setUser(data.user);
  }

  async function refreshUser() {
    const data = await api<{ user: User }>("/api/auth/me");
    setUser(data.user);
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Le "hook" à utiliser dans les pages : const { user, logout } = useAuth();
// (Il est volontairement dans le même fichier que AuthProvider : ils vont ensemble.)
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error(
      "useAuth doit être utilisé à l'intérieur de <AuthProvider>",
    );
  return context;
}
