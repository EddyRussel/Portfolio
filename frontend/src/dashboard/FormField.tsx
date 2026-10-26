import type { Field } from "./fields";

// Affiche UN champ de formulaire selon son type (texte, zone de texte, mois, liste...)
export default function FormField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `field-${field.name}`;
  const hintId = field.hint ? `${id}-hint` : undefined;
  const common = {
    id,
    value,
    required: field.required,
    "aria-describedby": hintId,
  };

  return (
    <div className={`field ${field.wide ? "field-wide" : ""}`}>
      <label htmlFor={id}>
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>

      {field.type === "textarea" || field.type === "lines" || field.type === "pairs" ? (
        <textarea {...common} rows={field.type === "textarea" ? 4 : 5} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "select" ? (
        <select {...common} onChange={(e) => onChange(e.target.value)}>
          {!field.required ? null : <option value="">Choisir…</option>}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          {...common}
          type={field.type === "month" ? "month" : field.type === "url" ? "url" : "text"}
          placeholder={field.type === "month" ? "AAAA-MM" : field.type === "url" ? "https://" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.hint && (
        <p id={hintId} className="field-hint">
          {field.hint}
        </p>
      )}
    </div>
  );
}
