import { NextResponse } from 'next/server';
import { bucketsFromPositions, runAll, totalOf, weightsOf } from '@/lib/engine';
import { getMep } from '@/lib/market';
import { getInstruments, getLatestBook, getSettings, saveMemo } from '@/lib/queries';
import { KINDS } from '@/lib/types';
import { hasClaude, writeMemo } from '@/lib/claude';
import { type Capability, selectSkills } from '@/lib/skills';

export const runtime = 'nodejs';
export const maxDuration = 120;

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Memo del asesor. User-initiated: sólo corre cuando el dueño aprieta el botón.
 * El contexto lleva los números YA calculados por el motor; el modelo narra.
 */
export async function POST() {
  if (!hasClaude()) {
    return NextResponse.json(
      { error: 'Falta ANTHROPIC_API_KEY en el servidor.' },
      { status: 503 },
    );
  }

  const [book, settings, catalog] = await Promise.all([
    getLatestBook(),
    getSettings(),
    getInstruments(),
  ]);

  if (!book) {
    return NextResponse.json(
      { error: 'No hay ningún corte cargado todavía.' },
      { status: 400 },
    );
  }

  const { snapshot, positions } = book;
  const buckets = bucketsFromPositions(positions);
  const totalArs = totalOf(buckets);
  const weights = weightsOf(buckets);

  // El bono más cercano a vencer marca cuándo esa clase pasa a liquidez.
  const bondMaturity = positions
    .map((p) => catalog.find((i) => i.id === p.instrumentId)?.maturity)
    .filter((m): m is string => Boolean(m))
    .sort()[0] ?? null;

  const results = runAll({
    positions,
    startMep: snapshot.mep,
    startDate: snapshot.takenAt,
    settings,
    bondMaturity,
  });

  const mepHoy = await getMep();

  const context = {
    aviso: 'Los números de "motor" ya están calculados. Citalos tal cual; no los recalcules.',
    corte: {
      fecha: snapshot.takenAt,
      origen: snapshot.source,
      mep_del_corte: snapshot.mep,
      mep_hoy: mepHoy.ok ? round(mepHoy.promedio ?? 0) : 'n/d',
      total_ars: round(totalArs),
      total_usd: round(snapshot.mep > 0 ? totalArs / snapshot.mep : 0),
    },
    composicion: KINDS.filter((k) => buckets[k] > 0).map((k) => ({
      clase: k,
      ars: round(buckets[k]),
      peso_pct: round(weights[k] * 100),
    })),
    posiciones: positions.map((p) => ({
      especie: p.name,
      clase: p.kind,
      plataforma: p.platform,
      ars: round(p.arsValue),
    })),
    supuestos: {
      aporte_usd_por_mes: settings.saveUsd,
      horizonte_meses: settings.months,
      retorno_usa_anual_base_pct: settings.usAnn,
      tasa_pesos_anual_pct: settings.arsAnn,
      rebalanceo: settings.rebalance,
      vencimiento_bono: bondMaturity ?? 'no hay bono en cartera',
    },
    motor: results.map((r) => ({
      escenario: r.spec.id,
      supuesto: r.spec.note,
      usd_inicial: round(r.startUsd),
      aportes_usd: round(r.contributedUsd),
      usd_final: round(r.endUsd),
      resultado_de_mercado_usd: round(r.gainUsd),
      mix_final_pct: Object.fromEntries(
        KINDS.filter((k) => r.endWeights[k] > 0.001).map((k) => [k, round(r.endWeights[k] * 100)]),
      ),
    })),
  };

  // Qué datos hay realmente. Un skill que pide algo que no está no se inyecta,
  // así el modelo nunca recibe instrucciones sin insumos para cumplirlas.
  const available: Capability[] = ['book', 'engine'];
  const skills = selectSkills(available);

  try {
    const body = await writeMemo(JSON.stringify(context, null, 2), skills);
    const memo = await saveMemo(body, snapshot.id);
    return NextResponse.json({ ...memo, skills: skills.map((s) => s.name) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo generar el memo.';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
