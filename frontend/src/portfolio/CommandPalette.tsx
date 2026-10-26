import { useEffect, useRef, useState } from "react";

export type Command = { label: string; hint: string; run: () => void };

// ---------------------------------------------------------------------------
// Palette de commandes (Ctrl K) : on tape quelques lettres, on choisit avec
// les flèches et Entrée. Échap ferme la fenêtre.
// ---------------------------------------------------------------------------
export default function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  // Recherche sans tenir compte des accents ni des majuscules
  const simple = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const results = commands.filter((c) => simple(c.label).includes(simple(query.trim())));

  function choose(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") onClose();
    else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[selected]);
    } else if (event.key === "Tab") {
      event.preventDefault(); // le focus reste dans la palette
    }
  }

  return (
    <div className="pf-palette-backdrop" onMouseDown={onClose}>
      <div
        className="pf-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Aller à…"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          placeholder="Aller à une section, télécharger le CV…"
          aria-label="Rechercher une commande"
          role="combobox"
          aria-expanded="true"
          aria-controls="pf-palette-list"
          aria-activedescendant={results[selected] ? `pf-cmd-${selected}` : undefined}
        />
        <ul id="pf-palette-list" role="listbox">
          {results.map((command, i) => (
            <li
              key={command.label}
              id={`pf-cmd-${i}`}
              role="option"
              aria-selected={i === selected}
              className={i === selected ? "is-selected" : ""}
              onMouseEnter={() => setSelected(i)}
              onClick={() => choose(command)}
            >
              <span>{command.label}</span>
              <span className="pf-palette-hint">{command.hint}</span>
            </li>
          ))}
          {results.length === 0 && <li className="pf-palette-empty">Aucun résultat.</li>}
        </ul>
        <p className="pf-palette-help" aria-hidden="true">
          ↑↓ pour choisir · Entrée pour ouvrir · Échap pour fermer
        </p>
      </div>
    </div>
  );
}
