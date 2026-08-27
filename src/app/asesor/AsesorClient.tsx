'use client';

import { useState } from 'react';
import Memo from './Memo';
import { Card, Empty } from '@/components/ui';
import { fmtFecha } from '@/lib/format';
import type { Memo as MemoType } from '@/lib/types';

interface Props {
  initialMemos: MemoType[];
  canGenerate: boolean;
  snapshotDate: string | null;
}

export default function AsesorClient({ initialMemos, canGenerate, snapshotDate }: Props) {
  const [memos, setMemos] = useState(initialMemos);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/memo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'No se pudo generar el memo.');
      setMemos((prev) => [data as MemoType, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el memo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 pb-4">
      <button
        type="button"
        onClick={() => void generate()}
        disabled={!canGenerate || busy}
        className="mt-3 w-full rounded-xl bg-accent py-3 text-sm font-semibold text-ink disabled:opacity-40"
      >
        {busy ? 'Pensando…' : 'Pedir memo'}
      </button>
      <p className="px-1 text-xs text-mut">
        {snapshotDate
          ? `Sobre el corte del ${fmtFecha(snapshotDate)} y los números del motor. Nada corre solo: se genera cuando apretás.`
          : 'Se genera cuando apretás. Nada corre solo.'}
      </p>

      {error ? <p className="px-1 text-sm text-down">{error}</p> : null}

      {memos.length === 0 ? (
        <Card><Empty>Todavía no pediste ningún memo.</Empty></Card>
      ) : (
        memos.map((m) => (
          <Card key={m.id}>
            <p className="mb-2 text-xs text-mut">{fmtFecha(m.createdAt)}</p>
            <Memo body={m.body} />
          </Card>
        ))
      )}
    </div>
  );
}
