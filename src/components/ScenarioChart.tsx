'use client';

import { useId, useState } from 'react';
import type { ScenarioResult } from '@/lib/engine';
import { fmtUsd } from '@/lib/format';

// Slots 1-3 de la paleta categórica de referencia, escalonados para fondo
// oscuro. Validados contra la superficie #131519: separación CVD y contraste
// pasan en adyacentes y en todos los pares.
export const SERIES_COLOR: Record<string, string> = {
  base: '#3987e5',
  oso: '#d95926',
  toro: '#199e70',
};

// El orden es fijo: el color sigue al escenario, no a su posición en pantalla.
const ORDER = ['base', 'oso', 'toro'] as const;

const W = 340;
const H = 190;
const PAD = { top: 12, right: 46, bottom: 22, left: 44 };

const nice = (n: number) => {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, n))));
  return Math.ceil(n / pow) * pow;
};

export default function ScenarioChart({ results }: { results: ScenarioResult[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const clipId = useId();

  const ordered = ORDER.map((id) => results.find((r) => r.spec.id === id)).filter(
    (r): r is ScenarioResult => Boolean(r),
  );
  if (ordered.length === 0) return null;

  const months = ordered[0].series.length;
  const maxUsd = nice(Math.max(...ordered.flatMap((r) => r.series.map((p) => p.totalUsd))));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (months <= 1 ? 0 : (i / (months - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / maxUsd) * plotH;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxUsd * f);
  const compact = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / plotW) * (months - 1));
    setHover(i >= 0 && i < months ? i : null);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        {/* Leyenda siempre presente: la identidad nunca depende sólo del color. */}
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {ordered.map((r) => (
            <li key={r.spec.id} className="flex items-center gap-1.5 text-xs text-mut">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: SERIES_COLOR[r.spec.id] }}
                aria-hidden="true"
              />
              {r.spec.label}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setTable((v) => !v)}
          className="shrink-0 text-xs text-mut underline underline-offset-4"
        >
          {table ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </div>

      {table ? (
        <div className="max-h-64 overflow-auto rounded-lg border border-line">
          <table className="tnum w-full text-xs">
            <thead className="sticky top-0 bg-panel text-mut">
              <tr>
                <th className="p-2 text-left font-normal">Mes</th>
                {ordered.map((r) => (
                  <th key={r.spec.id} className="p-2 text-right font-normal">{r.spec.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordered[0].series.map((p, i) => (
                <tr key={p.month} className="border-t border-line">
                  <td className="p-2 text-mut">{p.label}</td>
                  {ordered.map((r) => (
                    <td key={r.spec.id} className="p-2 text-right">
                      {fmtUsd(r.series[i].totalUsd)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          role="img"
          aria-label="Total en dólares por mes, en los tres escenarios"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
            </clipPath>
          </defs>

          {/* Grilla recesiva. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
                stroke="#23262d" strokeWidth="1"
              />
              <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#8b93a1">
                {compact(t)}
              </text>
            </g>
          ))}

          <text x={PAD.left} y={H - 6} fontSize="9" fill="#8b93a1">
            {ordered[0].series[0].label}
          </text>
          <text x={W - PAD.right} y={H - 6} textAnchor="end" fontSize="9" fill="#8b93a1">
            {ordered[0].series[months - 1].label}
          </text>

          {hover != null ? (
            <line
              x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH}
              stroke="#8b93a1" strokeWidth="1" strokeDasharray="3 3"
            />
          ) : null}

          <g clipPath={`url(#${clipId})`}>
            {ordered.map((r) => (
              <polyline
                key={r.spec.id}
                fill="none"
                stroke={SERIES_COLOR[r.spec.id]}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={r.series.map((p, i) => `${x(i)},${y(p.totalUsd)}`).join(' ')}
              />
            ))}
          </g>

          {/* Etiqueta directa al final de cada línea: identidad sin leer la leyenda. */}
          {ordered.map((r) => (
            <text
              key={r.spec.id}
              x={W - PAD.right + 4}
              y={y(r.series[months - 1].totalUsd) + 3}
              fontSize="9"
              fill="#8b93a1"
            >
              {r.spec.label}
            </text>
          ))}

          {hover != null
            ? ordered.map((r) => (
                <circle
                  key={r.spec.id}
                  cx={x(hover)} cy={y(r.series[hover].totalUsd)} r="4"
                  fill={SERIES_COLOR[r.spec.id]}
                  stroke="#131519" strokeWidth="2"
                />
              ))
            : null}
        </svg>
      )}

      {hover != null && !table ? (
        <div className="mt-2 rounded-lg border border-line bg-ink px-3 py-2">
          <p className="mb-1 text-xs text-mut">{ordered[0].series[hover].label}</p>
          {ordered.map((r) => (
            <div key={r.spec.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-mut">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: SERIES_COLOR[r.spec.id] }}
                  aria-hidden="true"
                />
                {r.spec.label}
              </span>
              <span className="tnum">{fmtUsd(r.series[hover].totalUsd)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
