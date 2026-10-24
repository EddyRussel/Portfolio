import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { api, API_URL } from "../api";
import { useAuth } from "../auth";

// ---------------------------------------------------------------------------
// "CV pour les visiteurs" : le PDF que les visiteurs du portfolio peuvent télécharger.
// On peut téléverser son propre fichier, ou publier le CV généré (bouton dans CvBuilder).
// ---------------------------------------------------------------------------

export type CvFileInfo = {
  file_name: string;
  size_bytes: number;
  is_public: boolean;
  uploaded_at: string;
} | null;

// Envoie un PDF à l'API (utilisé ici et par le bouton "Publier ce CV" du générateur)
export async function uploadCvFile(file: Blob, fileName: string): Promise<CvFileInfo> {
  const response = await fetch(`${API_URL}/api/cv-file`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/pdf",
      "X-File-Name": encodeURIComponent(fileName), // les en-têtes HTTP n'acceptent pas les accents
    },
    body: file, // le fichier tel quel, sans transformation
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Le téléversement a échoué.");
  return data;
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} Ko` : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

export default function CvFileManager({ reloadKey }: { reloadKey: number }) {
  const { user } = useAuth();
  const [info, setInfo] = useState<CvFileInfo>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // reloadKey change quand le générateur publie un CV : on relit les infos
  useEffect(() => {
    api<CvFileInfo>("/api/cv-file")
      .then(setInfo)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoaded(true));
  }, [reloadKey]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permet de rechoisir le même fichier plus tard
    if (!file) return;
    setError(null);
    // Vérifications rapides côté navigateur (l'API vérifie aussi, c'est elle qui fait foi)
    if (file.type !== "application/pdf") return setError("Choisis un fichier PDF.");
    if (file.size > 5 * 1024 * 1024) return setError("Fichier trop volumineux (5 Mo maximum).");

    setBusy(true);
    try {
      setInfo(await uploadCvFile(file, file.name));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (!info) return;
    try {
      setInfo(await api<CvFileInfo>("/api/cv-file", { method: "PATCH", body: { is_public: !info.is_public } }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove() {
    if (!window.confirm("Retirer ce CV ? Les visiteurs ne pourront plus le télécharger.")) return;
    try {
      await api("/api/cv-file", { method: "DELETE" });
      setInfo(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!loaded) return null;

  return (
    <section className="cv-file">
      <div className="cv-file-head">
        <div>
          <h2>CV pour les visiteurs</h2>
          <p className="muted">
            Le PDF que les visiteurs de ton portfolio peuvent télécharger. Téléverse ton propre fichier, ou publie le CV
            généré plus bas.
          </p>
        </div>
        {info && (
          <button
            className={`switch ${info.is_public ? "is-on" : ""}`}
            role="switch"
            aria-checked={info.is_public}
            aria-label="Autoriser le téléchargement par les visiteurs"
            onClick={toggle}
          >
            <span />
          </button>
        )}
      </div>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      {info ? (
        <div className="cv-file-current">
          <div className="item-text">
            <strong>{info.file_name}</strong>
            <span>
              {formatSize(info.size_bytes)} — mis en ligne le{" "}
              {new Date(info.uploaded_at).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}
              {" — "}
              {info.is_public ? "téléchargeable sur ton portfolio" : "masqué aux visiteurs"}
            </span>
          </div>
          <div className="item-actions">
            {user && info.is_public && (
              <a className="btn-ghost" href={`${API_URL}/api/public/${user.slug}/cv`}>
                Tester
              </a>
            )}
            <button className="btn-ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
              Remplacer
            </button>
            <button className="btn-danger" onClick={remove}>
              Retirer
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-add" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? "Téléversement…" : "+ Téléverser mon CV (PDF, 5 Mo max)"}
        </button>
      )}

      {/* Le vrai sélecteur de fichier est caché : les boutons ci-dessus l'ouvrent */}
      <input ref={inputRef} type="file" accept="application/pdf" hidden onChange={handleFile} />
    </section>
  );
}
