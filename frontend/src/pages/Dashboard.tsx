import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import ProfileEditor from "../dashboard/ProfileEditor";
import ResourceEditor from "../dashboard/ResourceEditor";
import CvBuilder from "../dashboard/CvBuilder";
import AccountSettings from "../dashboard/AccountSettings";
import { RESOURCES } from "../dashboard/fields";
import "../auth.css";
import "../dashboard.css";

const TABS = [
  { id: "profile", label: "Profil" },
  { id: "experiences", label: "Expériences" },
  { id: "education", label: "Formations" },
  { id: "skills", label: "Compétences" },
  { id: "projects", label: "Projets" },
  { id: "cv", label: "Mon CV" },
  { id: "account", label: "Compte" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("profile");

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  if (!user) return null;
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="dash">
      <header className="dash-bar">
        <span className="dash-logo">tableau de bord</span>
        <div className="dash-bar-actions">
          <Link className="dash-view" to={`/p/${user.slug}`} target="_blank">
            Voir mon portfolio
          </Link>
          <button className="dash-logout" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      </header>

      <div className="dash-layout">
        <nav className="dash-tabs" aria-label="Sections du portfolio">
          <p className="dash-hello">Bonjour {user.full_name.split(" ")[0]} 👋</p>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={t.id === tab ? "is-active" : ""}
              aria-current={t.id === tab ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main className="dash-content">
          <h1>{current.label}</h1>
          {/* key={tab} : on recrée l'éditeur à chaque changement d'onglet */}
          {tab === "profile" ? (
            <ProfileEditor />
          ) : tab === "cv" ? (
            <CvBuilder />
          ) : tab === "account" ? (
            <AccountSettings />
          ) : (
            <ResourceEditor key={tab} config={RESOURCES[tab]} />
          )}
        </main>
      </div>
    </div>
  );
}
