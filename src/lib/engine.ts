// Motor determinístico. No hay azar, no hay red, no hay modelo.
// El asesor lee estos números; no los recalcula.

import { KINDS, type Kind, type Position, type Settings } from './types';

export const SCENARIO_IDS = ['oso', 'base', 'toro'] as const;
export type ScenarioId = (typeof SCENARIO_IDS)[number];

export interface ScenarioSpec {
  id: ScenarioId;
  label: string;
  mepTerminal: number;
  usAnn: number;
  note: string;
}

/** Oso y toro están fijos. El base toma el retorno USA de settings. */
export function scenarioSpecs(usAnnBase: number): ScenarioSpec[] {
  const s = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}%`;
  return [
    { id: 'oso', label: 'Oso', mepTerminal: 2600, usAnn: -12, note: `MEP 2600, USA ${s(-12)}` },
    { id: 'base', label: 'Base', mepTerminal: 2200, usAnn: usAnnBase, note: `MEP 2200, USA ${s(usAnnBase)}` },
    { id: 'toro', label: 'Toro', mepTerminal: 1900, usAnn: 22, note: `MEP 1900, USA ${s(22)}` },
  ];
}

export type Buckets = Record<Kind, number>;

const emptyBuckets = (): Buckets =>
  ({ fondo: 0, bono: 0, cedear: 0, usd: 0, ars: 0 });

export function bucketsFromPositions(positions: Position[]): Buckets {
  const b = emptyBuckets();
  for (const p of positions) b[p.kind] += p.arsValue;
  return b;
}

export const totalOf = (b: Buckets): number =>
  KINDS.reduce((acc, k) => acc + b[k], 0);

export function weightsOf(b: Buckets): Buckets {
  const total = totalOf(b);
  const w = emptyBuckets();
  if (total <= 0) return w;
  for (const k of KINDS) w[k] = b[k] / total;
  return w;
}

/** Normaliza a que sume 1. Si viene vacío devuelve null. */
function normalize(weights: Partial<Record<Kind, number>>): Buckets | null {
  const sum = KINDS.reduce((acc, k) => acc + Math.max(0, weights[k] ?? 0), 0);
  if (sum <= 0) return null;
  const out = emptyBuckets();
  for (const k of KINDS) out[k] = Math.max(0, weights[k] ?? 0) / sum;
  return out;
}

const monthlyRate = (annualPct: number): number =>
  Math.pow(1 + annualPct / 100, 1 / 12);

function addMonths(iso: string, months: number): Date {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  const target = new Date(d);
  target.setUTCMonth(target.getUTCMonth() + months);
  return target;
}

export interface MonthPoint {
  month: number;
  label: string;
  mep: number;
  buckets: Buckets;
  totalArs: number;
  totalUsd: number;
}

export interface ScenarioResult {
  spec: ScenarioSpec;
  series: MonthPoint[];
  startArs: number;
  startUsd: number;
  endArs: number;
  endUsd: number;
  contributedUsd: number;
  /** USD finales menos (USD iniciales + aportes). Lo que puso el mercado. */
  gainUsd: number;
  endWeights: Buckets;
}

export interface EngineInput {
  positions: Position[];
  startMep: number;
  startDate: string;
  settings: Settings;
  /** Vencimiento del bono en cartera. Después de esa fecha pasa a liquidez. */
  bondMaturity?: string | null;
}

export function runScenario(input: EngineInput, spec: ScenarioSpec): ScenarioResult {
  const { settings, startMep, startDate } = input;
  const months = Math.max(1, Math.round(settings.months));

  let buckets = bucketsFromPositions(input.positions);
  const startArs = totalOf(buckets);
  const startUsd = startMep > 0 ? startArs / startMep : 0;

  const w0 = weightsOf(buckets);
  const target = normalize(settings.targetWeights) ?? w0;

  const usMonthly = monthlyRate(spec.usAnn);
  const arsMonthly = monthlyRate(settings.arsAnn);
  const maturity = input.bondMaturity
    ? new Date(`${input.bondMaturity.slice(0, 10)}T12:00:00Z`)
    : null;

  const series: MonthPoint[] = [];
  let prevMep = startMep;
  let bondMatured = false;

  for (let t = 1; t <= months; t++) {
    // El MEP interpola lineal del corte de hoy al del escenario.
    const mep = startMep + (spec.mepTerminal - startMep) * (t / months);
    const mepGrowth = prevMep > 0 ? mep / prevMep : 1;
    const when = addMonths(startDate, t);

    const next = emptyBuckets();
    next.cedear = buckets.cedear * usMonthly * mepGrowth; // retorno USA × crawl del MEP
    next.usd = buckets.usd * mepGrowth;                   // dólar quieto, sigue al MEP
    next.fondo = buckets.fondo * arsMonthly;
    next.ars = buckets.ars * arsMonthly;
    next.bono = buckets.bono * arsMonthly;                // carry

    // Vencido el bono, el capital queda en liquidez.
    if (maturity && when > maturity) {
      if (next.bono > 0) {
        next.ars += next.bono;
        next.bono = 0;
      }
      bondMatured = true;
    }

    // Mix objetivo: interpola lineal del mix de hoy al objetivo.
    const glide = emptyBuckets();
    for (const k of KINDS) glide[k] = w0[k] + (target[k] - w0[k]) * (t / months);

    // Un bono vencido no se repone: su peso se reparte entre el resto, o el
    // aporte volvería a llenar una clase que ya no existe.
    if (bondMatured && glide.bono > 0) {
      const freed = glide.bono;
      glide.bono = 0;
      const rest = KINDS.reduce((acc, k) => acc + glide[k], 0);
      if (rest > 0) for (const k of KINDS) glide[k] += (glide[k] / rest) * freed;
      else glide.ars = 1;
    }

    const aporteArs = settings.saveUsd * mep;
    const totalAfter = totalOf(next) + aporteArs;

    if (settings.rebalance) {
      for (const k of KINDS) next[k] = glide[k] * totalAfter;
    } else {
      // Sin rebalance, sólo el aporte nuevo empuja hacia el objetivo:
      // va a lo que está por debajo del mix, proporcional al faltante.
      const shortfall = emptyBuckets();
      let sum = 0;
      for (const k of KINDS) {
        shortfall[k] = Math.max(0, glide[k] * totalAfter - next[k]);
        sum += shortfall[k];
      }
      for (const k of KINDS) {
        const share = sum > 0 ? shortfall[k] / sum : glide[k];
        next[k] += aporteArs * share;
      }
    }

    buckets = next;
    prevMep = mep;

    const totalArs = totalOf(buckets);
    series.push({
      month: t,
      label: when.toLocaleDateString('es-AR', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      mep,
      buckets: { ...buckets },
      totalArs,
      totalUsd: mep > 0 ? totalArs / mep : 0,
    });
  }

  const last = series[series.length - 1];
  const contributedUsd = settings.saveUsd * months;

  return {
    spec,
    series,
    startArs,
    startUsd,
    endArs: last.totalArs,
    endUsd: last.totalUsd,
    contributedUsd,
    gainUsd: last.totalUsd - startUsd - contributedUsd,
    endWeights: weightsOf(last.buckets),
  };
}

export function runAll(input: EngineInput): ScenarioResult[] {
  return scenarioSpecs(input.settings.usAnn).map((spec) => runScenario(input, spec));
}
