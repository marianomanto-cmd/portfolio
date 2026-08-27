import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/queries';
import { KINDS, type Kind } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    return NextResponse.json(await getSettings());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo leer la configuración.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  const rawWeights = (body.targetWeights ?? {}) as Record<string, unknown>;
  const targetWeights: Partial<Record<Kind, number>> = {};
  for (const k of KINDS) {
    const n = Number(rawWeights[k]);
    if (Number.isFinite(n) && n > 0) targetWeights[k] = n;
  }

  try {
    await saveSettings({
      saveUsd: clamp(body.saveUsd, 0, 1_000_000, 3000),
      mep: clamp(body.mep, 1, 1_000_000, 1540),
      months: Math.round(clamp(body.months, 1, 120, 16)),
      usAnn: clamp(body.usAnn, -90, 200, 10),
      arsAnn: clamp(body.arsAnn, -90, 500, 30),
      rebalance: Boolean(body.rebalance),
      targetWeights,
    });
    return NextResponse.json(await getSettings());
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo guardar.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
