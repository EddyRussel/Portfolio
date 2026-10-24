import { useEffect, useState } from "react";
import { api } from "../api";

// ---------------------------------------------------------------------------
// Onglet "Statistiques" : visites du portfolio sur les 30 derniers jours.
// Les données viennent de PostgreSQL, alimenté chaque minute par les compteurs Redis.
// ---------------------------------------------------------------------------

type Day = { day: string; views: number; unique_visitors: number; cv_downloads: number };
type Stats = { days: Day[]; totals: { views: number; unique_visitors: number; cv_downloads: number } };

// "2026-10-23" -> "23 oct."
function shortDate(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}
function longDate(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
}

// Graphique en barres : une barre par jour, dessinée en SVG (pas de bibliothèque)
function VisitsChart({ days }: { days: Day[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 720;
  const height = 220;
  const pad = { top: 16, right: 8, bottom: 26, left: 32 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Échelle verticale : arrondie à un nombre "rond" pour des graduations lisibles
  const max = Math.max(4, ...days.map((d) => d.views));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const y = (value: number) => pad.top + plotH - (value / top) * plotH;

  const slot = plotW / days.length;
  const barW = Math.min(18, slot - 2); // barres fines, avec de l'air entre elles
  const x = (i: number) => pad.left + i * slot + (slot - barW) / 2;

  const point = hovered !== null ? days[hovered] : null;

  return (
    // chart-scroll : sur petit écran, le graphique défile dans son cadre au lieu de rapetisser
    <div className="chart-scroll">
      <div className="chart">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Visites par jour sur les 30 derniers jours">
          {/* Grille horizontale discrète + graduations */}
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line className="chart-grid" x1={pad.left} x2={width - pad.right} y1={y(step * i)} y2={y(step * i)} />
              <text className="chart-tick" x={pad.left - 8} y={y(step * i)} dy="0.32em" textAnchor="end">
                {step * i}
              </text>
            </g>
          ))}

          {days.map((d, i) => {
            const h = Math.max(0, y(0) - y(d.views));
            const r = Math.min(4, h / 2); // coins arrondis en haut seulement, carrés à la base
            const bx = x(i);
            const by = y(d.views);
            return (
              <g key={d.day}>
                {h > 0 && (
                  <path
                    className={`chart-bar ${hovered === i ? "is-hovered" : ""}`}
                    d={`M${bx},${y(0)} V${by + r} Q${bx},${by} ${bx + r},${by} H${bx + barW - r} Q${bx + barW},${by} ${bx + barW},${by + r} V${y(0)} Z`}
                  />
                )}
                {/* Zone de survol invisible, plus large que la barre */}
                <rect
                  x={pad.left + i * slot}
                  y={pad.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              </g>
            );
          })}

          {/* Dates : une sur cinq, pour ne pas surcharger */}
          {days.map((d, i) =>
            i % 5 === 4 || i === days.length - 1 ? (
              <text key={d.day} className="chart-tick" x={x(i) + barW / 2} y={height - 6} textAnchor="middle">
                {shortDate(d.day)}
              </text>
            ) : null,
          )}
          <line className="chart-axis" x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} />
        </svg>

        {/* Infobulle au survol */}
        {point && hovered !== null && (
          <div className="chart-tooltip" style={{ left: `${((x(hovered) + barW / 2) / width) * 100}%` }} role="status">
            <strong>{longDate(point.day)}</strong>
            <span>
              {point.views} visite{point.views > 1 ? "s" : ""}
            </span>
            <span>
              {point.unique_visitors} visiteur{point.unique_visitors > 1 ? "s" : ""} unique
              {point.unique_visitors > 1 ? "s" : ""}
            </span>
            <span>
              {point.cv_downloads} téléchargement{point.cv_downloads > 1 ? "s" : ""} du CV
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StatsPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Stats>("/api/stats")
      .then(setStats)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p className="alert alert-error">{error}</p>;
  if (!stats) return <p className="muted">Chargement…</p>;

  const todayStats = stats.days[stats.days.length - 1];
  const tiles = [
    { label: "Visites", value: stats.totals.views, hint: "sur 30 jours" },
    { label: "Visiteurs uniques", value: stats.totals.unique_visitors, hint: "additionnés jour par jour" },
    { label: "CV téléchargés", value: stats.totals.cv_downloads, hint: "sur 30 jours" },
    { label: "Aujourd'hui", value: todayStats.views, hint: `visite${todayStats.views > 1 ? "s" : ""}` },
  ];

  return (
    <div className="stats-panel">
      <div className="stat-tiles">
        {tiles.map((t) => (
          <div key={t.label} className="stat-tile">
            <span className="stat-label">{t.label}</span>
            <strong>{t.value}</strong>
            <span className="stat-hint">{t.hint}</span>
          </div>
        ))}
      </div>

      <section className="stats-chart-block">
        <h2>Visites par jour</h2>
        {stats.totals.views === 0 ? (
          <p className="muted">
            Aucune visite pour l'instant. Partage l'adresse de ton portfolio : les visites apparaîtront ici. Tes propres
            visites, quand tu es connecté, ne sont pas comptées.
          </p>
        ) : (
          <VisitsChart days={stats.days} />
        )}
      </section>

      {/* Les mêmes données en tableau (accessibilité : lecteurs d'écran, lecture précise) */}
      <details className="stats-table">
        <summary>Voir les données en tableau</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Jour</th>
              <th scope="col">Visites</th>
              <th scope="col">Visiteurs uniques</th>
              <th scope="col">CV téléchargés</th>
            </tr>
          </thead>
          <tbody>
            {[...stats.days].reverse().map((d) => (
              <tr key={d.day}>
                <td>{longDate(d.day)}</td>
                <td>{d.views}</td>
                <td>{d.unique_visitors}</td>
                <td>{d.cv_downloads}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <p className="field-hint">
        Une visite = une personne qui consulte ton portfolio (si elle revient dans les 30 minutes, c'est la même
        visite). Tes propres visites ne comptent pas. Aucune adresse IP n'est enregistrée.
      </p>
    </div>
  );
}
