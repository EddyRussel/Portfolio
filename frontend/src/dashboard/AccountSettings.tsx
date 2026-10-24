import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

// Onglet "Compte" : changer de mot de passe (RF-03) et supprimer son compte (RF-04)
export default function AccountSettings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // ----- Changement de mot de passe -----
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwNotice, setPwNotice] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPwError(null);
    setPwNotice(null);
    // Vérification faite dans le navigateur, avant même d'appeler l'API
    if (next !== confirm) {
      setPwError("Les deux nouveaux mots de passe ne sont pas identiques.");
      return;
    }
    setPwSaving(true);
    try {
      await api("/api/account/password", {
        method: "PUT",
        body: { current_password: current, new_password: next },
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      setPwNotice(
        "Mot de passe modifié. Tes autres appareils ont été déconnectés.",
      );
    } catch (err) {
      setPwError((err as Error).message);
    } finally {
      setPwSaving(false);
    }
  }

  // ----- Suppression du compte -----
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    setDeleteError(null);
    const ok = window.confirm(
      "Supprimer définitivement ton compte, ton portfolio et toutes tes données ? Cette action est irréversible.",
    );
    if (!ok) return;

    setDeleting(true);
    try {
      await api("/api/account", {
        method: "DELETE",
        body: { password: deletePassword },
      });
      await logout(); // oublie l'utilisateur côté frontend
      navigate("/register", { replace: true });
    } catch (err) {
      setDeleteError((err as Error).message);
      setDeleting(false);
    }
  }

  return (
    <div className="account">
      <section className="account-block">
        <h2>Mot de passe</h2>
        <p className="muted">Connecté avec {user?.email}</p>

        <form className="editor-form" onSubmit={changePassword} noValidate>
          {pwError && (
            <p className="alert alert-error" role="alert">
              {pwError}
            </p>
          )}
          {pwNotice && (
            <p className="alert alert-ok" role="status">
              {pwNotice}
            </p>
          )}
          <div className="editor-grid">
            <div className="field field-wide">
              <label htmlFor="current_password">Mot de passe actuel</label>
              <input
                id="current_password"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="new_password">Nouveau mot de passe</label>
              <input
                id="new_password"
                type="password"
                autoComplete="new-password"
                aria-describedby="new_password_hint"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <p id="new_password_hint" className="field-hint">
                8 caractères minimum.
              </p>
            </div>
            <div className="field">
              <label htmlFor="confirm_password">
                Confirmer le nouveau mot de passe
              </label>
              <input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>
          <div className="editor-actions">
            <button type="submit" className="btn-primary" disabled={pwSaving}>
              {pwSaving ? "Modification…" : "Changer le mot de passe"}
            </button>
          </div>
        </form>
      </section>

      <section className="account-block account-danger">
        <h2>Supprimer mon compte</h2>
        <p className="muted">
          Ton portfolio, ton CV et toutes tes données (profil, expériences,
          formations, compétences, projets) seront effacés définitivement.
        </p>
        <form onSubmit={deleteAccount} noValidate>
          {deleteError && (
            <p className="alert alert-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="field account-delete-field">
            <label htmlFor="delete_password">
              Confirme avec ton mot de passe
            </label>
            <input
              id="delete_password"
              type="password"
              autoComplete="current-password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn-delete"
            disabled={deleting || !deletePassword}
          >
            {deleting ? "Suppression…" : "Supprimer définitivement mon compte"}
          </button>
        </form>
      </section>
    </div>
  );
}
