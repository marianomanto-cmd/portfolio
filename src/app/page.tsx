import Link from 'next/link';
import { Card, Empty, PageTitle, Row, SetupNotice } from '@/components/ui';
import { hasDb } from '@/lib/db';
import { bucketsFromPositions, totalOf, weightsOf } from '@/lib/engine';
import { fmtArs, fmtFecha, fmtNum, fmtPct, fmtUsd } from '@/lib/format';
import { getMep, getUnderlyings } from '@/lib/market';
import { getInstruments, getLatestBook } from '@/lib/queries';
import { KIND_LABEL, KINDS, PLATFORM_LABEL, type Platform } from '@/lib/types';

// Lee la DB en cada request: nada de prerender en build (donde no hay env vars).
export const dynamic = 'force-dynamic';

const KIND_COLOR: Record<string, string> = {
  fondo: 'bg-sky-400',
  bono: 'bg-violet-400',
  cedear: 'bg-emerald-400',
  usd: 'bg-amber-400',
  ars: 'bg-slate-400',
};

export default async function LibroPage() {
  if (!hasDb()) {
    return (
      <>
        <PageTitle title="Libro" />
        <SetupNotice what="la base">
          <p>
            No hay <code className="text-white">DATABASE_URL</code>. Cargala en las variables de
            entorno del proyecto en Vercel, apuntando al Transaction pooler (puerto 6543) del
            proyecto de Supabase, y volvé a deployar.
          </p>
        </SetupNotice>
      </>
    );
  }

  const [book, catalog, mep] = await Promise.all([
    getLatestBook(),
    getInstruments(),
    getMep(),
  ]);

  if (!book) {
    return (
      <>
        <PageTitle title="Libro" />
        <Card>
          <Empty>
            Todavía no hay ningún corte.{' '}
            <Link href="/cargar" className="text-accent underline underline-offset-4">
              Cargá el primero
            </Link>
            .
          </Empty>
        </Card>
      </>
    );
  }

  const { snapshot, positions } = book;
  const buckets = bucketsFromPositions(positions);
  const totalArs = totalOf(buckets);
  const weights = weightsOf(buckets);
  const totalUsd = snapshot.mep > 0 ? totalArs / snapshot.mep : 0;

  const byPlatform = (p: Platform) =>
    positions.filter((x) => x.platform === p).reduce((a, x) => a + x.arsValue, 0);

  // Sólo pedimos a Yahoo los cedears que realmente están en el libro.
  const heldSymbols = [
    ...new Set(
      positions
        .map((p) => catalog.find((i) => i.id === p.instrumentId)?.yahooSymbol)
        .filter((s): s is string => Boolean(s)),
    ),
  ];
  const underlyings = heldSymbols.length ? await getUnderlyings(heldSymbols) : [];

  const mepDelta =
    mep.ok && mep.promedio && snapshot.mep > 0
      ? ((mep.promedio - snapshot.mep) / snapshot.mep) * 100
      : null;

  return (
    <>
      <PageTitle
        title="Libro"
        sub={`Corte del ${fmtFecha(snapshot.takenAt)} · ${
          snapshot.source === 'mixed' ? 'FIMA + broker' : PLATFORM_LABEL[snapshot.source]
        }`}
      />

      <Card>
        <p className="text-xs uppercase tracking-wide text-mut">Total</p>
        <p className="tnum mt-1 text-3xl font-semibold">{fmtArs(totalArs)}</p>
        <p className="tnum mt-1 text-lg text-mut">
          {fmtUsd(totalUsd)} <span className="text-xs">al MEP {fmtNum(snapshot.mep)}</span>
        </p>

        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-line">
          {KINDS.filter((k) => weights[k] > 0).map((k) => (
            <div
              key={k}
              className={KIND_COLOR[k]}
              style={{ width: `${weights[k] * 100}%` }}
              title={`${KIND_LABEL[k]} ${(weights[k] * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="mt-3 space-y-0.5">
          {KINDS.filter((k) => buckets[k] > 0).map((k) => (
            <Row
              key={k}
              label={
                <span className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${KIND_COLOR[k]}`} />
                  {KIND_LABEL[k]}
                </span>
              }
              value={fmtArs(buckets[k])}
              hint={`${(weights[k] * 100).toFixed(0)}%`}
            />
          ))}
        </div>
      </Card>

      <Card className="mt-3">
        <h2 className="mb-2 text-sm font-semibold">Cuentas</h2>
        <p className="mb-2 text-xs text-mut">Separadas a propósito. No se unifican.</p>
        <Row label="FIMA" value={fmtArs(byPlatform('fima'))} />
        <Row label="Broker" value={fmtArs(byPlatform('broker'))} />
      </Card>

      <Card className="mt-3">
        <h2 className="mb-2 text-sm font-semibold">MEP</h2>
        <Row label="Del corte" value={fmtNum(snapshot.mep)} />
        <Row
          label="Hoy (dolarapi)"
          value={mep.ok ? fmtNum(mep.promedio) : 'n/d'}
          hint={mepDelta != null ? fmtPct(mepDelta) : undefined}
        />
        {!mep.ok ? (
          <p className="mt-2 text-xs text-mut">dolarapi no respondió. El libro usa el MEP del corte.</p>
        ) : null}
      </Card>

      {underlyings.length ? (
        <Card className="mt-3">
          <h2 className="mb-2 text-sm font-semibold">Underlyings</h2>
          {underlyings.map((u) => (
            <Row
              key={u.symbol}
              label={u.symbol}
              value={u.ok ? `US$ ${fmtNum(u.price)}` : 'n/d'}
              hint={
                u.changePct != null ? (
                  <span className={u.changePct >= 0 ? 'text-up' : 'text-down'}>
                    {fmtPct(u.changePct)}
                  </span>
                ) : undefined
              }
            />
          ))}
          <p className="mt-2 text-xs text-mut">Precio del subyacente en Yahoo, no del cedear.</p>
        </Card>
      ) : null}

      <Card className="mt-3 mb-4">
        <h2 className="mb-2 text-sm font-semibold">Posiciones</h2>
        {positions.length === 0 ? (
          <Empty>El corte no tiene filas.</Empty>
        ) : (
          positions.map((p) => (
            <Row
              key={`${p.instrumentId}-${p.platform}`}
              label={
                <>
                  {p.name}
                  <span className="ml-2 text-xs text-mut">{PLATFORM_LABEL[p.platform]}</span>
                </>
              }
              value={fmtArs(p.arsValue)}
              hint={p.quantity != null ? `${fmtNum(p.quantity)} u.` : undefined}
            />
          ))
        )}
      </Card>

      {snapshot.notes ? (
        <p className="mb-4 px-1 text-xs text-mut">Nota del corte: {snapshot.notes}</p>
      ) : null}
    </>
  );
}
