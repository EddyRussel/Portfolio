import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import FormField from "./FormField";
import type { Field } from "./fields";

type Profile = Record<string, string | boolean | null> & { is_public: boolean; slug: string };

const PROFILE_FIELDS: Field[] = [
  { name: "full_name", label: "Nom complet", type: "text", required: true },
  { name: "headline", label: "Titre professionnel", type: "text" },
  { name: "city", label: "Ville", type: "text" },
  { name: "phone", label: "Téléphone", type: "text", hint: "Privé : n'apparaît pas sur ton portfolio public." },
  { name: "bio", label: "Présentation", type: "textarea", wide: true },
  { name: "linkedin_url", label: "LinkedIn", type: "url" },
  { name: "github_url", label: "GitHub", type: "url" },
  { name: "website_url", label: "Site web", type: "url" },
  { name: "photo_url", label: "Photo (lien)", type: "url" },
];

export default function ProfileEditor() {
  const { refreshUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Profile>("/api/profile")
      .then((data) => {
        setProfile(data);
        const initial: Record<string, string> = {};
        for (const f of PROFILE_FIELDS) initial[f.name] = (data[f.name] as string | null) ?? "";
        setValues(initial);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await api("/api/profile", { method: "PUT", body: values });
      await refreshUser(); // le nom a peut-être changé : on met à jour l'en-tête
      setNotice("Profil enregistré.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Interrupteur public / privé (RF-11)
  async function toggleVisibility() {
    if (!profile) return;
    try {
      const data = await api<{ is_public: boolean }>("/api/profile/visibility", {
        method: "PATCH",
        body: { is_public: !profile.is_public },
      });
      setProfile({ ...profile, is_public: data.is_public });
      await refreshUser();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!profile) return error ? <p className="alert alert-error">{error}</p> : <p className="muted">Chargement…</p>;

  return (
    <div>
      <div className="visibility">
        <div>
          <strong>{profile.is_public ? "Portfolio public" : "Portfolio privé"}</strong>
          <span>
            {profile.is_public
              ? `Tout le monde peut le voir à l'adresse /p/${profile.slug}.`
              : "Personne d'autre que toi ne peut le voir."}
          </span>
        </div>
        <button
          className={`switch ${profile.is_public ? "is-on" : ""}`}
          role="switch"
          aria-checked={profile.is_public}
          aria-label="Portfolio public"
          onClick={toggleVisibility}
        >
          <span />
        </button>
      </div>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert alert-ok" role="status">
          {notice}
        </p>
      )}

      <form className="editor-form" onSubmit={handleSubmit} noValidate>
        <div className="editor-grid">
          {PROFILE_FIELDS.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={values[field.name] ?? ""}
              onChange={(v) => setValues((current) => ({ ...current, [field.name]: v }))}
            />
          ))}
        </div>
        <div className="editor-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer le profil"}
          </button>
        </div>
      </form>
    </div>
  );
}
