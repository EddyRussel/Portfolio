import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import "../auth.css";

export default function Register() {
    const { user, register } = useAuth();
    const navigate = useNavigate();
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    if (user) return <Navigate to="/dashboard" replace />;

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await register(fullName, email, password);
            navigate("/dashboard", { replace: true });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="auth-page">
            <form className="auth-card" onSubmit={handleSubmit} noValidate>
                <h1>Créer un compte</h1>
                <p className="auth-intro">Ton portfolio sera privé tant que tu ne le rends pas public.</p>

                {error && (
                    <p className="auth-error" role="alert">
                        {error}
                    </p>
                )}

                <label htmlFor="full_name">Nom complet</label>
                <input
                    id="full_name"
                    autoComplete="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                />

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
                    autoComplete="new-password"
                    aria-describedby="password-hint"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <p id="password-hint" className="auth-hint">
                    8 caractères minimum.
                </p>

                <button type="submit" disabled={submitting}>
                    {submitting ? "Création du compte…" : "Créer mon compte"}
                </button>

                <p className="auth-switch">
                    Déjà un compte ? <Link to="/login">Se connecter</Link>
                </p>
            </form>
        </main>
    );
}
