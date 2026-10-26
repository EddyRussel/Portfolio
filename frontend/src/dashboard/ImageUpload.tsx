import { useRef, useState, type ChangeEvent } from "react";
import { api, API_URL } from "../api";
import { resizeImage, uploadImage } from "./imageApi";

type Props = {
  path: string; // adresse de l'API, ex. "/api/images/photo"
  version: number | null; // null = pas encore d'image
  shape: "portrait" | "wide"; // photo (4:5) ou capture d'écran (16:9)
  emptyLabel: string;
  compact?: boolean; // petite vignette (dans la liste des projets)
  onChange: () => void; // appelé après un envoi ou une suppression
};

// Téléversement d'une image : aperçu, "Choisir / Remplacer" et "Retirer"
export default function ImageUpload({ path, version, shape, emptyLabel, compact, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permet de rechoisir le même fichier
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choisis une image JPEG, PNG ou WebP.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await uploadImage(path, await resizeImage(file));
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Retirer cette image ?")) return;
    try {
      await api(path, { method: "DELETE" });
      onChange();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // ?v=version : une nouvelle image a une nouvelle adresse, le navigateur ne montre pas l'ancienne
  const src = version ? `${API_URL}${path}?v=${version}` : null;

  return (
    <div className={`image-upload ${compact ? "is-compact" : ""}`}>
      <div className={`image-frame image-${shape}`}>
        {src ? <img src={src} alt="" /> : <span>{busy ? "Envoi…" : emptyLabel}</span>}
      </div>
      <div className="image-actions">
        <button type="button" className="btn-ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? "Envoi…" : src ? "Remplacer" : "Choisir une image"}
        </button>
        {src && (
          <button type="button" className="btn-danger" onClick={remove}>
            Retirer
          </button>
        )}
      </div>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />
    </div>
  );
}
