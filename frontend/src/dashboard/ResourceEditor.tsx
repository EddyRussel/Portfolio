import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import FormField from "./FormField";
import type { Item, ResourceConfig } from "./fields";

// ---------------------------------------------------------------------------
// Éditeur générique : liste + ajout + modification + suppression + réordonnancement.
// Le même composant sert pour les expériences, formations, compétences et projets :
// seule la "config" (les champs, l'adresse de l'API...) change.
// ---------------------------------------------------------------------------

type FormValues = Record<string, string>;

// Élément de l'API -> valeurs du formulaire (tout en texte)
function toForm(config: ResourceConfig, item?: Item): FormValues {
  const values: FormValues = {};
  for (const field of config.fields) {
    const raw = item?.[field.name];
    if (field.type === "tags")
      values[field.name] = Array.isArray(raw) ? raw.join(", ") : "";
    else
      values[field.name] = raw === null || raw === undefined ? "" : String(raw);
  }
  return values;
}

// Valeurs du formulaire -> données envoyées à l'API
function toPayload(
  config: ResourceConfig,
  values: FormValues,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of config.fields) {
    const value = values[field.name] ?? "";
    payload[field.name] =
      field.type === "tags"
        ? value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : value;
  }
  return payload;
}

export default function ResourceEditor({ config }: { config: ResourceConfig }) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | "new" | null>(null); // id en cours de modification
  const [values, setValues] = useState<FormValues>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Chargement de la liste (à chaque changement d'onglet)
  useEffect(() => {
    setLoading(true);
    setEditing(null);
    setNotice(null);
    api<Item[]>(config.path)
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [config]);

  function startEdit(item?: Item) {
    setEditing(item ? item.id : "new");
    setValues(toForm(config, item));
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(config, values);
      if (editing === "new") {
        const created = await api<Item>(config.path, {
          method: "POST",
          body: payload,
        });
        setItems((list) => [...list, created]);
        setNotice("Ajouté.");
      } else {
        const updated = await api<Item>(`${config.path}/${editing}`, {
          method: "PUT",
          body: payload,
        });
        setItems((list) =>
          list.map((i) => (i.id === updated.id ? updated : i)),
        );
        setNotice("Modifications enregistrées.");
      }
      setEditing(null);
    } catch (err) {
      setError((err as Error).message); // message de l'API, ex. "Le poste est obligatoire."
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: Item) {
    if (
      !window.confirm(
        `Supprimer « ${config.title(item)} » ? Cette action est définitive.`,
      )
    )
      return;
    try {
      await api(`${config.path}/${item.id}`, { method: "DELETE" });
      setItems((list) => list.filter((i) => i.id !== item.id));
      setNotice("Supprimé.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  // Monter (-1) ou descendre (+1) un élément, puis envoyer le nouvel ordre à l'API
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    setItems(reordered); // affichage immédiat, sans attendre l'API
    try {
      await api(`${config.path}/reorder`, {
        method: "PUT",
        body: { ids: reordered.map((i) => i.id) },
      });
    } catch (err) {
      setItems(items); // en cas d'échec, on remet l'ancien ordre
      setError((err as Error).message);
    }
  }

  const form = (
    <form className="editor-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      <div className="editor-grid">
        {config.fields.map((field) => (
          <FormField
            key={field.name}
            field={field}
            value={values[field.name] ?? ""}
            onChange={(v) =>
              setValues((current) => ({ ...current, [field.name]: v }))
            }
          />
        ))}
      </div>
      <div className="editor-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving
            ? "Enregistrement…"
            : editing === "new"
              ? "Ajouter"
              : "Enregistrer"}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            setEditing(null);
            setError(null);
          }}
        >
          Annuler
        </button>
      </div>
    </form>
  );

  if (loading) return <p className="muted">Chargement…</p>;

  return (
    <div>
      {/* Pendant une modification, l'erreur s'affiche dans le formulaire (juste au-dessus des champs) */}
      {error && editing === null && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="alert alert-ok" role="status">
          {notice}
        </p>
      )}

      {items.length === 0 && editing !== "new" && (
        <p className="muted">{config.empty}</p>
      )}

      <ol className="items">
        {items.map((item, index) => (
          <li
            key={item.id}
            className={`item ${editing === item.id ? "is-editing" : ""}`}
          >
            {editing === item.id ? (
              form
            ) : (
              <>
                <div className="item-text">
                  <strong>{config.title(item)}</strong>
                  <span>{config.subtitle(item)}</span>
                </div>
                <div className="item-actions">
                  <button
                    className="icon-btn"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Monter « ${config.title(item)} »`}
                  >
                    ↑
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label={`Descendre « ${config.title(item)} »`}
                  >
                    ↓
                  </button>
                  <button className="btn-ghost" onClick={() => startEdit(item)}>
                    Modifier
                  </button>
                  <button
                    className="btn-danger"
                    onClick={() => handleDelete(item)}
                  >
                    Supprimer
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ol>

      {editing === "new" ? (
        <div className="item is-editing">{form}</div>
      ) : (
        <button className="btn-add" onClick={() => startEdit()}>
          + Ajouter {config.singular}
        </button>
      )}
    </div>
  );
}
