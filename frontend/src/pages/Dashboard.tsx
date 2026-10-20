import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import "../auth.css";

// Tableau de bord (version de départ) : on le remplira avec la gestion du contenu.
export default function Dashboard() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    async function handleLogout() {
        await logout();
        navigate("/login", { replace: true });
    }

    if (!user) return null;

    return (
        <div className="dash">
            <header className="dash-bar">
                <span className="dash-logo">tableau de bord</span>
                <button className="dash-logout" onClick={handleLogout}>
                    Se déconnecter
                </button>
            </header>

            <main className="dash-main">
                <h1>Bonjour {user.full_name.split(" ")[0]} 👋</h1>
                <p className="auth-intro">Connecté avec {user.email}</p>

                <section className="dash-card">
                    <h2>Mon portfolio</h2>
                    <p>
                        Adresse publique : <code>/p/{user.slug}</code>
                        {" — "}
                        {user.is_public ? "visible par tout le monde" : "privé pour le moment"}
                    </p>
                    <Link className="dash-link" to={`/p/${user.slug}`}>
                        Voir mon portfolio
                    </Link>
                </section>

                <section className="dash-card dash-todo">
                    <h2>Bientôt ici</h2>
                    <p>Modifier mon profil, mes expériences, formations, compétences et projets, puis générer mon CV en PDF.</p>
                </section>
            </main>
        </div>
    );
}
