import { Navigate, Route, Routes } from "react-router-dom";
import PublicPortfolio from "./PublicPortfolio";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import RequireAuth from "./RequireAuth";

// Le portfolio affiché quand on arrive sur l'adresse principale du site.
// (Modifiable sans toucher au code avec la variable d'environnement VITE_HOME_SLUG.)
const HOME_SLUG = import.meta.env.VITE_HOME_SLUG ?? "eddy-russel-ngoue";

export default function App() {
  return (
    <Routes>
      {/* L'adresse principale mène directement au portfolio */}
      <Route path="/" element={<Navigate to={`/p/${HOME_SLUG}`} replace />} />
      <Route path="/p/:slug" element={<PublicPortfolio />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      {/* Page protégée : RequireAuth redirige vers /login si on n'est pas connecté */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      {/* Toute adresse inconnue renvoie aussi au portfolio */}
      <Route path="*" element={<Navigate to={`/p/${HOME_SLUG}`} replace />} />
    </Routes>
  );
}
