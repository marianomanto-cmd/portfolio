'use client';

import { useMemo, useState } from 'react';
import ScenarioChart, { SERIES_COLOR } from '@/components/ScenarioChart';
import { Card } from '@/components/ui';
import { bucketsFromPositions, runAll, totalOf, weightsOf } from '@/lib/engine';
import { fmtInt, fmtNum, fmtUsd } from '@/lib/format';
import { KIND_LABEL, KINDS, type Kind, type Position, type Settings } from '@/lib/types';

interface Props {
  positions: Position[];
  startMep: number;
  startDate: string;
  initialSettings: Settings;
  bondMaturity: string | null;
}

export default function EscenariosClient({
  positions, startMep, startDate, initialSettings, bondMaturity,
}: Props) {
  const [s, setS] = useState<Settings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = useMemo(() => weightsOf(bucketsFromPositions(positions)), [positions]);
  const startUsd = startMep > 0 ? totalOf(bucketsFromPositions(positions)) / startMep : 0;

  // El motor corre acá mismo: es puro, así que el número cambia mientras movés
  // los controles y es idéntico al que calcula el servidor para el memo.
  const results = useMemo(
    () => runAll({ positions, startMep, startDate, settings: s, bondMaturity }),
    [positions, startMep, startDate, s, bondMaturity],
  );

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    setS((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  const targetPct = (k: Kind) => Math.round((s.targetWeights[k] ?? 0) * 100);
  const targetSum = KINDS.reduce((a, k) => a + targetPct(k), 0);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(s),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'No se pudo guardar.');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  const field = 'w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm tnum outline-none focus:border-mut';

  return (
    <div className="space-y-3 pb-4">
      <Card>
        <h2 className="mb-3 text-sm font-semibold">Proyección en dólares</h2>
        <ScenarioChart results={results} />
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {(['oso', 'base', 'toro'] as const).map((id) => {
          const r = results.find((x) => x.spec.id === id);
          if (!r) return null;
          return (
            <div key={id} className="rounded-2xl border border-line bg-panel p-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: SERIES_COLOR[id] }}
                  aria-hidden="true"
                />
                <span className="text-xs text-mut">{r.spec.label}</span>
              </div>
              <p className="tnum mt-1 text-lg leading-tight font-semibold">{fmtInt(r.endUsd)}</p>
              <p className="text-[10px] text-mut">USD finales</p>
              <p className="mt-1 text-[10px] leading-tight text-mut">{r.spec.note}</p>
            </div>
          );
        })}
      </div>

      <Card>
        <h2 className="mb-1 text-sm font-semibold">De dónde sale</h2>
        <p className="text-xs text-mut">
          Arrancás con {fmtUsd(startUsd)} y ponés {fmtUsd(s.saveUsd * s.months)} en aportes a lo
          largo de {s.months} meses. La diferencia contra el total la pone (o la saca) el mercado.
        </p>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold">Supuestos</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-mut">Aporte USD/mes</span>
            <input type="number" inputMode="decimal" value={s.saveUsd} className={field}
              onChange={(e) => set('saveUsd', Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mut">Meses</span>
            <input type="number" inputMode="numeric" value={s.months} className={field}
              onChange={(e) => set('months', Math.max(1, Math.round(Number(e.target.value) || 1)))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mut">USA anual % (base)</span>
            <input type="number" inputMode="decimal" value={s.usAnn} className={field}
              onChange={(e) => set('usAnn', Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mut">Tasa pesos anual %</span>
            <input type="number" inputMode="decimal" value={s.arsAnn} className={field}
              onChange={(e) => set('arsAnn', Number(e.target.value))} />
          </label>
        </div>
        <p className="mt-2 text-xs text-mut">
          Oso y toro están fijos (MEP 2600 / USA −12% y MEP 1900 / USA +22%). El MEP de partida es
          el del corte: {fmtNum(startMep)}.
        </p>
      </Card>

      <Card>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Mix objetivo</h2>
          <label className="flex items-center gap-2 text-xs text-mut">
            <input type="checkbox" checked={s.rebalance}
              onChange={(e) => set('rebalance', e.target.checked)} />
            Rebalancear
          </label>
        </div>
        <p className="mb-3 text-xs text-mut">
          {s.rebalance
            ? 'Con rebalanceo, cada mes la cartera se lleva al mix del glide path.'
            : 'Sin rebalanceo, sólo el aporte nuevo empuja hacia el objetivo.'}
        </p>

        {KINDS.map((k) => (
          <div key={k} className="flex items-center gap-3 py-1">
            <span className="w-20 shrink-0 text-sm text-mut">{KIND_LABEL[k]}</span>
            <span className="tnum w-12 shrink-0 text-right text-xs text-mut">
              {Math.round(current[k] * 100)}%
            </span>
            <input
              type="range" min={0} max={100} step={5} value={targetPct(k)}
              className="min-w-0 flex-1 accent-amber-400"
              onChange={(e) =>
                set('targetWeights', { ...s.targetWeights, [k]: Number(e.target.value) / 100 })
              }
            />
            <span className="tnum w-10 shrink-0 text-right text-sm">{targetPct(k)}%</span>
          </div>
        ))}
        <p className="mt-2 text-xs text-mut">
          Primera columna: cómo está hoy. Suma del objetivo: {targetSum}%
          {targetSum === 0
            ? ' — sin objetivo, el motor mantiene el mix actual.'
            : targetSum !== 100
              ? ' — se normaliza a 100 al correr.'
              : '.'}
        </p>
      </Card>

      {error ? <p className="px-1 text-sm text-down">{error}</p> : null}

      <button
        type="button" onClick={() => void save()} disabled={saving}
        className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-ink disabled:opacity-40"
      >
        {saving ? 'Guardando…' : saved ? 'Guardado' : 'Guardar supuestos'}
      </button>
    </div>
  );
}
