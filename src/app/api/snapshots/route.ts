import { NextResponse } from 'next/server';
import { createSnapshot, type NewPosition } from '@/lib/queries';
import type { Platform, Source } from '@/lib/types';

export const runtime = 'nodejs';

const SOURCES: Source[] = ['fima', 'broker', 'mixed'];

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Body inválido.' }, { status: 400 });
  }

  const takenAt = String(body.takenAt ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(takenAt)) {
    return NextResponse.json({ error: 'Fecha inválida.' }, { status: 400 });
  }

  const mep = Number(body.mep);
  if (!Number.isFinite(mep) || mep <= 0) {
    return NextResponse.json({ error: 'El MEP del corte es obligatorio.' }, { status: 400 });
  }

  const source = SOURCES.includes(body.source as Source) ? (body.source as Source) : 'mixed';
  const rawRows = Array.isArray(body.positions) ? (body.positions as Record<string, unknown>[]) : [];

  const positions: NewPosition[] = [];
  for (const r of rawRows) {
    const instrumentId = String(r.instrumentId ?? '');
    const arsValue = Number(r.arsValue);
    if (!instrumentId || !Number.isFinite(arsValue) || arsValue <= 0) continue;
    const qty = Number(r.quantity);
    positions.push({
      instrumentId,
      platform: (r.platform === 'fima' ? 'fima' : 'broker') as Platform,
      arsValue,
      quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
    });
  }

  if (positions.length === 0) {
    return NextResponse.json({ error: 'No hay ninguna fila válida para grabar.' }, { status: 400 });
  }

  try {
    const id = await createSnapshot({
      takenAt,
      mep,
      source,
      notes: body.notes ? String(body.notes) : null,
      positions,
    });
    return NextResponse.json({ id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'No se pudo grabar el corte.';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
