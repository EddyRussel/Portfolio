import { useEffect, useState } from "react";
import { Routes, Route, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type Health = { status: string; postgres?: string; redis?: string };

function Home() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ status: "error" }));
  }, []);

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 720, margin: "2rem auto" }}>
      <h1>Portfolio professionnel de Eddy Russel </h1>
      <p>Socle de départ : React + Vite + Express + PostgreSQL + Redis.</p>
      <h2>État des services</h2>
      <pre>{JSON.stringify(health, null, 2)}</pre>
      <p>
        <Link to="/p/demo-etudiant">Voir le portfolio de démonstration</Link>
      </p>
    </main>
  );
}

function PublicPortfolio() {
  // TODO (étudiants) : récupérer /api/public/:slug et afficher toutes les sections
  return <main style={{ fontFamily: "sans-serif", margin: "2rem" }}>Portfolio public à implémenter</main>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/p/:slug" element={<PublicPortfolio />} />
      {/* TODO : /login, /register, /dashboard */}
    </Routes>
  );
}
