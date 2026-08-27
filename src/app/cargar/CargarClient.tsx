'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui';
import { rowsFromCsv } from '@/lib/csv';
import { fmtArs } from '@/lib/format';
import type { Instrument, ParsedRow, Platform, Source } from '@/lib/types';

interface Props {
  catalog: Instrument[];
  defaultDate: string;
  defaultMep: number | null;
  photoEnabled: boolean;
}

const SOURCES: { id: Source; label: string }[] = [
  { id: 'mixed', label: 'FIMA + broker' },
  { id: 'fima', label: 'Sólo FIMA' },
  { id: 'broker', label: 'Sólo broker' },
];

/** Achica la foto antes de subirla: el modelo no necesita 12 megapíxeles. */
async function downscale(file: File, maxSide = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}

export default function CargarClient({ catalog, defaultDate, defaultMep, photoEnabled }: Props) {
  const router = useRouter();
  const [takenAt, setTakenAt] = useState(defaultDate);
  const [mep, setMep] = useState(defaultMep ? String(defaultMep) : '');
  const [source, setSource] = useState<Source>('mixed');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const csvInput = useRef<HTMLInputElement>(null);

  const total = useMemo(() => rows.reduce((a, r) => a + (r.arsValue || 0), 0), [rows]);
  const unmapped = rows.filter((r) => !r.instrumentId).length;
  const mepNum = Number(mep);
  const canSave =
    rows.length > 0 && unmapped === 0 && Number.isFinite(mepNum) && mepNum > 0 && !busy;

  const update = (i: number, patch: Partial<ParsedRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function onPhoto(file: File) {
    setError(null);
    setBusy('Leyendo la foto…');
    try {
      const image = await downscale(file);
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo leer la foto.');

      setRows((prev) => [...prev, ...(data.rows as ParsedRow[])]);
      if (data.mep && !mep) setMep(String(data.mep));
      if (data.takenAt) setTakenAt(data.takenAt as string);
      if (!data.rows?.length) setError('No se reconoció ninguna fila en la imagen.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falló el parseo.');
    } finally {
      setBusy(null);
      if (photoInput.current) photoInput.current.value = '';
    }
  }

  async function onCsv(file: File) {
    setError(null);
    try {
      const parsed = rowsFromCsv(await file.text(), catalog);
      if (parsed.length === 0) setError('El CSV no tenía filas reconocibles.');
      setRows((prev) => [...prev, ...parsed]);
    } catch {
      setError('No se pudo leer el CSV.');
    } finally {
      if (csvInput.current) csvInput.current.value = '';
    }
  }

  function addManual() {
    const first = catalog[0];
    setRows((prev) => [
      ...prev,
      {
        instrumentId: first?.id ?? null,
        rawLabel: first?.name ?? '',
        platform: first?.platform ?? 'broker',
        arsValue: 0,
        quantity: null,
        confidence: 'alta',
      },
    ]);
  }

  async function save() {
    setError(null);
    setBusy('Grabando…');
    try {
      const res = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ takenAt, mep: mepNum, source, notes: notes || null, positions: rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo grabar.');
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo grabar.');
      setBusy(null);
    }
  }

  const field = 'w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-mut';

  return (
    <div className="space-y-3 pb-4">
      <Card>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-mut">Fecha del corte</span>
            <input type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-mut">MEP</span>
            <input
              type="number" inputMode="decimal" value={mep} placeholder="1540"
              onChange={(e) => setMep(e.target.value)} className={`${field} tnum`}
            />
          </label>
        </div>

        <div className="mt-3 flex gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id} type="button" onClick={() => setSource(s.id)}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs ${
                source === s.id ? 'border-accent text-accent' : 'border-line text-mut'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold">De dónde salen las filas</h2>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button" disabled={!photoEnabled || Boolean(busy)}
            onClick={() => photoInput.current?.click()}
            className="rounded-lg border border-line py-2 text-xs disabled:opacity-40"
          >
            Foto
          </button>
          <button
            type="button" disabled={Boolean(busy)}
            onClick={() => csvInput.current?.click()}
            className="rounded-lg border border-line py-2 text-xs disabled:opacity-40"
          >
            CSV
          </button>
          <button
            type="button" disabled={Boolean(busy)} onClick={addManual}
            className="rounded-lg border border-line py-2 text-xs disabled:opacity-40"
          >
            A mano
          </button>
        </div>
        {!photoEnabled ? (
          <p className="mt-2 text-xs text-mut">
            La foto necesita <code className="text-white">ANTHROPIC_API_KEY</code> en el servidor.
          </p>
        ) : null}
        <input
          ref={photoInput} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onPhoto(f); }}
        />
        <input
          ref={csvInput} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCsv(f); }}
        />
      </Card>

      {busy ? <p className="px-1 text-sm text-accent">{busy}</p> : null}
      {error ? <p className="px-1 text-sm text-down">{error}</p> : null}

      {rows.length > 0 ? (
        <Card>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold">Filas ({rows.length})</h2>
            <span className="tnum text-sm text-mut">{fmtArs(total)}</span>
          </div>

          {unmapped > 0 ? (
            <p className="mb-3 rounded-lg border border-accent/40 px-3 py-2 text-xs text-accent">
              {unmapped} fila{unmapped > 1 ? 's' : ''} sin especie. Elegila del catálogo o borrala;
              no se graba nada fuera del catálogo.
            </p>
          ) : null}

          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className={`rounded-xl border p-3 ${r.instrumentId ? 'border-line' : 'border-accent/50'}`}>
                {r.rawLabel && r.rawLabel !== r.instrumentId ? (
                  <p className="mb-2 truncate text-xs text-mut">Leído: “{r.rawLabel}”</p>
                ) : null}

                <select
                  value={r.instrumentId ?? ''}
                  onChange={(e) => {
                    const inst = catalog.find((c) => c.id === e.target.value);
                    update(i, {
                      instrumentId: inst?.id ?? null,
                      platform: inst?.platform ?? r.platform,
                    });
                  }}
                  className={field}
                >
                  <option value="">— elegí la especie —</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <select
                    value={r.platform}
                    onChange={(e) => update(i, { platform: e.target.value as Platform })}
                    className={field}
                  >
                    <option value="fima">FIMA</option>
                    <option value="broker">Broker</option>
                  </select>
                  <input
                    type="number" inputMode="decimal" placeholder="ARS" value={r.arsValue || ''}
                    onChange={(e) => update(i, { arsValue: Number(e.target.value) })}
                    className={`${field} tnum col-span-2`}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <input
                    type="number" inputMode="decimal" placeholder="cantidad (opcional)"
                    value={r.quantity ?? ''}
                    onChange={(e) => update(i, { quantity: e.target.value ? Number(e.target.value) : null })}
                    className={`${field} tnum mr-2`}
                  />
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs text-mut"
                  >
                    Borrar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <label className="mt-3 block">
            <span className="mb-1 block text-xs text-mut">Nota (opcional)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
          </label>

          <button
            type="button" disabled={!canSave} onClick={() => void save()}
            className="mt-4 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-ink disabled:opacity-40"
          >
            Grabar corte
          </button>
        </Card>
      ) : null}
    </div>
  );
}
