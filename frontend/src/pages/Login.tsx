import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import "../auth.css";

export default function Login() {
    const { user, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Déjà connecté ? On va directement au tableau de bord
    if (user) return <Navigate to="/dashboard" replace />;

    async function handleSubmit(event: FormEvent) {
        event.preventDefault(); // empêche le rechargement de la page
        setError(null);
        setSubmitting(true);
        try {
            await login(email, password);
            // On revient à la page demandée avant la connexion, sinon au tableau de bord
            const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
            navigate(from, { replace: true });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="auth-page">
            <form className="auth-card" onSubmit={handleSubmit} noValidate>
                <h1>Connexion</h1>
                <p className="auth-intro">Accède à ton tableau de bord pour gérer ton portfolio.</p>

                {error && (
                    <p className="auth-error" role="alert">
                        {error}
                    </p>
                )}

                <label htmlFor="email">Courriel</label>
                <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <label htmlFor="password">Mot de passe</label>
                <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <button type="submit" disabled={submitting}>
                    {submitting ? "Connexion…" : "Se connecter"}
                </button>

                <p className="auth-switch">
                    Pas encore de compte ? <Link to="/register">Créer un compte</Link>
                </p>
            </form>
        </main>
    );
}
